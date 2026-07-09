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
} from '../src/core/loanSystem';
import {
  predatoryLoanApr,
  PREDATORY_APR_ESCALATION,
  AUTO_BAILOUT_MAX,
} from '../src/data/setupCosts';
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

describe('① 自动兜底限次（gameLoop F001 分支）', () => {
  it('前 2 次 cash<0 自动银行兜底并 autoBailoutCount+1；第 3 次起不再兜底', () => {
    // 并行对照：同一前置负现金状态，一份 autoBailoutCount=0（兜底），一份 =2（不兜底）
    const rngA = createRng(11);
    const rngB = createRng(11);

    const preBail = fresh();
    preBail.cash = -50000;
    preBail.autoBailoutCount = 0;

    const preNoBail = fresh();
    preNoBail.cash = -50000;
    preNoBail.autoBailoutCount = 2;

    const rBail = runDailyLoop(preBail, rngA).state;
    const rNoBail = runDailyLoop(preNoBail, rngB).state;

    expect(rBail.autoBailoutCount).toBe(1); // 兜底成功 +1
    expect(rNoBail.autoBailoutCount).toBe(2); // 已达上限，不再 +1
    // 兜底注入 need = max(0,50000) + buffer(10000) = 60000 现金；不兜底则无 → 现金恰好差 60000
    const buffer = 10000;
    expect(rNoBail.cash).toBe(rBail.cash - (50000 + buffer));
    // 兜底多写入一笔银行贷款
    expect(rNoBail.loans.length).toBe(rBail.loans.length - 1);
  });

  it('连续 cash<0 多天：autoBailoutCount 仅前 2 次递增，之后停在 2', () => {
    let state = fresh();
    for (let i = 0; i < 5; i++) {
      state.cash = -30000; // 每天强制负现金
      state = runDailyLoop(state, createRng(100 + i)).state;
    }
    expect(state.autoBailoutCount).toBe(AUTO_BAILOUT_MAX); // 停在 2
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

    const r1 = takeCrisisLoan(s, 'predatory', () => 0.5);
    expect(r1.loans[r1.loans.length - 1].apr).toBeCloseTo(0.36, 4);
    expect(r1.loans[r1.loans.length - 1].loanNo).toBe(1);
    expect(r1.predatoryLoanCount).toBe(1);
    expect(r1.bailoutRateMultiplier).toBeCloseTo(PREDATORY_APR_ESCALATION ** 1, 6);

    s = r1;
    s.cash = -1000;
    const r2 = takeCrisisLoan(s, 'predatory', () => 0.5);
    expect(r2.loans[r2.loans.length - 1].apr).toBeCloseTo(0.54, 4);
    expect(r2.loans[r2.loans.length - 1].loanNo).toBe(2);
    expect(r2.predatoryLoanCount).toBe(2);
    expect(r2.bailoutRateMultiplier).toBeCloseTo(PREDATORY_APR_ESCALATION ** 2, 6);

    s = r2;
    s.cash = -1000;
    const r3 = takeCrisisLoan(s, 'predatory', () => 0.5);
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
    const r = takeCrisisLoan(s, 'bank', () => 0.5);
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

    // 超上限 → 拒绝（reason='cap'），对所有渠道生效（crisisLoanCount >= 宽限期后）
    const cap = fresh();
    cap.netWorth = 100000;
    cap.debt = 90000;
    cap.crisisLoanCount = 3; // 超出宽限期（CRISIS_LOAN_GRACE_COUNT=2），80% 上限生效
    expect(canTakeCrisisLoan(cap, 'bank').ok).toBe(false);
    expect(canTakeCrisisLoan(cap, 'bank').reason).toBe('cap');
    expect(canTakeCrisisLoan(cap, 'predatory').ok).toBe(false);
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
