// 存档迁移（架构 §9.3）：将旧版（v2）或结构残缺的存档补齐为完整的 v3 GameState，
// 保证任何被 v3 代码读取的字段都存在，绝不会因 undefined 而崩溃。
//
// 触发场景：手机端 localStorage 存有 v2 旧档，缺少 eventWeightMods / loans / heat 等
// 增量字段，加载后进入 eventEngine.selectPool 的 Object.entries(state.eventWeightMods)
// 直接抛出 "Object.entries requires that input parameter not be null or undefined"。
import type {
  GameState,
  StoreState,
  HiddenLines,
  SoftHidden,
  DecisionState,
} from '../types';
import { emptyModifiers } from './modifiers';
import { computeNetWorth } from './branch';
import { HEAT_INIT } from '../data/repurchaseHeat';
import { stabilityToBaseQuality, BATCH_CYCLE } from '../data/supplierStability';
import { monthOfDay } from '../utils/constants';

/** 当前存档版本（v3 = 1）。 */
export const SAVE_VERSION = 1;

const DEFAULT_HIDDEN_LINES: HiddenLines = {
  landlordAttention: 0,
  employeePressure: 0,
  customerTrust: 50,
  priceControversy: 0,
  promoHype: 0,
  supplyRisk: 0,
  platformDependence: 0,
  hygieneRisk: 0,
};

const DEFAULT_SOFT_HIDDEN: SoftHidden = {
  ownerFatigue: 0,
  wasteRisk: 0,
  qualityVariance: 0,
  landlordPatience: 100,
  accountingErrorRisk: 0,
  stability: 100,
};

const DEFAULT_DECISIONS: DecisionState = {
  supplierTier: 'local',
  priceStrategy: 'normal',
  decorationLevel: 'clean',
  promotionTier: 'light',
  staffTier: 'standard',
};

