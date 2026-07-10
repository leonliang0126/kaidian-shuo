// 《开店说》三处改动（离职过渡状态机 / 老板顶班承载 / 事件 story 挂载）专项单测。
// 对应技术方案 docs/three-fix-arch.md 的验收点：
//   块 A（离职计数 5 场景）、块 B（承载 5 场景）、块 C（interpolateStory 5 场景 + JSON 195 条 story）。
// 不依赖 React / Zustand，直接测试纯函数与结算/行动系统。
import { describe, it, expect } from 'vitest';
import {
  advanceWarningAndResign,
  checkResignOrStrike,
  applySalaryRaise,
  computeCapacity,
} from '../src/core/staffSystem';
import type { Employee } from '../src/types/employee';
import type { GameState } from '../src/types';
import { resolveSettlement } from '../src/core/settlement';
import { emptyModifiers } from '../src/core/modifiers';
import { takeAction, resetDailyActionState } from '../src/core/actionSystem';
import { createNewGame } from '../src/core/createNewGame';
import { createRng } from '../src/core/rng';
import { interpolateStory } from '../src/utils/interpolateStory';
import eventsJson from '../src/data/events.v0.1.json';

// ====== 测试工厂 ======

function mkEmp(o: Partial<Employee> = {}): Employee {
  return {
    id: 'emp_t',
    name: '阿强',
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
    status: 'stable',
    warningWorkDays: 0,
    ...o,
  };
}

/** 用 createNewGame 起一局，再把主店员工整体替换为指定数量（可选排班）的测试员工。 */
function freshStoreState(employeeCount: number, scheduled: boolean): GameState {
  const rng = createRng(7);
  const state = createNewGame(
    {
      initialCashTier: 300000,
      storeType: '奶茶饮品',
      locationType: '学校门口',
      decorationLevel: 'clean',
      storeName: '老王煎饼',
      seed: 7,
    },
    rng,
  );
  const emps: Employee[] = [];
  for (let i = 0; i < employeeCount; i++) {
    emps.push(
      mkEmp({ id: `emp_${i}`, name: `员工${i}`, isScheduledToday: scheduled, morale: 80 }),
    );
  }
  state.stores[0].employees = emps;
  return state;
}

/** 构造一个超高曝光的修正器，确保订单需求远超承载上限，使承载成为唯一约束。 */
function hugeExposureMods() {
  const m = emptyModifiers();
  m.exposurePct = 1000;
  return m;
}

// =====================================================================
// 块 A · 离职过渡状态机（advanceWarningAndResign / checkResignOrStrike）
// =====================================================================

describe('块 A · 离职过渡状态机', () => {
  it('A1: warning 员工连续排班 6 天且士气 ≤20 → 第 6 天必然离职', () => {
    let emps = [
      mkEmp({ status: 'warning', morale: 15, warningWorkDays: 0, isScheduledToday: true }),
    ];
    let resignedTotal = 0;
    for (let i = 0; i < 6; i++) {
      emps = emps.map((e) => ({ ...e, isScheduledToday: true }));
      const r = advanceWarningAndResign(emps);
      emps = r.employees;
      if (i < 5) expect(r.resigning.length, `第 ${i + 1} 天不应离职`).toBe(0);
      resignedTotal += r.resigning.length;
    }
    expect(resignedTotal).toBe(1);
    expect(emps.length, '离职后员工列表应清空该员工').toBe(0);
  });

  it('A2: 中途任一一天不排班 → 计数清零、不会在第 6 天离职', () => {
    let emps = [
      mkEmp({ status: 'warning', morale: 15, warningWorkDays: 0, isScheduledToday: true }),
    ];
    // 第 4 天休息（不排班），其余排班；总跨度 9 天，但连续出勤被中断
    const scheduled = [true, true, true, false, true, true, true, true, true];
    let resignedTotal = 0;
    for (const sched of scheduled) {
      emps = emps.map((e) => ({ ...e, isScheduledToday: sched }));
      const r = advanceWarningAndResign(emps);
      emps = r.employees;
      resignedTotal += r.resigning.length;
    }
    expect(resignedTotal).toBe(0);
    expect(emps[0].warningWorkDays).toBeLessThan(6);
  });

  it('A3: 加薪使士气 >20 退出 warning → 后续连续排班也不再离职', () => {
    let emp = mkEmp({ status: 'warning', morale: 15, warningWorkDays: 3 });
    // 加薪 5000、每 500 元 +5 士气 → 增益 50 → morale 65 > 20 → 退出 warning
    emp = applySalaryRaise(emp, 5000, 5);
    expect(emp.status).toBe('stable');
    expect(emp.warningWorkDays).toBe(0);

    let emps = [emp];
    let resignedTotal = 0;
    for (let i = 0; i < 6; i++) {
      emps = emps.map((e) => ({ ...e, isScheduledToday: true }));
      const r = advanceWarningAndResign(emps);
      emps = r.employees;
      resignedTotal += r.resigning.length;
    }
    expect(resignedTotal, '退出 warning 后不应再被计数离职').toBe(0);
  });

  it('A4: 刺头士气 <20 立即罢工（不卡 6 天）', () => {
    const r = checkResignOrStrike([
      mkEmp({ attribute: 'troublemaker', morale: 12, status: 'stable' }),
    ]);
    expect(r.type).toBe('strike');
    expect(r.resigning.length).toBe(0);
  });

  it('A5: 已移除 morale<15 即时离职分支 → 非刺头低士气只返回 none', () => {
    const r = checkResignOrStrike([
      mkEmp({ attribute: 'old_smooth', morale: 5, status: 'stable' }),
    ]);
    expect(r.type, '旧即时离职分支应已移除，仅可能 none/strike').toBe('none');
    expect(r.resigning.length).toBe(0);
  });
});

