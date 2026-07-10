// QA 独立验证：员工系统核心纯函数（staffSystem.ts）全路径覆盖
// 不依赖 React / Zustand，直接测试纯函数。
import { describe, it, expect } from 'vitest';
import {
  generateCandidate,
  generateCandidates,
  generateEmployee,
  computeDailyEfficiency,
  getDailySalary,
  checkOvertime,
  computeStaffCost,
  computeCapacity,
  applyMoraleDecay,
  checkResignOrStrike,
  tryExposeAttributes,
  setEmployeeSchedule,
  fireEmployee,
  isWeekStart,
  getDayOfWeek,
  getWeekNumber,
  dayOfWeekLabel,
  resetWeeklyWorkDays,
  applyAllRest,
  applySalaryRaise,
  applyFullWeekWarning,
  getMaxEmployees,
  getScheduledCount,
  computeOwnerCapacity,
} from '../src/core/staffSystem';
import {
  OVERTIME_SALARY_MULTIPLIER,
  MAX_WORK_DAYS_PER_WEEK,
} from '../src/data/staffConstants';
import type { Employee } from '../src/types/employee';
import type { GameState, StoreState } from '../src/types';
import { createNewGame } from '../src/core/createNewGame';
import { createRng } from '../src/core/rng';

// ====== 辅助工厂 ======

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'emp_test_001',
    name: '测试员工',
    joinDay: 1,
    attribute: 'old_smooth',
    isExposed: false,
    morale: 70,
    monthlySalary: 5000,
    daysWorkedThisWeek: 0,
    isScheduledToday: false,
    weeklyWorkDays: [],
    consecutiveWorkDays: 0,
    isTempStaff: false,
    efficiencyCache: 0,
    ...overrides,
  };
}

function makeMinimalGameState(overrides: Partial<GameState> = {}): GameState {
  const baseState: GameState = {
    __version: 1,
    day: 10,
    month: 1,
    cash: 100000,
    debt: 0,
    monthlyRepayment: 0,
    credit: 70,
    netWorth: 100000,
    storeCount: 1,
    brandRating: 80,
    stores: [
      {
        id: 'store_001',
        name: '测试店',
        storeType: '奶茶饮品',
        locationType: '学校门口',
        rent: 5000,
        deposit: 10000,
        decorationLevel: 'clean',
        decorationEntryBonus: 0,
        decorationAovBonus: 0,
        supplierTier: 'local',
        priceStrategy: 'normal',
        promotionTier: 'light',
        rating: 80,
        repurchaseRate: 0.3,
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
        heat: 60,
        currentBatchQuality: 60,
        batchRenewDay: 8,
        supplierStability: 0.6,
        employees: [],
      },
    ],
    hiddenLines: {
      landlordAttention: 0,
      employeePressure: 0,
      customerTrust: 50,
      priceControversy: 0,
      promoHype: 0,
      supplyRisk: 0,
      platformDependence: 0,
      hygieneRisk: 0,
    },
    softHidden: {
      ownerFatigue: 0,
      wasteRisk: 0,
      qualityVariance: 0,
      landlordPatience: 100,
      accountingErrorRisk: 0,
      stability: 100,
    },
    eventHistory: [],
    businessLog: [],
    windMessages: [],
    pendingEffects: [],
    tempModifiers: [],
    dayModifiers: {
      exposurePct: 0,
      dineInExposurePct: 0,
      deliveryExposurePct: 0,
      entryRatePct: 0,
      conversionRatePct: 0,
      repurchaseRatePct: 0,
      avgOrderValuePct: 0,
      ordersPct: 0,
      revenuePct: 0,
      marginPct: 0,
      promoCostAdd: 0,
      staffCostAdd: 0,
      staffCostPct: 0,
      miscCostAdd: 0,
      platformCostPct: 0,
      deliveryOrdersPct: 0,
    },
    activeCooldowns: {},
    unlockedRoutes: [],
    endingsUnlocked: [],
    accountsPayable: 0,
    reserve: 0,
    lastLargeEventDay: -999,
    seed: 42,
    tutorialSeen: false,
    gameOver: false,
    decisions: {
      supplierTier: 'local',
      priceStrategy: 'normal',
      decorationLevel: 'clean',
      promotionTier: 'light',
    },
    loans: [],
    actionPointsMax: 3,
    actionPointsCurrent: 3,
    selectedDailyFocus: null,
    selectedActionsToday: [],
    actionCooldowns: {},
    bossStrain: 0,
    cashNegativeStreak: 0,
    hiddenHealthyStreak: 0,
    peakNetWorth: 100000,
    cumulativeNetProfit: 0,
    eventWeightMods: {},
    autoBailoutCount: 0,
    predatoryLoanCount: 0,
    bailoutRateMultiplier: 1,
    crisisLoanCount: 0,
    ...overrides,
  } as GameState;

  // 如果 overrides 含有 stores，深层合并
  if (overrides.stores) {
    baseState.stores = overrides.stores;
  }
  return baseState;
}

