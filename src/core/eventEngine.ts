// 事件引擎（架构 §6.1 / §6.2）：抽事件、选池、冷却、强制事件。
import type { EventCategory, EventDef, GameState } from '../types';
import type { RNG } from './rng';
import { EVENTS, getEvent } from '../data/events';
import { evaluateGate } from './eventGate';
import { clamp, isLast3DaysOfMonth, isWeekend, maxHiddenLine, SMALL_EVENT_EVERY } from '../utils/constants';
import { EVENT_WEIGHT_TO_CATEGORY } from '../data/eventWeightMap';

const CATEGORIES: EventCategory[] = [
  'weather',
  'district',
  'landlord',
  'staff',
  'supplier',
  'promotion',
  'platform',
  'competitor',
  'equipment',
  'compliance',
];

/** 命名冷却 → 被封锁的事件 id。 */
const NAMED_COOLDOWN_BLOCKS: Record<string, string> = {
  rent_increase_60_days: 'E016',
};

/** 基础事件概率（增量设计 v2 §5：提频）。 */
export function computeBaseProb(state: GameState): number {
  let p = 0.45;
  if (isWeekend(state.day)) p = Math.max(p, 0.55);
  if (isLast3DaysOfMonth(state.day)) p = Math.max(p, 0.55);
  if (maxHiddenLine(state) > 60) p = Math.max(p, 0.7);
  if (state.day - state.lastLargeEventDay <= 3) p = Math.min(p, 0.2);
  return clamp(p, 0, 0.95);
}

/** 事件等级权重（小事件更常出现）。 */
export function levelWeight(e: EventDef): number {
  switch (e.level) {
    case 'small':
      return 3;
    case 'medium':
      return 2;
    case 'large':
      return 1;
    case 'fate':
      return 0.5;
    default:
      return 0;
  }
}

function getLastEventDay(state: GameState, id: string): number {
  let last = -999;
  for (const h of state.eventHistory) {
    if (h.eventId === id) last = Math.max(last, h.day);
  }
  return last;
}

/** 冷却判定：per-event cooldownDays + 命名冷却。 */
export function cooldownOk(e: EventDef, state: GameState): boolean {
  const lastDay = getLastEventDay(state, e.id);
  if (state.day - lastDay < e.cooldownDays) return false;
  for (const key of Object.keys(NAMED_COOLDOWN_BLOCKS)) {
    const blockedId = NAMED_COOLDOWN_BLOCKS[key];
    if (blockedId === e.id && (state.activeCooldowns ?? {})[key] !== undefined) {
      if (state.day <= state.activeCooldowns[key]) return false;
    }
  }
  return true;
}

/** 按暗线权重选事件池（架构 §6.1 selectPool）。 */
export function selectPool(state: GameState, rng: RNG): EventCategory {
  const hl = state.hiddenLines;
  const w: Record<EventCategory, number> = {
    weather: 1,
    district: 1,
    landlord: 1,
    staff: 1,
    supplier: 1,
    promotion: 1,
    platform: 1,
    competitor: 1,
    equipment: 1,
    compliance: 1,
    forced: 0,
  };
  w.landlord += hl.landlordAttention / 30;
  w.staff += hl.employeePressure / 20;
  w.promotion += hl.promoHype / 20 + hl.priceControversy / 30;
  w.supplier += hl.supplyRisk / 20;
  w.platform += hl.platformDependence / 20;
  w.compliance += hl.hygieneRisk / 20;
  w.equipment += hl.hygieneRisk / 30;
  w.competitor += hl.priceControversy / 30;
  if (hl.customerTrust > 60) {
    w.weather += 0.5;
    w.staff += 0.5;
  }
  // 行动事件权重偏置（数据驱动映射，见 data/eventWeightMap.ts）
  for (const [k, v] of Object.entries(state.eventWeightMods ?? {})) {
    const cat = EVENT_WEIGHT_TO_CATEGORY[k];
    if (cat && cat in w) {
      w[cat as EventCategory] += v;
    }
  }
  return weightedPickKey(w, rng);
}

