// V3 危机系统（架构 §5.1 / §5.7）：数据驱动的危机贷款（loanSystem）+ 危机应对行动（actionSystem）。
import { describe, it, expect } from 'vitest';
import { createRng } from '../src/core/rng';
import { createNewGame } from '../src/core/createNewGame';
import { takeCrisisLoan, applyMonthlyInterest, prepayLoan } from '../src/core/loanSystem';
import { takeCrisisAction } from '../src/core/actionSystem';
import { CRISIS_LOAN_BUFFER, LOAN_APR, MONTHLY_INTEREST_DIVISOR } from '../src/data/setupCosts';
import type { GameState } from '../src/types';

function freshGame(): GameState {
  const rng = createRng(42);
  const s = createNewGame(
    { storeType: '奶茶饮品', locationType: '学校门口', decorationLevel: 'clean', storeName: '危机店', seed: 42 },
    rng,
  );
  s.cash = -10000; // 现金流断裂
  return s;
}

describe('危机贷款（takeCrisisLoan）', () => {
  it('银行贷款：cash↑、债务/月供累加、消耗 1 行动点', () => {
    const s = freshGame();
    const r = takeCrisisLoan(s, 'bank', () => 0.5);
    const need = 10000 + CRISIS_LOAN_BUFFER; // max(0,−cash)+buffer
    expect(r.cash).toBe(s.cash + need);
    expect(r.loans.length).toBe(1);
    expect(r.debt).toBe(need);
    expect(r.monthlyRepayment).toBe(Math.round((need * LOAN_APR.bank) / MONTHLY_INTEREST_DIVISOR));
    expect(r.actionPointsCurrent).toBe(s.actionPointsCurrent - 1);
  });

  it('民间/高利贷渠道按各自年利率计月供', () => {
    const privateR = takeCrisisLoan(freshGame(), 'private', () => 0.5);
    const predR = takeCrisisLoan(freshGame(), 'predatory', () => 0.5);
    const need = 10000 + CRISIS_LOAN_BUFFER;
    expect(privateR.monthlyRepayment).toBe(Math.round((need * LOAN_APR.private) / MONTHLY_INTEREST_DIVISOR));
    expect(predR.monthlyRepayment).toBe(Math.round((need * LOAN_APR.predatory) / MONTHLY_INTEREST_DIVISOR));
  });
});

describe('月结月息（applyMonthlyInterest）', () => {
  it('现金充足：利息从现金扣除，余额不变', () => {
    const s = freshGame();
    s.cash = 100000;
    const loan = { ...s.loans[0], balance: 10000, apr: 0.12, overdueDays: 0, accruedInterest: 0, startDate: 1, id: 'l', channel: 'private' as const };
    s.loans = [loan];
    const interest = Math.round((10000 * 0.12) / 12);
    const r = applyMonthlyInterest(s);
    expect(r.cash).toBe(100000 - interest);
    expect(r.loans[0].balance).toBe(10000);
    expect(r.loans[0].overdueDays).toBe(0);
  });

  it('现金不足：利息滚入本金 + 逾期 +1', () => {
    const s = freshGame();
    s.cash = 1000;
    const loan = { ...s.loans[0], balance: 100000, apr: 0.36, overdueDays: 0, accruedInterest: 0, startDate: 1, id: 'l', channel: 'predatory' as const };
    s.loans = [loan];
    const interest = Math.round((100000 * 0.36) / 12); // 3000
    const r = applyMonthlyInterest(s);
    expect(r.cash).toBe(1000); // 现金不动
    expect(r.loans[0].balance).toBe(100000 + interest);
    expect(r.loans[0].overdueDays).toBe(1);
  });
});

describe('提前还本（prepayLoan）', () => {
  it('减少余额并扣现金，可清空贷款', () => {
    const s = freshGame();
    const loan = takeCrisisLoan(s, 'bank', () => 0.5);
    const balanceBefore = loan.loans[0].balance;
    const r = prepayLoan(loan, loan.loans[0].id, balanceBefore); // 全额还
    expect(r.loans.length).toBe(0);
    expect(r.debt).toBe(0);
    expect(r.cash).toBe(loan.cash - balanceBefore);
  });
});

describe('危机应对行动（takeCrisisAction）', () => {
  it('拖欠房租：现金 +半月租、房东关注 +15', () => {
    const s = freshGame();
    const rent = s.stores[0].rent;
    const before = s.hiddenLines.landlordAttention;
    const r = takeCrisisAction(s, 'delay_rent', () => 0.5).state;
    expect(r.cash).toBe(s.cash + rent / 2);
    expect(r.hiddenLines.landlordAttention).toBe(before + 15);
  });

  it('裁员：员工压力 −10、顾客信任 −3、经营稳定性 −3', () => {
    const s = freshGame();
    s.hiddenLines.employeePressure = 50; // 给负向效果留出空间（暗线夹紧 [0,100]）
    const r = takeCrisisAction(s, 'layoff', () => 0.5).state;
    expect(r.hiddenLines.employeePressure).toBe(40);
    expect(r.hiddenLines.customerTrust).toBe(47); // 50 − 3
    expect(r.softHidden.stability).toBe(97); // 100 − 3
  });

  it('卖设备：现金 +5000、卫生风险 −2', () => {
    const s = freshGame();
    s.hiddenLines.hygieneRisk = 50; // 给负向效果留出空间
    const r = takeCrisisAction(s, 'sell_equipment', () => 0.5).state;
    expect(r.cash).toBe(s.cash + 5000);
    expect(r.hiddenLines.hygieneRisk).toBe(48); // 50 − 2
  });

  it('清仓促销：现金 +2000、价格争议 +5', () => {
    const s = freshGame();
    const before = s.hiddenLines.priceControversy;
    const r = takeCrisisAction(s, 'clearance_sale', () => 0.5).state;
    expect(r.cash).toBe(s.cash + 2000);
    expect(r.hiddenLines.priceControversy).toBe(before + 5);
  });

  it('主动关店：标记 decent_exit 结局', () => {
    const s = freshGame();
    const r = takeCrisisAction(s, 'close_shop', () => 0.5).state;
    expect(r.activeEnding).toBe('decent_exit');
    expect(r.endingsUnlocked).toContain('decent_exit');
  });
});
