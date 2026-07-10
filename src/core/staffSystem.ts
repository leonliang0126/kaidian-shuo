// 员工系统核心逻辑（《开店说》员工系统重构 v3）
// 纯函数模块，不耦合 React。所有依赖通过参数注入。
import type { Employee, Candidate, StaffEvent } from '../types/employee';
import type { StoreState, GameState, HiddenLines } from '../types';
import { ATTRIBUTE_CONFIG, drawAttribute } from '../data/employeeAttributes';
import { generateEmployeeName } from '../data/employeeNames';
import {
  BASE_CAPACITY_PER_STAFF,
  LAYOFF_COMPENSATION_DAYS,
  ATTRIBUTE_EXPOSE_DAYS,
  MAX_WORK_DAYS_PER_WEEK,
  OVERTIME_SALARY_MULTIPLIER,
  TEMP_STAFF_SALARY_MULTIPLIER,
  MORALE_DECAY_OVERTIME,
  MORALE_RECOVERY_REST,
  MORALE_DECAY_CONTINUOUS,
  STRIKE_MORALE_THRESHOLD,
  WARN_GRACE_DAYS,
  LOW_MORALE_THRESHOLD,
  BASE_MONTHLY_SALARY,
  SALARY_VARIANCE,
  CANDIDATE_COUNT_MIN,
  CANDIDATE_COUNT_MAX,
  DAYS_PER_WEEK,
  SALARY_RAISE_MORALE_FLAT,
  FULL_WEEKS_TO_WARN,
  CONTINUOUS_WORK_PENALTY_THRESHOLD,
} from '../data/staffConstants';
import { clamp } from '../utils/constants';

// ====== 候选人/员工生成 ======

/** 生成一名候选人（含随机属性、薪资、隐晦描述） */
export function generateCandidate(
  rng: () => number,
  day: number,
  _decorationLevel: string,
): Candidate {
  const attribute = drawAttribute(rng);
  const cfg = ATTRIBUTE_CONFIG[attribute];
  const hint = cfg.descriptionHints[Math.floor(rng() * cfg.descriptionHints.length)];
  const salaryVariance = 1 + (rng() - 0.5) * 2 * SALARY_VARIANCE;
  const salary = Math.round(BASE_MONTHLY_SALARY * salaryVariance);
  const name = generateEmployeeName(rng);
  const rand4 = rng().toString(36).slice(2, 6);

  return {
    id: `candidate_${day}_${rand4}`,
    name,
    attribute,
    hint,
    monthlySalary: salary,
    generatedDay: day,
  };
}

/** 生成一批候选人 */
export function generateCandidates(
  rng: () => number,
  day: number,
  decorationLevel: string,
): Candidate[] {
  const count =
    CANDIDATE_COUNT_MIN +
    Math.floor(rng() * (CANDIDATE_COUNT_MAX - CANDIDATE_COUNT_MIN + 1));
  const candidates: Candidate[] = [];
  for (let i = 0; i < count; i++) {
    candidates.push(generateCandidate(rng, day, decorationLevel));
  }
  return candidates;
}

/** 将候选人转为正式员工（入职） */
export function generateEmployee(candidate: Candidate, day: number, isTemp = false, rng?: () => number): Employee {
  const r = rng ?? Math.random;
  const rand4 = r().toString(36).slice(2, 6);
  return {
    id: `emp_${day}_${rand4}`,
    name: candidate.name,
    joinDay: day,
    attribute: candidate.attribute,
    isExposed: false,
    morale: 70, // 入职初始士气
    monthlySalary: candidate.monthlySalary,
    daysWorkedThisWeek: 0,
    isScheduledToday: false,
    weeklyWorkDays: [],
    consecutiveWorkDays: 0,
    isTempStaff: isTemp,
    efficiencyCache: 0,
    status: 'stable',
    warningWorkDays: 0,
  };
}

// ====== 效率计算 ======