let seq = 0;
function detRng(): () => number {
  seq = 0;
  return () => {
    seq += 0.07;
    return seq % 1;
  };
}

// ==============================================================================
// 1. 候选人/员工生成
// ==============================================================================
describe('候选人/员工生成', () => {
  it('generateCandidate 返回有效候选人', () => {
    const rng = detRng();
    const c = generateCandidate(rng, 1, 'clean');
    expect(c).toHaveProperty('id');
    expect(c).toHaveProperty('name');
    expect(c).toHaveProperty('attribute');
    expect(c).toHaveProperty('hint');
    expect(c).toHaveProperty('monthlySalary');
    expect(c).toHaveProperty('generatedDay');
    expect(c.id).toContain('candidate_1_');
    expect(c.generatedDay).toBe(1);
    expect(c.monthlySalary).toBeGreaterThan(0);
  });

  it('generateCandidates 返回 2-3 名候选人', () => {
    const rng = detRng();
    const candidates = generateCandidates(rng, 1, 'clean');
    expect(candidates.length).toBeGreaterThanOrEqual(2);
    expect(candidates.length).toBeLessThanOrEqual(3);
  });

  it('generateEmployee 从候选人创建员工', () => {
    const rng = detRng();
    const candidate = generateCandidate(rng, 1, 'clean');
    const emp = generateEmployee(candidate, 1, false, rng);
    expect(emp.id).toContain('emp_1_');
    expect(emp.name).toBe(candidate.name);
    expect(emp.attribute).toBe(candidate.attribute);
    expect(emp.monthlySalary).toBe(candidate.monthlySalary);
    expect(emp.joinDay).toBe(1);
    expect(emp.morale).toBe(70);      // 初始士气
    expect(emp.isExposed).toBe(false);  // 入职时不暴露
    expect(emp.isTempStaff).toBe(false);
    expect(emp.daysWorkedThisWeek).toBe(0);
    expect(emp.isScheduledToday).toBe(false);
    expect(emp.consecutiveWorkDays).toBe(0);
  });

  it('generateEmployee 可创建临时员工', () => {
    const rng = detRng();
    const candidate = generateCandidate(rng, 1, 'clean');
    const emp = generateEmployee(candidate, 1, true, rng);
    expect(emp.isTempStaff).toBe(true);
  });
});

// ==============================================================================
// 2. 效率计算
// ==============================================================================
describe('computeDailyEfficiency', () => {
  it('old_smooth 返回稳定效率 0.9-1.0 之间', () => {
    const emp = makeEmployee({ attribute: 'old_smooth' });
    const eff = computeDailyEfficiency(emp, 10);
    expect(eff).toBeGreaterThanOrEqual(0.3);
    expect(eff).toBeLessThanOrEqual(1.5);
  });

  it('rookie 使用 joinDay 计算成长（总雇佣天数持续增长）', () => {
    const emp = makeEmployee({
      attribute: 'rookie',
      joinDay: 1,
      daysWorkedThisWeek: 10,  // 工作 10 天
    });
    const eff = computeDailyEfficiency(emp, 15); // day=15, 已雇佣 14 天
    // 0.5 + 14*0.02 = 0.78，上限 1.0
    expect(eff).toBeGreaterThanOrEqual(0.3);
  });

  it('rookie 上限为 1.0 即使入职很久', () => {
    const emp = makeEmployee({
      attribute: 'rookie',
      joinDay: 1,
      daysWorkedThisWeek: 999,
    });
    const eff = computeDailyEfficiency(emp, 100); // day=100, 已雇佣 99 天
    expect(eff).toBeLessThanOrEqual(1.5);
  });

  it('士气 100 时获得效率加成', () => {
    const emp = makeEmployee({ attribute: 'old_smooth', morale: 100 });
    const eff = computeDailyEfficiency(emp, 10);
    // base=0.95, 士气修正: 1 + (100-50)*0.006 = 1.3, 最终 ~1.235
    expect(eff).toBeGreaterThan(0.95);
  });

  it('士气 0 时效率大幅降低', () => {
    const emp = makeEmployee({ attribute: 'old_smooth', morale: 0 });
    const eff = computeDailyEfficiency(emp, 10);
    // 士气修正: 1 + (0-50)*0.01 = 0.5
    expect(eff).toBeLessThan(0.95);
  });

  it('波动属性（摸鱼王 slacker）在不同调用中产生变化', () => {
    const emp = makeEmployee({ attribute: 'slacker' });
    const results = new Set<number>();
    for (let i = 0; i < 20; i++) {
      results.add(computeDailyEfficiency(emp, 10));
    }
    // 摸鱼王波动大，20 次调用应有多种结果
    expect(results.size).toBeGreaterThan(1);
  });
});

