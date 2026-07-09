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
  RESIGN_MORALE_THRESHOLD,
  STRIKE_MORALE_THRESHOLD,
  BASE_MONTHLY_SALARY,
  SALARY_VARIANCE,
  CANDIDATE_COUNT_MIN,
  CANDIDATE_COUNT_MAX,
  DAYS_PER_WEEK,
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

/** 检查员工今日是否超时加班（本周已排满 MAX_WORK_DAYS_PER_WEEK 天且今日排班） */
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
          description: `${emp.name} 本周已连续上班超过 ${MAX_WORK_DAYS_PER_WEEK} 天，今日工资 ×${OVERTIME_SALARY_MULTIPLIER}，士气 -${Math.abs(MORALE_DECAY_OVERTIME)}。`,
        });
      }
    } else {
      // 今日休息 → 士气恢复
      newMorale += MORALE_RECOVERY_REST;
    }

    // 连续工作超过 7 天惩罚
    if (emp.consecutiveWorkDays > DAYS_PER_WEEK) {
      newMorale += MORALE_DECAY_CONTINUOUS;
    }

    // 低士气额外惩罚（士气 ≤ 30 时每日再 -2）
    if (newMorale <= 30) {
      newMorale -= 2;
    }

    // 士气警告
    if (newMorale <= 20 && emp.morale > 20) {
      events.push({
        type: 'morale_warning',
        employeeId: emp.id,
        employeeName: emp.name,
        description: `${emp.name} 士气已降至 ${Math.max(0, Math.round(newMorale))}，濒临离职！建议安排休息或涨工资。`,
      });
    }

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
      efficiencyCache: 0, // 重置效率缓存
    };
  });

  return { employees: updated, events };
}

// ====== 离职/罢工检测 ======

/** 检测是否有员工要主动离职或罢工 */
export function checkResignOrStrike(
  employees: Employee[],
  _store?: StoreState,
): { type: 'none' | 'resign' | 'strike'; resigning: Employee[]; description: string } {
  const resigning: Employee[] = [];

  // 检查离职
  for (const emp of employees) {
    if (emp.morale < RESIGN_MORALE_THRESHOLD) {
      resigning.push(emp);
    }
  }

  if (resigning.length > 0) {
    const names = resigning.map((e) => e.name).join('、');
    return {
      type: 'resign',
      resigning,
      description: `${names} 因士气过低（< ${RESIGN_MORALE_THRESHOLD}）选择离职！`,
    };
  }

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

/** 设置员工排班状态（含加班警告检测） */
export function setEmployeeSchedule(
  employee: Employee,
  scheduled: boolean,
  day: number,
): { employee: Employee; isOvertime: boolean } {
  if (scheduled === employee.isScheduledToday) {
    return { employee, isOvertime: false };
  }

  const isOvertime = scheduled && employee.daysWorkedThisWeek >= MAX_WORK_DAYS_PER_WEEK;

  if (scheduled) {
    // 排班
    return {
      employee: {
        ...employee,
        isScheduledToday: true,
        weeklyWorkDays: [...employee.weeklyWorkDays, day],
        daysWorkedThisWeek: employee.daysWorkedThisWeek + 1,
        consecutiveWorkDays: employee.consecutiveWorkDays + 1,
      },
      isOvertime,
    };
  }

  // 取消排班
  return {
    employee: {
      ...employee,
      isScheduledToday: false,
      // 注意：不减少 daysWorkedThisWeek 和 weeklyWorkDays，因为当日已记录
      consecutiveWorkDays: 0,
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

// ====== 周重置 ======

/** 是否为周一开始（day % 7 === 1） */
export function isWeekStart(day: number): boolean {
  return day % 7 === 1;
}

/** 重置所有员工的每周排班数据 */
export function resetWeeklyWorkDays(employees: Employee[]): Employee[] {
  return employees.map((e) => ({
    ...e,
    daysWorkedThisWeek: 0,
    weeklyWorkDays: [],
    // 不重置 consecutiveWorkDays（连续工作日跨周跟踪）
  }));
}

/** 全员放假：所有员工不排班，士气全体恢复 */
export function applyAllRest(employees: Employee[], moraleBonus: number): Employee[] {
  return employees.map((e) => ({
    ...e,
    isScheduledToday: false,
    morale: clamp(e.morale + moraleBonus, 0, 100),
    consecutiveWorkDays: 0,
  }));
}

/** 涨工资恢复士气 */
export function applySalaryRaise(
  employee: Employee,
  amount: number,
  moralePerAmount: number,
): Employee {
  const moraleGain = Math.floor(amount / 500) * moralePerAmount;
  return {
    ...employee,
    monthlySalary: employee.monthlySalary + amount,
    morale: clamp(employee.morale + moraleGain, 0, 100),
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

/** 老板顶班模式下计算承载 */
export function computeOwnerCapacity(): number {
  return 90;
}
