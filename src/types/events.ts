// 事件相关类型（与 GameState 类型分离，便于 core 纯函数复用）
import type { HiddenLines, SoftHidden } from './index';

/**
 * 通用 effect 对象。
 * decision-options.json 与 events.v0.1.json 共用同一 schema。
 * 分为两类：
 *  - 当日结算修正（Pct 乘法 / 百分点加法）：由 modifiers.ts 聚合进 DayModifiers
 *  - 即时/持久状态改动（cash/隐藏暗线/软暗线/评分/租金/效率...）：由 effectResolver.applyEffects 直接作用
 */
export interface EffectObject {
  cash?: number | string; // number 直接加减；string 为令牌（见 core/effectResolver）
  revenuePct?: number;
  ordersPct?: number;
  marginPct?: number; // 毛利率「百分点加法」
  avgOrderValuePct?: number; // 客单价「百分比乘法」
  conversionRatePct?: number;
  entryRatePct?: number;
  repurchaseRatePct?: number; // 百分点加法
  exposurePct?: number; // 百分比乘法
  dineInExposurePct?: number;
  deliveryExposurePct?: number;
  deliveryOrdersPct?: number;
  rating?: number; // 0-100 内部分 加法
  staffCost?: number; // 加性成本
  staffCostPct?: number;
  promoCost?: number; // 加性推广成本
  rentPct?: number; // 持久修改 store.rent
  platformCostPct?: number; // 当日乘子（结算公式 §5.3）
  miscCostAdd?: number; // 其它固定成本加项（暗线耦合，§2.2）
  efficiencyPct?: number; // 持久修改 store.efficiency
  accountsPayable?: number;
  debt?: number; // 借款负债（即时累加，夹紧 ≥0）
  monthlyRepayment?: number; // 对应月供（即时累加，夹紧 ≥0）
  ownerFatigue?: number;
  credit?: number;
  hidden?: Partial<Record<keyof HiddenLines, number>>;
  soft?: Partial<Record<keyof SoftHidden, number>>;
  random?: string; // 软效果：按描述近似
  futureEffect?: string; // → pendingEffects
  unlock?: string; // → unlockedRoutes
  durationDays?: number; // 与 Pct 配合：持续 N 天
  stability?: number;
  wasteRisk?: number;
  qualityVariance?: number;
  landlordPatience?: number;
  accountingErrorRisk?: number;
  ending?: string; // 触发结局 id
  cooldown?: string; // 命名冷却
}

export interface EventOption {
  id: string;
  label: string;
  visibleEffect?: string;
  effects: EffectObject;
}

export type EventLevel = 'small' | 'medium' | 'large' | 'fate' | 'forced';

export type EventCategory =
  | 'weather'
  | 'district'
  | 'landlord'
  | 'staff'
  | 'supplier'
  | 'promotion'
  | 'platform'
  | 'competitor'
  | 'equipment'
  | 'compliance'
  | 'forced';

export interface EventDef {
  id: string;
  title: string;
  category: EventCategory;
  level: EventLevel;
  trigger: string;
  cooldownDays: number;
  options: EventOption[];
  wind: string;
}

export type EndingType = 'hidden' | 'stop_loss' | 'failure';

export interface EndingDef {
  id: string;
  title: string;
  type: EndingType;
  conditions?: string[];
  netWorthFormula?: string;
  text: string;
  buttons: string[];
}
