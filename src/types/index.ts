// 《开店说》全局类型定义（单一事实来源）
import type { EffectObject, EventDef, EndingDef, EventOption, EventCategory } from './events';
import type { Loan } from './actions';
import type { Employee } from './employee';

export type StoreType =
  | '奶茶饮品'
  | '小吃快餐'
  | '粉面店'
  | '咖啡主理人店'
  | '加盟连锁店';

export type LocationType =
  | '学校门口'
  | '写字楼'
  | '社区底商'
  | '商场'
  | '冷清新商圈';

export type SupplierTier = 'cheap' | 'local' | 'stable' | 'premium';
export type PriceStrategy = 'low' | 'normal' | 'raise' | 'premium';
export type DecorationLevel =
  | 'bare'
  | 'clean'
  | 'memorable'
  | 'viral'
  | 'designer';
export type PromotionTier = 'none' | 'light' | 'normal' | 'heavy' | 'gamble';

export type CashflowStatus = '健康' | '紧张' | '危险';
export type WindLevel = 'calm' | 'watch' | 'warn' | 'danger';
export type DebtPressure = 'light' | 'medium' | 'heavy';

// —— 隐藏暗线（0-100）——
export interface HiddenLines {
  landlordAttention: number; // 房东关注
  employeePressure: number; // 员工压力
  customerTrust: number; // 顾客信任（初始 50）
  priceControversy: number; // 价格争议
  promoHype: number; // 推广虚火
  supplyRisk: number; // 供应链隐患
  platformDependence: number; // 平台依赖
  hygieneRisk: number; // 卫生风险
}

// —— 软暗线（0-100，近似实现，不直接展示）——
export interface SoftHidden {
  ownerFatigue: number; // 老板透支
  wasteRisk: number; // 损耗风险
  qualityVariance: number; // 品质波动
  landlordPatience: number; // 房东耐心
  accountingErrorRisk: number; // 账目误差风险
  stability: number; // 经营稳定性
}

// —— 单店状态 ——
export interface StoreState {
  id: string;
  name: string;
  storeType: StoreType;
  locationType: LocationType;
  rent: number; // 月租（可被 rentPct 持久修改）
  deposit: number; // 押金（= 2 × 初始 rent）
  decorationLevel: DecorationLevel;
  decorationEntryBonus: number; // 装修档固化进店率加成（pct，开局固化，§4）
  decorationAovBonus: number; // 装修档固化客单价加成（pct，开局固化，§4）
  supplierTier: SupplierTier;
  priceStrategy: PriceStrategy;
  promotionTier: PromotionTier;
  rating: number; // 0-100 内部分（UI 显示 = rating/20，clamp 0-5）
  repurchaseRate: number; // 0-1（每日由 computeRepurchase 覆盖）
  deliveryRatio: number; // 外卖占比 0-1（默认 0.30）
  platformRate: number; // 平台抽成率（默认 0.18，platformCostPct 当日乘子）
  isInCrisis: boolean;
  crisisDays: number;
  cashflowStatus: CashflowStatus;
  monthlyRevenue: number; // 本月累计流水
  monthlyGrossProfit: number;
  monthlyNetProfit: number;
  monthlyPromoCost: number;
  monthlyDeliveryRevenue: number;
  monthlyStaffCost: number;
  lastMonthNetProfit: number; // 上月净利（月结用）
  monthlyNetProfitPositiveStreak: number; // 连续正净利月数（结局用）
  repurchaseRateStartOfMonth: number; // 月初复购（月结变化用）
  ratingStartOfMonth: number; // 月初评分（月结变化用）
  // —— v3 增量字段 ——
  heat: number; // 复购热度 0–100（每日衰减 ~8）
  currentBatchQuality: number; // 当前供应商批次品质 0–100
  batchRenewDay: number; // 下一批次重抽 day（~7 天）
  supplierStability: number; // 当前供应商 stability 缓存（0–1）
  employees: Employee[]; // 该店面的员工列表（v3 员工系统重构）
}

