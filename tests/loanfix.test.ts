// 贷款子系统增量修复（INCREMENTAL_LOANFIX）回归测试：
//   ① 自动兜底限次（前 2 次自动银行兜底，第 3 次起不再兜底）
//   ② 高利贷利率递增（36% → 54% → 81%）
//   ③ 危机贷款 80% 净资上限（isCrisisLoanOverCap / canTakeCrisisLoan / 按钮禁用）
//   ④ 被银行收店结局（Σ(本金+利息) > 估值×1.5 且 netWorth<0 → 复用 suspended 文案）
//   ⑤ 旧档迁移（缺 3 字段的存档 migrate 后不崩溃、字段为默认 0/1）
import { describe, it, expect } from 'vitest';
import { createRng } from '../src/core/rng';
import { createNewGame } from '../src/core/createNewGame';
import { runDailyLoop } from '../src/core/gameLoop';
import { evaluateEndings } from '../src/core/endingEngine';
import { migrateGameState } from '../src/core/migration';
import {
  takeCrisisLoan,
  isCrisisLoanOverCap,
  canTakeCrisisLoan,
  isBankPrivateLocked,
} from '../src/core/loanSystem';
import {
  predatoryLoanApr,
  PREDATORY_APR_ESCALATION,
  CRISIS_LOAN_BANK_CUTOFF,
  PREDATORY_REJECT_CUTOFF,
  FRIEND_LOAN_MIN,
  FRIEND_LOAN_MAX,
  LOAN_SHARK_MIN,
  LOAN_SHARK_MAX,
} from '../src/data/setupCosts';
import { getCrisisActionMaxUses } from '../src/data/crisisActionDefs';
import { CASH_NEGATIVE_STREAK_BANKRUPTCY } from '../src/data/endingTriggers';
import type { GameState } from '../src/types';

const cfg = {
  storeType: '奶茶饮品' as const,
  locationType: '学校门口' as const,
  decorationLevel: 'clean' as const,
  storeName: '贷款修复店',
  seed: 7,
};

function fresh(): GameState {
  return createNewGame(cfg, createRng(cfg.seed));
}

describe('① cash<0 不再自动银行兜底（runDailyLoop 死代码一致性清理）', () => {
  it('runDailyLoop 对 cash<0 不再自动银行兜底：不写贷款、autoBailoutCount 不变', () => {
    const pre = fresh();
    pre.cash = -50000;
    pre.autoBailoutCount = 0;

    const r = runDailyLoop(pre, createRng(11)).state;

    // 取消自动兜底：不偷偷写入任何银行贷款
    expect(r.loans.length).toBe(0);
    // autoBailoutCount 不再自增（保持 0）
    expect(r.autoBailoutCount).toBe(0);
  });

  it('并行对照：cash<0 与 cash>=0 的 runDailyLoop 均不写"自动兜底"贷款', () => {
    const neg = fresh();
    neg.cash = -30000;
    const pos = fresh();
    pos.cash = 1000;
    const rNeg = runDailyLoop(neg, createRng(200)).state;
    const rPos = runDailyLoop(pos, createRng(200)).state;
    // clean 配置无 setup 贷款；两份均不写自动兜底贷款
    expect(rNeg.loans.length).toBe(0);
    expect(rPos.loans.length).toBe(0);
    expect(rNeg.autoBailoutCount).toBe(0);
  });
});

