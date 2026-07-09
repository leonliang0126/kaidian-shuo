// V3-7 结局判定引擎单元测试（架构 §7）：单一判定表、阈值门控、首触不重复。
import { describe, it, expect } from 'vitest';
import { evaluateEndings } from '../src/core/endingEngine';
import { createRng } from '../src/core/rng';
import { createNewGame } from '../src/core/createNewGame';
import {
  CASH_NEGATIVE_STREAK_BANKRUPTCY,
  CHAIN_EMPIRE_STORES,
  CHAIN_EMPIRE_NET_WORTH,
  FINANCIAL_FREEDOM_NET_WORTH,
  PREDATORY_OVERDUE_DEBT_RUN,
} from '../src/data/endingTriggers';
import type { GameState } from '../src/types';

function freshGame(): GameState {
  return createNewGame(
    { storeType: '奶茶饮品', locationType: '学校门口', decorationLevel: 'clean', storeName: '结局店', seed: 1 },
    createRng(1),
  );
}

describe('V3 胜利结局', () => {
  it('连锁帝国：≥3 店 且 峰值净资 ≥600万（同口径，当前净资可低于阈值）', () => {
    const s = freshGame();
    s.storeCount = CHAIN_EMPIRE_STORES;
    s.netWorth = CHAIN_EMPIRE_NET_WORTH - 1_000_000; // 当前净资低于阈值
    s.peakNetWorth = CHAIN_EMPIRE_NET_WORTH; // 峰值曾达标
    const r = evaluateEndings(s);
    expect(r?.def.id).toBe('chain_empire');
    expect(r?.tone).toBe('win');
  });

  it('财务自由：峰值净资 ≥1200万', () => {
    const s = freshGame();
    s.peakNetWorth = FINANCIAL_FREEDOM_NET_WORTH;
    const r = evaluateEndings(s);
    expect(r?.def.id).toBe('financial_freedom');
    expect(r?.tone).toBe('win');
  });
});

describe('V3 失败结局', () => {
  it('破产倒闭：现金连续为负 ≥5 天', () => {
    const s = freshGame();
    s.cashNegativeStreak = CASH_NEGATIVE_STREAK_BANKRUPTCY;
    const r = evaluateEndings(s);
    expect(r?.def.id).toBe('suspended');
    expect(r?.tone).toBe('lose');
  });

  it('高利贷跑路：predatory 逾期 ≥5 天', () => {
    const s = freshGame();
    s.loans = [{ id: 'p', channel: 'predatory', principal: 10000, apr: 0.36, balance: 10000, accruedInterest: 0, startDate: 1, overdueDays: PREDATORY_OVERDUE_DEBT_RUN } as any];
    const r = evaluateEndings(s);
    expect(r?.def.id).toBe('debt_trap');
    expect(r?.tone).toBe('lose');
  });
});

describe('遗留失败结局', () => {
  it('房东收割：landlordAttention ≥90', () => {
    const s = freshGame();
    s.hiddenLines.landlordAttention = 90;
    expect(evaluateEndings(s)?.def.id).toBe('landlord_win');
  });

  it('虚火翻车：promoHype ≥80 且 customerTrust ≤30', () => {
    const s = freshGame();
    s.hiddenLines.promoHype = 80;
    s.hiddenLines.customerTrust = 30;
    expect(evaluateEndings(s)?.def.id).toBe('viral_failure');
  });

  it('无供应链的菜单：supplyRisk ≥80 且 customerTrust ≤25', () => {
    const s = freshGame();
    s.hiddenLines.supplyRisk = 80;
    s.hiddenLines.customerTrust = 25;
    expect(evaluateEndings(s)?.def.id).toBe('menu_without_supply');
  });

  it('一人店：day>30 且所有店 staffTier=owner', () => {
    const s = freshGame();
    s.day = 31;
    s.stores = s.stores.map((st) => ({ ...st, staffTier: 'owner' as const }));
    expect(evaluateEndings(s)?.def.id).toBe('one_person_shop');
  });
});

describe('门控与显式触发', () => {
  it('已解锁的结局不重复触发', () => {
    const s = freshGame();
    s.cashNegativeStreak = CASH_NEGATIVE_STREAK_BANKRUPTCY;
    s.endingsUnlocked = ['suspended'];
    expect(evaluateEndings(s)).toBeNull();
  });

  it('activeEnding 显式触发优先', () => {
    const s = freshGame();
    s.activeEnding = 'decent_exit';
    const r = evaluateEndings(s);
    expect(r?.def.id).toBe('decent_exit');
    expect(r?.tone).toBe('lose');
  });

  it('无触发条件：返回 null', () => {
    expect(evaluateEndings(freshGame())).toBeNull();
  });
});
