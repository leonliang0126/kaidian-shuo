// 商圈基准参数表（架构 §5.1）
import type { LocationType } from '../types';

export interface LocationProfile {
  locationType: LocationType;
  baseMonthlyRent: number; // 月租基数
  trafficCoef: number; // 人流系数
  volatility: string; // 波动描述
}

export const LOCATION_PROFILES: Record<LocationType, LocationProfile> = {
  学校门口: {
    locationType: '学校门口',
    baseMonthlyRent: 12000,
    trafficCoef: 1.0,
    volatility: '高',
  },
  写字楼: {
    locationType: '写字楼',
    baseMonthlyRent: 22000,
    trafficCoef: 1.2,
    volatility: '中',
  },
  社区底商: {
    locationType: '社区底商',
    baseMonthlyRent: 10000,
    trafficCoef: 0.85,
    volatility: '低',
  },
  商场: {
    locationType: '商场',
    baseMonthlyRent: 38000,
    trafficCoef: 1.5,
    volatility: '中',
  },
  冷清新商圈: {
    locationType: '冷清新商圈',
    baseMonthlyRent: 6000,
    trafficCoef: 0.7,
    volatility: '高',
  },
};

export function getLocationProfile(locationType: LocationType): LocationProfile {
  return LOCATION_PROFILES[locationType];
}