describe('①b 危机门控：第 3 次危机起银行/亲友禁用（isBankPrivateLocked / CRISIS_LOAN_BANK_CUTOFF）', () => {
  it('CRISIS_LOAN_BANK_CUTOFF = 2：前 2 次危机可选银行/亲友，第 3 次起锁定', () => {
    expect(CRISIS_LOAN_BANK_CUTOFF).toBe(2);
  });

  it('crisisLoanCount 0/1 → 不锁定（银行/亲友可选）；2/3 → 锁定（仅高利贷）', () => {
    const s0 = fresh();
    s0.crisisLoanCount = 0;
    expect(isBankPrivateLocked(s0)).toBe(false);

    const s1 = fresh();
    s1.crisisLoanCount = 1;
    expect(isBankPrivateLocked(s1)).toBe(false);

    const s2 = fresh();
    s2.crisisLoanCount = 2;
    expect(isBankPrivateLocked(s2)).toBe(true);

    const s3 = fresh();
    s3.crisisLoanCount = 3;
    expect(isBankPrivateLocked(s3)).toBe(true);
  });

  it('连续危机借款 → crisisLoanCount 递增，满 2 笔后第 3 次危机银行/亲友禁用', () => {
    let s = fresh();
    // 第 1 次危机借款（银行）
    s.cash = -1000;
    s = takeCrisisLoan(s, 'bank', () => 0.5).state;
    expect(s.crisisLoanCount).toBe(1);
    expect(isBankPrivateLocked(s)).toBe(false);
    // 第 2 次危机借款（亲友）
    s.cash = -1000;
    s = takeCrisisLoan(s, 'private', () => 0.5).state;
    expect(s.crisisLoanCount).toBe(2);
    expect(isBankPrivateLocked(s)).toBe(true); // 第 3 次危机起银行/亲友禁用
  });
});

describe('② 高利贷利率递增', () => {
  it('predatoryLoanApr 纯函数：36% → 54% → 81% → 121.5%', () => {
    expect(predatoryLoanApr(0)).toBeCloseTo(0.36, 4);
    expect(predatoryLoanApr(1)).toBeCloseTo(0.54, 4);
    expect(predatoryLoanApr(2)).toBeCloseTo(0.81, 4);
    expect(predatoryLoanApr(3)).toBeCloseTo(1.215, 4);
  });

  it('第 1 笔 36% → 第 2 笔 54% → 第 3 笔 81%，且 predatoryLoanCount/bailoutRateMultiplier 同步', () => {
    let s = fresh();
    s.cash = -1000;

    const { state: r1 } = takeCrisisLoan(s, 'predatory', () => 0.5);
    expect(r1.loans[r1.loans.length - 1].apr).toBeCloseTo(0.36, 4);
    expect(r1.loans[r1.loans.length - 1].loanNo).toBe(1);
    expect(r1.predatoryLoanCount).toBe(1);
    expect(r1.bailoutRateMultiplier).toBeCloseTo(PREDATORY_APR_ESCALATION ** 1, 6);

    s = r1;
    s.cash = -1000;
    const { state: r2 } = takeCrisisLoan(s, 'predatory', () => 0.5);
    expect(r2.loans[r2.loans.length - 1].apr).toBeCloseTo(0.54, 4);
    expect(r2.loans[r2.loans.length - 1].loanNo).toBe(2);
    expect(r2.predatoryLoanCount).toBe(2);
    expect(r2.bailoutRateMultiplier).toBeCloseTo(PREDATORY_APR_ESCALATION ** 2, 6);

    s = r2;
    s.cash = -1000;
    const { state: r3 } = takeCrisisLoan(s, 'predatory', () => 0.5);
    expect(r3.loans[r3.loans.length - 1].apr).toBeCloseTo(0.81, 4);
    expect(r3.loans[r3.loans.length - 1].loanNo).toBe(3);
    expect(r3.predatoryLoanCount).toBe(3);
    // 不变式：bailoutRateMultiplier === PREDATORY_APR_ESCALATION ** predatoryLoanCount
    expect(r3.bailoutRateMultiplier).toBeCloseTo(PREDATORY_APR_ESCALATION ** r3.predatoryLoanCount, 6);
  });

  it('非高利贷渠道不受飙升公式影响，仍用基准利率', () => {
    const s = fresh();
    s.cash = -1000;
    s.predatoryLoanCount = 5; // 即便高利贷计数很高，bank 仍按 4%
    const { state: r } = takeCrisisLoan(s, 'bank', () => 0.5);
    expect(r.loans[r.loans.length - 1].apr).toBeCloseTo(0.04, 4);
    expect(r.predatoryLoanCount).toBe(5); // 未改变
  });
});

