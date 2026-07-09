// 开业成本 / 统一 10 万 / 贷款档位（数据驱动）。
import type { LocationType } from '../types';
import type { LoanChannel } from '../types/actions';

/** 统一起手资金（v3 锁定）。 */
export const INITIAL_CASH = 100000;

/** 开业备货成本（默认 20000，待校准）。 */
export const OPENING_INVENTORY_COST = 20000;

/** 选址转让费（按商圈，默认全 0；商场/写字楼可配小额）。 */
export const LOCATION_TRANSFER_FEE: Record<LocationType, number> = {
  学校门口: 0,
  写字楼: 0,
  社区底商: 0,
  商场: 0,
  冷清新商圈: 0,
};

/** 超额自动贷款档位阈值（over = setupCost − INITIAL_CASH）。 */
export const LOAN_TIER_THRESHOLDS = {
  bankMax: 50000, // over ≤ 5万 → 银行 4%
  privateMax: 150000, // 5万 < over ≤ 15万 → 民间 12%
  // over > 15万 → 高利贷 36%
};

/** 各渠道年利率。 */
export const LOAN_APR: Record<LoanChannel, number> = {
  bank: 0.04,
  private: 0.12,
  predatory: 0.36,
};

/** 月息 = balance × apr / 12（公式系数，保持 1/12）。 */
export const MONTHLY_INTEREST_DIVISOR = 12;

/** 危机贷款缓冲（续命金额 = max(0,−cash) + buffer）。 */
export const CRISIS_LOAN_BUFFER = 10000;

/** 提前还本消耗行动点（默认 0：月结 repay 不耗 AP；LoanPanel 直操作也不耗）。 */
export const PREPAY_COST_AP = 0;

/** 行动点基准上限。 */
export const ACTION_POINTS_BASE = 3;

/** 老板透支（ownerFatigue）超过此值 → 次日行动点上限 −1。 */
export const BOSS_STRAIN_AP_PENALTY = 70;

/** 利滚利上限：累计利息不超过本金的此倍数。 */
export const ACCRUED_INTEREST_CAP_MULT = 2;

/** 根据超额金额决定贷款渠道。 */
export function channelForOver(over: number): LoanChannel {
  if (over <= LOAN_TIER_THRESHOLDS.bankMax) return 'bank';
  if (over <= LOAN_TIER_THRESHOLDS.privateMax) return 'private';
  return 'predatory';
}
