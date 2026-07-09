// 客流工作日/周末波动系统单元测试（T01 数据层 / T02 接入 / T03 组合表）
//
// 验证基准 = 任务锁定的两张系数表（选址 × 工作日/周末、品类 × 工作日/周末）
// + 档位阈值（1.2 / 0.8）+ 周末判定（getDayOfWeek(day) >= 6）。
//
// 口径说明：combined 采用「2-因子」口径
//   combined = 选址波动(按日取值) × 品类波动(按日取值)
// 该口径与 getTrafficWaves 实现、结算接入（baseExposure × combined）以及
// UI（工作日高峰 / 周末客流暴增）完全一致，是设计自洽的口径。
// （任务给定的「组合示例」交叉验证数值采用了 3-因子写法，与锁定系数表在
//  2-因子口径下不一致；该差异已在测试汇报中作为 spec 文档歧义单独标注，
//  此处测试严格以锁定系数表为唯一基准。）
import { describe, it, expect } from 'vitest';
import {
  LOCATION_TRAFFIC_WAVE,
  STORE_TRAFFIC_WAVE,
  TRAFFIC_LEVEL_HIGH,
  TRAFFIC_LEVEL_LOW,
  isWeekend,
  getTrafficWaves,
  getTrafficLevel,
  estimateExposure,
  generateTrafficComboRows,
} from '../src/data/trafficPatterns';
import type { LocationType, StoreType } from '../src/types';
import {
  getTrafficPillContent,
  formatEstimatedCount,
  levelClassName,
} from '../src/utils/trafficUI';
import { getLocationProfile } from '../src/data/locationProfiles';
import { getStoreProfile } from '../src/data/storeProfiles';
import { BASE_EXPOSURE } from '../src/utils/constants';

// —— 锁定系数表（验证基准，逐行断言用）——
const LOC_WEEKDAY: Record<LocationType, number> = {
  学校门口: 1.0,
  写字楼: 1.0,
  社区底商: 0.9,
  商场: 0.7,
  冷清新商圈: 0.7,
};
const LOC_WEEKEND: Record<LocationType, number> = {
  学校门口: 0.5,
  写字楼: 0.3,
  社区底商: 1.1,
  商场: 1.3,
  冷清新商圈: 0.9,
};
const STORE_WEEKDAY: Record<StoreType, number> = {
  奶茶饮品: 0.8,
  小吃快餐: 1.0,
  粉面店: 1.0,
  咖啡主理人店: 1.0,
  加盟连锁店: 0.75,
};
const STORE_WEEKEND: Record<StoreType, number> = {
  奶茶饮品: 1.2,
  小吃快餐: 0.7,
  粉面店: 0.7,
  咖啡主理人店: 0.6,
  加盟连锁店: 1.3,
};

const LOCATIONS = Object.keys(LOC_WEEKDAY) as LocationType[];
const STORES = Object.keys(STORE_WEEKDAY) as StoreType[];

function combinedFor(loc: LocationType, st: StoreType, weekend: boolean): number {
  return (weekend ? LOC_WEEKEND[loc] : LOC_WEEKDAY[loc]) *
    (weekend ? STORE_WEEKEND[st] : STORE_WEEKDAY[st]);
}

describe('getTrafficWaves — 锁定系数表逐行断言（2-因子口径）', () => {
  it('工作日(day=1)：locWave / storeWave / combined 与系数表一致', () => {
    for (const loc of LOCATIONS) {
      for (const st of STORES) {
        const w = getTrafficWaves(1, loc, st);
        expect(w.locWave).toBeCloseTo(LOC_WEEKDAY[loc], 6);
        expect(w.storeWave).toBeCloseTo(STORE_WEEKDAY[st], 6);
        expect(w.combined).toBeCloseTo(combinedFor(loc, st, false), 6);
      }
    }
  });

  it('周末(day=6)：locWave / storeWave / combined 与系数表一致', () => {
    for (const loc of LOCATIONS) {
      for (const st of STORES) {
        const w = getTrafficWaves(6, loc, st);
        expect(w.locWave).toBeCloseTo(LOC_WEEKEND[loc], 6);
        expect(w.storeWave).toBeCloseTo(STORE_WEEKEND[st], 6);
        expect(w.combined).toBeCloseTo(combinedFor(loc, st, true), 6);
      }
    }
  });

  it('源码常量表与锁定 spec 表完全一致（防止系数被私自改动）', () => {
    for (const loc of LOCATIONS) {
      expect(LOCATION_TRAFFIC_WAVE[loc].weekday).toBeCloseTo(LOC_WEEKDAY[loc], 6);
      expect(LOCATION_TRAFFIC_WAVE[loc].weekend).toBeCloseTo(LOC_WEEKEND[loc], 6);
    }
    for (const st of STORES) {
      expect(STORE_TRAFFIC_WAVE[st].weekday).toBeCloseTo(STORE_WEEKDAY[st], 6);
      expect(STORE_TRAFFIC_WAVE[st].weekend).toBeCloseTo(STORE_WEEKEND[st], 6);
    }
  });
});