describe('③ 危机贷款 80% 净资上限', () => {
  it('isCrisisLoanOverCap：净资为负恒 true；debt >= netWorth*0.8 命中，否则 false', () => {
    const s = fresh();
    s.debt = 0;
    expect(isCrisisLoanOverCap(s)).toBe(false); // 净资为正、债务 0

    const neg = fresh();
    neg.netWorth = -1000;
    neg.debt = 0;
    expect(isCrisisLoanOverCap(neg)).toBe(true); // 净资为负右端为负，debt≥0 恒大于

    const cap = fresh();
    cap.netWorth = 100000;
    cap.debt = 80000; // 恰好 80%
    expect(isCrisisLoanOverCap(cap)).toBe(true);

    cap.debt = 79900; // 略低于上限
    expect(isCrisisLoanOverCap(cap)).toBe(false);
  });

  it('canTakeCrisisLoan：正常可借（含高利贷）；AP=0 / 超上限拒绝', () => {
    const s = fresh();
    expect(canTakeCrisisLoan(s, 'bank').ok).toBe(true);
    expect(canTakeCrisisLoan(s, 'private').ok).toBe(true);
    // 强制高利贷模式依赖：限内高利贷仍允许
    expect(canTakeCrisisLoan(s, 'predatory').ok).toBe(true);

    // AP=0 → 拒绝（reason='ap'）
    const noAp = fresh();
    noAp.actionPointsCurrent = 0;
    expect(canTakeCrisisLoan(noAp, 'bank').ok).toBe(false);
    expect(canTakeCrisisLoan(noAp, 'bank').reason).toBe('ap');

    // 超上限 → 银行/亲属拒绝（reason='cap'），高利贷始终不受限
    const cap = fresh();
    cap.netWorth = 100000;
    cap.debt = 90000;
    cap.crisisLoanCount = 3; // 超出宽限期（CRISIS_LOAN_GRACE_COUNT=2），80% 上限生效
    expect(canTakeCrisisLoan(cap, 'bank').ok).toBe(false);
    expect(canTakeCrisisLoan(cap, 'bank').reason).toBe('cap');
    // 高利贷不受 80% 上限约束，始终可点
    expect(canTakeCrisisLoan(cap, 'predatory').ok).toBe(true);
  });
});