/** 计算员工当日实际效率系数（属性基础 × 士气修正 × 特殊机制） */
export function computeDailyEfficiency(
  employee: Employee,
  currentDay: number,
  _store?: StoreState,
  _hiddenLines?: HiddenLines,
): number {
  const cfg = ATTRIBUTE_CONFIG[employee.attribute];
  let base = (cfg.efficiencyRange[0] + cfg.efficiencyRange[1]) / 2;

  // 波动属性（摸鱼王、关系户等）每日波动
  if (cfg.efficiencyVolatility > 0) {
    const wave = (Math.random() - 0.5) * 2 * cfg.efficiencyVolatility;
    base += wave;
  }

  // 新手上路成长（每日 +0.02，上限 1.0）
  if (employee.attribute === 'rookie') {
    const daysEmployed = currentDay - employee.joinDay;
    base = Math.min(1.0, 0.5 + daysEmployed * 0.02);
  }

  // 士气修正：士气 50 为基准
  // 每低 10 点 -5% 效率，每高 10 点 +3% 效率
  let moraleFactor: number;
  if (employee.morale < 50) {
    moraleFactor = 1 + (employee.morale - 50) * 0.01; // 士气 0 → 0.5, 士气 50 → 1.0
  } else {
    moraleFactor = 1 + (employee.morale - 50) * 0.006; // 士气 100 → 1.3
  }
  moraleFactor = clamp(moraleFactor, 0.3, 1.5);

  return Math.round(base * moraleFactor * 100) / 100;
}

// ====== 成本与承载计算 ======

/** 计算员工今日日薪 */
export function getDailySalary(employee: Employee): number {
  return Math.floor(employee.monthlySalary / 30);
}

/** 检查员工今日是否超时加班（本周已上班满 MAX_WORK_DAYS_PER_WEEK 天且今日排班 → 第 6 天起算加班 ×1.5） */
export function checkOvertime(employee: Employee): boolean {
  return employee.isScheduledToday && employee.daysWorkedThisWeek >= MAX_WORK_DAYS_PER_WEEK;
}

/** 计算今日总人力成本 */
export function computeStaffCost(employees: Employee[]): number {
  let total = 0;
  for (const emp of employees) {
    if (!emp.isScheduledToday) continue;
    const base = getDailySalary(emp);
    const isOvertime = checkOvertime(emp);
    const multiplier = isOvertime ? OVERTIME_SALARY_MULTIPLIER : 1;
    const tempMultiplier = emp.isTempStaff ? TEMP_STAFF_SALARY_MULTIPLIER : 1;
    total += base * multiplier * tempMultiplier;
  }
  return total;
}

/** 计算今日承载上限 */
export function computeCapacity(employees: Employee[]): number {
  const scheduledCount = employees.filter((e) => e.isScheduledToday).length;
  return scheduledCount * BASE_CAPACITY_PER_STAFF;
}

// ====== 士气系统 ======

/** 每日结束时的士气处理：加班扣减、休息恢复、连续工作惩罚 */
export function applyMoraleDecay(
  employees: Employee[],
  _today: number,
): { employees: Employee[]; events: StaffEvent[] } {
  const events: StaffEvent[] = [];
  const updated = employees.map((emp) => {
    let newMorale = emp.morale;
    let status: 'stable' | 'warning' = emp.status ?? 'stable';
    let warningWorkDays = emp.warningWorkDays ?? 0;

    // 今日排班 → 士气自然消耗
    if (emp.isScheduledToday) {
      const cfg = ATTRIBUTE_CONFIG[emp.attribute];
      newMorale -= cfg.baseMoraleDecay;

      // 加班惩罚
      if (checkOvertime(emp)) {
        newMorale += MORALE_DECAY_OVERTIME;
        events.push({
          type: 'overtime_warning',
          employeeId: emp.id,
          employeeName: emp.name,
          description: `${emp.name} 本周已上班满 ${MAX_WORK_DAYS_PER_WEEK} 天，今日（第 ${MAX_WORK_DAYS_PER_WEEK + 1} 天）按加班计 ×${OVERTIME_SALARY_MULTIPLIER}，士气 -${Math.abs(MORALE_DECAY_OVERTIME)}。`,
        });
      }
    } else {
      // 今日休息 → 士气恢复
      newMorale += MORALE_RECOVERY_REST;
    }

    // 连续工作超过阈值天数惩罚（阈值后移至 14 天：连续上班满 14 天起才扣士气）
    if (emp.consecutiveWorkDays >= CONTINUOUS_WORK_PENALTY_THRESHOLD) {
      newMorale += MORALE_DECAY_CONTINUOUS;
    }

    // 低士气额外惩罚（士气 ≤ 30 时每日再 -2）
    if (newMorale <= 30) {
      newMorale -= 2;
    }

    // 注意：濒临离职 warning 的进入/退出已移至 resetWeeklyWorkDays 之后的 applyFullWeekWarning，
    // 基于 consecutiveFullWeeks（连续满勤周）驱动，避免在员工连续上班早期就因士气低误触发。

    newMorale = clamp(Math.round(newMorale), 0, 100);

    // 更新连续工作天数
    let newConsecutive = emp.consecutiveWorkDays;
    if (emp.isScheduledToday) {
      newConsecutive += 1;
    } else {
      newConsecutive = 0;
    }

    return {
      ...emp,
      morale: newMorale,
      consecutiveWorkDays: newConsecutive,
      status,
      warningWorkDays,
      efficiencyCache: 0, // 重置效率缓存
    };
  });

  return { employees: updated, events };
}