// —— 五项每日决策（与主店当前策略一致）——
export interface DecisionState {
  supplierTier: SupplierTier;
  priceStrategy: PriceStrategy;
  decorationLevel: DecorationLevel;
  promotionTier: PromotionTier;
}

// —— 每日修正累加器（modifiers.ts）——
export interface DayModifiers {
  exposurePct: number;
  dineInExposurePct: number;
  deliveryExposurePct: number;
  entryRatePct: number;
  conversionRatePct: number;
  repurchaseRatePct: number;
  avgOrderValuePct: number;
  marginPct: number;
  revenuePct: number;
  ordersPct: number;
  deliveryOrdersPct: number;
  staffCostAdd: number;
  staffCostPct: number;
  promoCostAdd: number;
  rentPct: number;
  platformCostPct: number;
  miscCostAdd: number; // 其它固定成本加项（暗线耦合：房东日摊杂费等，§2.2）
  efficiencyPct: number;
  ratingAdd: number;
  creditAdd: number;
  cashAdd: number;
  accountsPayableAdd: number;
  ownerFatigueAdd: number;
  hidden: Partial<Record<keyof HiddenLines, number>>;
  soft: Partial<Record<keyof SoftHidden, number>>;
  durationDays?: number;
  futureEffect?: string;
  unlock?: string;
  cooldown?: string;
  ending?: string;
  random?: string;
}

// —— 结算结果 ——
export interface DailyResult {
  day: number;
  eventId: string | null;
  decisions: DecisionState;
  exposure: number;
  dineInExposure: number;
  deliveryExposure: number;
  entryRate: number;
  conversionRate: number;
  repurchaseRate: number;
  orders: number;
  avgOrderValue: number;
  revenue: number;
  grossMarginRate: number;
  grossProfit: number;
  promoCost: number;
  staffCost: number;
  fixedCostDaily: number;
  platformCost: number;
  netProfit: number;
  cashAfter: number;
  breakEvenRevenue: number;
  safeRevenue: number;
  capacityOverload: boolean;
}

// —— 经营日志条目 ——
export interface BusinessLogEntry {
  day: number;
  eventId: string | null;
  eventTitle?: string;
  decisions: DecisionState;
  revenue: number;
  netProfit: number;
  cashAfter: number;
  note?: string;
}

// —— 事件历史条目 ——
export interface EventLogEntry {
  day: number;
  eventId: string;
  optionId: string;
  title: string;
  visibleEffect?: string;
  /** 选项叙事文案（含占位符模板），渲染时再做 {name}/{店名} 插值。 */
  story?: string;
}

// —— 店里风向 ——
export interface WindMessage {
  day: number;
  level: WindLevel; // 风险等级（不显示数值）
  lines: string[];
}

// —— 月度结算选项 ——
export interface MonthOption {
  id: string;
  label: string;
  desc: string;
}

// —— 月度报表 ——
export interface MonthlyReport {
  month: number;
  revenue: number;
  grossProfit: number;
  netProfit: number;
  cash: number;
  debt: number;
  debtPressure: DebtPressure;
  rentRatio: number;
  staffRatio: number;
  promoEfficiency: number;
  deliveryRatio: number;
  repurchaseChange: number;
  ratingChange: number;
  wind: WindMessage;
  options: MonthOption[];
}

// —— 未来效果队列项 ——
export interface PendingEffect {
  applyAtDay: number; // 到期 day（含）
  source: string; // 来源事件 id
  effects: EffectObject; // 到期时应用的修正
  label?: string;
}

// —— 临时效果（durationDays 持续 N 天）——
export interface TempModifier {
  expiresDay: number;
  effects: EffectObject;
  label?: string;
}

