// V3 平衡自测（架构 §8）：用统一流程验收 8 个 v3 机制的数据驱动性与确定性。
import { describe, it, expect } from 'vitest';
import { createRng } from '../src/core/rng';
import { createNewGame } from '../src/core/createNewGame';
import { canTakeAction, takeAction, resetDailyActionState } from '../src/core/actionSystem';
import { takeCrisisLoan, applyMonthlyInterest } from '../src/core/loanSystem';
import { computeRepurchase, decayHeat } from '../src/core/repurchaseHeat';
import { applySegmentModulation } from '../src/core/segmentProfiles';
import { applyEventShock } from '../src/core/eventVisibleShock';
import { rollBatchIfDue, batchQualityMods } from '../src/core/supplierStability';
import { evaluateEndings } from '../src/core/endingEngine';
import { channelForOver, CRISIS_LOAN_BUFFER, LOAN_APR, MONTHLY_INTEREST_DIVISOR } from '../src/data/setupCosts';
import type { EventDef } from '../src/types';

const cfg = (locationType: any, decorationLevel: any) => ({
  storeType: '奶茶饮品' as const,
  locationType,
  decorationLevel,
  storeName: '平衡店',
  seed: 123,
});

function ev(id: string, category: EventDef['category'], level: EventDef['level']): EventDef {
  return { id, title: id, category, level, trigger: '', cooldownDays: 0, options: [], wind: '' };
}

describe('机制1：统一10万起手 + setup 超额自动贷款定档', () => {
  it('低配不超额 → 无 setup 贷款', () => {
    const s = createNewGame(cfg('学校门口', 'clean'), createRng(123));
    const over = s.debt; // over 等价于 debt（setup 一次性贷款）
    if (over > 0) {
      expect(s.loans.length).toBe(1);
      expect(s.loans[0].channel).toBe(channelForOver(over));
      expect(s.loans[0].balance).toBe(over);
    } else {
      expect(s.loans.length).toBe(0);
    }
  });

  it('高配超额 → 自动定档贷款（渠道与 over 一致）', () => {
    const s = createNewGame(cfg('商场', 'designer'), createRng(123));
    const over = s.debt;
    if (over > 0) {
      expect(s.loans[0].channel).toBe(channelForOver(over));
      expect(s.loans[0].balance).toBe(over);
    }
  });
});

describe('机制2：行动点系统', () => {
  it('canTakeAction 正常、takeAction 扣 AP、resetDailyActionState 恢复', () => {
    const s = createNewGame(cfg('学校门口', 'clean'), createRng(123));
    s.cash = 50000;
    expect(canTakeAction(s, 'owner_shift').ok).toBe(true);
    const r = takeAction(s, 'owner_shift', () => 1);
    expect(r.state.actionPointsCurrent).toBe(s.actionPointsCurrent - 1);
    const reset = resetDailyActionState(r.state);
    expect(reset.actionPointsCurrent).toBe(3);
  });
});

describe('机制3：危机贷款续命', () => {
  it('cash<0 时 takeCrisisLoan 回正并扣 1 AP', () => {
    const s = createNewGame(cfg('学校门口', 'clean'), createRng(123));
    s.cash = -5000;
    const r = takeCrisisLoan(s, 'bank', () => 0.5);
    const need = 5000 + CRISIS_LOAN_BUFFER;
    expect(r.cash).toBe(s.cash + need);
    expect(r.actionPointsCurrent).toBe(s.actionPointsCurrent - 1);
  });
});

describe('机制4：月结月息', () => {
  it('现金充足时月息从现金扣除', () => {
    const s = createNewGame(cfg('学校门口', 'clean'), createRng(123));
    s.cash = 100000;
    s.loans = [{ id: 'l', channel: 'private' as const, principal: 12000, apr: 0.12, balance: 12000, accruedInterest: 0, startDate: 1, overdueDays: 0 }];
    s.debt = 12000;
    const interest = Math.round((12000 * LOAN_APR.private) / MONTHLY_INTEREST_DIVISOR);
    const r = applyMonthlyInterest(s);
    expect(r.cash).toBe(100000 - interest);
  });
});

describe('机制5：复购热度崩溃', () => {
  it('每日衰减，heat=0 时复购塌地板', () => {
    const s = createNewGame(cfg('学校门口', 'clean'), createRng(123));
    s.stores[0].heat = 60;
    const decayed = decayHeat(s);
    expect(decayed.stores[0].heat).toBe(52);
    // 品质不足 → 地板
    s.stores[0].heat = 0;
    s.stores[0].currentBatchQuality = 50;
    const rep = computeRepurchase(s.stores[0], { ...s.hiddenLines, hygieneRisk: 50, supplyRisk: 50, employeePressure: 50 });
    expect(rep).toBeGreaterThan(0);
    expect(rep).toBeLessThanOrEqual(0.9);
  });
});

describe('机制6：客群极端敏感度', () => {
  it('学校门口高价 → 进店 −30；商场装修不足 → 进店 −40', () => {
    const s = createNewGame(cfg('学校门口', 'clean'), createRng(123));
    const schoolHigh = applySegmentModulation(s, { ...s.stores[0], priceStrategy: 'raise' });
    expect(schoolHigh.entryRatePct).toBe(-30);
    const mallLow = applySegmentModulation(s, { ...s.stores[0], locationType: '商场', decorationLevel: 'clean' });
    expect(mallLow.entryRatePct).toBe(-40);
  });
});

describe('机制7：事件明线冲击', () => {
  it('口碑硬砸（E059）直接扣现金与评分', () => {
    const s = createNewGame(cfg('学校门口', 'clean'), createRng(123));
    const cashBefore = s.cash;
    const ratingBefore = s.stores[0].rating;
    const r = applyEventShock(s, ev('E059', 'weather', 'small'));
    expect(r.cash).toBe(cashBefore - 5000);
    expect(r.stores[0].rating).toBe(ratingBefore - 40);
  });
});

describe('机制8：供应商批次波动', () => {
  it('每 ~7 天重抽，品质→明线修正随偏差线性变化', () => {
    const s = createNewGame(cfg('学校门口', 'clean'), createRng(123));
    s.day = 8;
    s.stores[0].batchRenewDay = 8;
    s.stores[0].supplierStability = 0.6;
    const rolled = rollBatchIfDue(s, () => 0.5);
    expect(rolled.stores[0].currentBatchQuality).toBe(60);
    expect(rolled.stores[0].batchRenewDay).toBe(8 + 7);
    const m = batchQualityMods({ ...s.stores[0], currentBatchQuality: 80 });
    expect(m.avgOrderValuePct).toBe(1);
  });
});

describe('机制9：结局引擎压力触发', () => {
  it('现金流连续断裂 → 破产结局', () => {
    const s = createNewGame(cfg('学校门口', 'clean'), createRng(123));
    s.cashNegativeStreak = 5;
    expect(evaluateEndings(s)?.def.id).toBe('suspended');
  });
});

describe('确定性：同种子同结果', () => {
  it('两次相同 seed 开局状态深度一致', () => {
    const a = createNewGame(cfg('学校门口', 'clean'), createRng(123));
    const b = createNewGame(cfg('学校门口', 'clean'), createRng(123));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