describe('isWeekend — 周末判定', () => {
  it('day 1..5 为工作日 → false', () => {
    for (let d = 1; d <= 5; d++) expect(isWeekend(d)).toBe(false);
  });

  it('day 6 / 7 为周末 → true', () => {
    expect(isWeekend(6)).toBe(true);
    expect(isWeekend(7)).toBe(true);
  });

  it('day 8..12 正确循环（周一~周五，均非周末）', () => {
    const expected = [false, false, false, false, false];
    for (let i = 0; i < 5; i++) expect(isWeekend(8 + i)).toBe(expected[i]);
  });

  it('跨周循环：day 13 / 14 = 周六 / 周日 → true', () => {
    expect(isWeekend(13)).toBe(true);
    expect(isWeekend(14)).toBe(true);
  });

  it('负数/边界：getDayOfWeek 取模口径稳定（day=0 视为周日）', () => {
    // getDayOfWeek 使用 ((day-1)%7+7)%7+1，day=0 → 周日(7) → 周末
    expect(isWeekend(0)).toBe(true);
  });
});

describe('getTrafficLevel — 档位阈值', () => {
  it('combined >= 1.2 → surge', () => {
    expect(getTrafficLevel(1.2)).toBe('surge');
    expect(getTrafficLevel(1.56)).toBe('surge');
    expect(getTrafficLevel(2.0)).toBe('surge');
  });

  it('0.8 <= combined < 1.2 → normal', () => {
    expect(getTrafficLevel(1.19)).toBe('normal');
    expect(getTrafficLevel(1.199)).toBe('normal');
    expect(getTrafficLevel(0.8)).toBe('normal');
    expect(getTrafficLevel(1.0)).toBe('normal');
  });

  it('combined < 0.8 → quiet', () => {
    expect(getTrafficLevel(0.79)).toBe('quiet');
    expect(getTrafficLevel(0.0)).toBe('quiet');
    expect(getTrafficLevel(0.5)).toBe('quiet');
  });

  it('阈值常量与 spec 一致', () => {
    expect(TRAFFIC_LEVEL_HIGH).toBe(1.2);
    expect(TRAFFIC_LEVEL_LOW).toBe(0.8);
  });
});

describe('estimateExposure — 预估曝光公式（不依赖硬编码 magic number）', () => {
  it('返回值 = BASE_EXPOSURE × trafficCoef × exposureFactor × combined（工作日抽样）', () => {
    const loc: LocationType = '商场';
    const st: StoreType = '奶茶饮品';
    const day = 1;
    const w = getTrafficWaves(day, loc, st);
    const expected =
      BASE_EXPOSURE *
      getLocationProfile(loc).trafficCoef *
      getStoreProfile(st).exposureFactor *
      w.combined;
    expect(estimateExposure(day, loc, st)).toBeCloseTo(expected, 6);
  });

  it('周末 vs 工作日：曝光随 combined 比例变化（证明 combined 已乘入）', () => {
    const loc: LocationType = '商场';
    const st: StoreType = '奶茶饮品';
    const wd = getTrafficWaves(1, loc, st);
    const we = getTrafficWaves(6, loc, st);
    const ratio = we.combined / wd.combined;
    const actualRatio = estimateExposure(6, loc, st) / estimateExposure(1, loc, st);
    expect(actualRatio).toBeCloseTo(ratio, 6);
    expect(estimateExposure(6, loc, st)).not.toBe(estimateExposure(1, loc, st));
  });

  it('全 选址×品类×(工作日/周末) 公式自洽', () => {
    for (const loc of LOCATIONS) {
      for (const st of STORES) {
        for (const day of [1, 6]) {
          const w = getTrafficWaves(day, loc, st);
          const expected =
            BASE_EXPOSURE *
            getLocationProfile(loc).trafficCoef *
            getStoreProfile(st).exposureFactor *
            w.combined;
          expect(estimateExposure(day, loc, st)).toBeCloseTo(expected, 6);
        }
      }
    }
  });
});

