// QA 独立验证：复购热度崩溃（架构 §5.5）
// heat=0 → 塌地板 ~0.05；heat=0 但品质≥70 → 托底 ~0.5×base；商场 heat=0 无品质托底；heat>0 随品质上升。
import { describe, it, expect } from 'vitest';
import { computeRepurchase, qualityScore } from '../src/core/repurchaseHeat';
import { createNewGame } from '../src/core/createNewGame';
import { createRng } from '../src/core/rng';
import { getStoreProfile } from '../src/data/storeProfiles';
import { HEAT_FLOOR_REPURCHASE, QUALITY_FLOOR_FACTOR, QUALITY_HIGH } from '../src/data/repurchaseHeat';
import type { StoreState, HiddenLines } from '../src/types';

function mkStore(over: Partial<StoreState> = {}): StoreState {
  const s = createNewGame(
    { storeType: '奶茶饮品', locationType: '学校门口', decorationLevel: 'clean', storeName: 'QA', seed: 1 },
    createRng(1),
  );
  return { ...s.stores[0], ...over };
}

const healthyHidden: HiddenLines = {
  landlordAttention: 0,
  employeePressure: 0,
  customerTrust: 50,
  priceControversy: 0,
  promoHype: 0,
  supplyRisk: 0,
  platformDependence: 0,
  hygieneRisk: 0,
};
const brokenHidden: HiddenLines = {
  landlordAttention: 0,
  employeePressure: 0,
  customerTrust: 50,
  priceControversy: 0,
  promoHype: 0,
  supplyRisk: 50,
  platformDependence: 0,
  hygieneRisk: 50,
};

describe('复购崩溃：heat=0 塌地板', () => {
  it('heat=0 且品质<70（暗线崩）→ 地板 0.05', () => {
    const store = mkStore({ heat: 0, currentBatchQuality: 80, locationType: '学校门口' });
    const rep = computeRepurchase(store, brokenHidden);
    expect(rep).toBe(HEAT_FLOOR_REPURCHASE); // 0.05
  });
  it('heat=0 但品质≥70（暗线健康）→ 托底 0.5×base', () => {
    const base = getStoreProfile('奶茶饮品').repurchaseRate; // 0.28
    const store = mkStore({ heat: 0, currentBatchQuality: 80, locationType: '学校门口' });
    const rep = computeRepurchase(store, healthyHidden);
    expect(rep).toBeCloseTo(base * QUALITY_FLOOR_FACTOR, 5); // 0.14
  });
});

describe('商场无品质托底', () => {
  it('商场 heat=0 即使品质≥70 也塌地板 0.05', () => {
    const store = mkStore({ heat: 0, currentBatchQuality: 80, locationType: '商场', decorationLevel: 'memorable' });
    const rep = computeRepurchase(store, healthyHidden);
    expect(rep).toBe(HEAT_FLOOR_REPURCHASE);
  });
});

describe('heat>0 随品质上升', () => {
  it('同 heat=30，品质=100 的复购 > 品质=0 的复购', () => {
    const storeHi = mkStore({ heat: 30, currentBatchQuality: 80, locationType: '学校门口' });
    const storeLo = mkStore({ heat: 30, currentBatchQuality: 80, locationType: '学校门口' });
    const hi = computeRepurchase(storeHi, healthyHidden); // qs=100
    const lo = computeRepurchase(storeLo, {
      ...healthyHidden,
      customerTrust: 0,
      supplyRisk: 50,
      hygieneRisk: 50,
    }); // qs=35 (<70)：暗线确实崩，品质托底失效
    expect(hi).toBeGreaterThan(lo);
    expect(hi).toBeLessThanOrEqual(0.9);
  });
  it('qualityScore 公式：暗线崩→低分(<70)，暗线健康→高分(≥70)', () => {
    const bad = qualityScore({
      landlordAttention: 100,
      employeePressure: 100,
      customerTrust: 0,
      priceControversy: 100,
      promoHype: 0,
      supplyRisk: 100,
      platformDependence: 0,
      hygieneRisk: 100,
    });
    const good = qualityScore(healthyHidden);
    expect(good).toBeGreaterThan(QUALITY_HIGH); // ≥70
    expect(bad).toBeLessThan(QUALITY_HIGH); // <70
  });
});