// ==============================================================================
// 3. 成本与承载
// ==============================================================================
describe('成本与承载计算', () => {
  it('getDailySalary 月薪/30 取整', () => {
    const emp = makeEmployee({ monthlySalary: 5000 });
    expect(getDailySalary(emp)).toBe(166); // 5000/30 = 166.666 → floor 166
  });

  it('checkOvertime 未排班 → false', () => {
    const emp = makeEmployee({ isScheduledToday: false, daysWorkedThisWeek: 5 });
    expect(checkOvertime(emp)).toBe(false);
  });

  it('checkOvertime 排班但连续上班<5 → false', () => {
    const emp = makeEmployee({ isScheduledToday: true, consecutiveWorkDays: 3 });
    expect(checkOvertime(emp)).toBe(false);
  });

  it('checkOvertime 排班且本周上班满 5 天 → true', () => {
    const emp = makeEmployee({ isScheduledToday: true, daysWorkedThisWeek: 5, consecutiveWorkDays: 0 });
    expect(checkOvertime(emp)).toBe(true);
  });

  it('computeStaffCost 无排班 → 0', () => {
    const emp = makeEmployee({ isScheduledToday: false });
    expect(computeStaffCost([emp])).toBe(0);
  });

  it('computeStaffCost 排班员工按日薪计入', () => {
    const emp = makeEmployee({ monthlySalary: 6000, isScheduledToday: true });
    const daily = getDailySalary(emp); // 6000/30 = 200
    expect(computeStaffCost([emp])).toBe(daily);
  });

  it('computeStaffCost 本周上班满 5 天员工按加班 ×1.5', () => {
    const emp = makeEmployee({
      monthlySalary: 6000,
      isScheduledToday: true,
      daysWorkedThisWeek: 5,
    });
    const daily = getDailySalary(emp); // 200
    expect(computeStaffCost([emp])).toBe(daily * 1.5);
  });

  it('computeStaffCost 临时员工工资 ×1.5', () => {
    const emp = makeEmployee({
      monthlySalary: 6000,
      isScheduledToday: true,
      isTempStaff: true,
    });
    const daily = getDailySalary(emp); // 200
    expect(computeStaffCost([emp])).toBe(daily * 1.5);
  });

  it('computeStaffCost 加班 + 临时叠加', () => {
    const emp = makeEmployee({
      monthlySalary: 6000,
      isScheduledToday: true,
      daysWorkedThisWeek: 5,
      isTempStaff: true,
    });
    const daily = getDailySalary(emp); // 200
    expect(computeStaffCost([emp])).toBe(Math.round(daily * 1.5 * 1.5));
  });

  it('computeCapacity 按排班人数 ×70 计算', () => {
    const emp1 = makeEmployee({ id: 'e1', isScheduledToday: true });
    const emp2 = makeEmployee({ id: 'e2', isScheduledToday: true });
    const emp3 = makeEmployee({ id: 'e3', isScheduledToday: false });
    expect(computeCapacity([emp1, emp2, emp3])).toBe(2 * 70);
  });

  it('computeCapacity 无人排班 → 0', () => {
    const emp = makeEmployee({ isScheduledToday: false });
    expect(computeCapacity([emp])).toBe(0);
  });
});