describe('generateTrafficComboRows — 5×5 组合表', () => {
  it('返回 25 行（5 选址 × 5 品类）', () => {
    expect(generateTrafficComboRows(true)).toHaveLength(25);
    expect(generateTrafficComboRows(false)).toHaveLength(25);
  });

  it('周末视图：每行 combined 与档位正确（2-因子口径）', () => {
    const rows = generateTrafficComboRows(true);
    const map = new Map(rows.map((r) => [`${r.locationType}|${r.storeType}`, r]));
    for (const loc of LOCATIONS) {
      for (const st of STORES) {
        const r = map.get(`${loc}|${st}`)!;
        const expected = combinedFor(loc, st, true);
        expect(r.combined).toBeCloseTo(expected, 6);
        expect(r.level).toBe(getTrafficLevel(expected));
        expect(r.locWave).toBeCloseTo(LOC_WEEKEND[loc], 6);
        expect(r.storeWave).toBeCloseTo(STORE_WEEKEND[st], 6);
      }
    }
  });

  it('工作日视图：每行 combined 与档位正确', () => {
    const rows = generateTrafficComboRows(false);
    const map = new Map(rows.map((r) => [`${r.locationType}|${r.storeType}`, r]));
    for (const loc of LOCATIONS) {
      for (const st of STORES) {
        const r = map.get(`${loc}|${st}`)!;
        const expected = combinedFor(loc, st, false);
        expect(r.combined).toBeCloseTo(expected, 6);
        expect(r.level).toBe(getTrafficLevel(expected));
      }
    }
  });

  it('抽样校验关键组合的 2-因子档位', () => {
    const we = new Map(
      generateTrafficComboRows(true).map((r) => [`${r.locationType}|${r.storeType}`, r]),
    );
    // 商场 + 奶茶饮品 周末：1.3 × 1.2 = 1.56 → surge
    expect(we.get('商场|奶茶饮品')!.combined).toBeCloseTo(1.3 * 1.2, 6);
    expect(we.get('商场|奶茶饮品')!.level).toBe('surge');
    // 写字楼 + 咖啡主理人店 周末：0.3 × 0.6 = 0.18 → quiet（暴跌）
    expect(we.get('写字楼|咖啡主理人店')!.combined).toBeCloseTo(0.3 * 0.6, 6);
    expect(we.get('写字楼|咖啡主理人店')!.level).toBe('quiet');
    // 社区底商 + 小吃快餐 周末：1.1 × 0.7 = 0.77 → quiet（< 0.8）
    expect(we.get('社区底商|小吃快餐')!.combined).toBeCloseTo(1.1 * 0.7, 6);
    expect(we.get('社区底商|小吃快餐')!.level).toBe('quiet');
    // 冷清新商圈 + 奶茶饮品 周末：0.9 × 1.2 = 1.08 → normal
    expect(we.get('冷清新商圈|奶茶饮品')!.combined).toBeCloseTo(0.9 * 1.2, 6);
    expect(we.get('冷清新商圈|奶茶饮品')!.level).toBe('normal');
  });
});

describe('getTrafficPillContent — 档位 → 展示映射', () => {
  it('surge + 工作日 → 📈 工作日高峰（orange 配色）', () => {
    const c = getTrafficPillContent('surge', false);
    expect(c.emoji).toBe('📈');
    expect(c.text).toBe('工作日高峰');
    expect(c.className).toBe('bg-orange-100 text-orange-600');
  });

  it('surge + 周末 → 🔥 周末客流暴增（orange 配色）', () => {
    const c = getTrafficPillContent('surge', true);
    expect(c.emoji).toBe('🔥');
    expect(c.text).toBe('周末客流暴增');
    expect(c.className).toBe('bg-orange-100 text-orange-600');
  });

  it('normal → 😐 客流平稳（zinc 配色）', () => {
    const c = getTrafficPillContent('normal', true);
    expect(c.emoji).toBe('😐');
    expect(c.text).toBe('客流平稳');
    expect(c.className).toBe('bg-zinc-100 text-zinc-600');
  });

  it('quiet → 😴 客流清淡（blue 配色）', () => {
    const c = getTrafficPillContent('quiet', false);
    expect(c.emoji).toBe('😴');
    expect(c.text).toBe('客流清淡');
    expect(c.className).toBe('bg-blue-100 text-blue-600');
  });

  it('levelClassName 与 getTrafficPillContent 配色一致', () => {
    expect(levelClassName('surge')).toBe('bg-orange-100 text-orange-600');
    expect(levelClassName('normal')).toBe('bg-zinc-100 text-zinc-600');
    expect(levelClassName('quiet')).toBe('bg-blue-100 text-blue-600');
  });

  it('formatEstimatedCount 格式化为中文「预估到店 ~N 人」', () => {
    expect(formatEstimatedCount(1234.6)).toBe('预估到店 ~1,235 人');
  });
});
