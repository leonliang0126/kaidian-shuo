// 事件触发判定（架构 §6.6）：把 trigger 文本转成布尔函数。
import type { EventDef, GameState } from '../types';

type GateFn = (state: GameState) => boolean;

/** 各事件的 gate 条件（仅列出需要条件限定的事件）。 */
const GATES: Record<string, GateFn> = {
  E007: (s) => s.stores[0]?.locationType === '写字楼',
  E008: (s) => s.stores[0]?.locationType === '写字楼',
  E009: (s) => s.stores[0]?.locationType === '学校门口',
  E010: (s) => s.stores[0]?.locationType === '商场',
  E016: (s) => s.hiddenLines.landlordAttention > 50,
  E017: (s) => s.hiddenLines.landlordAttention > 35 && s.cash > s.stores[0].rent,
  E021: (s) => s.hiddenLines.employeePressure > 40,
  E022: (s) =>
    s.hiddenLines.employeePressure > 70 ||
    s.stores[0]?.staffTier === 'owner',
  E023: (s) => s.hiddenLines.employeePressure > 50,
  E026: (s) => s.hiddenLines.employeePressure > 80,
  E027: (s) => s.softHidden.ownerFatigue > 50,
  E028: (s) => s.cash > 50000 && s.hiddenLines.employeePressure > 40,
  E030: (s) => s.hiddenLines.supplyRisk > 50,
  E032: (s) => s.hiddenLines.supplyRisk > 65,
  E033: (s) => s.stores[0]?.supplierTier === 'cheap',
  E034: (s) => s.stores[0]?.supplierTier === 'premium',
  E038: (s) => s.hiddenLines.promoHype > 50,
  E039: (s) => s.hiddenLines.priceControversy > 45,
  E040: (s) => s.hiddenLines.promoHype > 50 && s.hiddenLines.customerTrust < 40,
  E041: (s) => s.hiddenLines.promoHype > 40 && s.stores[0]?.rating > 70,
  E042: (s) =>
    s.stores[0]?.decorationLevel === 'viral' ||
    s.stores[0]?.decorationLevel === 'designer',
  E044: (s) => s.hiddenLines.promoHype > 50,
  E045: (s) => s.stores[0]?.deliveryRatio > 0 && s.stores[0]?.rating > 70,
  E046: (s) => s.hiddenLines.platformDependence > 40,
  E047: (s) => s.stores[0]?.deliveryRatio > 0.5,
  E048: (s) => s.stores[0]?.rating < 70 && s.stores[0]?.deliveryRatio > 0.3,
  E049: (s) => s.hiddenLines.platformDependence > 60,
  E050: (s) => s.stores[0]?.deliveryRatio > 0.4,
  E053: (s) => s.hiddenLines.supplyRisk > 30,
  E055: (s) => s.hiddenLines.platformDependence > 30,
  E056: (s) => s.stores[0]?.decorationLevel === 'viral' || s.stores[0]?.decorationLevel === 'designer',
  E058: (s) => s.hiddenLines.hygieneRisk > 30,
  E059: (s) => s.hiddenLines.hygieneRisk > 50,
  E060: (s) =>
    s.hiddenLines.hygieneRisk > 70 ||
    (s.stores[0]?.supplierTier === 'cheap' && s.hiddenLines.customerTrust < 40),
};

/** 命运事件无 gate。 */
const NO_GATE = new Set(['E012']);

/** 评估事件是否可触发（true=可触发，false=被 gate 阻挡）。 */
export function evaluateGate(ev: EventDef, state: GameState): boolean {
  if (ev.level === 'forced') return false; // 强制事件走 checkForcedEvents
  if (NO_GATE.has(ev.id)) return true;
  const fn = GATES[ev.id];
  if (!fn) return true; // 未列明 gate 的事件，命中池即可触发
  return fn(state);
}
