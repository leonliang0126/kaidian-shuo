// QA 独立验证：供应商稳定性波动（架构 §5.6）
// cheap 档高波动（偶尔极好/极坏），premium 档稳；每 ~7 天重抽；品质同时影响明线+暗线。
import { describe, it, expect } from 'vitest';
import { rollBatchIfDue, batchQualityMods } from '../src/core/supplierStability';
import { stabilityToBaseQuality, volatilityFor, BATCH_CYCLE, QUALITY_BASELINE } from '../src/data/supplierStability';
import { createNewGame } from '../src/core/createNewGame';
import { createRng } from '../src/core/rng';
import type { GameState, StoreState } from '../src/types';

function game() {
  return createNewGame(
    { storeType: '奶茶饮品', locationType: '学校门口', decorationLevel: 'clean', storeName: 'QA', seed: 1 },
    createRng(1),
  );
}

function withStability(s: GameState, stability: number, batchRenewDay: number): GameState {
  return { ...s, day: 8, stores: s.stores.map((st) => ({ ...st, supplierStability: stability, batchRenewDay })) };
}

describe('供应商稳定性：档位→品质基准与波动', () => {
  it('stability→基准品质：cheap 0.3→30，premium 0.9→90', () => {
    expect(stabilityToBaseQuality(0.3)).toBe(30);
    expect(stabilityToBaseQuality(0.9)).toBe(90);
  });
  it('volatility：cheap(25) 远大于 premium(5)', () => {
    expect(volatilityFor(0.3)).toBe(25);
    expect(volatilityFor(0.9)).toBe(5);
  });
});

describe('批次重抽：每 ~7 天，cheap 高波动 / premium 稳', () => {
  it('到期(day>=batchRenewDay)重抽；cheap rng=0→极坏(5)，rng=1→极好(55)', () => {
    const s = withStability(game(), 0.3, 8);
    const low = rollBatchIfDue(s, () => 0); // base 30 - 25 = 5
    expect(low.stores[0].currentBatchQuality).toBe(5);
    expect(low.stores[0].batchRenewDay).toBe(8 + BATCH_CYCLE);
    const high = rollBatchIfDue(s, () => 1); // base 30 + 25 = 55
    expect(high.stores[0].currentBatchQuality).toBe(55);
  });
  it('premium 波动小：rng=0→85，rng=1→95', () => {
    const s = withStability(game(), 0.9, 8);
    expect(rollBatchIfDue(s, () => 0).stores[0].currentBatchQuality).toBe(85);
    expect(rollBatchIfDue(s, () => 1).stores[0].currentBatchQuality).toBe(95);
  });
  it('未到期(day<batchRenewDay)不重抽', () => {
    const s0 = game();
    const q0 = s0.stores[0].currentBatchQuality;
    const s = { ...s0, day: 5, stores: s0.stores.map((st) => ({ ...st, batchRenewDay: 100 })) };
    const r = rollBatchIfDue(s, () => 0.5);
    expect(r.stores[0].currentBatchQuality).toBe(q0);
  });
});

describe('品质→明线修正（线性，基准70）', () => {
  it('quality=80 → aov+1, conv+0.5, rep+0.5；quality=60 → 各 −1/−0.5/−0.5', () => {
    const baseStore: StoreState = game().stores[0];
    const hi = batchQualityMods({ ...baseStore, currentBatchQuality: 80 });
    expect(hi.avgOrderValuePct).toBe(1);
    expect(hi.conversionRatePct).toBeCloseTo(0.5, 5);
    expect(hi.repurchaseRatePct).toBeCloseTo(0.5, 5);
    const lo = batchQualityMods({ ...baseStore, currentBatchQuality: 60 });
    expect(lo.avgOrderValuePct).toBe(-1);
    expect(lo.conversionRatePct).toBeCloseTo(-0.5, 5);
  });
  it('基准品质 70 → 所有明线修正为 0', () => {
    const m = batchQualityMods({ ...game().stores[0], currentBatchQuality: QUALITY_BASELINE });
    expect(m.avgOrderValuePct).toBe(0);
    expect(m.conversionRatePct).toBe(0);
    expect(m.repurchaseRatePct).toBe(0);
  });
});