// ====== 离职/罢工检测 ======

/**
 * 离职过渡状态机：对处于 warning 的员工推进"连续排班出勤"计数；
 * 满 WARN_GRACE_DAYS 且此刻士气仍 ≤ LOW_MORALE_THRESHOLD → 必然离职。
 * 中途未排班（跳过排班/休息/请假）→ 计数清零（连续中断）。
 *
 * 注：原本 `morale < RESIGN_MORALE_THRESHOLD` 的"次日立即离职"分支已由本函数接管，
 * 这里不再做即时离职，所有离职都必须经过 warning 计数窗口。
 */
export function advanceWarningAndResign(
  employees: Employee[],
): { employees: Employee[]; resigning: Employee[] } {
  const resigning: Employee[] = [];
  const updated = employees
    .map((emp): Employee | null => {
      if (emp.status !== 'warning') return emp; // 仅 warning 员工参与计数
      // 连续出勤计数：当日排班 +1，否则清零（连续中断）；warningWorkDays 缺省按 0
      const nextCount = emp.isScheduledToday ? (emp.warningWorkDays ?? 0) + 1 : 0;
      // 离职称职条件：计数达标 且 此刻士气仍低 → 必然离职
      if (nextCount >= WARN_GRACE_DAYS && emp.morale <= LOW_MORALE_THRESHOLD) {
        resigning.push(emp);
        return null; // 标记移除
      }
      return { ...emp, warningWorkDays: nextCount };
    })
    .filter((e): e is Employee => e !== null);
  return { employees: updated, resigning };
}

/** 检测是否有员工要罢工（离职由 advanceWarningAndResign 的 warning 状态机接管） */
export function checkResignOrStrike(
  employees: Employee[],
  _store?: StoreState,
): { type: 'none' | 'strike'; resigning: Employee[]; description: string } {
  // 检查罢工：是否有刺头且士气低
  const troublemakers = employees.filter(
    (e) => e.attribute === 'troublemaker' && e.morale < STRIKE_MORALE_THRESHOLD,
  );
  if (troublemakers.length > 0) {
    // 刺头带节奏 → 全体罢工
    const names = troublemakers.map((e) => e.name).join('、');
    return {
      type: 'strike',
      resigning: [],
      description: `${names} 煽动全体员工罢工！今日无人上班。`,
    };
  }

  return { type: 'none', resigning: [], description: '' };
}

// ====== 属性暴露 ======

/** 尝试暴露属性（入职满 ATTRIBUTE_EXPOSE_DAYS 天） */
export function tryExposeAttributes(
  employee: Employee,
  currentDay: number,
): { employee: Employee; exposed: boolean } {
  if (employee.isExposed) return { employee, exposed: false };
  if (currentDay - employee.joinDay >= ATTRIBUTE_EXPOSE_DAYS) {
    return { employee: { ...employee, isExposed: true }, exposed: true };
  }
  return { employee, exposed: false };
}

// ====== 排班相关 ======

