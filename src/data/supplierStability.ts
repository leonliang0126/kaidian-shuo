// 供应商稳定性波动：平衡常量（数据驱动，逻辑函数在 core/supplierStability.ts）。
import type { SupplierTier } from '../types';
import { clamp } from '../utils/constants';

/** 批次重抽周期（天）。 */
export const BATCH_CYCLE = 7;

/** 各供应商档位的品质波动幅度（绝对品质点，非百分比）。 */
export const SUPPLIER_STABILITY_VOL: Record<SupplierTier, number> = {
  cheap: 25,
  local: 12,
  stable: 10,
  premium: 5,
};

/** 批次品质 → 明线换算系数。 */
export const QUALITY_AOV_COEF = 0.1; // 每点品质偏差 → avgOrderValuePct
export const QUALITY_CONVERSION_COEF = 0.05; // → conversionRatePct
export const QUALITY_REPURCHASE_COEF = 0.05; // → repurchaseRatePct

/** 品质基准（stability × 100 附近）。 */
export const QUALITY_BASELINE = 70;

/** 供应商 stability（0–1）→ 批次品质基准。 */
export function stabilityToBaseQuality(stability: number): number {
  return clamp(stability * 100, 0, 100);
}

/** 根据档位 stability 返回波动幅度。 */
export function volatilityFor(stability: number): number {
  if (stability >= 0.9) return SUPPLIER_STABILITY_VOL.premium;
  if (stability >= 0.7) return SUPPLIER_STABILITY_VOL.stable;
  if (stability >= 0.6) return SUPPLIER_STABILITY_VOL.local;
  return SUPPLIER_STABILITY_VOL.cheap;
}