// ==============================================================================
// 4. 士气系统
// ==============================================================================
describe('applyMoraleDecay', () => {
  it('排班员工士气自然消耗（减对应属性基数）', () => {
    const emp = makeEmployee({
      attribute: 'old_smooth', // baseMoraleDecay = ?
      isScheduledToday: true,
      morale: 70,
    });
    const { employees } = applyMoraleDecay([emp], 10);
    // old_smooth 的 baseMoraleDecay 应该是负值，新士气 < 70
    expect(employees[0].morale).toBeLessThan(70);
  });

  it('休息员工士气恢复 +40', () => {
    const emp = makeEmployee({
      isScheduledToday: false,
      morale: 50,
    });
    const { employees } = applyMoraleDecay([emp], 10);
    expect(employees[0].morale).toBe(90); // 50 + 40
  });

  it('加班员工额外扣减士气 -10', () => {
    const emp = makeEmployee({
      attribute: 'old_smooth',
      isScheduledToday: true,
      daysWorkedThisWeek: 5,
      morale: 70,
    });
    const { employees, events } = applyMoraleDecay([emp], 10);
    expect(employees[0].morale).toBeLessThan(70);
    // 应有加班警告事件
    const hasOvertimeWarning = events.some((e) => e.type === 'overtime_warning');
    expect(hasOvertimeWarning).toBe(true);
  });

  it('士气 ≤30 时额外 -2', () => {
    const emp = makeEmployee({
      isScheduledToday: false, // 休息，+40
      morale: 27,              // 27 + 40 = 67，远高于 30，不触发额外 -2
    });
    const { employees } = applyMoraleDecay([emp], 10);
    expect(employees[0].morale).toBe(67); // 27+40=67 正常

    // 测试士气 25，排班（消耗 baseMoraleDecay），可能到 ≤30
    const emp2 = makeEmployee({
      isScheduledToday: true,
      morale: 25,
    });
    const r = applyMoraleDecay([emp2], 10);
    // 排班消耗后可能 ≤30，额外 -2
    expect(r.employees[0].morale).toBeLessThanOrEqual(25 + 5 - 2); // baseMoraleDecay + 额外惩罚
  });

  it('applyMoraleDecay 不再因士气低生成 morale_warning（warning 改由 applyFullWeekWarning 基于满勤周驱动）', () => {
    const emp = makeEmployee({ isScheduledToday: true, morale: 22 });
    const { events } = applyMoraleDecay([emp], 10);
    const hasWarning = events.some((e) => e.type === 'morale_warning');
    expect(hasWarning).toBe(false); // 士气低仍消耗，但不再自动进 warning
  });

  it('applyFullWeekWarning：连续满勤两周 → 进入 warning', () => {
    const emp = { ...makeEmployee({ status: 'stable', morale: 60 }), consecutiveFullWeeks: 2 };
    const { employees, events } = applyFullWeekWarning([emp]);
    expect(employees[0].status).toBe('warning');
    expect(events.some((e) => e.includes('濒临离职'))).toBe(true);
  });

  it('applyFullWeekWarning：休息一周（满勤周清零）→ 退出 warning', () => {
    const emp = { ...makeEmployee({ status: 'warning', morale: 60 }), consecutiveFullWeeks: 0 };
    const { employees } = applyFullWeekWarning([emp]);
    expect(employees[0].status).toBe('stable');
  });

  it('连续工作达 14 天起额外惩罚 -5（阈值后移：13 天不扣，14 天起扣）', () => {
    const emp13 = makeEmployee({ isScheduledToday: false, consecutiveWorkDays: 13, morale: 50 });
    const r13 = applyMoraleDecay([emp13], 10);
    expect(r13.employees[0].morale).toBe(90); // 休息 +40，未达阈值无额外惩罚

    const emp14 = makeEmployee({ isScheduledToday: false, consecutiveWorkDays: 14, morale: 50 });
    const r14 = applyMoraleDecay([emp14], 10);
    // 休息 +40，连续工作惩罚 -5 → 50 + 40 - 5 = 85
    expect(r14.employees[0].morale).toBe(85);
  });

  it('士气值 clamp 到 [0, 100]', () => {
    const empHigh = makeEmployee({ isScheduledToday: false, morale: 99 });
    const highResult = applyMoraleDecay([empHigh], 10);
    expect(highResult.employees[0].morale).toBeLessThanOrEqual(100);

    const empLow = makeEmployee({ isScheduledToday: true, morale: 5 });
    const lowResult = applyMoraleDecay([empLow], 10);
    expect(lowResult.employees[0].morale).toBeGreaterThanOrEqual(0);
  });

  it('consecutiveWorkDays 排班日 +1，休息日重置为 0', () => {
    const empWork = makeEmployee({ isScheduledToday: true, consecutiveWorkDays: 3 });
    const rWork = applyMoraleDecay([empWork], 10);
    expect(rWork.employees[0].consecutiveWorkDays).toBe(4);

    const empRest = makeEmployee({ isScheduledToday: false, consecutiveWorkDays: 5 });
    const rRest = applyMoraleDecay([empRest], 10);
    expect(rRest.employees[0].consecutiveWorkDays).toBe(0);
  });
});

// ==============================================================================
// 5. 离职/罢工检测
// ==============================================================================
describe('checkResignOrStrike', () => {
  it('士气 ≥ RESIGN_MORALE_THRESHOLD (15) → 不离职', () => {
    const emp = makeEmployee({ morale: 30 });
    const result = checkResignOrStrike([emp]);
    expect(result.type).toBe('none');
  });

  it('士气 < RESIGN_MORALE_THRESHOLD (15) → 不再即时离职（改由 warning 状态机接管）', () => {
    const emp = makeEmployee({ id: 'e1', morale: 10 });
    const result = checkResignOrStrike([emp]);
    // 即时离职分支已移除：低士气但非刺头的员工不会在 checkResignOrStrike 内离职
    expect(result.type).toBe('none');
    expect(result.resigning.length).toBe(0);
  });

  it('多个低士气员工不再即时离职（由 warning 状态机统一判定）', () => {
    const emp1 = makeEmployee({ id: 'e1', morale: 5 });
    const emp2 = makeEmployee({ id: 'e2', morale: 8 });
    const emp3 = makeEmployee({ id: 'e3', morale: 50 }); // 正常
    const result = checkResignOrStrike([emp1, emp2, emp3]);
    // 旧版"多员工同时即时离职"已移除，checkResignOrStrike 只处理罢工
    expect(result.type).toBe('none');
    expect(result.resigning.length).toBe(0);
  });

  it('刺头士气低 → 触发罢工（type=strike）', () => {
    const troublemaker = makeEmployee({
      id: 't1',
      attribute: 'troublemaker',
      morale: 16, // >= RESIGN_MORALE_THRESHOLD (15) 但 < STRIKE_MORALE_THRESHOLD (20)
    });
    const result = checkResignOrStrike([troublemaker]);
    expect(result.type).toBe('strike');
  });

  it('刺头士气不低 → 不罢工', () => {
    const troublemaker = makeEmployee({
      id: 't1',
      attribute: 'troublemaker',
      morale: 30, // >= STRIKE_MORALE_THRESHOLD
    });
    const result = checkResignOrStrike([troublemaker]);
    expect(result.type).toBe('none');
  });

  it('刺头低士气 + 普通低士气 → 仅罢工（离职改由 warning 状态机判定）', () => {
    const emp = makeEmployee({ id: 'e1', morale: 5 }); // 普通低士气（不再即时离职）
    const troublemaker = makeEmployee({
      id: 't1',
      attribute: 'troublemaker',
      morale: 10, // 罢工条件
    });
    const result = checkResignOrStrike([emp, troublemaker]);
    // 即时离职分支已移除，checkResignOrStrike 在存在刺头低士气时只返回 strike
    expect(result.type).toBe('strike');
  });
});

