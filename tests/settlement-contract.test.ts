// B.1 结算引擎契约测试：断言具体数值 / 不变量 / Pct 契约 / 承载截断 / customerTrust 下降。
import { describe, it, expect } from 'vitest';
import { createRng } from '../src/core/rng';
import { createNewGame } from '../src/core/createNewGame';
import { resolveSettlement, settleAllStores } from '../src/core/settlement';
import { buildDailyModifiers } from '../src/core/modifiers';
import { applyEffects } from '../src/core/effectResolver';
import { runDailyLoop } from '../src/core/gameLoop';
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

// 无过载配置：冗余人工 + 人为抬高承载，便于孤立测试 Pct 乘法。
function freshGameIsolated(): GameState {
  const rng = createRng(42);
  const s = createNewGame(
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
  s.decisions = { ...s.decisions, staffTier: 'redundant' };
  s.stores = s.stores.map((st) => ({ ...st, staffTier: 'redundant', capacity: 1000 }));
  return s;
}

describe('B.1 结算公式数值正确性（架构 §5.3，基础配置=过载）', () => {
  it('基础配置(basic, cap=140)命中承载上限，按公式算出确定数值', () => {
    const state = freshGame();
    // 用基础人工(cap 140)刻意制造过载，验证截断公式（standard 已上调至 280 不再过载）
    state.decisions = { ...state.decisions, staffTier: 'basic' };
    state.stores = state.stores.map((st) => ({ ...st, staffTier: 'basic', capacity: 140 }));
    const store = state.stores[0];
    const mods = buildDailyModifiers(state, state.decisions);
    const rng = createRng(42);
    const { daily } = resolveSettlement(state, store, state.decisions, mods, rng);

    const sp = STORE_PROFILES[store.storeType];
    const loc = LOCATION_PROFILES[store.locationType];

    const baseExposure = BASE_EXPOSURE * loc.trafficCoef * sp.exposureFactor; // 1000
    const dineInExp = baseExposure * (1 - store.deliveryRatio) * (1 + mods.exposurePct / 100);
    const deliveryExp = baseExposure * store.deliveryRatio * (1 + mods.exposurePct / 100);
    expect(daily.exposure).toBe(Math.round(dineInExp + deliveryExp)); // 1080
    expect(daily.exposure).toBe(1080);

    // 订单（含复购，light 推广 exposurePct=8）
    const entryRate = sp.entryRate + mods.entryRatePct / 100;
    const conversionRate = sp.conversionRate + mods.conversionRatePct / 100;
    const repurchaseRate = store.repurchaseRate + mods.repurchaseRatePct / 100;
    const dineInOrders = dineInExp * entryRate * conversionRate * (1 + repurchaseRate);
    const deliveryOrders = deliveryExp * entryRate * conversionRate * (1 + repurchaseRate);
    const orders0 = dineInOrders + deliveryOrders; // ~257.13
    const cap = getStaffCapacity(state.decisions.staffTier) * (store.efficiency / 100); // 140

    expect(daily.capacityOverload).toBe(true);
    expect(daily.orders).toBe(Math.round(cap)); // 截断到 140
    expect(Math.round(orders0)).toBeGreaterThan(cap); // 确发生过截断

    const avgOrderValue = sp.avgOrderValue * (1 + mods.avgOrderValuePct / 100);
    const grossMargin = sp.grossMargin + mods.marginPct / 100;
    const revenue = daily.orders * avgOrderValue * (1 + mods.revenuePct / 100);
    const grossProfit = revenue * grossMargin;
    const promoCost = getPromotionCost(state.decisions.promotionTier); // 300
    const staffCost = getStaffDailyCost(state.decisions.staffTier); // 250
    const fixedCostDaily = store.rent / 30; // 400
    const platformCost = revenue * store.deliveryRatio * store.platformRate * (1 + mods.platformCostPct / 100);

    expect(daily.revenue).toBe(Math.round(revenue)); // 2520
    expect(daily.grossProfit).toBe(Math.round(grossProfit)); // 1310
    expect(daily.promoCost).toBe(promoCost); // 300
    expect(daily.staffCost).toBe(staffCost); // 250
    expect(daily.fixedCostDaily).toBe(Math.round(fixedCostDaily)); // 400
    expect(daily.platformCost).toBe(Math.round(platformCost)); // 151
    expect(daily.revenue).toBe(2520);
    expect(daily.grossProfit).toBe(1310);
    expect(daily.promoCost).toBe(300);
    expect(daily.staffCost).toBe(250);
    expect(daily.fixedCostDaily).toBe(400);
    expect(daily.platformCost).toBe(151);

    const netProfit = grossProfit - promoCost - staffCost - fixedCostDaily - platformCost;
    expect(daily.netProfit).toBe(Math.round(netProfit)); // 209
    expect(daily.netProfit).toBe(209);
    expect(daily.cashAfter).toBe(Math.round(state.cash + daily.netProfit)); // 随统一起手现金变化
    expect(daily.cashAfter).toBe(Math.round(state.cash + daily.netProfit));

    // 保本线 / 安全线（按结算公式核算：costSum=1101 / 毛利0.52 → round 2118，×1.4 → 2965）
    expect(daily.breakEvenRevenue).toBe(2118);
    expect(daily.safeRevenue).toBe(2965);
  });
});

describe('B.1 Pct 契约（百分点加法 vs 百分比乘法 vs 持久改 rent）', () => {
  it('marginPct = 百分点加法：毛利率按 /100 累加', () => {
    const state = freshGameIsolated();
    const rng = createRng(7);
    const base = buildDailyModifiers(state, state.decisions);
    const { daily: d0 } = resolveSettlement(state, state.stores[0], state.decisions, base, rng);

    const s1 = applyEffects(state, { marginPct: 10 }, rng, { accumulateMods: true });
    const m1 = buildDailyModifiers(s1, s1.decisions);
    const { daily: d1 } = resolveSettlement(s1, s1.stores[0], s1.decisions, m1, rng);

    // 收入不受 margin 影响；毛利 = 收入 × (0.52 + 0.10)
    expect(d1.revenue).toBe(d0.revenue);
    expect(d1.grossMarginRate).toBeCloseTo(0.62, 5);
    expect(d1.grossProfit).toBe(Math.round(d0.revenue * 0.62));
  });

  it('exposurePct = 百分比乘法：曝光 ×(1+pct/100)，收入随之等比放大', () => {
    const state = freshGameIsolated();
    const rng = createRng(7);
    const base = buildDailyModifiers(state, state.decisions);
    const { daily: d0 } = resolveSettlement(state, state.stores[0], state.decisions, base, rng);

    const s1 = applyEffects(state, { exposurePct: 10 }, rng, { accumulateMods: true });
    const m1 = buildDailyModifiers(s1, s1.decisions);
    const { daily: d1 } = resolveSettlement(s1, s1.stores[0], s1.decisions, m1, rng);

    // 相对基线（已含 light 推广 +8 曝光），再 ×1.10
    expect(d1.revenue / d0.revenue).toBeGreaterThan(1.05);
    expect(d1.revenue / d0.revenue).toBeLessThan(1.15);
  });

  it('avgOrderValuePct / ordersPct / revenuePct = 百分比乘法（×1+p/100）', () => {
    const state = freshGameIsolated();
    const rng = createRng(7);
    const base = buildDailyModifiers(state, state.decisions);
    const { daily: d0 } = resolveSettlement(state, state.stores[0], state.decisions, base, rng);

    const sA = applyEffects(state, { avgOrderValuePct: 100 }, rng, { accumulateMods: true });
    const mA = buildDailyModifiers(sA, sA.decisions);
    const { daily: dA } = resolveSettlement(sA, sA.stores[0], sA.decisions, mA, rng);
    expect(dA.revenue / d0.revenue).toBeCloseTo(2, 2); // 客单价翻倍 → 收入翻倍

    const sO = applyEffects(state, { ordersPct: 100 }, rng, { accumulateMods: true });
    const mO = buildDailyModifiers(sO, sO.decisions);
    const { daily: dO } = resolveSettlement(sO, sO.stores[0], sO.decisions, mO, rng);
    expect(dO.revenue / d0.revenue).toBeCloseTo(2, 2); // 订单翻倍 → 收入翻倍

    const sR = applyEffects(state, { revenuePct: 100 }, rng, { accumulateMods: true });
    const mR = buildDailyModifiers(sR, sR.decisions);
    const { daily: dR } = resolveSettlement(sR, sR.stores[0], sR.decisions, mR, rng);
    expect(dR.revenue / d0.revenue).toBeCloseTo(4, 2); // 订单×2 且收入×2 → 4 倍
  });

  it('rentPct = 持久修改 store.rent（而非当日）', () => {
    const state = freshGameIsolated();
    const rng = createRng(7);
    const before = state.stores[0].rent;
    const s1 = applyEffects(state, { rentPct: 10 }, rng, { accumulateMods: true });
    expect(s1.stores[0].rent).toBe(Math.round(before * 1.1));
    // 持久：applyEffects 返回的 rent 已改，且不影响其它字段的当日结算链路
  });
});

describe('B.1 承载过载 → 截断（代价为曝光浪费，不再额外扣 customerTrust）', () => {
  it('过载当天截断订单，但 customerTrust 保持不变（设计文档 §2 未定义过载→信任惩罚）', () => {
    // 用恒不触发事件的 rng（>baseProb）隔离：仅结算 + 截断
    const noEventRng = (): number => 0.99;
    let state = createNewGame(
      {
        initialCashTier: 300000,
        storeType: '奶茶饮品',
        locationType: '学校门口',
        decorationLevel: 'clean',
        storeName: '过载店',
        seed: 1,
      },
      noEventRng,
    );
    const before = state.hiddenLines.customerTrust; // 50
    // 用基础人工(cap 140)刻意制造过载（standard 已上调至 280 不再过载）
    state.decisions = { ...state.decisions, staffTier: 'basic' };
    state.stores = state.stores.map((st) => ({ ...st, staffTier: 'basic', capacity: 140 }));
    const res = runDailyLoop(state, noEventRng);
    // 基础人工 cap=140 < 257 订单 → 过载
    expect(res.daily?.capacityOverload).toBe(true);
    // 截断即代价，信任不受影响
    expect(res.state.hiddenLines.customerTrust).toBe(before);
  });

  it('settleAllStores 多店累加净利且主店 cashAfter 为全局累加', () => {
    const state = freshGame();
    const rng = createRng(7);
    const { totalNetProfit, mainDaily } = settleAllStores(state, rng);
    expect(typeof totalNetProfit).toBe('number');
    expect(mainDaily.cashAfter).toBe(Math.round(state.cash + totalNetProfit));
  });
});
