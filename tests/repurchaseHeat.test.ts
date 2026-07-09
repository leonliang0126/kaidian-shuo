// V3-5 复购热度崩溃单元测试（架构 §7）：qualityScore / computeRepurchase / decayHeat。
import { describe, it, expect } from 'vitest';
import { qualityScore, computeRepurchase, decayHeat } from '../src/core/repurchaseHeat';
import { createRng } from '../src/core/rng';
import { createNewGame } from '../src/core/createNewGame';
import { HEAT_FLOOR_REPURCHASE, QUALITY_FLOOR_FACTOR, MALL_HEAT_DECAY_MULT, HEAT_DECAY } from '../src/data/repurchaseHeat';
import type { HiddenLines, StoreState } from '../src/types';

const zeroHidden: HiddenLines = {
  landlordAttention: 0,
  employeePressure: 0,
  customerTrust: 50,
  priceControversy: 0,
  promoHype: 0,
  supplyRisk: 0,
  platformDependence: 0,
  hygieneRisk: 0,
};

function baseStore(locationType: StoreState['locationType'] = '学校门口'): StoreState {
  const s = createNewGame(
    { storeType: '奶茶饮品', locationType, decorationLevel: 'clean', storeName: '复购店', seed: 5 },
    createRng(5),
  );
  return { ...s.stores[0] };
}

describe('qualityScore 品质得分', () => {
  it('全 0 暗线 + trust50 → 100', () => {
    expect(qualityScore(zeroHidden)).toBe(100);
  });

  it('卫生/供应链/员工压力各 50 → 50', () => {
    const h: HiddenLines = { ...zeroHidden, hygieneRisk: 50, supplyRisk: 50, employeePressure: 50 };
    expect(qualityScore(h)).toBe(50);
  });

  it('批次品质 <70 额外惩罚', () => {
    const store = { ...baseStore(), currentBatchQuality: 50 };
    // qs=100 − 0.3×(70−50)=6 → 94
    expect(qualityScore(zeroHidden, store)).toBe(94);
  });
});

describe('computeRepurchase 复购崩溃公式', () => {
  it('商场 heat=0 无品质托底 → 地板 0.05', () => {
    const store = { ...baseStore('商场'), heat: 0 };
    expect(computeRepurchase(store, zeroHidden)).toBe(HEAT_FLOOR_REPURCHASE);
  });

  it('非商场 heat=0 且品质不足 → 地板 0.05', () => {
    const h: HiddenLines = { ...zeroHidden, hygieneRisk: 50, supplyRisk: 50, employeePressure: 50 }; // qs 50
    const store = { ...baseStore(), heat: 0 };
    expect(computeRepurchase(store, h)).toBe(HEAT_FLOOR_REPURCHASE);
  });

  it('非商场 heat=0 但品质≥高托底 → base × 0.5', () => {
    const store = { ...baseStore(), heat: 0 }; // qs=100 ≥ QUALITY_HIGH
    const base = store.repurchaseRate;
    expect(computeRepurchase(store, zeroHidden)).toBeCloseTo(base * QUALITY_FLOOR_FACTOR, 5);
  });

  it('heat>0 且高品质 → base × (1 + heat/100 × HEAT_SENS)', () => {
    const store = { ...baseStore(), heat: 50 }; // qs=100
    const base = store.repurchaseRate;
    expect(computeRepurchase(store, zeroHidden)).toBeCloseTo(base * (1 + (50 / 100) * 1), 5);
  });

  it('结果始终夹紧在 [0, 0.9]', () => {
    const store = { ...baseStore(), heat: 100 };
    const r = computeRepurchase(store, zeroHidden);
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(0.9);
  });
});

describe('decayHeat 每日衰减', () => {
  it('普通店 heat 60 → 52', () => {
    const s = createNewGame(
      { storeType: '奶茶饮品', locationType: '学校门口', decorationLevel: 'clean', storeName: '衰减店', seed: 9 },
      createRng(9),
    );
    s.stores[0].heat = 60;
    const r = decayHeat(s);
    expect(r.stores[0].heat).toBe(60 - HEAT_DECAY);
  });

  it('商场衰减 ×1.5（60 → 48）', () => {
    const s = createNewGame(
      { storeType: '奶茶饮品', locationType: '商场', decorationLevel: 'clean', storeName: '衰减店2', seed: 9 },
      createRng(9),
    );
    s.stores[0].heat = 60;
    const r = decayHeat(s);
    expect(r.stores[0].heat).toBe(60 - HEAT_DECAY * MALL_HEAT_DECAY_MULT);
  });
});