/**
 * 设置员工今日排班状态（仅切换"今日是否上班"意图，不累加任何天数计数器）。
 *
 * 关键修正（bugfix）：之前此处在按下"上班/休息"按钮时当场把
 * daysWorkedThisWeek / consecutiveWorkDays / weeklyWorkDays 各 +1，而"一天结束"
 * 的结算（endDay → applyMoraleDecay）又会再 +1，导致：
 *   1) 按一下按钮当天就被记成"已上班一天"；
 *   2) 中途反复切换（上班→休息→上班）计数器被多次累加，出现"当天连续上班十几天"；
 *   3) daysWorkedThisWeek 虚高 → 加班阈值提前触发（第 5 天就算加班）。
 * 现改为：本函数只切换 isScheduledToday（排班意图），所有天数计数器统一在
 * 结算时由 endDay 推进，保证每个真实工作日只 +1 一次。
 *
 * 加班预览（isOvertime）基于 daysWorkedThisWeek（本周已上班天数），
 * 与结算时的 checkOvertime 语义保持一致：本周上班满 MAX_WORK_DAYS_PER_WEEK 天后，
 * 当日（第 6 天起）按加班计 ×1.5。周日结束由 resetWeeklyWorkDays 清零，跨周重置。
 */
export function setEmployeeSchedule(
  employee: Employee,
  scheduled: boolean,
  _day: number,
): { employee: Employee; isOvertime: boolean } {
  if (scheduled === employee.isScheduledToday) {
    return { employee, isOvertime: false };
  }

  const isOvertime = scheduled && employee.daysWorkedThisWeek >= MAX_WORK_DAYS_PER_WEEK;

  if (scheduled) {
    // 仅切换今日排班意图；天数计数器由结算统一推进（见 endDay / applyMoraleDecay）
    return {
      employee: {
        ...employee,
        isScheduledToday: true,
      },
      isOvertime,
    };
  }

  // 取消排班（休息）：仅切换意图；连续上班天数由结算时统一处理（isScheduledToday=false → 结算清零）
  return {
    employee: {
      ...employee,
      isScheduledToday: false,
    },
    isOvertime: false,
  };
}

// ====== 裁员 ======

/** 裁员（包含补偿金计算、品牌评级影响、employeePressure 联动） */
export function fireEmployee(
  employeeId: string,
  state: GameState,
): { state: GameState; compensation: number } {
  const s = { ...state };
  const storeIndex = s.stores.findIndex((st) =>
    st.employees.some((e) => e.id === employeeId),
  );
  if (storeIndex < 0) return { state: s, compensation: 0 };

  const store = { ...s.stores[storeIndex] };
  const empIndex = store.employees.findIndex((e) => e.id === employeeId);
  if (empIndex < 0) return { state: s, compensation: 0 };

  const emp = store.employees[empIndex];
  const dailySalary = getDailySalary(emp);
  const compensation = dailySalary * LAYOFF_COMPENSATION_DAYS;

  // 移除该员工
  const newEmployees = [...store.employees];
  newEmployees.splice(empIndex, 1);
  store.employees = newEmployees;

  // 扣现金
  s.cash = Math.round(s.cash - compensation);

  // 员工压力 +15
  const newHidden = { ...s.hiddenLines };
  newHidden.employeePressure = clamp(newHidden.employeePressure + 15, 0, 100);

  // 品牌评级 -1
  store.rating = clamp(store.rating - 1, 0, 100);

  // 关系户额外惩罚
  if (emp.attribute === 'guanxi_hire') {
    newHidden.employeePressure = clamp(newHidden.employeePressure + 25, 0, 100);
    store.rating = clamp(store.rating - 5, 0, 100);
  }

  const newStores = [...s.stores];
  newStores[storeIndex] = store;

  return {
    state: {
      ...s,
      stores: newStores,
      hiddenLines: newHidden,
      brandRating: newStores[0]?.rating ?? s.brandRating,
    },
    compensation,
  };
}

// ====== 周/日期工具 ======

/** 计算某一天是周几（1-7，1=周一，7=周日） */
export function getDayOfWeek(day: number): number {
  // ((day - 1) % 7) + 1：保证 JS 负数取模也得到 1-7
  return ((day - 1) % 7 + 7) % 7 + 1;
}

/** 计算某一天所在周数（每 7 天一周，第 1 周为 1-7 天） */
export function getWeekNumber(day: number): number {
  return Math.ceil(day / 7);
}

/** 返回"周一" ~ "周日"标签 */
export function dayOfWeekLabel(day: number): string {
  const labels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const idx = getDayOfWeek(day) - 1;
  return labels[idx] ?? '?';
}

// ====== 周重置 ======