/** 把任意一个（可能残缺的）门店对象补齐为完整的 StoreState。 */
function migrateStore(raw: unknown, day: number): StoreState {
  const st = (raw ?? {}) as Record<string, unknown>;
  const supplierStability =
    typeof st.supplierStability === 'number' ? st.supplierStability : 0.6;
  const store: StoreState = {
    id: typeof st.id === 'string' ? st.id : 'store_001',
    name: typeof st.name === 'string' ? st.name : '我的小店',
    storeType: (st.storeType as StoreState['storeType']) ?? '奶茶饮品',
    locationType: (st.locationType as StoreState['locationType']) ?? '学校门口',
    rent: typeof st.rent === 'number' ? st.rent : 0,
    deposit: typeof st.deposit === 'number' ? st.deposit : 0,
    decorationLevel: (st.decorationLevel as StoreState['decorationLevel']) ?? 'clean',
    decorationEntryBonus: typeof st.decorationEntryBonus === 'number' ? st.decorationEntryBonus : 0,
    decorationAovBonus: typeof st.decorationAovBonus === 'number' ? st.decorationAovBonus : 0,
    supplierTier: (st.supplierTier as StoreState['supplierTier']) ?? 'local',
    priceStrategy: (st.priceStrategy as StoreState['priceStrategy']) ?? 'normal',
    promotionTier: (st.promotionTier as StoreState['promotionTier']) ?? 'light',
    staffTier: (st.staffTier as StoreState['staffTier']) ?? 'standard',
    rating: typeof st.rating === 'number' ? st.rating : 80,
    repurchaseRate: typeof st.repurchaseRate === 'number' ? st.repurchaseRate : 0.3,
    efficiency: typeof st.efficiency === 'number' ? st.efficiency : 100,
    capacity: typeof st.capacity === 'number' ? st.capacity : 10,
    deliveryRatio: typeof st.deliveryRatio === 'number' ? st.deliveryRatio : 0.3,
    platformRate: typeof st.platformRate === 'number' ? st.platformRate : 0.18,
    isInCrisis: typeof st.isInCrisis === 'boolean' ? st.isInCrisis : false,
    crisisDays: typeof st.crisisDays === 'number' ? st.crisisDays : 0,
    cashflowStatus: (st.cashflowStatus as StoreState['cashflowStatus']) ?? '健康',
    monthlyRevenue: typeof st.monthlyRevenue === 'number' ? st.monthlyRevenue : 0,
    monthlyGrossProfit: typeof st.monthlyGrossProfit === 'number' ? st.monthlyGrossProfit : 0,
    monthlyNetProfit: typeof st.monthlyNetProfit === 'number' ? st.monthlyNetProfit : 0,
    monthlyPromoCost: typeof st.monthlyPromoCost === 'number' ? st.monthlyPromoCost : 0,
    monthlyDeliveryRevenue:
      typeof st.monthlyDeliveryRevenue === 'number' ? st.monthlyDeliveryRevenue : 0,
    monthlyStaffCost: typeof st.monthlyStaffCost === 'number' ? st.monthlyStaffCost : 0,
    lastMonthNetProfit: typeof st.lastMonthNetProfit === 'number' ? st.lastMonthNetProfit : 0,
    monthlyNetProfitPositiveStreak:
      typeof st.monthlyNetProfitPositiveStreak === 'number'
        ? st.monthlyNetProfitPositiveStreak
        : 0,
    repurchaseRateStartOfMonth:
      typeof st.repurchaseRateStartOfMonth === 'number'
        ? st.repurchaseRateStartOfMonth
        : typeof st.repurchaseRate === 'number'
          ? st.repurchaseRate
          : 0.3,
    ratingStartOfMonth:
      typeof st.ratingStartOfMonth === 'number'
        ? st.ratingStartOfMonth
        : typeof st.rating === 'number'
          ? st.rating
          : 80,
    // —— v3 增量字段（最关键，旧档缺失）——
    heat: typeof st.heat === 'number' ? st.heat : HEAT_INIT,
    currentBatchQuality:
      typeof st.currentBatchQuality === 'number'
        ? st.currentBatchQuality
        : stabilityToBaseQuality(supplierStability),
    batchRenewDay: typeof st.batchRenewDay === 'number' ? st.batchRenewDay : day + BATCH_CYCLE,
    supplierStability,
  };
  return store;
}

/**
 * 将任意旧版/残缺存档对象迁移为完整的 v3 GameState。
 * 原则：保留旧档已有值，仅补齐缺失字段的默认值；__version 提升到 SAVE_VERSION。
 * 不会抛异常（对输入类型做了全面兜底），调用方可在外部再 try/catch 做清档兜底。
 */
