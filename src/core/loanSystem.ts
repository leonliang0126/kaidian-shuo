// 真实债务系统（架构 V3-3 / V3-7）：统一 10 万起手的 setup 自动贷款、危机贷款、
// 月结月息、提前还本、高利贷逾期。纯函数。所有贷款写入 GameState.loans，
// 绝不做每日循环弹窗（见 doc §8.6）。
import type { GameState } from '../types';
import type { Loan, LoanChannel, CrisisLoanCheck } from '../types/actions';
import type { RNG } from './rng';
import { cloneState } from './effectResolver';
import {
  LOAN_APR,
  MONTHLY_INTEREST_DIVISOR,
  CRISIS_LOAN_BUFFER,
  ACCRUED_INTEREST_CAP_MULT,
  channelForOver,
  predatoryLoanApr,
  PREDATORY_APR_ESCALATION,
  CRISIS_LOAN_NETWORTH_CAP_RATIO,
  CRISIS_LOAN_GRACE_COUNT,
} from '../data/setupCosts';
import { clamp } from '../utils/constants';

let loanSeq = 0;
function nextLoanId(): string {
  loanSeq += 1;
  return `loan_${String(loanSeq).padStart(3, '0')}`;
}

/** 同步 state.debt / monthlyRepayment 与 loans[] 余额（供净资产与危机检测）。 */
function syncLoanTotals(s: GameState): void {
  s.debt = Math.round(s.loans.reduce((sum, l) => sum + l.balance, 0));
  s.monthlyRepayment = Math.round(
    s.loans.reduce((sum, l) => sum + (l.balance * l.apr) / MONTHLY_INTEREST_DIVISOR, 0),
  );
}

/** 由超额金额定档（≤5万银行 / 5–15万民间 / >15万高利贷）生成 setup 一次性贷款。 */
export function computeSetupLoan(over: number): Loan {
  const channel = channelForOver(over);
  return {
    id: nextLoanId(),
    channel,
    principal: over,
    apr: LOAN_APR[channel],
    balance: over,
    accruedInterest: 0,
    startDate: 1,
    overdueDays: 0,
    isSetup: true,
  };
}

/**
 * 危机贷款：仅 cash<0 危机态可用；加现金 + 写 Loan + 扣 1 行动点 → 回到当天。
 * 高利贷（predatory）按飙升公式写入 apr 并递增 predatoryLoanCount / 更新 bailoutRateMultiplier。
 * 注意：本函数不校验 80% 净资上限——该上限仅约束"玩家在危机面板手动发起"的路径（store action 层），
 * setup 一次性贷款与自动兜底（core 直调本函数）不受此限。
 */
export function takeCrisisLoan(state: GameState, channel: LoanChannel, _rng: RNG): GameState {
  const need = Math.max(0, -state.cash) + CRISIS_LOAN_BUFFER;
  // 高利贷：按已借笔数写入飙升利率，并记录第几笔（UI 文案用）
  const isPredatory = channel === 'predatory';
  const apr = isPredatory ? predatoryLoanApr(state.predatoryLoanCount) : LOAN_APR[channel];
  const loanNo = isPredatory ? state.predatoryLoanCount + 1 : undefined;
  const loan: Loan = {
    id: nextLoanId(),
    channel,
    principal: need,
    apr,
    balance: need,
    accruedInterest: 0,
    startDate: state.day,
    overdueDays: 0,
    loanNo,
  };
  const s = cloneState(state);
  s.loans = [...s.loans, loan];
  s.cash += need;
  s.actionPointsCurrent = Math.max(0, s.actionPointsCurrent - 1);
  syncLoanTotals(s);
  s.crisisLoanCount = (s.crisisLoanCount ?? 0) + 1;
  s.bossStrain = s.softHidden.ownerFatigue;
  if (isPredatory) {
    // 不变式：bailoutRateMultiplier === PREDATORY_APR_ESCALATION ** predatoryLoanCount
    s.predatoryLoanCount += 1;
    s.bailoutRateMultiplier = PREDATORY_APR_ESCALATION ** s.predatoryLoanCount;
  }
  return s;
}

/**
 * 是否超过"危机贷款 ≤ 当前净资 80%"上限（setup 一次性贷款 / 自动兜底不走此限）。
 * 口径：state.debt >= state.netWorth × CRISIS_LOAN_NETWORTH_CAP_RATIO。
 * 净资为负时右端为负、debt≥0 恒大于 → 直接命中（资不抵债不允许再加贷）。
 */
export function isCrisisLoanOverCap(state: GameState): boolean {
  return state.debt >= state.netWorth * CRISIS_LOAN_NETWORTH_CAP_RATIO;
}

/**
 * 玩家在危机面板手动发起危机贷款前的可借性检查。
 * - 行动点耗尽（AP≤0）：拒绝（reason='ap'）。
 * - 宽限期内（crisisLoanCount < CRISIS_LOAN_GRACE_COUNT）：跳过 80% 上限判断。
 * - 触及 80% 净资上限（isCrisisLoanOverCap）：拒绝（reason='cap'），仅限银行/亲属；
 *   高利贷（predatory）始终不受上限约束（靠随机不借率 + 利率飙升劝退）。
 */
export function canTakeCrisisLoan(state: GameState, channel: LoanChannel): CrisisLoanCheck {
  if (state.actionPointsCurrent <= 0) return { ok: false, reason: 'ap' };
  // 高利贷不受 80% 上限约束（产品方确认）
  if (channel === 'predatory') return { ok: true, reason: null };
  // 前 CRISIS_LOAN_GRACE_COUNT 次借款不受 80% 上限约束
  const inGrace = (state.crisisLoanCount ?? 0) < CRISIS_LOAN_GRACE_COUNT;
  if (!inGrace && isCrisisLoanOverCap(state)) return { ok: false, reason: 'cap' };
  return { ok: true, reason: null };
}

/** 月结扣月息：balance × apr / 12；现金不足 → 利息滚入本金（利滚利封顶）+ 逾期 +1。 */
export function applyMonthlyInterest(state: GameState): GameState {
  const s = cloneState(state);
  for (const loan of s.loans) {
    const interest = Math.round((loan.balance * loan.apr) / MONTHLY_INTEREST_DIVISOR);
    if (interest <= 0) continue;
    if (s.cash >= interest) {
      s.cash -= interest;
      loan.accruedInterest += interest;
    } else {
      // 现金不足：利息滚入本金（仅 predatory 触发结局），逾期累计
      loan.balance += interest;
      loan.accruedInterest = Math.min(
        loan.accruedInterest + interest,
        loan.principal * ACCRUED_INTEREST_CAP_MULT,
      );
      loan.overdueDays += 1;
    }
  }
  syncLoanTotals(s);
  return s;
}

/** 提前还本：减少某贷款本金（可移除已还清的贷款），消耗现金。 */
export function prepayLoan(state: GameState, loanId: string, amount: number): GameState {
  const s = cloneState(state);
  const loan = s.loans.find((l) => l.id === loanId);
  if (!loan) return state;
  const pay = Math.min(Math.max(0, amount), loan.balance);
  if (pay <= 0) return state;
  const updated: Loan = { ...loan, balance: loan.balance - pay };
  if (updated.balance <= 0) {
    s.loans = s.loans.filter((l) => l.id !== loanId);
  } else {
    s.loans = s.loans.map((l) => (l.id === loanId ? updated : l));
  }
  s.cash -= pay;
  syncLoanTotals(s);
  return s;
}

export { clamp };
