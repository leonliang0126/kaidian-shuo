// 客流波动数据层（T01 · 客流波动）
// 提供「选址 × 工作日/周末」与「品类 × 工作日/周末」两张波动表，
// 以及统一的波动系数计算入口 getTrafficWaves（settlement 与 UI 的唯一调用来源）。
// 周末判定统一走 getDayOfWeek(day) >= 6，避免与 constants.isWeekend 的取模口径分歧。
import type { LocationType, StoreType } from '../types';
import { getDayOfWeek } from '../core/staffSystem';
import { getLocationProfile } from '../data/locationProfiles';
import { getStoreProfile } from '../data/storeProfiles';
import { BASE_EXPOSURE } from '../utils/constants';

/** 单条波动系数（工作日 / 周末） */
export interface WaveEntry {
  weekday: number;
  weekend: number;
}

/** 档位阈值：combined 高于 HIGH 视为暴增，低于 LOW 视为清淡，其间为平稳。 */
export const TRAFFIC_LEVEL_HIGH = 1.2;
export const TRAFFIC_LEVEL_LOW = 0.8;

/** 选址 × 工作日/周末 波动系数（架构 §5.1 客流波动） */
export const LOCATION_TRAFFIC_WAVE: Record<LocationType, WaveEntry> = {
  学校门口: { weekday: 1.0, weekend: 0.5 },
  写字楼: { weekday: 1.0, weekend: 0.3 },
  社区底商: { weekday: 0.9, weekend: 1.1 },
  商场: { weekday: 0.7, weekend: 1.3 },
  冷清新商圈: { weekday: 0.7, weekend: 0.9 },
};

/** 品类 × 工作日/周末 波动系数 */
export const STORE_TRAFFIC_WAVE: Record<StoreType, WaveEntry> = {
  奶茶饮品: { weekday: 0.8, weekend: 1.2 },
  小吃快餐: { weekday: 1.0, weekend: 0.7 },
  粉面店: { weekday: 1.0, weekend: 0.7 },
  咖啡主理人店: { weekday: 1.0, weekend: 0.6 },
  加盟连锁店: { weekday: 0.75, weekend: 1.3 },
};

/** 综合波动结果 */
export interface TrafficWaves {
  locWave: number;
  storeWave: number;
  combined: number;
}

/** 客流档位 */
export type TrafficLevel = 'surge' | 'normal' | 'quiet';

/** 组合效果表的一行（用于帮助面板 5×5 矩阵） */
export interface ComboRow {
  locationType: LocationType;
  storeType: StoreType;
  locWave: number;
  storeWave: number;
  combined: number;
  level: TrafficLevel;
}

/** 周末判定：周六(6)/周日(7) 视为周末，统一走 getDayOfWeek(day) >= 6。 */
export function isWeekend(day: number): boolean {
  return getDayOfWeek(day) >= 6;
}

/**
 * 计算某天、某选址、某品类的综合客流波动系数。
 * 这是结算与 UI 计算波动的唯一入口——不在别处重算，保证口径一致。
 */
export function getTrafficWaves(
  day: number,
  locationType: LocationType,
  storeType: StoreType,
): TrafficWaves {
  const wk = isWeekend(day);
  const locWave = wk
    ? LOCATION_TRAFFIC_WAVE[locationType].weekend
    : LOCATION_TRAFFIC_WAVE[locationType].weekday;
  const storeWave = wk
    ? STORE_TRAFFIC_WAVE[storeType].weekend
    : STORE_TRAFFIC_WAVE[storeType].weekday;
  return { locWave, storeWave, combined: locWave * storeWave };
}

/** 由综合系数推导档位 */
export function getTrafficLevel(combined: number): TrafficLevel {
  if (combined >= TRAFFIC_LEVEL_HIGH) return 'surge';
  if (combined >= TRAFFIC_LEVEL_LOW) return 'normal';
  return 'quiet';
}

/**
 * 预估到店曝光人数 = 基准曝光 × 选址人流系数 × 品类曝光系数 × 综合波动。
 * 与 settlement 中 baseExposure 的口径保持一致（乘子顺序相同）。
 */
export function estimateExposure(
  day: number,
  locationType: LocationType,
  storeType: StoreType,
): number {
  const loc = getLocationProfile(locationType);
  const sp = getStoreProfile(storeType);
  const waves = getTrafficWaves(day, locationType, storeType);
  return BASE_EXPOSURE * loc.trafficCoef * sp.exposureFactor * waves.combined;
}

/**
 * 生成 5×5 组合效果表（选址 × 品类），用于帮助/信息面板。
 * isWeekendFlag 决定采用工作日还是周末波动系数。
 */
export function generateTrafficComboRows(isWeekendFlag: boolean): ComboRow[] {
  const rows: ComboRow[] = [];
  (Object.keys(LOCATION_TRAFFIC_WAVE) as LocationType[]).forEach((loc) => {
    (Object.keys(STORE_TRAFFIC_WAVE) as StoreType[]).forEach((st) => {
      const locWave = isWeekendFlag
        ? LOCATION_TRAFFIC_WAVE[loc].weekend
        : LOCATION_TRAFFIC_WAVE[loc].weekday;
      const storeWave = isWeekendFlag
        ? STORE_TRAFFIC_WAVE[st].weekend
        : STORE_TRAFFIC_WAVE[st].weekday;
      const combined = locWave * storeWave;
      rows.push({
        locationType: loc,
        storeType: st,
        locWave,
        storeWave,
        combined,
        level: getTrafficLevel(combined),
      });
    });
  });
  return rows;
}