// ==============================================================================
// 6. 属性暴露
// ==============================================================================
describe('tryExposeAttributes', () => {
  it('入职不满 7 天 → 不暴露', () => {
    const emp = makeEmployee({ joinDay: 5, isExposed: false });
    const result = tryExposeAttributes(emp, 10);
    expect(result.exposed).toBe(false);
    expect(result.employee.isExposed).toBe(false);
  });

  it('入职满 7 天 → 暴露', () => {
    const emp = makeEmployee({ joinDay: 1, isExposed: false });
    const result = tryExposeAttributes(emp, 8); // 8-1 = 7 >= 7
    expect(result.exposed).toBe(true);
    expect(result.employee.isExposed).toBe(true);
  });

  it('已暴露员工不再重复暴露', () => {
    const emp = makeEmployee({ joinDay: 1, isExposed: true });
    const result = tryExposeAttributes(emp, 100);
    expect(result.exposed).toBe(false);
    expect(result.employee.isExposed).toBe(true);
  });

  it('刚好满 7 天（day 8 - joinDay 1 = 7）→ 暴露', () => {
    const emp = makeEmployee({ joinDay: 1, isExposed: false });
    const result = tryExposeAttributes(emp, 8);
    expect(result.exposed).toBe(true);
  });
});

// ==============================================================================
// 7. 排班
// ==============================================================================
describe('setEmployeeSchedule', () => {
  it('设置为排班 → 仅切换 isScheduledToday，不累加天数', () => {
    const emp = makeEmployee({ isScheduledToday: false, daysWorkedThisWeek: 3, consecutiveWorkDays: 2 });
    const result = setEmployeeSchedule(emp, true, 10);
    expect(result.employee.isScheduledToday).toBe(true);
    expect(result.employee.daysWorkedThisWeek).toBe(3);   // 不变
    expect(result.employee.weeklyWorkDays).toEqual([]);   // 不再当场写入
    expect(result.employee.consecutiveWorkDays).toBe(2);  // 不变
  });

  it('取消排班 → isScheduledToday=false，连续天数不当场清零（由结算统一处理）', () => {
    const emp = makeEmployee({
      isScheduledToday: true,
      daysWorkedThisWeek: 4,
      weeklyWorkDays: [8, 9],
      consecutiveWorkDays: 3,
    });
    const result = setEmployeeSchedule(emp, false, 10);
    expect(result.employee.isScheduledToday).toBe(false);
    expect(result.employee.daysWorkedThisWeek).toBe(4); // 不减少
    expect(result.employee.consecutiveWorkDays).toBe(3); // 不当场清零（结算时对 false 才清零）
    expect(result.employee.weeklyWorkDays).toEqual([8, 9]); // 不变
  });

  it('相同状态 → 不改变', () => {
    const emp = makeEmployee({ isScheduledToday: true });
    const result = setEmployeeSchedule(emp, true, 10);
    expect(result.isOvertime).toBe(false);
    expect(result.employee).toBe(emp); // 同一个引用
  });

  it('排班且本周上班满 MAX_WORK_DAYS_PER_WEEK → isOvertime=true', () => {
    const emp = makeEmployee({
      isScheduledToday: false,
      daysWorkedThisWeek: 5, // >= MAX_WORK_DAYS_PER_WEEK（本周已上班 5 天）
      consecutiveWorkDays: 0,
    });
    const result = setEmployeeSchedule(emp, true, 10);
    expect(result.isOvertime).toBe(true);
  });

  it('回归：切换按钮不虚增天数，且第6个工作日起算加班（含中途反复切换）', () => {
    let emp = makeEmployee({ isScheduledToday: false, daysWorkedThisWeek: 0, consecutiveWorkDays: 0 });
    for (let d = 1; d <= 6; d++) {
      // 当天玩家反复切换：上班→休息→上班（验证 bug 修复：切换按钮只改变排班意图）
      emp = setEmployeeSchedule(emp, true, d).employee;
      emp = setEmployeeSchedule(emp, false, d).employee; // 休息
      emp = setEmployeeSchedule(emp, true, d).employee;  // 再上班
      // 切换按钮只改变 isScheduledToday：本周/连续天数计数器不应被按钮累加（仅结算时推进）
      expect(emp.isScheduledToday).toBe(true);
      expect(emp.daysWorkedThisWeek).toBe(d - 1);   // 结算前本周已上班 d-1 天（未虚增）
      expect(emp.consecutiveWorkDays).toBe(d - 1);  // 结算前连续 d-1 天（未虚增）
      // 用"结算前本周已上班天数"判加班：前 5 天 daysWorkedThisWeek=0~4 → 正常；第 6 天 =5 → 加班
      const daily = getDailySalary(emp);
      const cost = computeStaffCost([emp]);
      if (d <= 5) {
        expect(cost).toBe(daily); // 前 5 天正常工资
      } else {
        expect(cost).toBe(Math.round(daily * 1.5)); // 第 6 天起加班 ×1.5
      }
      // 模拟 endDay 结算：每个真实工作日仅 +1（先推进本周天数，再推进连续天数）
      emp = { ...emp, daysWorkedThisWeek: emp.daysWorkedThisWeek + 1 };
      emp = applyMoraleDecay([emp], d).employees[0];
      expect(emp.daysWorkedThisWeek).toBe(d);     // 本周天数随结算 +1，无虚增
      expect(emp.consecutiveWorkDays).toBe(d);    // 连续天数随结算 +1，无虚增
    }
  });
});

