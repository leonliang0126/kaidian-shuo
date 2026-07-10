// 开业成本 / 统一 10 万 / 贷款档位（数据驱动）。
import type { LocationType } from '../types';
import type { LoanChannel } from '../types/actions';

/** 统一起手资金（v3 锁定）。保留作兜底默认值；实际起手资金改由开局页随机决定（见 randomInitialCash）。 */
export const INITIAL_CASH = 100000;

/** 初始资金随机范围（需求：5000–20万）。 */
export const INITIAL_CASH_MIN = 5000;
export const INITIAL_CASH_MAX = 200000;
/** 随机起手资金（5000–20万均匀分布，取整到元）。 */
export function randomInitialCash(): number {
  return Math.floor(INITIAL_CASH_MIN + Math.random() * (INITIAL_CASH_MAX - INITIAL_CASH_MIN));
}

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

/** 危机贷款缓冲（续命金额 = max(0,−cash) + buffer；小额缺口下观感约 3 万）。 */
export const CRISIS_LOAN_BUFFER = 30000;

/** 提前还本消耗行动点（默认 0：月结 repay 不耗 AP；LoanPanel 直操作也不耗）。 */
export const PREPAY_COST_AP = 0;

// —— 贷款子系统增量修复（INCREMENTAL_LOANFIX）常量与纯函数 ——

/** 高利贷每多借一笔的年利率乘子（复合 ×1.5：36% → 54% → 81% → …）。 */
export const PREDATORY_APR_ESCALATION = 1.5;

/** 危机贷款（玩家手动发起）累计上限占净资比例：debt >= netWorth × 该值 即达上限。 */
export const CRISIS_LOAN_NETWORTH_CAP_RATIO = 0.8;

/** 80% 上限的宽限借款次数：前 count 次危机借款不触发上限判断。2 = 自动兜底的 2 次内免判。 */
export const CRISIS_LOAN_GRACE_COUNT = 2;

/** 危机借款满 N 笔后银行/亲友禁用、仅许高利贷（硬压力来源，替代原 autoBailoutCount 自动兜底）。 */
export const CRISIS_LOAN_BANK_CUTOFF = 2;

/** 高利贷借款满 N 笔后判定"无油水"、拒绝再放（不借钱、不增计数，仅弹无油水拒故事）。 */
export const PREDATORY_REJECT_CUTOFF = 3;

// —— 危机借款额度/拒绝率（玩家危机面板随机借款，防确定性刷钱）——
// 亲友借款（private）：成功时随机借到 5千–5万；拒绝率随尝试次数递增。
export const FRIEND_LOAN_MIN = 5000;
export const FRIEND_LOAN_MAX = 50000;
// 高利贷（predatory）：成功时随机借到 5千–8万；利率仍按已借笔数飙升（predatoryLoanApr 不变）。
export const LOAN_SHARK_MIN = 5000;
export const LOAN_SHARK_MAX = 80000;
// 亲友拒绝率：第1次 30%，第2次 30%+40%=70%，第3次起封顶 95%。
export const FRIEND_REJECT_BASE = 0.3;
export const FRIEND_REJECT_STEP = 0.4;
export const FRIEND_REJECT_CAP = 0.95;

/**
 * 危机应对行动累计使用上限（防无限拖延）。
 * 注：delay_supplier_payment 用户原话"3个月内2次"，此处实现为全局累计上限 2，
 * 不区分月份（产品简化：用满 2 次即禁用）。temporary_price_increase / close_shop 不在此表 = 无限/始终可用。
 */
export const CRISIS_ACTION_MAX_USES: Record<string, number> = {
  sell_equipment: 1,
  clearance_sale: 1,
  delay_rent: 2,
  delay_supplier_payment: 2,
  layoff: 1,
};

/**
 * 第 (count+1) 笔高利贷的年利率（count = 已借高利贷笔数）。
 * 公式：LOAN_APR.predatory × PREDATORY_APR_ESCALATION ^ count，结果四舍五入至 4 位小数。
 * @example predatoryLoanApr(0)=0.36, predatoryLoanApr(1)=0.54, predatoryLoanApr(2)=0.81
 */
export function predatoryLoanApr(count: number): number {
  return Math.round(LOAN_APR.predatory * PREDATORY_APR_ESCALATION ** count * 1e4) / 1e4;
}

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
