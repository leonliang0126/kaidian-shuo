// 供应商稳定性波动（架构 V3-6）：按 supplierTier.stability 每 ~7 天重抽批次品质，
// 产出品质 → 明线/暗线修正。纯函数。
import type { GameState, StoreState, DayModifiers } from '../types';
import type { RNG } from './rng';
import {
  BATCH_CYCLE,
  stabilityToBaseQuality,
  volatilityFor,
  QUALITY_AOV_COEF,
  QUALITY_CONVERSION_COEF,
  QUALITY_REPURCHASE_COEF,
  QUALITY_BASELINE,
} from '../data/supplierStability';
import { emptyModifiers } from './modifiers';
import { cloneState } from './effectResolver';
import { clamp } from '../utils/constants';

/** 到期则重抽当前批次品质（~7 天）。 */
export function rollBatchIfDue(state: GameState, rng: RNG): GameState {
  const s = cloneState(state);
  s.stores = s.stores.map((st) => {
    if (st.batchRenewDay <= s.day) {
      const stability = st.supplierStability;
      const vol = volatilityFor(stability);
      const base = stabilityToBaseQuality(stability);
      const quality = clamp(base + (rng() * 2 - 1) * vol, 0, 100);
      return { ...st, currentBatchQuality: quality, batchRenewDay: s.day + BATCH_CYCLE };
    }
    return st;
  });
  return s;
}

/** 当前批次品质 → 明线修正（高于基准加成，低于基准减成）。 */
export function batchQualityMods(store: StoreState): DayModifiers {
  const m = emptyModifiers();
  const dev = store.currentBatchQuality - QUALITY_BASELINE;
  m.avgOrderValuePct += dev * QUALITY_AOV_COEF;
  m.conversionRatePct += dev * QUALITY_CONVERSION_COEF;
  m.repurchaseRatePct += dev * QUALITY_REPURCHASE_COEF;
  return m;
}
