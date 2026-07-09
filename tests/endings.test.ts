// V3 结局引擎（evaluateEndings）：单判定表 + 阈值（数据驱动 endingTriggers.ts）。
import { describe, it, expect } from 'vitest';
import { createRng } from '../src/core/rng';
import { createNewGame } from '../src/core/createNewGame';
import { evaluateEndings } from '../src/core/endingEngine';
import type { GameState } from '../src/types';
import type { Loan } from '../src/types/actions';

function freshGame(): GameState {
  const rng = createRng(42);
  return createNewGame(
    { storeType: '奶茶饮品', locationType: '学校门口', decorationLevel: 'clean', storeName: '测试店', seed: 42 },
    rng,
  );
}

function predatoryLoan(overdueDays: number): Loan {
  return {
    id: 'lp',
    channel: 'predatory',
    principal: 100000,
    apr: 0.36,
    balance: 100000,
    accruedInterest: 0,
    startDate: 1,
    overdueDays,
  };
}

describe('V3 结局触发（单判定表）', () => {
  it('全新存档不触发任何结局', () => {
    expect(evaluateEndings(freshGame())).toBeNull();
  });

  it('连锁帝国：≥3 店 且 峰值净资 ≥ 600 万（同口径）', () => {
    const s = freshGame();
    s.storeCount = 3;
    s.netWorth = 5_000_000; // 当前净资低于阈值
    s.peakNetWorth = 6_000_000; // 峰值曾达标
    expect(evaluateEndings(s)?.def.id).toBe('chain_empire');
  });

  it('连锁帝国门槛不足（仅 2 店）不触发', () => {
    const s = freshGame();
    s.storeCount = 2;
    s.peakNetWorth = 6_000_000;
    expect(evaluateEndings(s)).toBeNull();
  });

  it('财务自由：峰值净资 ≥ 1200 万', () => {
    const s = freshGame();
    s.peakNetWorth = 12_000_000;
    expect(evaluateEndings(s)?.def.id).toBe('financial_freedom');
  });

  it('破产倒闭：现金连续为负 ≥ 5 天', () => {
    const s = freshGame();
    s.cashNegativeStreak = 5;
    expect(evaluateEndings(s)?.def.id).toBe('suspended');
  });

  it('高利贷跑路：predatory 逾期 ≥ 5 天', () => {
    const s = freshGame();
    s.loans = [predatoryLoan(5)];
    expect(evaluateEndings(s)?.def.id).toBe('debt_trap');
  });

  it('房东的胜利：landlordAttention ≥ 90', () => {
    const s = freshGame();
    s.hiddenLines.landlordAttention = 95;
    expect(evaluateEndings(s)?.def.id).toBe('landlord_win');
  });

  it('红过也烂过：promoHype ≥ 80 且 customerTrust ≤ 30', () => {
    const s = freshGame();
    s.hiddenLines.promoHype = 85;
    s.hiddenLines.customerTrust = 30;
    expect(evaluateEndings(s)?.def.id).toBe('viral_failure');
  });

  it('菜单还在东西没了：supplyRisk ≥ 80 且 customerTrust ≤ 25', () => {
    const s = freshGame();
    s.hiddenLines.supplyRisk = 85;
    s.hiddenLines.customerTrust = 25;
    expect(evaluateEndings(s)?.def.id).toBe('menu_without_supply');
  });

  it('老板一个人的店：day>30 且全员 owner', () => {
    const s = freshGame();
    s.day = 31;
    s.stores = s.stores.map((st) => ({ ...st, staffTier: 'owner' }));
    expect(evaluateEndings(s)?.def.id).toBe('one_person_shop');
  });
});

describe('V3 结局门控（首次触发，已解锁不再弹）', () => {
  it('已解锁的结局不再触发，且不修改 state', () => {
    const s = freshGame();
    s.storeCount = 3;
    s.netWorth = 5_000_000;
    s.peakNetWorth = 6_000_000; // 否则会触发 chain_empire
    s.endingsUnlocked = ['chain_empire'];
    const before = s.endingsUnlocked.slice();
    const e = evaluateEndings(s);
    expect(e).toBeNull();
    expect(s.endingsUnlocked).toEqual(before); // 纯函数，未改 state
  });

  it('evaluateEndings 为纯函数：不修改入参', () => {
    const c = freshGame();
    c.peakNetWorth = 12_000_000;
    const snapshot = JSON.stringify(c);
    evaluateEndings(c);
    expect(JSON.stringify(c)).toBe(snapshot);
  });
});
