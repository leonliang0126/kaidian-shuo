// 分店系统（架构 §7 / §10）
import type { GameState, StoreState } from '../types';
import type { RNG } from './rng';
import { cloneState } from './effectResolver';
import { DEPOSIT_MULTIPLIER } from '../utils/constants';
import { OPENING_INVENTORY_COST } from '../data/setupCosts';
import { getDecorationCost } from '../data/decisionOptions';

/** 总部日摊成本（架构 §10.4）：storeCount>=3 起算，月 8000 + 每多一店 4000，按 30 天日摊。 */
export function headquartersDailyCost(storeCount: number): number {
  if (storeCount >= 3) {
    return (8000 + 4000 * (storeCount - 3)) / 30;
  }
  return 0;
}

/** 单店估值（架构 §10.15）：rent × 6。仅用于银行收店阈值（endingEngine），勿用于净资产。 */
export function storeValuation(store: StoreState): number {
  return store.rent * 6;
}

/** 单店实际可收回资产（用于净资产）：押金 + 首批备货 + 装修投入。 */
function storeEquityAssets(store: StoreState): number {
  const deposit = store.rent * DEPOSIT_MULTIPLIER;
  const decorationValue = getDecorationCost(store.decorationLevel);
  return deposit + OPENING_INVENTORY_COST + decorationValue;
}

/** 净资产 = cash + Σ门店实际资产 − debt。 */
export function computeNetWorth(state: GameState): number {
  const totalVal = state.stores.reduce((sum, s) => sum + storeEquityAssets(s), 0);
  return Math.round(state.cash + totalVal - state.debt);
}

/** 分店解锁条件（架构 §10.5）。 */
export function checkBranchUnlock(state: GameState): boolean {
  const main = state.stores[0];
  if (!main) return false;
  const val = computeNetWorth(state);
  const debtOk = state.debt <= 0.3 * Math.max(val, 1);
  return (
    state.cash >= 200000 &&
    main.monthlyNetProfitPositiveStreak >= 1 &&
    state.brandRating >= 80 &&
    debtOk &&
    !main.isInCrisis &&
    state.storeCount < 10
  );
}

/** 开一家直营分店：扣现金、增门店。 */
export function openBranch(state: GameState, _rng: RNG): GameState {
  if (!checkBranchUnlock(state)) return state;
  const s = cloneState(state);
  const main = s.stores[0];
  const branchCost = Math.round(main.rent * 2);
  s.cash -= branchCost;
  const id = `store_${String(s.storeCount + 1).padStart(3, '0')}`;
  const newStore: StoreState = {
    ...main,
    id,
    name: `${main.name} 分店${s.storeCount}`,
    isInCrisis: false,
    crisisDays: 0,
    monthlyRevenue: 0,
    monthlyGrossProfit: 0,
    monthlyNetProfit: 0,
    monthlyPromoCost: 0,
    monthlyDeliveryRevenue: 0,
    monthlyStaffCost: 0,
    lastMonthNetProfit: 0,
    monthlyNetProfitPositiveStreak: 0,
    repurchaseRateStartOfMonth: main.repurchaseRate,
    ratingStartOfMonth: main.rating,
    cashflowStatus: '健康',
  };
  s.stores = [...s.stores, newStore];
  s.storeCount = s.stores.length;
  s.netWorth = computeNetWorth(s);
  return s;
}