describe('④ 被银行收店结局（复用 suspended 文案）', () => {
  it('Σ(本金+利息) > 估值×1.5 且 netWorth<0 → 结局为 suspended（不新增 id）', () => {
    const s = fresh();
    const rent = s.stores[0].rent;
    const valuation = rent * 6; // storeValuation = rent × 6
    s.loans = [
      {
        id: 'L1',
        channel: 'predatory',
        principal: valuation * 2,
        apr: 0.36,
        balance: valuation * 2,
        accruedInterest: valuation * 0.5,
        startDate: 1,
        overdueDays: 0,
      },
    ];
    s.debt = valuation * 2;
    s.netWorth = -5000; // 资不抵债

    const r = evaluateEndings(s);
    expect(r).not.toBeNull();
    expect(r!.def.id).toBe('suspended'); // 复用"歇业"文案，未新增 bank_foreclosure
    expect(r!.tone).toBe('lose');
  });

  it('净资为正时不触发收店', () => {
    const s = fresh();
    const rent = s.stores[0].rent;
    const valuation = rent * 6;
    s.loans = [
      {
        id: 'L1',
        channel: 'predatory',
        principal: valuation * 2,
        apr: 0.36,
        balance: valuation * 2,
        accruedInterest: valuation * 0.5,
        startDate: 1,
        overdueDays: 0,
      },
    ];
    s.debt = valuation * 2;
    s.netWorth = 50000; // 净资为正
    expect(evaluateEndings(s)).toBeNull();
  });

  it('开局 setup 一次性贷款不计入收店阈值（超额开局仍可正常推进，不第 1 天误判）', () => {
    const s = fresh();
    const rent = s.stores[0].rent;
    const valuation = rent * 6;
    // 仅一笔超大额 setup 贷款，净资为负、债务远超估值 ×1.5
    s.loans = [
      {
        id: 'setup',
        channel: 'private',
        principal: valuation * 4,
        apr: 0.12,
        balance: valuation * 4,
        accruedInterest: 0,
        startDate: 1,
        overdueDays: 0,
        isSetup: true,
      },
    ];
    s.debt = valuation * 4;
    s.netWorth = -5000; // 资不抵债
    // 仅 setup 贷款 → 收店债务计为 0 → 不触发收店
    expect(evaluateEndings(s)).toBeNull();
  });

  it('收店与破产共用 suspended：收店先触发即锁定，破产分支不重复', () => {
    const s = fresh();
    const rent = s.stores[0].rent;
    const valuation = rent * 6;
    s.loans = [
      {
        id: 'L1',
        channel: 'predatory',
        principal: valuation * 2,
        apr: 0.36,
        balance: valuation * 2,
        accruedInterest: valuation * 0.5,
        startDate: 1,
        overdueDays: 0,
      },
    ];
    s.debt = valuation * 2;
    s.netWorth = -5000;
    s.cashNegativeStreak = CASH_NEGATIVE_STREAK_BANKRUPTCY; // 同时满足破产条件

    const r = evaluateEndings(s);
    expect(r!.def.id).toBe('suspended'); // 收店（step 0.5）先于破产（step 2）
    // 锁定后再次判定返回 null（不重复弹）
    s.endingsUnlocked = ['suspended'];
    expect(evaluateEndings(s)).toBeNull();
  });
});

describe('⑤ 旧档迁移（缺 3 字段）', () => {
  it('缺 autoBailoutCount/predatoryLoanCount/bailoutRateMultiplier 的存档 migrate 后不崩溃，字段为默认 0/1', () => {
    const legacy = {
      day: 3,
      cash: 50000,
      debt: 0,
      netWorth: 50000,
      storeCount: 1,
      stores: [
        {
          id: 'store_001',
          name: '旧店',
          storeType: '奶茶饮品',
          locationType: '学校门口',
          rent: 4800,
          deposit: 9600,
          decorationLevel: 'clean',
          supplierTier: 'local',
          priceStrategy: 'normal',
          promotionTier: 'light',
          staffTier: 'standard',
          rating: 80,
          repurchaseRate: 0.3,
          efficiency: 100,
          deliveryRatio: 0.3,
          platformRate: 0.18,
          isInCrisis: false,
          crisisDays: 0,
          cashflowStatus: '健康',
          monthlyRevenue: 0,
          monthlyGrossProfit: 0,
          monthlyNetProfit: 0,
          monthlyPromoCost: 0,
          monthlyDeliveryRevenue: 0,
          monthlyStaffCost: 0,
          lastMonthNetProfit: 0,
          monthlyNetProfitPositiveStreak: 0,
          repurchaseRateStartOfMonth: 0.3,
          ratingStartOfMonth: 80,
        },
      ],
      hiddenLines: {},
      softHidden: {},
      eventHistory: [],
      businessLog: [],
      windMessages: [],
      pendingEffects: [],
      tempModifiers: [],
      dayModifiers: {},
      activeCooldowns: {},
      unlockedRoutes: [],
      endingsUnlocked: [],
      decisions: {},
      // 刻意缺失 autoBailoutCount / predatoryLoanCount / bailoutRateMultiplier
    };
    const migrated = migrateGameState(legacy);
    expect(migrated.autoBailoutCount).toBe(0);
    expect(migrated.predatoryLoanCount).toBe(0);
    expect(migrated.bailoutRateMultiplier).toBe(1);
    // 不崩溃且可序列化（无 undefined 字段）
    expect(() => JSON.stringify(migrated)).not.toThrow();
    expect(typeof migrated.loans).toBe('object');
  });
});