// ==============================================================================
// 8. 裁员
// ==============================================================================
describe('fireEmployee', () => {
  function stateWithEmployee(emp: Employee): GameState {
    return makeMinimalGameState({
      stores: [
        {
          ...makeMinimalGameState().stores[0],
          employees: [emp],
          rating: 80,
        } as StoreState,
      ],
      hiddenLines: { ...makeMinimalGameState().hiddenLines, employeePressure: 0 },
    } as GameState);
  }

  it('裁人：补偿金 = 日薪 × LAYOFF_COMPENSATION_DAYS', () => {
    const emp = makeEmployee({ monthlySalary: 6000 }); // 日薪 200
    const state = stateWithEmployee(emp);
    const { compensation } = fireEmployee(emp.id, state);
    expect(compensation).toBe(200 * 10); // 200 * 10 = 2000
  });

  it('裁人：从门店移除员工', () => {
    const emp = makeEmployee({ monthlySalary: 6000 });
    const state = stateWithEmployee(emp);
    const { state: newState } = fireEmployee(emp.id, state);
    expect(newState.stores[0].employees.length).toBe(0);
  });

  it('裁人：扣现金', () => {
    const emp = makeEmployee({ monthlySalary: 6000 });
    const state = stateWithEmployee(emp);
    const cashBefore = state.cash;
    const { state: newState, compensation } = fireEmployee(emp.id, state);
    expect(newState.cash).toBe(cashBefore - compensation);
  });

  it('裁人：employeePressure +15', () => {
    const emp = makeEmployee({ monthlySalary: 6000 });
    const state = stateWithEmployee(emp);
    const { state: newState } = fireEmployee(emp.id, state);
    expect(newState.hiddenLines.employeePressure).toBe(15);
  });

  it('裁人：品牌评级 -1', () => {
    const emp = makeEmployee({ monthlySalary: 6000 });
    const state = stateWithEmployee(emp);
    const ratingBefore = state.stores[0].rating;
    const { state: newState } = fireEmployee(emp.id, state);
    expect(newState.stores[0].rating).toBe(ratingBefore - 1);
  });

  it('关系户裁人：额外品牌 -5', () => {
    const emp = makeEmployee({ attribute: 'guanxi_hire', monthlySalary: 6000 });
    const state = stateWithEmployee(emp);
    const ratingBefore = state.stores[0].rating;
    const { state: newState } = fireEmployee(emp.id, state);
    expect(newState.stores[0].rating).toBe(ratingBefore - 1 - 5); // -1 通用 -5 额外
  });

  it('关系户裁人：额外 employeePressure +25', () => {
    const emp = makeEmployee({ attribute: 'guanxi_hire', monthlySalary: 6000 });
    const state = stateWithEmployee(emp);
    const { state: newState } = fireEmployee(emp.id, state);
    expect(newState.hiddenLines.employeePressure).toBe(15 + 25); // 15 通用 + 25 额外
  });

  it('不存在的 employeeId → 无影响', () => {
    const emp = makeEmployee({ monthlySalary: 6000 });
    const state = stateWithEmployee(emp);
    const cashBefore = state.cash;
    const { state: newState, compensation } = fireEmployee('nonexistent', state);
    expect(compensation).toBe(0);
    expect(newState.cash).toBe(cashBefore);
    expect(newState.stores[0].employees.length).toBe(1);
  });
});

