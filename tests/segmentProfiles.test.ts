// V3-4 商圈客群极端敏感度单元测试（架构 §5.4）：价格/装修/出餐/复购/季节调制。
import { describe, it, expect } from 'vitest';
import { applySegmentModulation } from '../src/core/segmentProfiles';
import { createRng } from '../src/core/rng';
import { createNewGame } from '../src/core/createNewGame';
import type { GameState, StoreState } from '../src/types';

function fresh(): { state: GameState; store: StoreState } {
  const state = createNewGame(
    { storeType: '奶茶饮品', locationType: '学校门口', decorationLevel: 'clean', storeName: '客群店', seed: 3 },
    createRng(3),
  );
  return { state, store: { ...state.stores[0] } };
}

describe('价格敏感（学校门口）', () => {
  it('高价策略 → 进店率 −30；正常价 → 不罚', () => {
    const { state, store } = fresh();
    const high = applySegmentModulation(state, { ...store, priceStrategy: 'raise' });
    expect(high.entryRatePct).toBe(-30);
    const normal = applySegmentModulation(state, { ...store, priceStrategy: 'normal' });
    expect(normal.entryRatePct).toBe(0);
  });
});

describe('装修敏感（商场）', () => {
  it('装修低于 memorable → 进店率 −40；designer 档 → 不罚', () => {
    const { state, store } = fresh();
    const low = applySegmentModulation(state, { ...store, locationType: '商场', decorationLevel: 'clean' });
    expect(low.entryRatePct).toBe(-40);
    const high = applySegmentModulation(state, { ...store, locationType: '商场', decorationLevel: 'designer' });
    expect(high.entryRatePct).toBe(0);
  });
});

describe('出餐敏感（写字楼）', () => {
  it('承载不足 → 转化惩罚（缺口比例 × 系数）', () => {
    const { state, store } = fresh();
    const m = applySegmentModulation(state, { ...store, locationType: '写字楼', capacity: 100 });
    // 缺口 = (220-100)/220 ≈ 0.545；惩罚 = round(0.545 × 40) = 22
    expect(m.conversionRatePct).toBe(-22);
  });
});

describe('复购加成（社区底商）', () => {
  it('复购率 +15', () => {
    const { state, store } = fresh();
    const m = applySegmentModulation(state, { ...store, locationType: '社区底商' });
    expect(m.repurchaseRatePct).toBe(15);
  });
});

describe('季节波动（冷清新商圈）', () => {
  it('day=7 时曝光正弦约 +25', () => {
    const { state, store } = fresh();
    const s = { ...state, day: 7 };
    const m = applySegmentModulation(s, { ...store, locationType: '冷清新商圈' });
    // sin(7/30 × 2π) × 25 ≈ 24.86 → round 25
    expect(m.exposurePct).toBeCloseTo(25, 0);
  });
});
