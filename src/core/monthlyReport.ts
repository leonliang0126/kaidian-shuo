// 月度结算（架构 §7 / §10）
import type { GameState, MonthlyReport, DebtPressure } from '../types';
import type { RNG } from './rng';
import { cloneState, applyEffects } from './effectResolver';
import { generateWind } from './wind';
import { checkBranchUnlock, openBranch, computeNetWorth } from './branch';
import { applyMonthlyInterest, prepayLoan } from './loanSystem';

function debtPressureOf(monthlyRepayment: number, avgGrossProfit: number): DebtPressure {
  const ratio = monthlyRepayment / Math.max(avgGrossProfit, 1);
  if (ratio < 0.2) return 'light';
  if (ratio <= 0.5) return 'medium';
  return 'heavy';
}

/** 执行月度结算：核算报表、推进月份、重置月度累计。 */
export function runMonthSettlement(
  state: GameState,
  _rng: RNG,
): { state: GameState; report: MonthlyReport } {
  let s = cloneState(state);
  const main = s.stores[0];

  const revenue = s.stores.reduce((sum, st) => sum + st.monthlyRevenue, 0);
  const grossProfit = s.stores.reduce((sum, st) => sum + st.monthlyGrossProfit, 0);
  const netProfit = s.stores.reduce((sum, st) => sum + st.monthlyNetProfit, 0);
  const promoCost = s.stores.reduce((sum, st) => sum + st.monthlyPromoCost, 0);
  const deliveryRevenue = s.stores.reduce((sum, st) => sum + st.monthlyDeliveryRevenue, 0);
  const staffCost = s.stores.reduce((sum, st) => sum + st.monthlyStaffCost, 0);
  const totalRent = s.stores.reduce((sum, st) => sum + st.rent, 0);

  const avgGrossProfit = grossProfit / 30;
  const debtPressure = debtPressureOf(s.monthlyRepayment, avgGrossProfit);

  // 应付账款到期：现金足够则支付
  let cash = s.cash;
  if (s.accountsPayable > 0 && cash >= s.accountsPayable) {
    cash -= s.accountsPayable;
    s.accountsPayable = 0;
  }
  s.cash = cash;

  // 月结扣贷款月息（余额 × 年利率 / 12；高利贷逾期累计）
  s = applyMonthlyInterest(s);

  const rentRatio = revenue > 0 ? totalRent / revenue : 0;
  const staffRatio = revenue > 0 ? staffCost / revenue : 0;
  const promoEfficiency = promoCost > 0 ? revenue / promoCost : 0;
  const deliveryRatio = revenue > 0 ? deliveryRevenue / revenue : 0;
  const repurchaseChange = main ? main.repurchaseRate - main.repurchaseRateStartOfMonth : 0;
  const ratingChange = main ? main.rating - main.ratingStartOfMonth : 0;

  // 连续正净利月数
  s.stores = s.stores.map((st) => {
    const streak = st.monthlyNetProfit > 0 ? st.monthlyNetProfitPositiveStreak + 1 : 0;
    return { ...st, monthlyNetProfitPositiveStreak: streak, lastMonthNetProfit: st.monthlyNetProfit };
  });

  const wind = generateWind(s);

  const options = buildMonthOptions(s);

  const report: MonthlyReport = {
    month: s.month,
    revenue: Math.round(revenue),
    grossProfit: Math.round(grossProfit),
    netProfit: Math.round(netProfit),
    cash: Math.round(s.cash),
    debt: Math.round(s.debt),
    debtPressure,
    rentRatio,
    staffRatio,
    promoEfficiency,
    deliveryRatio,
    repurchaseChange: Number(repurchaseChange.toFixed(3)),
    ratingChange: Number(ratingChange.toFixed(1)),
    wind,
    options,
  };

  // 推进月份 + 重置月度累计
  s.month += 1;
  s.stores = s.stores.map((st) => ({
    ...st,
    monthlyRevenue: 0,
    monthlyGrossProfit: 0,
    monthlyNetProfit: 0,
    monthlyPromoCost: 0,
    monthlyDeliveryRevenue: 0,
    monthlyStaffCost: 0,
    repurchaseRateStartOfMonth: st.repurchaseRate,
    ratingStartOfMonth: st.rating,
  }));
  s.netWorth = computeNetWorth(s);
  s.brandRating = s.stores[0]?.rating ?? s.brandRating;

  return { state: s, report };
}

function buildMonthOptions(state: GameState) {
  const opts = [
    { id: 'next', label: '进入下个月', desc: '维持当前经营节奏，继续经营。' },
    { id: 'optimize', label: '优化效率', desc: '整顿流程，经营效率 +5%。' },
    { id: 'repay', label: '提前还贷', desc: '用现金偿还一部分债务，降低月供。' },
    { id: 'reserve', label: '储备现金', desc: '把 20% 现金转为储备金（危机时可动用）。' },
  ];
  if (checkBranchUnlock(state)) {
    opts.push({ id: 'prepare_branch', label: '准备分店', desc: '满足条件，可开一家直营分店。' });
  }
  opts.push({ id: 'close', label: '关店止损', desc: '主动结束这一局经营。' });
  return opts;
}

/** 应用月结选项（进入下月/优化/还贷/储备/分店/关店）。 */
export function applyMonthOption(
  state: GameState,
  optionId: string,
  rng: RNG,
): GameState {
  let s = cloneState(state);
  switch (optionId) {
    case 'optimize':
      s = applyEffects(s, { efficiencyPct: 5 }, rng, { accumulateMods: false });
      break;
    case 'repay': {
      const pay = Math.min(Math.round(s.cash * 0.3), Math.max(s.debt, 0));
      if (pay > 0 && s.loans.length > 0) {
        // 优先偿还利率最高的贷款
        const target = [...s.loans].sort((a, b) => b.apr - a.apr)[0];
        s = prepayLoan(s, target.id, pay);
      }
      break;
    }
    case 'reserve': {
      const amt = Math.round(s.cash * 0.2);
      s.cash -= amt;
      s.reserve += amt;
      break;
    }
    case 'prepare_branch':
      s = openBranch(s, rng);
      break;
    case 'close':
      s.activeEnding = 'decent_exit';
      if (!s.endingsUnlocked.includes('decent_exit')) s.endingsUnlocked.push('decent_exit');
      break;
    case 'next':
    default:
      break;
  }
  s.netWorth = computeNetWorth(s);
  return s;
}
