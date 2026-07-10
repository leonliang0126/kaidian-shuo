// 全局常量与助手（localStorage key、周末/月末判定等）
import type { GameState } from '../types';

export const SAVE_KEY = 'kaidian-shuo:save:v1';
export const TUTORIAL_KEY = 'tutorialSeen';
/** 记录存档所属构建版本；与当前 BUILD_ID 不一致时视为旧部署，自动清档（详见 storage.ts）。 */
export const BUILD_KEY = 'kaidian-shuo:build';

// 派生常量（架构 §5.1 / §9.7）
export const BASE_EXPOSURE = 1000;
export const DEFAULT_DELIVERY_RATIO = 0.3;
export const DEFAULT_PLATFORM_RATE = 0.2;
export const DEPOSIT_MULTIPLIER = 2;
/** 保底小事件周期（增量设计 v2 §5）：每 N 天强制一次 small 事件（大事件静默期跳过）。 */
export const SMALL_EVENT_EVERY = 5;

/** 周末：day % 7 === 0 || day % 7 === 6 */
export function isWeekend(day: number): boolean {
  return day % 7 === 0 || day % 7 === 6;
}

/** 月末前 3 天：28/29/0 视为月末（架构 §9.6） */
export function isLast3DaysOfMonth(day: number): boolean {
  return day % 30 >= 28;
}

/** 月结触发：day % 30 === 0 */
export function isMonthEnd(day: number): boolean {
  return day % 30 === 0;
}

/** 月结触发时，下一天属于第几月（每 30 天为一个月） */
export function monthOfDay(day: number): number {
  return Math.floor((day - 1) / 30) + 1;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** 隐藏暗线最大值（用于事件概率提升判定） */
export function maxHiddenLine(state: GameState): number {
  const h = state.hiddenLines;
  return Math.max(
    h.landlordAttention,
    h.employeePressure,
    h.customerTrust,
    h.priceControversy,
    h.promoHype,
    h.supplyRisk,
    h.platformDependence,
    h.hygieneRisk,
  );
}
