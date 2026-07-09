// 结局判定（架构 §7 / §9）：连锁帝国 / 财富自由 / 体面撤退 / 失败结局。
// 注意：触发结局绝不强制结束存档（玩家可继续游戏）。
import type { EndingDef, GameState } from '../types';
import { getEnding } from '../data/endings';
import { computeNetWorth } from './branch';

/** 当前债务压力等级（与月度结算一致）。 */
function debtPressureOf(state: GameState): 'light' | 'medium' | 'heavy' {
  const main = state.stores[0];
  const avgGrossProfit = main ? main.monthlyGrossProfit / 30 : 0;
  const ratio = state.monthlyRepayment / Math.max(avgGrossProfit, 1);
  if (ratio < 0.2) return 'light';
  if (ratio <= 0.5) return 'medium';
  return 'heavy';
}

/**
 * 检查当前应触发的结局。
 * 优先级：显式触发（activeEnding）> 隐藏结局 > 失败结局（仅首次触发，避免反复弹窗）。
 */
export function checkEndings(state: GameState): EndingDef | null {
  // 1) 危机/月结选项显式触发的结局（如 decent_exit）
  if (state.activeEnding) {
    return getEnding(state.activeEnding) ?? null;
  }

  const main = state.stores[0];
  const netWorth = computeNetWorth(state);
  const positiveStreak = main?.monthlyNetProfitPositiveStreak ?? 0;

  // 2) 连锁帝国：10 家店 + 连续 2 月正净利 + 品牌 4.2★(84) + 无危机 + 总部现金流转正
  if (
    state.storeCount >= 10 &&
    positiveStreak >= 2 &&
    state.brandRating >= 84 &&
    !main?.isInCrisis &&
    (state.storeCount < 3 || (state.lastSettlement?.netProfit ?? 0) >= 0)
  ) {
    return getEnding('chain_empire') ?? null;
  }

  // 3) 财富自由：净资产 >= 500 万 + 连续 3 月正净利 + 债务压力轻 + 仍在经营
  if (
    netWorth >= 5000000 &&
    positiveStreak >= 3 &&
    debtPressureOf(state) === 'light' &&
    state.storeCount >= 1
  ) {
    return getEnding('financial_freedom') ?? null;
  }

  // 4) 失败结局（仅首次触发）
  const failChecks: { id: string; test: () => boolean }[] = [
    {
      id: 'debt_trap',
      test: () => state.debt > 0.6 * Math.max(netWorth, 1) && state.debt > 50000,
    },
    { id: 'landlord_win', test: () => state.hiddenLines.landlordAttention >= 90 },
    {
      id: 'viral_failure',
      test: () => state.hiddenLines.promoHype >= 80 && state.hiddenLines.customerTrust <= 30,
    },
    {
      id: 'menu_without_supply',
      test: () => state.hiddenLines.supplyRisk >= 80 && state.hiddenLines.customerTrust <= 25,
    },
    {
      id: 'one_person_shop',
      test: () =>
        state.day > 30 && state.stores.every((s) => s.staffTier === 'owner'),
    },
    { id: 'suspended', test: () => state.cash < -50000 },
  ];
  for (const f of failChecks) {
    if (!state.endingsUnlocked.includes(f.id) && f.test()) {
      return getEnding(f.id) ?? null;
    }
  }

  return null;
}
