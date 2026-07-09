// 每日结算引擎（架构 §5.3，严格顺序）
import type {
  DailyResult,
  DayModifiers,
  DecisionState,
  GameState,
  StoreState,
} from '../types';
import type { RNG } from './rng';
import { BASE_EXPOSURE, clamp } from '../utils/constants';
import { getStoreProfile } from '../data/storeProfiles';
import { getLocationProfile } from '../data/locationProfiles';
import { getPromotionCost, getStaffDailyCost } from '../data/decisionOptions';
import { buildDailyModifiers, addPenaltyModifiers } from './modifiers';
import { deriveDailyPenalties, ramp } from './hiddenPenalties';
import { headquartersDailyCost } from './branch';

/**
 * 结算单店当日经营。返回 DailyResult 与结算后现金。
 * 公式严格按架构 §5.3 顺序执行。
 */
export function resolveSettlement(
  state: GameState,
  store: StoreState,
  decisions: DecisionState,
  mods: DayModifiers,
  _rng: RNG,
): { daily: DailyResult; cashAfter: number } {
  const loc = getLocationProfile(store.locationType);
  const sp = getStoreProfile(store.storeType);

  // 1) 基准曝光与拆分
  const baseExposure = BASE_EXPOSURE * loc.trafficCoef * sp.exposureFactor;
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
  const exposure = dineInExp + deliveryExp;

  // 率/值修正（装修档已固化为门店基准，不再每日参与决策，§4.1）
  let entryRate = clamp(
    sp.entryRate + mods.entryRatePct / 100 + store.decorationEntryBonus / 100,
    0,
    0.95,
  );
  let conversionRate = clamp(sp.conversionRate + mods.conversionRatePct / 100, 0, 0.95);
  const repurchaseRate = clamp(store.repurchaseRate + mods.repurchaseRatePct / 100, 0, 0.9);
  const avgOrderValue =
    sp.avgOrderValue * (1 + (mods.avgOrderValuePct + store.decorationAovBonus) / 100);
  const grossMargin = clamp(sp.grossMargin + mods.marginPct / 100, 0.05, 0.95);

  // 人力压力统一块（老板疲劳 + 员工压力，§2.3）：转化率下降、承载下降
  let effectiveCap = store.capacity;
  const empPen = ramp(state.hiddenLines.employeePressure, 40); // 0..1
  if (state.softHidden.ownerFatigue > 70) {
    conversionRate = clamp(conversionRate - 0.03, 0, 0.95);
    effectiveCap = effectiveCap * 0.95;
  }
  conversionRate = clamp(conversionRate - empPen * 0.08, 0, 0.95); // 员工压力：最多 -8pp 转化
  effectiveCap *= 1 - empPen * 0.1; // 员工压力：最多 -10% 承载

  // 2) 订单（堂食/外卖拆分后合计；revenuePct/ordersPct 作总乘子）
  const dineInOrders =
    dineInExp * entryRate * conversionRate * (1 + repurchaseRate);
  const deliveryOrders =
    deliveryExp *
    entryRate *
    conversionRate *
    (1 + repurchaseRate) *
    (1 + mods.deliveryOrdersPct / 100);
  const orders0 = dineInOrders + deliveryOrders;
  const orders = Math.round(
    orders0 * (1 + mods.ordersPct / 100) * (1 + mods.revenuePct / 100),
  );

  // 3) 承载上限
  let capacityOverload = false;
  let finalOrders = orders;
  if (orders > effectiveCap) {
    capacityOverload = true;
    finalOrders = Math.round(effectiveCap);
  }

  // 4) 金额
  const revenue = finalOrders * avgOrderValue * (1 + mods.revenuePct / 100);
  const grossProfit = revenue * grossMargin;
  const promoCost = getPromotionCost(decisions.promotionTier) + mods.promoCostAdd;
  const staffCost =
    (getStaffDailyCost(decisions.staffTier) + mods.staffCostAdd) *
    (1 + mods.staffCostPct / 100);
  const fixedCostDaily =
    store.rent / 30 + headquartersDailyCost(state.storeCount) + mods.miscCostAdd;
  const platformCost =
    revenue *
    store.deliveryRatio *
    store.platformRate *
    (1 + mods.platformCostPct / 100);
  const netProfit = grossProfit - promoCost - staffCost - fixedCostDaily - platformCost;
  const cashAfter = state.cash + netProfit;

  // 5) 保本线 / 安全线
  const costSum = promoCost + staffCost + fixedCostDaily + platformCost;
  const breakEvenRevenue = grossMargin > 0 ? costSum / grossMargin : 0;
  const safeRevenue = breakEvenRevenue * 1.4;

  const daily: DailyResult = {
    day: state.day,
    eventId: null, // 由调用方（store/gameLoop）填入今日事件 id
    decisions: { ...decisions },
    exposure: Math.round(exposure),
    dineInExposure: Math.round(dineInExp),
    deliveryExposure: Math.round(deliveryExp),
    entryRate,
    conversionRate,
    repurchaseRate,
    orders: finalOrders,
    avgOrderValue,
    revenue: Math.round(revenue),
    grossMarginRate: grossMargin,
    grossProfit: Math.round(grossProfit),
    promoCost: Math.round(promoCost),
    staffCost: Math.round(staffCost),
    fixedCostDaily: Math.round(fixedCostDaily),
    platformCost: Math.round(platformCost),
    netProfit: Math.round(netProfit),
    cashAfter: Math.round(cashAfter),
    breakEvenRevenue: Math.round(breakEvenRevenue),
    safeRevenue: Math.round(safeRevenue),
    capacityOverload,
  };

  return { daily, cashAfter: Math.round(cashAfter) };
}

