// 商圈客群极端敏感度调制层（架构 V3-4）：按 store 当前定价/装修/人员/商圈，
// 产出 DayModifiers 修正（进店/转化/复购/曝光），由结算前合并。纯函数。
import type { GameState, StoreState, DayModifiers } from '../types';
import { getSegmentProfile, isDecorationBelow } from '../data/segmentProfiles';
import { emptyModifiers } from './modifiers';

/**
 * 计算某店的客群极端敏感度修正。
 * 价格敏感 → 高价惩罚进店；装修敏感 → 低装修惩罚进店；
 * 出餐敏感 → 承载不足惩罚转化；复购加成；季节波动 → 曝光正弦。
 */
export function applySegmentModulation(state: GameState, store: StoreState): DayModifiers {
  const prof = getSegmentProfile(store.locationType);
  const m = emptyModifiers();

  // 1) 价格敏感：高价策略（raise / premium）→ 进店率惩罚
  if (prof.priceSensitive && (store.priceStrategy === 'raise' || store.priceStrategy === 'premium')) {
    m.entryRatePct -= prof.entryPenaltyAtHighPrice;
  }

  // 2) 装修敏感：低于阈值 → 进店率惩罚
  if (prof.decorationSensitive && isDecorationBelow(store.decorationLevel, prof.decorationMinLevel)) {
    m.entryRatePct -= prof.entryPenaltyLowDecoration;
  }

  // 3) 出餐敏感：承载不足基线 → 转化惩罚（缺口比例 × 系数）
  if (prof.capacitySensitive && prof.capacityBaseline > 0 && store.capacity < prof.capacityBaseline) {
    const gap = (prof.capacityBaseline - store.capacity) / prof.capacityBaseline;
    m.conversionRatePct -= Math.round(gap * prof.capacityPenalty);
  }

  // 4) 复购加成（社区底商等）
  if (prof.repurchaseBonus > 0) {
    m.repurchaseRatePct += prof.repurchaseBonus;
  }

  // 5) 季节波动（冷清新商圈）：正弦 exposure 调制
  if (prof.seasonalVolatility > 0 && prof.seasonalPeriod > 0) {
    const phase = (state.day / prof.seasonalPeriod) * Math.PI * 2;
    m.exposurePct += Math.round(Math.sin(phase) * prof.seasonalVolatility);
  }

  return m;
}