// ==============================================================================
// 9. 周重置
// ==============================================================================
describe('周重置', () => {
  it('getDayOfWeek: 正确计算周几（1=周一, 7=周日）', () => {
    expect(getDayOfWeek(1)).toBe(1);  // Day 1 = 周一
    expect(getDayOfWeek(2)).toBe(2);  // Day 2 = 周二
    expect(getDayOfWeek(7)).toBe(7);  // Day 7 = 周日
    expect(getDayOfWeek(8)).toBe(1);  // Day 8 = 周一
    expect(getDayOfWeek(14)).toBe(7); // Day 14 = 周日
    expect(getDayOfWeek(15)).toBe(1); // Day 15 = 周一
  });

  it('getWeekNumber: Math.ceil(day/7)', () => {
    expect(getWeekNumber(1)).toBe(1);
    expect(getWeekNumber(7)).toBe(1);
    expect(getWeekNumber(8)).toBe(2);
    expect(getWeekNumber(14)).toBe(2);
    expect(getWeekNumber(15)).toBe(3);
  });

  it('dayOfWeekLabel: 返回中文标签', () => {
    expect(dayOfWeekLabel(1)).toBe('周一');
    expect(dayOfWeekLabel(7)).toBe('周日');
    expect(dayOfWeekLabel(5)).toBe('周五');
  });

  it('isWeekStart: getDayOfWeek===1（周一）返回 true', () => {
    expect(isWeekStart(1)).toBe(true);
    expect(isWeekStart(8)).toBe(true);
    expect(isWeekStart(15)).toBe(true);
    expect(isWeekStart(7)).toBe(false);
    expect(isWeekStart(14)).toBe(false);
    expect(isWeekStart(0)).toBe(false);
  });

  it('resetWeeklyWorkDays 重置 daysWorkedThisWeek 和 weeklyWorkDays', () => {
    const emp = makeEmployee({
      daysWorkedThisWeek: 5,
      weeklyWorkDays: [1, 2, 3, 4, 5],
      consecutiveWorkDays: 3,
    });
    const [reset] = resetWeeklyWorkDays([emp]);
    expect(reset.daysWorkedThisWeek).toBe(0);
    expect(reset.weeklyWorkDays).toEqual([]);
    // consecutiveWorkDays 保持不变
    expect(reset.consecutiveWorkDays).toBe(3);
  });
});

// ==============================================================================
// 10. 全员放假
// ==============================================================================
describe('applyAllRest', () => {
  it('所有员工放假：isScheduledToday=false, 士气+10, consecutiveWorkDays=0', () => {
    const emp1 = makeEmployee({ id: 'e1', isScheduledToday: true, morale: 50, consecutiveWorkDays: 5 });
    const emp2 = makeEmployee({ id: 'e2', isScheduledToday: false, morale: 30, consecutiveWorkDays: 3 });
    const result = applyAllRest([emp1, emp2], 10);
    expect(result[0].isScheduledToday).toBe(false);
    expect(result[0].morale).toBe(60); // 50 + 10
    expect(result[0].consecutiveWorkDays).toBe(0);
    expect(result[1].morale).toBe(40); // 30 + 10
    expect(result[1].consecutiveWorkDays).toBe(0);
  });

  it('士气上限 100', () => {
    const emp = makeEmployee({ morale: 95 });
    const [result] = applyAllRest([emp], 10);
    expect(result.morale).toBe(100); // clamp
  });
});

// ==============================================================================
// 11. 涨工资
// ==============================================================================
describe('applySalaryRaise', () => {
  it('涨工资固定 +20 士气（与涨幅脱钩）', () => {
    const emp = makeEmployee({ monthlySalary: 5000, morale: 50 });
    const result = applySalaryRaise(emp, 500);
    expect(result.monthlySalary).toBe(5500);
    expect(result.morale).toBe(70); // 50 + 20
  });

  it('低士气员工涨工资 +20 后越过阈值退出 warning', () => {
    const emp = makeEmployee({ monthlySalary: 5000, morale: 15, status: 'warning', warningWorkDays: 3 });
    const result = applySalaryRaise(emp, 1000);
    expect(result.monthlySalary).toBe(6000);
    expect(result.morale).toBe(35); // 15 + 20
    expect(result.status).toBe('stable');
    expect(result.warningWorkDays).toBe(0);
  });

  it('涨 1 元也固定 +20 士气', () => {
    const emp = makeEmployee({ monthlySalary: 5000, morale: 50 });
    const result = applySalaryRaise(emp, 1);
    expect(result.monthlySalary).toBe(5001);
    expect(result.morale).toBe(70); // 50 + 20（固定，不按涨幅比例）
  });
});

// ==============================================================================
// 12. 装修档↔最大员工数
// ==============================================================================
describe('getMaxEmployees', () => {
  it('bare → 4', () => expect(getMaxEmployees('bare')).toBe(4));
  it('clean → 8', () => expect(getMaxEmployees('clean')).toBe(8));
  it('memorable → 12', () => expect(getMaxEmployees('memorable')).toBe(12));
  it('viral → 16', () => expect(getMaxEmployees('viral')).toBe(16));
  it('designer → 20', () => expect(getMaxEmployees('designer')).toBe(20));
  it('未知装修档 → 兜底 4', () => expect(getMaxEmployees('unknown')).toBe(4));
});

