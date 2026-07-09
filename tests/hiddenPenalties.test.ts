// T-D7：暗线→结算耦合单测（增量设计 v2 §2）。
import { describe, it, expect } from 'vitest';
import { deriveDailyPenalties, applyHiddenLineDailyHits } from '../src/core/hiddenPenalties';
import { createNewGame } from '../src/core/createNewGame';
import { createRng } from '../src/core/rng';
import type { HiddenLines } from '../src/types';

function baseHidden(): HiddenLines {
  return {
    landlordAttention: 0,
    employeePressure: 0,
    customerTrust: 50,
    priceControversy: 0,
    promoHype: 0,
    supplyRisk: 0,
    platformDependence: 0,
    hygieneRisk: 0,
  };
}

describe('deriveDailyPenalties：init 态全 0', () => {
  it('hidden 全 0、customerTrust=50 → 所有修正为 0（不破坏结算契约测试）', () => {
    const m = deriveDailyPenalties(baseHidden(), { rent: 12000 });
    expect(m.marginPct).toBe(0);
    expect(m.ordersPct).toBe(0);
    expect(m.conversionRatePct).toBe(0);
    expect(m.platformCostPct).toBe(0);
    expect(m.entryRatePct).toBe(0);
    expect(m.repurchaseRatePct).toBe(0);
    expect(m.miscCostAdd).toBe(0);
  });
});

describe('deriveDailyPenalties：单条暗线映射', () => {
  it('supplyRisk=100 → marginPct -8 / ordersPct -4', () => {
    const m = deriveDailyPenalties({ ...baseHidden(), supplyRisk: 100 }, { rent: 12000 });
    expect(m.marginPct).toBeCloseTo(-8, 5);
    expect(m.ordersPct).toBeCloseTo(-4, 5);
  });

  it('hygieneRisk=100 → conversionRatePct -6', () => {
    const m = deriveDailyPenalties({ ...baseHidden(), hygieneRisk: 100 }, { rent: 12000 });
    expect(m.conversionRatePct).toBeCloseTo(-6, 5);
  });

  it('platformDependence=100 → platformCostPct +8', () => {
    const m = deriveDailyPenalties({ ...baseHidden(), platformDependence: 100 }, { rent: 12000 });
    expect(m.platformCostPct).toBeCloseTo(8, 5);
  });

  it('customerTrust=30 → entry/repurchase/conversion 均负增量', () => {
    const m = deriveDailyPenalties({ ...baseHidden(), customerTrust: 30 }, { rent: 12000 });
    expect(m.entryRatePct).toBeLessThan(0);
    expect(m.repurchaseRatePct).toBeLessThan(0);
    expect(m.conversionRatePct).toBeLessThan(0);
  });

  it('promoHype=100 且 trust=30 → 进店被撑高（>0）/ 转化受罚（<0）', () => {
    const m = deriveDailyPenalties(
      { ...baseHidden(), promoHype: 100, customerTrust: 30 },
      { rent: 12000 },
    );
    expect(m.entryRatePct).toBeGreaterThan(0); // 信任(30)-2 + 虚火+10 = +8
    expect(m.conversionRatePct).toBeLessThan(0);
  });

  it('promoHype=100 且 trust=50（中性）→ 纯虚火进店 +10 / 转化 0', () => {
    const m = deriveDailyPenalties(
      { ...baseHidden(), promoHype: 100, customerTrust: 50 },
      { rent: 12000 },
    );
    expect(m.entryRatePct).toBeCloseTo(10, 5);
    expect(m.conversionRatePct).toBeCloseTo(0, 5);
  });

  it('landlordAttention=100 → miscCostAdd > 0（= (100-40)/60 * rent * 0.01）', () => {
    const m = deriveDailyPenalties(
      { ...baseHidden(), landlordAttention: 100 },
      { rent: 10000 },
    );
    expect(m.miscCostAdd).toBeGreaterThan(0);
    expect(m.miscCostAdd).toBeCloseTo(100, 5);
  });

  it('landlordAttention<=40 → miscCostAdd = 0（不咬）', () => {
    const m = deriveDailyPenalties(
      { ...baseHidden(), landlordAttention: 40 },
      { rent: 10000 },
    );
    expect(m.miscCostAdd).toBe(0);
  });
});

describe('applyHiddenLineDailyHits：偶发重罚', () => {
  function freshGame(): ReturnType<typeof createNewGame> {
    return createNewGame(
      {
        initialCashTier: 300000,
        storeType: '奶茶饮品',
        locationType: '学校门口',
        decorationLevel: 'clean',
        storeName: '测试店',
        seed: 1,
      },
      createRng(1),
    );
  }

  it('supplyRisk>70 且 rng 命中 → 食材损耗罚款（现金扣减 + 日志）', () => {
    const state = freshGame();
    state.hiddenLines.supplyRisk = 80; // >70
    const rent = state.stores[0].rent; // 学校门口 12000
    const before = state.cash;
    const { state: s2, logs } = applyHiddenLineDailyHits(state, () => 0);
    expect(logs.length).toBe(1);
    expect(logs[0].kind).toBe('shortage');
    expect(s2.cash).toBe(before - Math.round((rent * 5) / 100));
  });

  it('supplyRisk>70 但 rng 未命中 → 不罚款', () => {
    const state = freshGame();
    state.hiddenLines.supplyRisk = 80;
    const before = state.cash;
    const { state: s2, logs } = applyHiddenLineDailyHits(state, () => 0.5);
    expect(logs.length).toBe(0);
    expect(s2.cash).toBe(before);
  });

  it('hygieneRisk>60 且 rng 命中 → 食安罚款 + 评级下滑', () => {
    const state = freshGame();
    state.hiddenLines.hygieneRisk = 80;
    const beforeRating = state.stores[0].rating;
    // rng 序列：第 1 次为 roll（supply 分支被 hygiene 短路跳过），第 2 次为 hygiene 判定 <0.12
    let i = 0;
    const seq = () => [0.5, 0.1][i++ % 2];
    const { state: s2, logs } = applyHiddenLineDailyHits(state, seq);
    expect(logs.length).toBe(1);
    expect(logs[0].kind).toBe('foodSafety');
    expect(s2.stores[0].rating).toBeLessThan(beforeRating);
  });

  it('hygiene 高 → 评级逐日下滑（连续确定性）', () => {
    const state = freshGame();
    state.hiddenLines.hygieneRisk = 100;
    const before = state.stores[0].rating;
    const { state: s2 } = applyHiddenLineDailyHits(state, () => 0.99);
    expect(s2.stores[0].rating).toBeCloseTo(before - 1.0, 5);
  });
});
