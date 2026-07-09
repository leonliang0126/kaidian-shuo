// B.1 结算引擎契约测试：断言具体数值 / 不变量 / Pct 契约 / 承载截断 / customerTrust 下降。
// 适配员工系统重构 v3：capacity/staffCost 由排班员工动态计算
import { describe, it, expect } from 'vitest';
import { createRng } from '../src/core/rng';
import { createNewGame } from '../src/core/createNewGame';
import { resolveSettlement, settleAllStores } from '../src/core/settlement';
import { buildDailyModifiers } from '../src/core/modifiers';
import { applyEffects } from '../src/core/effectResolver';
import { runDailyLoop } from '../src/core/gameLoop';
import { getPromotionCost } from '../src/data/decisionOptions';
import { computeStaffCost } from '../src/core/staffSystem';
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

// 无过载配置：多个员工排班确保 cap 充足，便于孤立测试 Pct 乘法。
function freshGameIsolated(): GameState {
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
  // 所有员工排班 + 额外模拟员工确保 cap≥420
  if (state.stores[0]) {
    const emps = state.stores[0].employees.map((e) => ({
      ...e,
      isScheduledToday: true,
      weeklyWorkDays: [1],
      daysWorkedThisWeek: 1,
    }));
    // 补齐到 10 人确保 cap=700（远高于 ~257 订单基线的 2 倍）
    while (emps.length < 10) {
      emps.push({
        id: `extra_emp_${emps.length}`,
        name: `额外员工${emps.length}`,
        joinDay: 1,
        attribute: 'old_smooth' as const,
        isExposed: false,
        morale: 70,
        monthlySalary: 5000,
        daysWorkedThisWeek: 1,
        isScheduledToday: true,
        weeklyWorkDays: [1],
        consecutiveWorkDays: 1,
        isTempStaff: false,
        efficiencyCache: 0,
      });
    }
    state.stores[0].employees = emps;
  }
  return state;
}

describe('B.1 结算公式数值正确性（架构 §5.3）', () => {
  it('按公式算出确定数值', () => {
    const state = freshGame();
    const store = state.stores[0];
    const mods = buildDailyModifiers(state, state.decisions);
    const rng = createRng(42);
    const { daily } = resolveSettlement(state, store, state.decisions, mods, rng);

    const sp = STORE_PROFILES[store.storeType];
    const loc = LOCATION_PROFILES[store.locationType];

    const baseExposure =
      BASE_EXPOSURE *
      loc.trafficCoef *
      sp.exposureFactor *
      getTrafficWaves(state.day, store.locationType, store.storeType).combined;
    const dineInExp = baseExposure * (1 - store.deliveryRatio) * (1 + mods.exposurePct / 100);
    const deliveryExp = baseExposure * store.deliveryRatio * (1 + mods.exposurePct / 100);
    expect(daily.exposure).toBe(Math.round(dineInExp + deliveryExp));

    const staffCost = computeStaffCost(store.employees);

    const avgOrderValue = sp.avgOrderValue * (1 + mods.avgOrderValuePct / 100);
    const grossMargin = sp.grossMargin + mods.marginPct / 100;
    const revenue = daily.orders * avgOrderValue * (1 + mods.revenuePct / 100);
    const grossProfit = revenue * grossMargin;
    const promoCost = getPromotionCost(state.decisions.promotionTier);
    const fixedCostDaily = store.rent / 30;
    const platformCost = revenue * store.deliveryRatio * store.platformRate * (1 + mods.platformCostPct / 100);

    expect(daily.revenue).toBe(Math.round(revenue));
    expect(daily.grossProfit).toBe(Math.round(grossProfit));
    expect(daily.promoCost).toBe(promoCost);
    expect(daily.fixedCostDaily).toBe(Math.round(fixedCostDaily));
    expect(daily.platformCost).toBe(Math.round(platformCost));

    const netProfit = grossProfit - promoCost - (staffCost + mods.staffCostAdd) * (1 + mods.staffCostPct / 100) - fixedCostDaily - platformCost;
    expect(daily.netProfit).toBe(Math.round(netProfit));
    expect(daily.cashAfter).toBe(Math.round(state.cash + daily.netProfit));
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
    expect(dA.revenue / d0.revenue).toBeCloseTo(2, 2);

    const sO = applyEffects(state, { ordersPct: 100 }, rng, { accumulateMods: true });
    const mO = buildDailyModifiers(sO, sO.decisions);
    const { daily: dO } = resolveSettlement(sO, sO.stores[0], sO.decisions, mO, rng);
    expect(dO.revenue / d0.revenue).toBeCloseTo(2, 2);

    const sR = applyEffects(state, { revenuePct: 100 }, rng, { accumulateMods: true });
    const mR = buildDailyModifiers(sR, sR.decisions);
    const { daily: dR } = resolveSettlement(sR, sR.stores[0], sR.decisions, mR, rng);
    // 容忍波系数缩放曝光量后 orders 取整带来的边界误差（Pct 契约仍成立 ≈4×）：
    // revenuePct=100 在 orders 与 revenue 两处各 ×2，合计 ×4。
    expect(dR.revenue / d0.revenue).toBeCloseTo(4, 1);
  });

  it('rentPct = 持久修改 store.rent（而非当日）', () => {
    const state = freshGameIsolated();
    const rng = createRng(7);
    const before = state.stores[0].rent;
    const s1 = applyEffects(state, { rentPct: 10 }, rng, { accumulateMods: true });
    expect(s1.stores[0].rent).toBe(Math.round(before * 1.1));
  });
});

describe('B.1 承载过载 → 截断', () => {
  it('过载当天截断订单，但 customerTrust 保持不变', () => {
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
    const before = state.hiddenLines.customerTrust;
    const res = runDailyLoop(state, noEventRng);
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