// ==============================================================================
// 13. 辅助函数
// ==============================================================================
describe('辅助函数', () => {
  it('getScheduledCount 返回排班人数', () => {
    const e1 = makeEmployee({ id: 'e1', isScheduledToday: true });
    const e2 = makeEmployee({ id: 'e2', isScheduledToday: false });
    const e3 = makeEmployee({ id: 'e3', isScheduledToday: true });
    expect(getScheduledCount([e1, e2, e3])).toBe(2);
  });

  it('computeOwnerCapacity 返回 90', () => {
    expect(computeOwnerCapacity()).toBe(90);
  });
});

// ==============================================================================
// 14. 关键回归场景：员工系统集成
// ==============================================================================
describe('员工系统集成场景', () => {
  it('开局生成 1-2 名员工', () => {
    const rng = createRng(42);
    const state = createNewGame(
      { storeType: '奶茶饮品', locationType: '学校门口', decorationLevel: 'clean', storeName: '测试', seed: 42 },
      rng,
    );
    const count = state.stores[0].employees.length;
    expect(count).toBeGreaterThanOrEqual(1);
    expect(count).toBeLessThanOrEqual(2);
    // 员工都有有效属性
    for (const emp of state.stores[0].employees) {
      expect(emp.id).toContain('emp_1_');
      expect(emp.morale).toBe(70);
      expect(emp.isExposed).toBe(false);
    }
  });

  it('getMaxEmployees 与装修档一致', () => {
    expect(getMaxEmployees('bare')).toBe(4);
    expect(getMaxEmployees('clean')).toBe(8);
    expect(getMaxEmployees('memorable')).toBe(12);
    expect(getMaxEmployees('viral')).toBe(16);
    expect(getMaxEmployees('designer')).toBe(20);
  });
});

// ==============================================================================
// 15. BUG 检测：rookie 效率成长使用 daysWorkedThisWeek（已修复为 joinDay）
// ==============================================================================
describe('rookie 效率成长（已修复）', () => {
  it('入职 30 天 rookie 效率接近 1.0（不再每周重置）', () => {
    // 一个入职 30 天的 rookie，本周只工作了 1 天
    const emp = makeEmployee({
      attribute: 'rookie',
      joinDay: 1,
      daysWorkedThisWeek: 1, // 周重置后只工作了 1 天
      weeklyWorkDays: [22],
    });
    const eff = computeDailyEfficiency(emp, 30); // currentDay=30
    // 修复后：0.5 + (30-1)*0.02 = 0.5 + 29*0.02 = 1.08 → clamp 1.0
    expect(eff).toBeGreaterThanOrEqual(0.9); // 接近 1.0，远高于旧值 0.52
  });
});

// ==============================================================================
// 16. 回归：加班判定按周循环（跨周重置 Bug 修复验证）
// ==============================================================================
describe('回归：加班判定按周循环（跨周重置）', () => {
  const OT_MULTIPLIER = OVERTIME_SALARY_MULTIPLIER; // 1.5
  const MAX_WEEK = MAX_WORK_DAYS_PER_WEEK;          // 5

  it('本周满 5 天后第 6 天加班；跨周重置清零重计；新周第 6 天复发；consecutiveWorkDays 不被重置', () => {
    // ---- 第 1 周：本周已上班满 5 天，今日仍排班 → 第 6 天应判加班 ----
    let emp = makeEmployee({
      isScheduledToday: true,
      daysWorkedThisWeek: MAX_WEEK,     // 本周已上班 5 天
      consecutiveWorkDays: MAX_WEEK,    // 长期不休息计数器一并累计（不影响加班判定）
      morale: 70,
    });
    expect(checkOvertime(emp)).toBe(true);
    const daily = getDailySalary(emp); // 5000/30 = 166
    expect(computeStaffCost([emp])).toBe(Math.round(daily * OT_MULTIPLIER)); // 166*1.5 = 249

    // ---- 模拟周重置（周日结束）：resetWeeklyWorkDays 只清 daysWorkedThisWeek ----
    const [resetEmp] = resetWeeklyWorkDays([{ ...emp }]);
    expect(resetEmp.daysWorkedThisWeek).toBe(0);          // 本周计数清零
    expect(resetEmp.consecutiveWorkDays).toBe(MAX_WEEK);  // 长期计数器保留（职责分离验证）
    // 新周第 1 天：仍排班但本周天数为 0 → 不再是加班（正常日薪）
    const newWeekDay1 = { ...resetEmp, isScheduledToday: true };
    expect(checkOvertime(newWeekDay1)).toBe(false);
    expect(computeStaffCost([newWeekDay1])).toBe(daily);  // 正常工资，不再 ×1.5

    // ---- 新周继续工作到第 6 天（本周再次累计到 5）→ 加班复发（按周循环，非永久）----
    const newWeekEmp = makeEmployee({
      isScheduledToday: true,
      daysWorkedThisWeek: MAX_WEEK,      // 新周再次满 5 天
      consecutiveWorkDays: MAX_WEEK * 2, // 长期计数器继续增长，不影响本周判定
      morale: 70,
    });
    expect(checkOvertime(newWeekEmp)).toBe(true);
    expect(computeStaffCost([newWeekEmp])).toBe(Math.round(daily * OT_MULTIPLIER)); // 249 复发
  });
});
