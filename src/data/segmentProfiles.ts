// 商圈客群极端敏感度数据（数据驱动：所有客群敏感系数集中此处）。
import type { LocationType, DecorationLevel } from '../types';

export interface SegmentProfile {
  priceSensitive: boolean; // 价格敏感：高定价 → 进店惩罚
  entryPenaltyAtHighPrice: number; // 高定价时进店率惩罚（pct）
  decorationSensitive: boolean; // 装修敏感：低于阈值 → 进店惩罚
  decorationMinLevel: DecorationLevel | null; // 装修最低档（低于则惩罚）
  entryPenaltyLowDecoration: number; // 装修不足时进店率惩罚（pct）
  capacitySensitive: boolean; // 出餐敏感：承载不足 → 转化惩罚
  capacityBaseline: number; // 出餐承载基线
  capacityPenalty: number; // 承载缺口惩罚系数（pct，乘缺口比例）
  repurchaseBonus: number; // 复购加成（pct，社区底商等）
  seasonalVolatility: number; // 季节波动幅度（exposure pct，冷清新商圈）
  seasonalPeriod: number; // 季节波动周期（天）
}

export const SEGMENT_PROFILES: Record<LocationType, SegmentProfile> = {
  学校门口: {
    priceSensitive: true,
    entryPenaltyAtHighPrice: 30,
    decorationSensitive: false,
    decorationMinLevel: null,
    entryPenaltyLowDecoration: 0,
    capacitySensitive: false,
    capacityBaseline: 0,
    capacityPenalty: 0,
    repurchaseBonus: 0,
    seasonalVolatility: 0,
    seasonalPeriod: 30,
  },
  写字楼: {
    priceSensitive: false,
    entryPenaltyAtHighPrice: 0,
    decorationSensitive: false,
    decorationMinLevel: null,
    entryPenaltyLowDecoration: 0,
    capacitySensitive: true,
    capacityBaseline: 220,
    capacityPenalty: 40,
    repurchaseBonus: 0,
    seasonalVolatility: 0,
    seasonalPeriod: 30,
  },
  社区底商: {
    priceSensitive: false,
    entryPenaltyAtHighPrice: 0,
    decorationSensitive: false,
    decorationMinLevel: null,
    entryPenaltyLowDecoration: 0,
    capacitySensitive: false,
    capacityBaseline: 0,
    capacityPenalty: 0,
    repurchaseBonus: 15,
    seasonalVolatility: 0,
    seasonalPeriod: 30,
  },
  商场: {
    priceSensitive: false,
    entryPenaltyAtHighPrice: 0,
    decorationSensitive: true,
    decorationMinLevel: 'memorable',
    entryPenaltyLowDecoration: 40,
    capacitySensitive: false,
    capacityBaseline: 0,
    capacityPenalty: 0,
    repurchaseBonus: 0,
    seasonalVolatility: 0,
    seasonalPeriod: 30,
  },
  冷清新商圈: {
    priceSensitive: false,
    entryPenaltyAtHighPrice: 0,
    decorationSensitive: false,
    decorationMinLevel: null,
    entryPenaltyLowDecoration: 0,
    capacitySensitive: false,
    capacityBaseline: 0,
    capacityPenalty: 0,
    repurchaseBonus: 0,
    seasonalVolatility: 25,
    seasonalPeriod: 30,
  },
};

const DECORATION_ORDER: DecorationLevel[] = ['bare', 'clean', 'memorable', 'viral', 'designer'];

/** 装修档是否低于阈值（用于装修敏感商圈惩罚）。 */
export function isDecorationBelow(
  level: DecorationLevel,
  min: DecorationLevel | null,
): boolean {
  if (!min) return false;
  return DECORATION_ORDER.indexOf(level) < DECORATION_ORDER.indexOf(min);
}

export function getSegmentProfile(locationType: LocationType): SegmentProfile {
  return SEGMENT_PROFILES[locationType];
}