function weightedPickKey(
  weights: Record<EventCategory, number>,
  rng: RNG,
): EventCategory {
  const entries = CATEGORIES.map((c) => ({ c, w: Math.max(0, weights[c]) }));
  const total = entries.reduce((s, e) => s + e.w, 0);
  if (total <= 0) return CATEGORIES[Math.floor(rng() * CATEGORIES.length)];
  let r = rng() * total;
  for (const e of entries) {
    r -= e.w;
    if (r <= 0) return e.c;
  }
  return entries[entries.length - 1].c;
}

function weightedPick<T>(arr: T[], weightFn: (t: T) => number, rng: RNG): T {
  const weights = arr.map((a) => Math.max(0, weightFn(a)));
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) return arr[Math.floor(rng() * arr.length)];
  let r = rng() * total;
  for (let i = 0; i < arr.length; i++) {
    r -= weights[i];
    if (r <= 0) return arr[i];
  }
  return arr[arr.length - 1];
}

function eligible(state: GameState, pool?: EventCategory): EventDef[] {
  return EVENTS.filter(
    (e) =>
      e.level !== 'forced' &&
      (pool ? e.category === pool : true) &&
      evaluateGate(e, state) &&
      cooldownOk(e, state) &&
      levelWeight(e) > 0,
  );
}

/** 跨池兜底：任意池中可触发事件。 */
function fallbackAnyPool(state: GameState, rng: RNG): EventDef | null {
  const all = eligible(state);
  if (all.length === 0) return null;
  return weightedPick(all, levelWeight, rng);
}

/**
 * 每日轻微天气波动：返回叠加到 exposurePct 的百分点（±2.5%）。
 * 在 gameLoop/endDay 结算前叠加到 dayModifiers，不进 buildDailyModifiers，
 * 以免破坏结算契约测试（§5）。
 */
export function dailyWeatherFluctuation(rng: RNG): number {
  return rng() * 5 - 2.5; // [-2.5, +2.5]
}

/**
 * 普通日抽事件：先判定保底小事件或按概率触发，再选池、按权重抽具体事件。
 * 返回 EventDef 或 null（未触发）。
 */
export function drawEvent(state: GameState, rng: RNG): EventDef | null {
  const quiet = state.day - state.lastLargeEventDay <= 3;
  const guaranteedSmall = !quiet && state.day % SMALL_EVENT_EVERY === 0;
  if (!guaranteedSmall && rng() > computeBaseProb(state)) return null;
  const pool = selectPool(state, rng);
  const candidates = guaranteedSmall
    ? eligible(state).filter((e) => e.level === 'small') // 保底只取小事件
    : eligible(state, pool);
  if (candidates.length === 0) {
    const any = fallbackAnyPool(state, rng);
    if (!any) return null;
    return any;
  }
  return weightedPick(candidates, levelWeight, rng);
}

/**
 * 强制事件判定（F001/F002/F003）。
 * ctx.atMonthEnd=true 时检查 F002/F003（月结场景）。
 */
export function checkForcedEvents(
  state: GameState,
  ctx: { atMonthEnd?: boolean } = {},
): EventDef | null {
  // F001 现金流危机：任意时刻 cash < 0
  if (state.cash < 0) return getEvent('F001') ?? null;

  if (ctx.atMonthEnd) {
    const main = state.stores[0];
    const rent = main?.rent ?? 0;
    // 用员工实际月薪总和的 1/30 估算日成本（不含加班）
    const staffDaily = main?.employees?.reduce((sum, e) => sum + Math.floor(e.monthlySalary / 30), 0) ?? 0;
    const staffMonthly = staffDaily * 30;
    // F002 月底房租不足：cash < 房租 + 还款 + 工资
    if (state.cash < rent + state.monthlyRepayment + staffMonthly) {
      return getEvent('F002') ?? null;
    }
    // F003 债务压力爆表：monthlyRepayment > 月均毛利 × 0.5
    const avgGrossProfit = main ? main.monthlyGrossProfit / 30 : 0;
    if (avgGrossProfit > 0 && state.monthlyRepayment > avgGrossProfit * 0.5) {
      return getEvent('F003') ?? null;
    }
  }
  return null;
}
