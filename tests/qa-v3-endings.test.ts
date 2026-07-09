// QA 独立验证：结局"一句话无页"bug 是否真修（架构 §5.8 / §8.1）
// 边界精确触发：破产连续≥5天；连锁帝国=分店≥3 且 峰值净资≥600万；
// 财务自由=峰值净资≥1200万（纯看资产，无暗线门槛）；高利贷跑路=overdue≥5；主动关店=decent_exit。
import { describe, it, expect } from 'vitest';
import { evaluateEndings } from '../src/core/endingEngine';
import { createNewGame } from '../src/core/createNewGame';
import { createRng } from '../src/core/rng';
import type { GameState, HiddenLines } from '../src/types';
import type { Loan } from '../src/types/actions';

function fresh(): GameState {
  return createNewGame(
    { storeType: '奶茶饮品', locationType: '学校门口', decorationLevel: 'clean', storeName: 'QA结局店', seed: 3 },
    createRng(3),
  );
}

describe('破产倒闭：cash<0 连续≥5天（不是3/4）', () => {
  it('连续4天不触发', () => {
    const s = fresh();
    s.cashNegativeStreak = 4;
    expect(evaluateEndings(s)).toBeNull();
  });
  it('连续5天触发 suspended', () => {
    const s = fresh();
    s.cashNegativeStreak = 5;
    const r = evaluateEndings(s);
    expect(r?.def.id).toBe('suspended');
    expect(r?.tone).toBe('lose');
  });
});

describe('连锁帝国：分店≥3 且 峰值净资≥600万', () => {
  it('当前净资不足但峰值曾达600万 → 应触发（峰值口径）', () => {
    const s = fresh();
    s.storeCount = 3;
    s.peakNetWorth = 6_500_000; // 峰值曾达 650万
    s.netWorth = 5_500_000; // 当前回落到 550万
    const r = evaluateEndings(s);
    expect(r?.def.id).toBe('chain_empire');
    expect(r?.tone).toBe('win');
  });
  it('控制组：当前净资也达600万 → 触发', () => {
    const s = fresh();
    s.storeCount = 3;
    s.peakNetWorth = 6_500_000;
    s.netWorth = 6_500_000;
    expect(evaluateEndings(s)?.def.id).toBe('chain_empire');
  });
  it('分店不足（2店）即使净资达标也不触发', () => {
    const s = fresh();
    s.storeCount = 2;
    s.peakNetWorth = 6_500_000;
    s.netWorth = 6_500_000;
    expect(evaluateEndings(s)).toBeNull();
  });
});

describe('财务自由：峰值净资≥1200万（纯看资产，无暗线门槛）', () => {
  it('峰值达标但暗线全崩 → 仍触发（无暗线健康门槛）', () => {
    const s = fresh();
    s.peakNetWorth = 12_500_000;
    const worst: HiddenLines = {
      landlordAttention: 100,
      employeePressure: 100,
      customerTrust: 0,
      priceControversy: 100,
      promoHype: 100,
      supplyRisk: 100,
      platformDependence: 100,
      hygieneRisk: 100,
    };
    s.hiddenLines = worst;
    const r = evaluateEndings(s);
    expect(r?.def.id).toBe('financial_freedom');
    expect(r?.tone).toBe('win');
  });
  it('边界：峰值 1199万不触发，1200万触发', () => {
    const a = fresh();
    a.peakNetWorth = 11_999_999;
    expect(evaluateEndings(a)).toBeNull();
    const b = fresh();
    b.peakNetWorth = 12_000_000;
    expect(evaluateEndings(b)?.def.id).toBe('financial_freedom');
  });
});

describe('高利贷跑路：predatory overdue≥5', () => {
  const mk = (od: number): Loan => ({
    id: 'p',
    channel: 'predatory',
    principal: 100000,
    apr: 0.36,
    balance: 100000,
    accruedInterest: 0,
    startDate: 1,
    overdueDays: od,
  });
  it('overdue=4 不触发，overdue=5 触发 debt_trap', () => {
    const a = fresh();
    a.loans = [mk(4)];
    expect(evaluateEndings(a)).toBeNull();
    const b = fresh();
    b.loans = [mk(5)];
    expect(evaluateEndings(b)?.def.id).toBe('debt_trap');
  });
  it('银行/民间逾期不触发 debt_trap', () => {
    const bank: Loan = {
      id: 'b',
      channel: 'bank',
      principal: 100000,
      apr: 0.04,
      balance: 100000,
      accruedInterest: 0,
      startDate: 1,
      overdueDays: 9,
    };
    const s = fresh();
    s.loans = [bank];
    expect(evaluateEndings(s)).toBeNull();
  });
});

describe('主动关店：close_shop → decent_exit', () => {
  it('activeEnding=decent_exit → 返回 decent_exit（lose）', () => {
    const s = fresh();
    s.activeEnding = 'decent_exit';
    const r = evaluateEndings(s);
    expect(r?.def.id).toBe('decent_exit');
    expect(r?.tone).toBe('lose');
  });
});

describe('门控：已解锁结局不再重复弹出', () => {
  it('chain_empire 已解锁后同条件返回 null', () => {
    const s = fresh();
    s.storeCount = 3;
    s.peakNetWorth = 6_500_000;
    s.netWorth = 6_500_000;
    s.endingsUnlocked = ['chain_empire'];
    expect(evaluateEndings(s)).toBeNull();
  });
});