function deriveCashflowStatus(netProfit: number, monthlyNet: number): StoreState['cashflowStatus'] {
  if (netProfit < 0 && monthlyNet < 0) return '危险';
  if (netProfit < 0) return '紧张';
  return '健康';
}

/**
 * 结算全部门店（多店收入叠加）。
 * 返回更新后的 stores、总净利、主店 DailyResult、是否有门店超载。
 */
export function settleAllStores(
  state: GameState,
  rng: RNG,
): {
  stores: StoreState[];
  totalNetProfit: number;
  mainDaily: DailyResult;
  anyOverload: boolean;
} {
  let totalNetProfit = 0;
  let anyOverload = false;
  const dailies: DailyResult[] = [];
  const stores = state.stores.map((store) => {
    const storeDecisions: DecisionState = {
      supplierTier: store.supplierTier,
      priceStrategy: store.priceStrategy,
      promotionTier: store.promotionTier,
      staffTier: store.staffTier,
      decorationLevel: store.decorationLevel, // 仅作记录，已移出每日决策（§4）
    };
    // 合并暗线派生惩罚（§2.2）：在结算时叠加进当日修正
    const mods = buildDailyModifiers(state, storeDecisions);
    const derived = deriveDailyPenalties(state.hiddenLines, { rent: store.rent });
    const mergedMods = addPenaltyModifiers(mods, derived);
    const { daily } = resolveSettlement(state, store, storeDecisions, mergedMods, rng);
    dailies.push(daily);
    totalNetProfit += daily.netProfit;
    if (daily.capacityOverload) anyOverload = true;
    return {
      ...store,
      monthlyRevenue: store.monthlyRevenue + daily.revenue,
      monthlyGrossProfit: store.monthlyGrossProfit + daily.grossProfit,
      monthlyNetProfit: store.monthlyNetProfit + daily.netProfit,
      monthlyPromoCost: store.monthlyPromoCost + daily.promoCost,
      monthlyDeliveryRevenue:
        store.monthlyDeliveryRevenue + Math.round(daily.revenue * store.deliveryRatio),
      monthlyStaffCost: store.monthlyStaffCost + daily.staffCost,
      cashflowStatus: deriveCashflowStatus(daily.netProfit, store.monthlyNetProfit + daily.netProfit),
    };
  });

  // 主店 DailyResult 的 cashAfter 用全局累加后的值覆盖，便于展示
  const mainDaily: DailyResult = {
    ...dailies[0],
    cashAfter: Math.round(state.cash + totalNetProfit),
  };

  return { stores, totalNetProfit: Math.round(totalNetProfit), mainDaily, anyOverload };
}

