// 结局触发阈值（数据驱动，覆盖 endings.json 的 conditions）。
// 全部数值集中此处，便于平衡校准（改一处即可）。

/** 破产倒闭：cash<0 连续天数阈值。 */
export const CASH_NEGATIVE_STREAK_BANKRUPTCY = 5;

/** 连锁帝国：分店数阈值。 */
export const CHAIN_EMPIRE_STORES = 3;

/** 连锁帝国：净资阈值。 */
export const CHAIN_EMPIRE_NET_WORTH = 6000000;

/** 财务自由：峰值净资阈值（纯看资产，不加暗线门槛）。 */
export const FINANCIAL_FREEDOM_NET_WORTH = 12000000;

/** 高利贷跑路：predatory 贷款 overdueDays 阈值。 */
export const PREDATORY_OVERDUE_DEBT_RUN = 5;

/** 8 暗线"全健康"阈值（每根暗线 ≤ 此值视为健康）。 */
export const HEALTHY_LINE_THRESHOLD = 40;

// —— 遗留 4 失败结局阈值（沿用 v2 触发口径）——
export const LANDLORD_WIN_ATTENTION = 90;
export const ONE_PERSON_SHOP_DAYS = 30;
export const MENU_WITHOUT_SUPPLY_SUPPLY = 80;
export const MENU_WITHOUT_SUPPLY_TRUST = 25;
export const VIRAL_FAILURE_HYPE = 80;
export const VIRAL_FAILURE_TRUST = 30;
