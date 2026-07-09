// futureEffect / unlock 文本解析器（架构 §6.5）
// 仅做文本→语义的映射，不依赖 React，也不直接改状态（改状态统一走 effectResolver）。
import type { EffectObject } from '../types';

/**
 * 把 futureEffect 文本解析为「N 天后到期 + 要应用的修正」。
 * 覆盖数据中出现的所有 futureEffect 文案；未识别的按兜底处理。
 */
export function resolveFutureEffect(
  text: string,
): { applyAtDayOffset: number; effects: EffectObject } | null {
  const map: Record<string, { applyAtDayOffset: number; effects: EffectObject }> = {
    '未来30天午餐曝光 -25%': {
      applyAtDayOffset: 30,
      effects: { exposurePct: -25 },
    },
    不确定事件权重上升: {
      applyAtDayOffset: 14,
      effects: { hidden: { landlordAttention: 5, employeePressure: 3 } },
    },
    培训事件权重上升: {
      applyAtDayOffset: 14,
      effects: { hidden: { employeePressure: 5 } },
    },
    离职权重上升: {
      applyAtDayOffset: 14,
      effects: { hidden: { employeePressure: 8 } },
    },
    '罢工/离职权重上升': {
      applyAtDayOffset: 14,
      effects: { hidden: { employeePressure: 10 } },
    },
    决策失误权重上升: {
      applyAtDayOffset: 14,
      effects: { hidden: { customerTrust: -5, priceControversy: 5 } },
    },
    暴雷权重上升: {
      applyAtDayOffset: 14,
      effects: { hidden: { promoHype: 8 } },
    },
    损耗风险上升: {
      applyAtDayOffset: 14,
      effects: { wasteRisk: 10 },
    },
    差评权重上升: {
      applyAtDayOffset: 14,
      effects: { hidden: { customerTrust: -8 } },
    },
    合规停业权重上升: {
      applyAtDayOffset: 14,
      effects: { hidden: { hygieneRisk: 8 } },
    },
    房东收铺权重上升: {
      applyAtDayOffset: 14,
      effects: { hidden: { landlordAttention: 10 } },
    },
    债务结局权重上升: {
      applyAtDayOffset: 14,
      effects: { hidden: { platformDependence: 3, employeePressure: 3 } },
    },
  };
  if (map[text]) return map[text];
  // 兜底：未识别文本 → 对应暗线 +8 并在 30 天后到期
  return {
    applyAtDayOffset: 30,
    effects: { hidden: { promoHype: 8 } },
  };
}

/** 把 unlock 文本解析为路由 key（数据里已是 key 形式）。 */
export function resolveUnlock(text: string): string | null {
  if (!text) return null;
  return text;
}
