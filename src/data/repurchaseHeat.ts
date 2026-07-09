// 复购热度崩溃：平衡常量（数据驱动，逻辑函数在 core/repurchaseHeat.ts）。
import type { StoreState } from '../types';

/** 开局复购热度初始值。 */
export const HEAT_INIT = 60;

/** 每日热度衰减（pct 点，绝对值）。 */
export const HEAT_DECAY = 8;

/** 商场热度衰减倍率（首月高次月崩）。 */
export const MALL_HEAT_DECAY_MULT = 1.5;

/** 热度敏感度：repurchase = base × (1 + heat/100 × HEAT_SENS) × qualityFactor。 */
export const HEAT_SENS = 1.0;

/** 品质≥此值视为"高品质"，可托住复购底。 */
export const QUALITY_HIGH = 70;

/** heat=0 且无品质托底时的复购地板。 */
export const HEAT_FLOOR_REPURCHASE = 0.05;

/** 品质托底时复购 = base × 此因子。 */
export const QUALITY_FLOOR_FACTOR = 0.5;

// —— qualityScore 公式系数（见 doc §7）——
export const QS_HYGIENE_W = 0.4;
export const QS_SUPPLY_W = 0.4;
export const QS_EMPLOYEE_W = 0.2;
export const QS_PRICE_W = 0.2;
export const QS_TRUST_W = 0.5;
export const QS_BASELINE_TRUST = 50;
/** 当前批次品质低于阈值时，对品质分的额外惩罚权重。 */
export const QS_BATCH_PENALTY_W = 0.3;
export const QS_BATCH_PENALTY_THRESHOLD = 70;

/** 是否为"商场"（热度衰减更快、heat=0 无品质托底）。 */
export function isMall(store: StoreState): boolean {
  return store.locationType === '商场';
}
