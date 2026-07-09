// 结算公式单元测试：严格校验架构 §5.3 的结算顺序与数值。
// 适配员工系统重构 v3：capacity/staffCost 改为员工动态计算
import { describe, it, expect } from 'vitest';
import { createRng } from '../src/core/rng';
import { createNewGame } from '../src/core/createNewGame';
import { resolveSettlement } from '../src/core/settlement';
import { buildDailyModifiers, emptyModifiers } from '../src/core/modifiers';
import { getPromotionCost } from '../src/data/decisionOptions';
import { computeCapacity, computeStaffCost } from '../src/core/staffSystem';
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
  // 排班所有员工，确保有收入
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

describe('结算公式（架构 §5.3）', () => {
  it('按公式算出确定数值，capacity 和 staffCost 由排班员工计算', () => {
    const state = freshGame();
    const store = state.stores[0];
    const mods = buildDailyModifiers(state, state.decisions);
    const rng = createRng(42);
    const { daily } = resolveSettlement(state, store, state.decisions, mods, rng);

    const sp = STORE_PROFILES[store.storeType];
    const loc = LOCATION_PROFILES[store.locationType];

    // 1) 基准曝光与拆分（promo=light → exposurePct=8，并乘当日客流波动 combined）
    const baseExposure =
      BASE_EXPOSURE *
      loc.trafficCoef *
      sp.exposureFactor *
      getTrafficWaves(state.day, store.locationType, store.storeType).combined;
    const dineInExp = baseExposure * (1 - store.deliveryRatio) * (1 + mods.exposurePct / 100);
    const deliveryExp = baseExposure * store.deliveryRatio * (1 + mods.exposurePct / 100);
    expect(daily.exposure).toBe(Math.round(dineInExp + deliveryExp));

    // 2) 订单（含复购，无额外 Pct）
    // capacity 和 staffCost 由排班员工计算
    const staffCost = computeStaffCost(store.employees);

    // 3) 金额
    const finalOrders = daily.orders;
    const avgOrderValue = sp.avgOrderValue * (1 + mods.avgOrderValuePct / 100);
    const grossMargin = sp.grossMargin + mods.marginPct / 100;
    const revenue = finalOrders * avgOrderValue * (1 + mods.revenuePct / 100);
    const grossProfit = revenue * grossMargin;
    const promoCost = getPromotionCost(state.decisions.promotionTier);
    const fixedCostDaily = store.rent / 30;
    const platformCost = revenue * store.deliveryRatio * store.platformRate * (1 + mods.platformCostPct / 100);

    expect(daily.revenue).toBe(Math.round(revenue));
    expect(daily.grossProfit).toBe(Math.round(grossProfit));
    expect(daily.promoCost).toBe(promoCost);
    expect(daily.staffCost).toBe(Math.round(staffCost));
    expect(daily.fixedCostDaily).toBe(Math.round(fixedCostDaily));
    expect(daily.platformCost).toBe(Math.round(platformCost));

    // 4) 净利 = 毛利 - 各项成本
    const netProfit = grossProfit - promoCost - (staffCost + mods.staffCostAdd) * (1 + mods.staffCostPct / 100) - fixedCostDaily - platformCost;
    expect(daily.netProfit).toBe(Math.round(netProfit));

    // 5) cashAfter 契约：cash + netProfit
    expect(daily.cashAfter).toBe(Math.round(state.cash + daily.netProfit));
  });

  it('承载截断逻辑正确', () => {
    const state = freshGame();
    const store = state.stores[0];
    const mods = buildDailyModifiers(state, state.decisions);
    const rng = createRng(42);
    const { daily } = resolveSettlement(state, store, state.decisions, mods, rng);

    const cap = computeCapacity(store.employees);
    if (daily.orders >= cap) {
      expect(daily.capacityOverload).toBe(true);
      expect(daily.orders).toBe(Math.round(cap));
    } else {
      expect(daily.capacityOverload).toBe(false);
    }
  });

  it('空修正下结算不抛错且数值为有限数', () => {
    const state = freshGame();
    const mods = emptyModifiers();
    const rng = createRng(1);
    const { daily } = resolveSettlement(state, state.stores[0], state.decisions, mods, rng);
    expect(Number.isFinite(daily.revenue)).toBe(true);
    expect(Number.isFinite(daily.netProfit)).toBe(true);
    expect(daily.orders).toBeGreaterThan(0);
  });
});
