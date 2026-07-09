// V3-3 / V3-7 真实债务系统单元测试（架构 §5.7 / §8.6）：setup 定档、危机贷款、月息滚利封顶、提前还本。
import { describe, it, expect } from 'vitest';
import { createRng } from '../src/core/rng';
import { createNewGame } from '../src/core/createNewGame';
import {
  computeSetupLoan,
  takeCrisisLoan,
  applyMonthlyInterest,
  prepayLoan,
} from '../src/core/loanSystem';
import { channelForOver, LOAN_APR, MONTHLY_INTEREST_DIVISOR, CRISIS_LOAN_BUFFER } from '../src/data/setupCosts';
import type { GameState } from '../src/types';
import type { Loan, LoanChannel } from '../src/types/actions';

function base(): GameState {
  return createNewGame(
    { storeType: '奶茶饮品', locationType: '学校门口', decorationLevel: 'clean', storeName: '贷款店', seed: 99 },
    createRng(99),
  );
}

const mkLoan = (balance: number, apr: number, channel: LoanChannel, overdueDays = 0): Loan => ({
  id: 'l',
  channel,
  principal: balance,
  apr,
  balance,
  accruedInterest: 0,
  startDate: 1,
  overdueDays,
});

describe('setup 超额自动贷款定档（computeSetupLoan）', () => {
  it('over ≤5万 → 银行 4%', () => {
    const loan = computeSetupLoan(30000);
    expect(loan.channel).toBe('bank');
    expect(loan.apr).toBe(LOAN_APR.bank);
    expect(loan.balance).toBe(30000);
    expect(loan.overdueDays).toBe(0);
    expect(loan.startDate).toBe(1);
  });

  it('5万 < over ≤15万 → 民间 12%', () => {
    const loan = computeSetupLoan(80000);
    expect(loan.channel).toBe('private');
    expect(loan.apr).toBe(LOAN_APR.private);
  });

  it('over >15万 → 高利贷 36%', () => {
    const loan = computeSetupLoan(200000);
    expect(loan.channel).toBe('predatory');
    expect(loan.apr).toBe(LOAN_APR.predatory);
  });

  it('channelForOver 与 computeSetupLoan 口径一致', () => {
    const overs = [0, 50000, 50001, 150000, 150001, 300000];
    const expected: LoanChannel[] = ['bank', 'bank', 'private', 'private', 'predatory', 'predatory'];
    overs.forEach((over, i) => {
      expect(channelForOver(over)).toBe(expected[i]);
      expect(computeSetupLoan(over).channel).toBe(expected[i]);
    });
  });
});

describe('危机贷款（takeCrisisLoan）', () => {
  it('续命金额 = max(0,−cash) + buffer，并扣 1 行动点', () => {
    const s = base();
    s.cash = -20000;
    const r = takeCrisisLoan(s, 'bank', () => 0.5);
    const need = 20000 + CRISIS_LOAN_BUFFER;
    expect(r.cash).toBe(s.cash + need); // -20000 + 30000 = 10000
    expect(r.loans[0].balance).toBe(need);
    expect(r.actionPointsCurrent).toBe(s.actionPointsCurrent - 1);
    expect(r.debt).toBe(need);
    expect(r.monthlyRepayment).toBe(Math.round((need * LOAN_APR.bank) / MONTHLY_INTEREST_DIVISOR));
  });

  it('渠道决定月供利率（高利贷 > 民间）', () => {
    const bank = takeCrisisLoan(base(), 'bank', () => 0.5);
    const pred = takeCrisisLoan(base(), 'predatory', () => 0.5);
    expect(bank.monthlyRepayment).toBeLessThan(pred.monthlyRepayment);
  });
});

describe('月结月息（applyMonthlyInterest）', () => {
  it('现金充足：利息从现金扣，余额不变', () => {
    const s = base();
    s.cash = 100000;
    s.loans = [mkLoan(10000, 0.12, 'private')];
    s.debt = 10000;
    const interest = Math.round((10000 * 0.12) / 12);
    const r = applyMonthlyInterest(s);
    expect(r.cash).toBe(100000 - interest);
    expect(r.loans[0].balance).toBe(10000);
    expect(r.loans[0].overdueDays).toBe(0);
  });

  it('现金不足：利滚利 + 逾期 +1，累计利息封顶本金×2', () => {
    const s = base();
    s.cash = 0;
    s.loans = [mkLoan(100000, 0.36, 'predatory')];
    s.debt = 100000;
    const interest = Math.round((100000 * 0.36) / 12); // 3000
    const r = applyMonthlyInterest(s);
    expect(r.cash).toBe(0); // 现金不动
    expect(r.loans[0].balance).toBe(100000 + interest); // 103000
    expect(r.loans[0].overdueDays).toBe(1);
    expect(r.loans[0].accruedInterest).toBe(Math.min(interest, 100000 * 2));
  });
});

describe('提前还本（prepayLoan）', () => {
  it('部分还本：余额减少、现金减少', () => {
    const s = base();
    s.cash = 50000;
    s.loans = [mkLoan(10000, 0.04, 'bank')];
    s.debt = 10000;
    const r = prepayLoan(s, 'l', 4000);
    expect(r.loans[0].balance).toBe(6000);
    expect(r.cash).toBe(46000);
    expect(r.debt).toBe(6000);
  });

  it('全额还本：移除贷款、债务清零', () => {
    const s = base();
    s.cash = 50000;
    s.loans = [mkLoan(10000, 0.04, 'bank')];
    s.debt = 10000;
    const r = prepayLoan(s, 'l', 10000);
    expect(r.loans.length).toBe(0);
    expect(r.debt).toBe(0);
    expect(r.cash).toBe(40000);
  });
});
