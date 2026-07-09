// 结算公式单元测试：严格校验架构 §5.3 的结算顺序与数值。
import { describe, it, expect } from 'vitest';
import { createRng } from '../src/core/rng';
import { createNewGame } from '../src/core/createNewGame';
import { resolveSettlement } from '../src/core/settlement';
import { buildDailyModifiers, emptyModifiers } from '../src/core/modifiers';
import { getStaffCapacity, getPromotionCost, getStaffDailyCost } from '../src/data/decisionOptions';
import { STORE_PROFILES } from '../src/data/storeProfiles';
import { LOCATION_PROFILES } from '../src/data/locationProfiles';
import { BASE_EXPOSURE } from '../src/utils/constants';
import type { GameState } from '../src/types';

function freshGame(): GameState {
  const rng = createRng(42);
  return createNewGame(
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
}

describe('结算公式（架构 §5.3）', () => {
  it('标准配置命中承载上限，按公式算出确定数值', () => {
    const state = freshGame();
    // 用基础人工(cap 140)刻意制造过载（standard 已上调至 280 不再过载）
    state.decisions = { ...state.decisions, staffTier: 'basic' };
    state.stores = state.stores.map((s) => ({
      ...s,
      staffTier: 'basic',
      capacity: Math.round(getStaffCapacity('basic') * (s.efficiency / 100)),
    }));
    const store = state.stores[0];
    const mods = buildDailyModifiers(state, state.decisions);
    const rng = createRng(42);
    const { daily } = resolveSettlement(state, store, state.decisions, mods, rng);

    const sp = STORE_PROFILES[store.storeType];
    const loc = LOCATION_PROFILES[store.locationType];

    // 1) 基准曝光与拆分（promo=light → exposurePct=8）
    const baseExposure = BASE_EXPOSURE * loc.trafficCoef * sp.exposureFactor;
    const dineInExp = baseExposure * (1 - store.deliveryRatio) * (1 + mods.exposurePct / 100);
    const deliveryExp = baseExposure * store.deliveryRatio * (1 + mods.exposurePct / 100);
    expect(daily.exposure).toBe(Math.round(dineInExp + deliveryExp));

    // 2) 订单（含复购，无额外 Pct）
    const entryRate = sp.entryRate + mods.entryRatePct / 100;
    const conversionRate = sp.conversionRate + mods.conversionRatePct / 100;
    const repurchaseRate = store.repurchaseRate + mods.repurchaseRatePct / 100;
    const dineInOrders = dineInExp * entryRate * conversionRate * (1 + repurchaseRate);
    const deliveryOrders = deliveryExp * entryRate * conversionRate * (1 + repurchaseRate);
    const orders0 = Math.round((dineInOrders + deliveryOrders) * (1 + mods.ordersPct / 100) * (1 + mods.revenuePct / 100));

    // 基础配置承载 140 < 257 → 超载，截断到承载
    const cap = getStaffCapacity(state.decisions.staffTier) * (store.efficiency / 100);
    expect(daily.capacityOverload).toBe(true);
    expect(daily.orders).toBe(Math.round(cap));
    expect(orders0).toBeGreaterThan(cap); // 证明确实发生了截断

    // 3) 金额
    const finalOrders = daily.orders;
    const avgOrderValue = sp.avgOrderValue * (1 + mods.avgOrderValuePct / 100);
    const grossMargin = sp.grossMargin + mods.marginPct / 100;
    const revenue = finalOrders * avgOrderValue * (1 + mods.revenuePct / 100);
    const grossProfit = revenue * grossMargin;
    const promoCost = getPromotionCost(state.decisions.promotionTier);
    const staffCost = getStaffDailyCost(state.decisions.staffTier);
    const fixedCostDaily = store.rent / 30;
    const platformCost = revenue * store.deliveryRatio * store.platformRate * (1 + mods.platformCostPct / 100);

    expect(daily.revenue).toBe(Math.round(revenue));
    expect(daily.grossProfit).toBe(Math.round(grossProfit));
    expect(daily.promoCost).toBe(promoCost);
    expect(daily.staffCost).toBe(staffCost);
    expect(daily.fixedCostDaily).toBe(Math.round(fixedCostDaily));
    expect(daily.platformCost).toBe(Math.round(platformCost));

    // 4) 净利 = 毛利 - 各项成本
    const netProfit = grossProfit - promoCost - staffCost - fixedCostDaily - platformCost;
    expect(daily.netProfit).toBe(Math.round(netProfit));

    // 5) cashAfter 契约：cash + netProfit
    expect(daily.cashAfter).toBe(Math.round(state.cash + daily.netProfit));
  });

  it('高承载配置不触发超载，订单按公式全量计算', () => {
    const state = freshGame();
    // 切到冗余人工（capacity 450 > 257）
    state.decisions = { ...state.decisions, staffTier: 'redundant' };
    state.stores = state.stores.map((s) => ({
      ...s,
      staffTier: 'redundant',
      capacity: Math.round(getStaffCapacity('redundant') * (s.efficiency / 100)),
    }));

    const mods = buildDailyModifiers(state, state.decisions);
    const rng = createRng(7);
    const { daily } = resolveSettlement(state, state.stores[0], state.decisions, mods, rng);

    expect(daily.capacityOverload).toBe(false);
    // 257 单 × 18 元
    expect(daily.orders).toBe(257);
    expect(daily.revenue).toBe(257 * 18);
    expect(daily.grossProfit).toBe(Math.round(257 * 18 * 0.52));
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
