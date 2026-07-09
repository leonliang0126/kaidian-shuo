// 复购热度崩溃（架构 V3-5）：heat 每日衰减 + 复购崩溃公式（品质托底）。
// heat 与 promoHype 解耦（doc §7）。纯函数。
import type { GameState, StoreState, HiddenLines } from '../types';
import {
  HEAT_DECAY,
  MALL_HEAT_DECAY_MULT,
  HEAT_SENS,
  QUALITY_HIGH,
  HEAT_FLOOR_REPURCHASE,
  QUALITY_FLOOR_FACTOR,
  QS_HYGIENE_W,
  QS_EMPLOYEE_W,
  QS_PRICE_W,
  QS_TRUST_W,
  QS_BASELINE_TRUST,
  QS_BATCH_PENALTY_W,
  QS_BATCH_PENALTY_THRESHOLD,
  isMall,
} from '../data/repurchaseHeat';
import { clamp } from '../utils/constants';
import { getStoreProfile } from '../data/storeProfiles';
import { cloneState } from './effectResolver';

/** 综合"品质"得分（doc §7）：暗线 + 当前批次品质。 */
export function qualityScore(hidden: HiddenLines, store?: StoreState): number {
  let qs =
    100 -
    QS_HYGIENE_W * (hidden.hygieneRisk + hidden.supplyRisk) -
    QS_EMPLOYEE_W * hidden.employeePressure -
    QS_PRICE_W * hidden.priceControversy +
    QS_TRUST_W * (hidden.customerTrust - QS_BASELINE_TRUST);
  if (store && store.currentBatchQuality < QS_BATCH_PENALTY_THRESHOLD) {
    qs -= QS_BATCH_PENALTY_W * (QS_BATCH_PENALTY_THRESHOLD - store.currentBatchQuality);
  }
  return clamp(qs, 0, 100);
}

/**
 * 复购崩溃公式：repurchase = base × (1 + heat/100 × HEAT_SENS) × qualityFactor。
 * heat=0 直接塌地板（除非品质≥高托底）；商场无品质托底。
 */
export function computeRepurchase(store: StoreState, hidden: HiddenLines): number {
  const base = getStoreProfile(store.storeType).repurchaseRate;
  const heat = store.heat;
  const qs = qualityScore(hidden, store);
  const qualityFactor = qs >= QUALITY_HIGH ? 1 : clamp(0.4 + qs / 100, 0, 1);

  if (heat <= 0) {
    if (isMall(store)) return HEAT_FLOOR_REPURCHASE; // 商场无品质托底
    if (qs >= QUALITY_HIGH) return base * QUALITY_FLOOR_FACTOR;
    return HEAT_FLOOR_REPURCHASE;
  }
  return clamp(base * (1 + (heat / 100) * HEAT_SENS) * qualityFactor, 0, 0.9);
}

/** 每日衰减（~8，商场额外 ×1.5）。结算后调用。 */
export function decayHeat(state: GameState): GameState {
  const s = cloneState(state);
  s.stores = s.stores.map((st) => {
    const decay = HEAT_DECAY * (isMall(st) ? MALL_HEAT_DECAY_MULT : 1);
    return { ...st, heat: Math.max(0, st.heat - decay) };
  });
  return s;
}

/** 给某店增加热度（promoHype 增益等，可选调用）。 */
export function addHeat(store: StoreState, amount: number): StoreState {
  return { ...store, heat: clamp(store.heat + amount, 0, 100) };
}
