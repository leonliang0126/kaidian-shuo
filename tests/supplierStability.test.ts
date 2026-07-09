// V3-6 供应商稳定性波动单元测试（架构 §5.5）：stabilityToBaseQuality / volatilityFor / rollBatchIfDue / batchQualityMods。
import { describe, it, expect } from 'vitest';
import { rollBatchIfDue, batchQualityMods } from '../src/core/supplierStability';
import {
  stabilityToBaseQuality,
  volatilityFor,
  BATCH_CYCLE,
  QUALITY_BASELINE,
  SUPPLIER_STABILITY_VOL,
} from '../src/data/supplierStability';
import { createRng } from '../src/core/rng';
import { createNewGame } from '../src/core/createNewGame';
import type { GameState, StoreState } from '../src/types';

describe('stabilityToBaseQuality 基准品质', () => {
  it('stability×100 夹紧 [0,100]', () => {
    expect(stabilityToBaseQuality(0.6)).toBe(60);
    expect(stabilityToBaseQuality(0.9)).toBe(90);
    expect(stabilityToBaseQuality(1.2)).toBe(100);
    expect(stabilityToBaseQuality(0)).toBe(0);
  });
});

describe('volatilityFor 波动档位', () => {
  it('按 stability 分档', () => {
    expect(volatilityFor(0.95)).toBe(SUPPLIER_STABILITY_VOL.premium); // 5
    expect(volatilityFor(0.75)).toBe(SUPPLIER_STABILITY_VOL.stable); // 10
    expect(volatilityFor(0.65)).toBe(SUPPLIER_STABILITY_VOL.local); // 12
    expect(volatilityFor(0.5)).toBe(SUPPLIER_STABILITY_VOL.cheap); // 25
  });
});

describe('rollBatchIfDue 批次重抽', () => {
  function gameAtDay(day: number, batchRenewDay: number, stability: number): GameState {
    const s = createNewGame(
      { storeType: '奶茶饮品', locationType: '学校门口', decorationLevel: 'clean', storeName: '供应店', seed: 21 },
      createRng(21),
    );
    s.day = day;
    s.stores[0].batchRenewDay = batchRenewDay;
    s.stores[0].supplierStability = stability;
    return s;
  }

  it('未到期：批次品质不变', () => {
    const s = gameAtDay(1, 8, 0.6); // batchRenewDay(8) > day(1)
    const r = rollBatchIfDue(s, () => 0.5);
    expect(r.stores[0].currentBatchQuality).toBe(s.stores[0].currentBatchQuality);
  });

  it('到期（batchRenewDay<=day）：按 stability 重抽并顺延 7 天', () => {
    const s = gameAtDay(8, 8, 0.6); // 到期
    const r = rollBatchIfDue(s, () => 0.5); // rng=0.5 → 偏差 0 → 品质=基准
    expect(r.stores[0].currentBatchQuality).toBe(stabilityToBaseQuality(0.6)); // 60
    expect(r.stores[0].batchRenewDay).toBe(8 + BATCH_CYCLE);
  });
});

describe('batchQualityMods 品质→明线修正', () => {
  function storeWithQuality(q: number): StoreState {
    const s = createNewGame(
      { storeType: '奶茶饮品', locationType: '学校门口', decorationLevel: 'clean', storeName: '品质店', seed: 33 },
      createRng(33),
    );
    return { ...s.stores[0], currentBatchQuality: q };
  }

  it('品质=基准(70) → 零修正', () => {
    const m = batchQualityMods(storeWithQuality(QUALITY_BASELINE));
    expect(m.avgOrderValuePct).toBe(0);
    expect(m.conversionRatePct).toBe(0);
    expect(m.repurchaseRatePct).toBe(0);
  });

  it('品质=80（dev=+10）→ aov+1 / 转化+0.5 / 复购+0.5', () => {
    const m = batchQualityMods(storeWithQuality(80));
    expect(m.avgOrderValuePct).toBe(1);
    expect(m.conversionRatePct).toBeCloseTo(0.5, 5);
    expect(m.repurchaseRatePct).toBeCloseTo(0.5, 5);
  });

  it('品质=90（dev=+20）→ aov+2 / 转化+1 / 复购+1', () => {
    const m = batchQualityMods(storeWithQuality(90));
    expect(m.avgOrderValuePct).toBe(2);
    expect(m.conversionRatePct).toBe(1);
    expect(m.repurchaseRatePct).toBe(1);
  });
});
