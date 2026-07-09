// 店型基准参数表（架构 §5.1）
import type { StoreType } from '../types';

export interface StoreProfile {
  storeType: StoreType;
  entryRate: number; // 进店率（基线）
  conversionRate: number; // 成交率（基线）
  repurchaseRate: number; // 复购率（基线）
  avgOrderValue: number; // 客单价（基线）
  grossMargin: number; // 毛利率（基线）
  exposureFactor: number; // 曝光系数
}

export const STORE_PROFILES: Record<StoreType, StoreProfile> = {
  奶茶饮品: {
    storeType: '奶茶饮品',
    entryRate: 0.3,
    conversionRate: 0.62,
    repurchaseRate: 0.28,
    avgOrderValue: 18,
    grossMargin: 0.52,
    exposureFactor: 1.0,
  },
  小吃快餐: {
    storeType: '小吃快餐',
    entryRate: 0.32,
    conversionRate: 0.7,
    repurchaseRate: 0.22,
    avgOrderValue: 22,
    grossMargin: 0.47,
    exposureFactor: 1.1,
  },
  粉面店: {
    storeType: '粉面店',
    entryRate: 0.28,
    conversionRate: 0.66,
    repurchaseRate: 0.35,
    avgOrderValue: 26,
    grossMargin: 0.49,
    exposureFactor: 0.95,
  },
  咖啡主理人店: {
    storeType: '咖啡主理人店',
    entryRate: 0.25,
    conversionRate: 0.58,
    repurchaseRate: 0.3,
    avgOrderValue: 32,
    grossMargin: 0.57,
    exposureFactor: 0.85,
  },
  加盟连锁店: {
    storeType: '加盟连锁店',
    entryRate: 0.3,
    conversionRate: 0.64,
    repurchaseRate: 0.25,
    avgOrderValue: 24,
    grossMargin: 0.4,
    exposureFactor: 1.0,
  },
};

export function getStoreProfile(storeType: StoreType): StoreProfile {
  return STORE_PROFILES[storeType];
}