export function migrateGameState(raw: unknown): GameState {
  const src = (raw ?? {}) as Record<string, unknown>;
  const day = typeof src.day === 'number' ? src.day : 1;
  const month = typeof src.month === 'number' ? src.month : monthOfDay(day);
  const cash = typeof src.cash === 'number' ? src.cash : 0;

  const rawStores = Array.isArray(src.stores) ? (src.stores as unknown[]) : [];
  const stores: StoreState[] =
    rawStores.length > 0
      ? rawStores.map((st) => migrateStore(st, day))
      : [migrateStore(src, day)]; // 退化：用顶层字段凑一个主店

  const state: GameState = {
    __version: SAVE_VERSION,
    day,
    month,
    cash,
    debt: typeof src.debt === 'number' ? src.debt : 0,
    monthlyRepayment: typeof src.monthlyRepayment === 'number' ? src.monthlyRepayment : 0,
    credit: typeof src.credit === 'number' ? src.credit : 70,
    netWorth: typeof src.netWorth === 'number' ? src.netWorth : cash,
    storeCount: typeof src.storeCount === 'number' ? src.storeCount : stores.length,
    brandRating:
      typeof src.brandRating === 'number'
        ? src.brandRating
        : stores[0]?.rating ?? 80,
    stores,
    hiddenLines: { ...DEFAULT_HIDDEN_LINES, ...(src.hiddenLines as object | undefined) },
    softHidden: { ...DEFAULT_SOFT_HIDDEN, ...(src.softHidden as object | undefined) },
    eventHistory: Array.isArray(src.eventHistory) ? (src.eventHistory as GameState['eventHistory']) : [],
    businessLog: Array.isArray(src.businessLog) ? (src.businessLog as GameState['businessLog']) : [],
    windMessages: Array.isArray(src.windMessages)
      ? (src.windMessages as GameState['windMessages'])
      : [],
    pendingEffects: Array.isArray(src.pendingEffects)
      ? (src.pendingEffects as GameState['pendingEffects'])
      : [],
    tempModifiers: Array.isArray(src.tempModifiers)
      ? (src.tempModifiers as GameState['tempModifiers'])
      : [],
    dayModifiers: src.dayModifiers
      ? { ...emptyModifiers(), ...(src.dayModifiers as object) }
      : emptyModifiers(),
    activeCooldowns: (src.activeCooldowns as Record<string, number> | undefined) ?? {},
    unlockedRoutes: Array.isArray(src.unlockedRoutes)
      ? (src.unlockedRoutes as string[])
      : [],
    endingsUnlocked: Array.isArray(src.endingsUnlocked)
      ? (src.endingsUnlocked as string[])
      : [],
    accountsPayable: typeof src.accountsPayable === 'number' ? src.accountsPayable : 0,
    reserve: typeof src.reserve === 'number' ? src.reserve : 0,
    lastLargeEventDay: typeof src.lastLargeEventDay === 'number' ? src.lastLargeEventDay : -999,
    seed: typeof src.seed === 'number' ? src.seed : undefined,
    tutorialSeen: typeof src.tutorialSeen === 'boolean' ? src.tutorialSeen : false,
    gameOver: typeof src.gameOver === 'boolean' ? src.gameOver : false,
    activeEnding: typeof src.activeEnding === 'string' ? src.activeEnding : undefined,
    decisions: { ...DEFAULT_DECISIONS, ...(src.decisions as object | undefined) },
    // —— v3 增量字段（全部补齐默认，避免 undefined 崩溃）——
    loans: Array.isArray(src.loans) ? (src.loans as GameState['loans']) : [],
    actionPointsMax: typeof src.actionPointsMax === 'number' ? src.actionPointsMax : 3,
    actionPointsCurrent:
      typeof src.actionPointsCurrent === 'number' ? src.actionPointsCurrent : 3,
    selectedDailyFocus:
      typeof src.selectedDailyFocus === 'string' ? src.selectedDailyFocus : null,
    selectedActionsToday: Array.isArray(src.selectedActionsToday)
      ? (src.selectedActionsToday as string[])
      : [],
    actionCooldowns: (src.actionCooldowns as Record<string, number> | undefined) ?? {},
    bossStrain: typeof src.bossStrain === 'number' ? src.bossStrain : 0,
    cashNegativeStreak: typeof src.cashNegativeStreak === 'number' ? src.cashNegativeStreak : 0,
    hiddenHealthyStreak: typeof src.hiddenHealthyStreak === 'number' ? src.hiddenHealthyStreak : 0,
    peakNetWorth: typeof src.peakNetWorth === 'number' ? src.peakNetWorth : cash,
    cumulativeNetProfit:
      typeof src.cumulativeNetProfit === 'number' ? src.cumulativeNetProfit : 0,
    eventWeightMods: (src.eventWeightMods as Record<string, number> | undefined) ?? {},
  };

  // 用真实公式修正净资产（若旧档没有则按 cash 兜底），并同步峰值净资。
  try {
    if (typeof src.netWorth !== 'number') {
      state.netWorth = computeNetWorth(state);
    }
    if (typeof src.peakNetWorth !== 'number') {
      state.peakNetWorth = state.netWorth;
    }
  } catch {
    // computeNetWorth 失败时保留 cash 兜底值
  }

  return state;
}