describe('⑥ 亲友借款：拒绝率按成功次数升档（修复"被拒不升档"bug）', () => {
  it('成功时随机借到 5千–5万，且 cash 可能仍为负（缺口大时填不平）', () => {
    const s = fresh();
    s.cash = -200000; // 缺口极大，随机借款不足以填平
    const { state, result } = takeCrisisLoan(s, 'private', () => 0.99); // 0.99 必成功
    expect(result.ok).toBe(true);
    expect(result.rejected).toBeFalsy();
    expect(result.amount).toBeGreaterThanOrEqual(FRIEND_LOAN_MIN);
    expect(result.amount).toBeLessThanOrEqual(FRIEND_LOAN_MAX);
    expect(state.cash).toBe(s.cash + result.amount); // 仍为负
    expect(state.cash).toBeLessThan(0);
    expect(state.crisisLoanCount).toBe(1); // 成功才 +1
    expect(state.friendLoanAttempts).toBe(1); // 尝试计入
    expect(state.friendLoanSuccessCount).toBe(1); // 成功才 +1
  });

  it('成功 0 次：rng<0.3 拒绝（且 successCount=0，不借钱/不增计数/不增成功次数）；rng>=0.3 成功', () => {
    // 拒绝路径：rng()=0.01 → 0.01 < 0.3 → 拒绝
    let s = fresh();
    s.cash = -1000;
    const rej = takeCrisisLoan(s, 'private', () => 0.01);
    expect(rej.result.ok).toBe(false);
    expect(rej.result.rejected).toBe(true);
    expect(rej.result.successCount).toBe(0);
    expect(rej.state.cash).toBe(-1000); // 现金不变
    expect(rej.state.crisisLoanCount).toBe(0); // 不增
    expect(rej.state.friendLoanSuccessCount).toBe(0); // 成功次数不变
    expect(rej.state.friendLoanAttempts).toBe(1); // 仍计入尝试

    // 成功路径：rng()=0.99 → 0.99 >= 0.3 → 成功
    s = fresh();
    s.cash = -1000;
    const ok = takeCrisisLoan(s, 'private', () => 0.99);
    expect(ok.result.ok).toBe(true);
    expect(ok.result.rejected).toBeFalsy();
    expect(ok.state.friendLoanAttempts).toBe(1);
    expect(ok.state.friendLoanSuccessCount).toBe(1);
    expect(ok.state.crisisLoanCount).toBe(1);
  });

  it('被拒不升档：连续 3 次被拒，successCount 始终 0、拒绝率恒定 0.3、crisisLoanCount 不变', () => {
    let s = fresh();
    s.cash = -1000;
    for (let i = 1; i <= 3; i++) {
      const r = takeCrisisLoan(s, 'private', () => 0.01); // 0.01 < 0.3 必拒
      expect(r.result.rejected).toBe(true);
      expect(r.result.successCount).toBe(0);
      expect(r.state.friendLoanSuccessCount).toBe(0); // 成功次数不变（被拒不升档）
      expect(r.state.friendLoanAttempts).toBe(i); // 尝试每次 +1
      expect(r.state.crisisLoanCount).toBe(0); // 不增
      s = r.state;
    }
  });

  it('成功 1 次后拒绝率升至 70%（successCount=1）：rng=0.5 拒绝、不升档', () => {
    let s = fresh();
    s.cash = -1000;
    s = takeCrisisLoan(s, 'private', () => 0.99).state; // 成功，successCount=1
    expect(s.friendLoanSuccessCount).toBe(1);
    const r = takeCrisisLoan(s, 'private', () => 0.5); // 0.5 < 0.7 → 拒绝
    expect(r.result.rejected).toBe(true);
    expect(r.result.successCount).toBe(1);
    expect(r.state.friendLoanSuccessCount).toBe(1); // 不升档
    expect(r.state.friendLoanAttempts).toBe(2);
  });

  it('成功 2 次后拒绝率升至 95%（successCount>=2）：rng=0.9 拒绝、不升档', () => {
    let s = fresh();
    s.cash = -1000;
    s = takeCrisisLoan(s, 'private', () => 0.99).state; // successCount=1
    s = takeCrisisLoan(s, 'private', () => 0.99).state; // successCount=2
    expect(s.friendLoanSuccessCount).toBe(2);
    const r = takeCrisisLoan(s, 'private', () => 0.9); // 0.9 < 0.95 → 拒绝
    expect(r.result.rejected).toBe(true);
    expect(r.result.successCount).toBe(2);
    expect(r.state.friendLoanSuccessCount).toBe(2); // 不升档
  });
});

