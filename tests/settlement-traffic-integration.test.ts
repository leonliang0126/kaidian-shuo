// 结算接入客流波动的回归测试（T01 → 结算核心 §5.3）
//
// 目的：
//  1) 确认 baseExposure 已乘入 combined（公式与 trafficPatterns 单一入口一致）；
//  2) 下游 dineInExp / deliveryExp 与 (1 + exposurePct/100) 链路数值合理；
//  3) 提供「漏乘 combined」的专用回归守卫（settlement-contract 中
//     revenuePct=100 的比值断言无法捕获「漏乘 combined」，因为 combined
//     对分子分母同为公共因子；此处用日切换比例守卫 + 显式不乘对照守卫）。
import { describe, it, expect } from 'vitest';
import { createRng } from '../src/core/rng';
import { createNewGame } from '../src/core/createNewGame';
import { resolveSettlement } from '../src/core/settlement';
import { buildDailyModifiers } from '../src/core/modifiers';
import { STORE_PROFILES } from '../src/data/storeProfiles';
import { LOCATION_PROFILES } from '../src/data/locationProfiles';
import { BASE_EXPOSURE } from '../src/utils/constants';
import { getTrafficWaves } from '../src/data/trafficPatterns';
import type { GameState } from '../src/types';

function freshGame(): GameState {
  const rng = createRng(42);
  const state = createNewGame(
    {
      initialCashTier: 300000,
      storeType: '奶茶饮品',
      locationType: '学校门口',
      decorationLevel: 'clean',
      storeName: '测试店',
      seed: 42,
    },
    rng,
  );
  if (state.stores[0]?.employees) {
    state.stores[0].employees = state.stores[0].employees.map((e) => ({
      ...e,
      isScheduledToday: true,
      weeklyWorkDays: [1],
      daysWorkedThisWeek: 1,
    }));
  }
  return state;
}

/** 按 settlement.ts 严格顺序计算 baseExposure（含 combined 与拆分）。 */
function computeBaseExposure(day: number, store: GameState['stores'][number], mods: ReturnType<typeof buildDailyModifiers>) {
  const loc = LOCATION_PROFILES[store.locationType];
  const sp = STORE_PROFILES[store.storeType];
  const combined = getTrafficWaves(day, store.locationType, store.storeType).combined;
  const baseExposure = BASE_EXPOSURE * loc.trafficCoef * sp.exposureFactor * combined;
  const dineInExp =
    baseExposure *
    (1 - store.deliveryRatio) *
    (1 + mods.dineInExposurePct / 100) *
    (1 + mods.exposurePct / 100);
  const deliveryExp =
    baseExposure *
    store.deliveryRatio *
    (1 + mods.deliveryExposurePct / 100) *
    (1 + mods.exposurePct / 100);
  return { baseExposure, exposure: dineInExp + deliveryExp };
}

describe('结算接入 combined 波动（防漏乘回归）', () => {
  it('baseExposure 已乘入 combined，且曝光 = base × (1+exposurePct) 按堂食/外卖拆分', () => {
    const state = freshGame();
    const store = state.stores[0];
    const mods = buildDailyModifiers(state, state.decisions);
    const rng = createRng(42);
    const { daily } = resolveSettlement(state, store, state.decisions, mods, rng);

    const { exposure } = computeBaseExposure(state.day, store, mods);
    expect(daily.exposure).toBe(Math.round(exposure));
  });

  it('漏乘 combined 会被捕获：曝光随周末/工作日 combined 比例变化', () => {
    const state = freshGame();
    const store = state.stores[0];

    const mkExposure = (day: number) => {
      const s = { ...state, day };
      const mods = buildDailyModifiers(s, s.decisions);
      const { daily } = resolveSettlement(s, store, s.decisions, mods, createRng(42));
      return daily.exposure;
    };

    const expWd = mkExposure(1); // 工作日
    const expWe = mkExposure(6); // 周末
    // buildDailyModifiers 与 state.day 无关（仅取决于 dayModifiers/tempModifiers/decisions），
    // 故曝光比值应严格等于 combined 比值。
    const combinedWd = getTrafficWaves(1, store.locationType, store.storeType).combined;
    const combinedWe = getTrafficWaves(6, store.locationType, store.storeType).combined;

    expect(expWe / expWd).toBeCloseTo(combinedWe / combinedWd, 6);
    expect(expWe).not.toBe(expWd);
  });

  it('若完全不乘 combined（用 1.0 代替），曝光会明显偏离实际（显式守卫）', () => {
    const state = freshGame();
    const store = state.stores[0];
    const mods = buildDailyModifiers(state, state.decisions);
    const { daily } = resolveSettlement(state, store, state.decisions, mods, createRng(42));

    const loc = LOCATION_PROFILES[store.locationType];
    const sp = STORE_PROFILES[store.storeType];

    // 含 combined（应与实际曝光一致）
    const { exposure: withCombined } = computeBaseExposure(state.day, store, mods);
    expect(daily.exposure).toBe(Math.round(withCombined));

    // 不含 combined（combined 置 1.0）→ 对 学校门口+奶茶 工作日(combined=0.8) 会高估 ~25%
    const baseWithout =
      BASE_EXPOSURE * loc.trafficCoef * sp.exposureFactor * 1.0;
    const exposureWithout =
      baseWithout *
        (1 - store.deliveryRatio) *
        (1 + mods.dineInExposurePct / 100) *
        (1 + mods.exposurePct / 100) +
      baseWithout *
        store.deliveryRatio *
        (1 + mods.deliveryExposurePct / 100) *
        (1 + mods.exposurePct / 100);

    expect(daily.exposure).not.toBe(Math.round(exposureWithout));
  });

  it('DailyResult 结构未被改动（关键字段存在，且 exposure/dineInExposure/deliveryExposure 自洽）', () => {
    const state = freshGame();
    const store = state.stores[0];
    const mods = buildDailyModifiers(state, state.decisions);
    const { daily } = resolveSettlement(state, store, state.decisions, mods, createRng(42));

    expect(typeof daily.exposure).toBe('number');
    expect(typeof daily.dineInExposure).toBe('number');
    expect(typeof daily.deliveryExposure).toBe('number');
    expect(daily.dineInExposure + daily.deliveryExposure).toBe(daily.exposure);
  });
});