/** 判断是否为周一（getDayOfWeek(day) === 1） */
export function isWeekStart(day: number): boolean {
  return getDayOfWeek(day) === 1;
}

/** 重置所有员工的每周排班数据，并基于本周是否满勤更新 consecutiveFullWeeks（连续满勤周计数）。 */
export function resetWeeklyWorkDays(employees: Employee[]): Employee[] {
  return employees.map((e) => {
    const isFullWeek = e.daysWorkedThisWeek >= DAYS_PER_WEEK; // 一周 7 天全部排班 = 满勤周
    return {
      ...e,
      daysWorkedThisWeek: 0,
      weeklyWorkDays: [],
      // 不重置 consecutiveWorkDays（连续工作日跨周跟踪）
      consecutiveFullWeeks: isFullWeek ? (e.consecutiveFullWeeks ?? 0) + 1 : 0,
    };
  });
}

/**
 * 濒临离职警告（基于连续满勤周）：在 resetWeeklyWorkDays（周日）之后调用。
 * - consecutiveFullWeeks >= FULL_WEEKS_TO_WARN（连续两周满勤）→ 进入 warning 并广播事件；
 * - consecutiveFullWeeks 清零（休息了一周）→ 退出 warning（撤回辞呈）。
 * 与 applyMoraleDecay 解耦：warning 不再因"士气低"误触发，只有长期不休息才濒临离职。
 */
export function applyFullWeekWarning(employees: Employee[]): { employees: Employee[]; events: string[] } {
  const events: string[] = [];
  const updated = employees.map((emp) => {
    const fullWeeks = emp.consecutiveFullWeeks ?? 0;
    if (fullWeeks >= FULL_WEEKS_TO_WARN && emp.status !== 'warning') {
      events.push(
        `${emp.name} 已经连续两周全勤没休息，濒临离职！建议安排休息或涨工资。`,
      );
      return { ...emp, status: 'warning' as const, warningWorkDays: 0 };
    }
    if (emp.status === 'warning' && fullWeeks < FULL_WEEKS_TO_WARN) {
      return { ...emp, status: 'stable' as const, warningWorkDays: 0 };
    }
    return emp;
  });
  return { employees: updated, events };
}

/** 全员放假：所有员工不排班，士气全体恢复；同时退出 warning（撤回辞呈）。 */
export function applyAllRest(employees: Employee[], moraleBonus: number): Employee[] {
  return employees.map((e) => ({
    ...e,
    isScheduledToday: false,
    morale: clamp(e.morale + moraleBonus, 0, 100),
    consecutiveWorkDays: 0,
    status: 'stable' as const,
    warningWorkDays: 0,
  }));
}

/** 涨工资恢复士气（固定 +SALARY_RAISE_MORALE_FLAT，与涨幅脱钩）；加薪后士气越过阈值则退出 warning。 */
export function applySalaryRaise(
  employee: Employee,
  amount: number,
): Employee {
  const moraleGain = SALARY_RAISE_MORALE_FLAT;
  const newMorale = clamp(employee.morale + moraleGain, 0, 100);
  const exitedWarning = employee.status === 'warning' && newMorale > LOW_MORALE_THRESHOLD;
  return {
    ...employee,
    monthlySalary: employee.monthlySalary + amount,
    morale: newMorale,
    status: exitedWarning ? ('stable' as const) : employee.status,
    warningWorkDays: exitedWarning ? 0 : employee.warningWorkDays,
  };
}

/** 获取装修档对应的最大员工数 */
export function getMaxEmployees(decorationLevel: string): number {
  const map: Record<string, number> = {
    bare: 4,
    clean: 8,
    memorable: 12,
    viral: 16,
    designer: 20,
  };
  return map[decorationLevel] ?? 4;
}

/** 获取今日排班的员工数 */
export function getScheduledCount(employees: Employee[]): number {
  return employees.filter((e) => e.isScheduledToday).length;
}

/**
 * @deprecated 死代码：函数已定义但全代码未被调用。老板顶班的承载加成统一用
 * `OWNER_CAPACITY_BONUS` 常量（=70，等于 1 个员工位），由 settlement.ts 在结算时叠加，
 * 不再走本函数。保留仅作历史参考。
 */
export function computeOwnerCapacity(): number {
  return 90;
}