describe('⑨ 高利贷"无油水拒"：借满 PREDATORY_REJECT_CUTOFF 笔后第 4 次被拒', () => {
  it('PREDATORY_REJECT_CUTOFF = 3：前 3 笔可借，第 4 笔无油水拒（不借钱/不增计数/不写 Loan）', () => {
    expect(PREDATORY_REJECT_CUTOFF).toBe(3);

    let s = fresh();
    // 前 3 笔正常借到
    for (let i = 1; i <= PREDATORY_REJECT_CUTOFF; i++) {
      s.cash = -1000;
      const { state, result } = takeCrisisLoan(s, 'predatory', () => 0.5);
      expect(result.ok).toBe(true);
      expect(result.rejected).toBeFalsy();
      expect(state.predatoryLoanCount).toBe(i);
      s = state;
    }
    expect(s.predatoryLoanCount).toBe(PREDATORY_REJECT_CUTOFF);
    const loansBefore = s.loans.length;

    // 第 4 笔：无油水拒
    s.cash = -1000;
    const rej = takeCrisisLoan(s, 'predatory', () => 0.5);
    expect(rej.result.ok).toBe(false);
    expect(rej.result.rejected).toBe(true);
    expect(rej.state.predatoryLoanCount).toBe(PREDATORY_REJECT_CUTOFF); // 不增
    expect(rej.state.loans.length).toBe(loansBefore); // 不写新贷款
    expect(rej.state.cash).toBe(-1000); // 现金不变
  });
});

describe('⑦ 高利贷随机额度', () => {
  it('predatory amount ∈ [5000,80000] 且 predatoryLoanCount+1', () => {
    const s = fresh();
    s.cash = -1000;
    const { state, result } = takeCrisisLoan(s, 'predatory', () => 0.5);
    expect(result.amount).toBeGreaterThanOrEqual(LOAN_SHARK_MIN);
    expect(result.amount).toBeLessThanOrEqual(LOAN_SHARK_MAX);
    expect(state.predatoryLoanCount).toBe(1);
    expect(result.apr).toBeCloseTo(0.36, 4);
  });
});

describe('⑧ 危机应对行动使用上限映射（getCrisisActionMaxUses）', () => {
  it('有限/无限映射正确', () => {
    expect(getCrisisActionMaxUses('sell_equipment')).toBe(1);
    expect(getCrisisActionMaxUses('clearance_sale')).toBe(1);
    expect(getCrisisActionMaxUses('delay_rent')).toBe(2);
    expect(getCrisisActionMaxUses('delay_supplier_payment')).toBe(2);
    expect(getCrisisActionMaxUses('layoff')).toBe(1);
    // 不设上限（无限 / 始终可用）
    expect(getCrisisActionMaxUses('temporary_price_increase')).toBe(Infinity);
    expect(getCrisisActionMaxUses('close_shop')).toBe(Infinity);
  });
});