// —— 全局游戏状态 ——
export interface GameState {
  /** 存档版本（v3 = 1）。旧版（v2）存档缺失该字段，加载时由 migrateGameState 补齐到 1。 */
  __version: number;
  day: number; // 1..
  month: number; // 1..
  currentWeek: number; // 当前周数（Math.ceil(day/7)，初始 1）
  cash: number;
  debt: number;
  monthlyRepayment: number;
  credit: number; // 0-100
  netWorth: number; // 净资产 = cash + ΣstoreValuation - debt
  storeCount: number;
  brandRating: number; // 0-100（UI /20）
  stores: StoreState[]; // 第 0 家为主店
  hiddenLines: HiddenLines;
  softHidden: SoftHidden;
  eventHistory: EventLogEntry[];
  businessLog: BusinessLogEntry[];
  windMessages: WindMessage[];
  pendingEffects: PendingEffect[]; // 未来效果队列（futureEffect/unlock/durationDays）
  tempModifiers: TempModifier[]; // durationDays 持续效果
  dayModifiers: DayModifiers; // 当日已发生的事件 Pct 累加（每天重置）
  activeCooldowns: Record<string, number>; // 命名冷却：key→到期 day
  unlockedRoutes: string[]; // unlock 收集
  endingsUnlocked: string[];
  accountsPayable: number; // 应付账款（月结到期）
  reserve: number; // 储备现金（月结"储备现金"选项转入）
  lastLargeEventDay: number; // 大事件后降概率用
  lastSettlement?: DailyResult;
  seed?: number; // 可复现随机种子（可选）
  tutorialSeen: boolean;
  gameOver: boolean;
  activeEnding?: string;
  decisions: DecisionState; // 主店当前策略
  // —— v3 增量字段 ——
  loans: Loan[]; // 真实债务列表
  actionPointsMax: number; // 当天行动点上限（默认 3；bossStrain>阈值→2）
  actionPointsCurrent: number; // 当天剩余行动点
  selectedDailyFocus: string | null; // 当天经营重点 id（7 选 1）
  selectedActionsToday: string[]; // 今天已选行动 id
  actionCooldowns: Record<string, number>; // actionId → 到期 day
  bossStrain: number; // 老板透支（= softHidden.ownerFatigue 的对外别名）
  cashNegativeStreak: number; // cash<0 连续天数（破产检测）
  hiddenHealthyStreak: number; // 8 暗线全健康连续天数
  peakNetWorth: number; // 峰值净资（财务自由/连锁帝国触发用）
  cumulativeNetProfit: number; // 累计净利（仅 EndingScreen 数据回顾）
  eventWeightMods: Record<string, number>; // 行动事件权重累加器（→ eventEngine 选池偏置）
  // —— 贷款子系统增量字段（INCREMENTAL_LOANFIX）——
  autoBailoutCount: number; // [已废弃] 原自动银行兜底计数；现取消自动兜底，保留仅为旧档兼容，固定为 0，不再自增/不参与门控
  predatoryLoanCount: number; // 已借高利贷笔数（利率飙升计数器，逻辑真相源）
  bailoutRateMultiplier: number; // 下一笔高利贷相对基准利率乘子 = PREDATORY_APR_ESCALATION ^ predatoryLoanCount
  /** 累计危机借款次数（含自动兜底 + 手动危机贷）。前 2 次不触发 80% 上限判断，第 3 次起才判断。 */
  crisisLoanCount: number;
  /** 危机应对行动已用次数（防无限拖延）：id → 次数。temporary_price_increase / close_shop 不设上限。 */
  crisisActionUsed?: Record<string, number>;
  /** 亲友借款尝试次数（含失败）：每次尝试都计入（成败都算），仅用于展示"第 N 次"。 */
  friendLoanAttempts?: number;
  /** 亲友成功借款次数：驱动拒绝率升档（成功 0 次=30% / 1 次=70% / 2 次+=95%；被拒不计入成功次数）。 */
  friendLoanSuccessCount?: number;
  /** 危机借款被拒绝后，当天禁止再次发起危机借款（次日 beginDay / resetDailyActionState 重置为 false）。 */
  crisisLoanBlockedToday: boolean;
  /** 员工事件通知（离职/罢工/士气警告等），每次 endDay 生成，打开员工页后清空。 */
  staffNotifications: string[];
  /** 当天是否有老板顶班（主动 owner_shift 或无人排班兜底触发），每日 beginDay/resetDailyActionState 重置为 false。仅作用于主店（index 0）。 */
  ownerCoverToday: boolean;
}

export type { EffectObject, EventDef, EndingDef, EventOption, EventCategory };