// =====================================================================
// 块 B · 老板顶班承载修正（settlement / actionSystem）
// =====================================================================

describe('块 B · 老板顶班承载修正', () => {
  it('B1: 1 员工 + 顶班 → effectiveCap=140；无顶班 → 70', () => {
    const state = freshStoreState(1, true);
    expect(computeCapacity(state.stores[0].employees)).toBe(70);
    const mods = hugeExposureMods();
    const { daily: dCov } = resolveSettlement(
      state,
      state.stores[0],
      state.decisions,
      mods,
      createRng(1),
      true,
    );
    const { daily: dNo } = resolveSettlement(
      state,
      state.stores[0],
      state.decisions,
      mods,
      createRng(1),
      false,
    );
    expect(dCov.orders, '1 员工 + 顶班(70) = 140 承载').toBe(140);
    expect(dNo.orders, '1 员工无顶班 = 70 承载').toBe(70);
    expect(dCov.orders - dNo.orders, '顶班恰好 +70 承载').toBe(70);
  });

  it('B2: 0 员工 + 顶班 → effectiveCap=70 → 产生基础流水（revenue>0）', () => {
    const state = freshStoreState(0, false);
    const mods = hugeExposureMods();
    const { daily } = resolveSettlement(
      state,
      state.stores[0],
      state.decisions,
      mods,
      createRng(1),
      true,
    );
    expect(daily.orders).toBe(70);
    expect(daily.revenue, '兜底顶班应产生基础流水').toBeGreaterThan(0);
  });

  it('B3: 0 员工无顶班 → effectiveCap=0 → revenue=0（行为不变）', () => {
    const state = freshStoreState(0, false);
    const mods = hugeExposureMods();
    const { daily } = resolveSettlement(
      state,
      state.stores[0],
      state.decisions,
      mods,
      createRng(1),
      false,
    );
    expect(daily.orders).toBe(0);
    expect(daily.revenue, '无员工无顶班不出单').toBe(0);
  });

  it('B4: 主动 owner_shift 后 ownerCoverToday=true，次日 beginDay 重置为 false', () => {
    const g = freshStoreState(1, true);
    const r1 = takeAction(g, 'owner_shift', createRng(1));
    expect(r1.state.ownerCoverToday, '主动顶班应置位').toBe(true);
    const r2 = resetDailyActionState(r1.state);
    expect(r2.ownerCoverToday, '新一天应重置为未顶班').toBe(false);
  });

  it('B5: owner_shift 不再误映射 ordersPct+3%（capacity→ordersPct 已移除）', () => {
    const g = freshStoreState(1, true);
    const r1 = takeAction(g, 'owner_shift', createRng(1));
    expect(r1.state.dayModifiers.ordersPct, '顶班不应再给订单 +3%').toBe(0);
  });
});

// =====================================================================
// 块 C · story 插值工具 + events.v0.1.json 文案校验
// =====================================================================

describe('块 C · story 插值工具 interpolateStory', () => {
  it('C1: {name} → 真实员工名', () => {
    expect(interpolateStory('{name} 今天没来', { name: '阿强', storeName: '老王煎饼' })).toBe(
      '阿强 今天没来',
    );
  });

  it('C2: 缺 name → 兜底「店员」', () => {
    expect(interpolateStory('{name} 呢', { storeName: '老王煎饼' })).toBe('店员 呢');
    expect(interpolateStory('{name} 呢', { name: null, storeName: '老王煎饼' })).toBe('店员 呢');
  });

  it('C3: {店名} → 真实店名', () => {
    expect(interpolateStory('{店名} 客满', { storeName: '老王煎饼' })).toBe('老王煎饼 客满');
  });

  it('C4: 无占位符模板原样返回', () => {
    expect(interpolateStory('今天天气不错', { storeName: '老王煎饼' })).toBe('今天天气不错');
  });

  it('C5: 空模板与空店名兜底', () => {
    expect(interpolateStory('', { storeName: '老王煎饼' })).toBe('');
    expect(interpolateStory('欢迎光临{店名}', { storeName: '' })).toBe('欢迎光临小店');
  });
});

describe('块 C · events.v0.1.json 文案校验', () => {
  const raw = eventsJson as unknown as Record<
    string,
    { id?: string; options?: Array<{ id?: string; story?: string; visibleEffect?: string }> }
  >;
  const events = Object.values(raw).filter((e) => e && Array.isArray(e.options));

  it('全 195 选项均含 story 字符串', () => {
    let count = 0;
    for (const ev of events) {
      for (const opt of ev.options ?? []) {
        expect(typeof opt.story, `选项 ${ev.id}->${opt.id} 应有 story 字符串`).toBe('string');
        count += 1;
      }
    }
    expect(count, '应有 195 个选项携带 story').toBe(195);
  });

  it('员工类 23 选项 story 含 {name}，通用 66 处含 {店名}', () => {
    let nameCount = 0;
    let storeCount = 0;
    for (const ev of events) {
      for (const opt of ev.options ?? []) {
        if (opt.story?.includes('{name}')) nameCount += 1;
        if (opt.story?.includes('{店名}')) storeCount += 1;
      }
    }
    expect(nameCount, '应恰好 23 个选项含 {name}').toBe(23);
    expect(storeCount, '应恰好 66 个选项含 {店名}').toBe(66);
  });
});
