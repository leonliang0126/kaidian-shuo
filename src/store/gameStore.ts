// Zustand 状态管理：持有 GameState + actions（UI 只调 action，action 调 core 纯函数）。
import { create } from 'zustand';
import type {
  GameState,
  EventDef,
  EventOption,
  DailyResult,
  MonthlyReport,
  DecisionState,
  BusinessLogEntry,
} from '../types';
import type { RNG } from '../core/rng';
import type { LoanChannel, EndingResult } from '../types/actions';
import { createRng } from '../core/rng';
import { cloneState, applyEffects, applyDuePendingEffects } from '../core/effectResolver';
import { emptyModifiers, addEffectModifiers } from '../core/modifiers';
import { settleAllStores } from '../core/settlement';
import { computeNetWorth } from '../core/branch';
import { updateHiddenLines, decaySoftHidden } from '../core/hiddenLines';
import { generateWind } from '../core/wind';
import { drawEvent, dailyWeatherFluctuation } from '../core/eventEngine';
import { applyHiddenLineDailyHits } from '../core/hiddenPenalties';
import { runMonthSettlement, applyMonthOption } from '../core/monthlyReport';
import { createNewGame, type OpeningConfig } from '../core/createNewGame';
import {
  saveGame,
  loadGameRespectingBuild,
  isTutorialSeen,
  setTutorialSeen,
  clearSave,
  clearTutorialSeen,
} from '../core/storage';
import { getDecisionEffects, getOption } from '../data/decisionOptions';
import { getCrisisActionMaxUses } from '../data/crisisActionDefs';
import { LOAN_STORIES, pickStory, fillStory } from '../data/loanStories';
import { fmtMoney, fmtSignedMoney } from '../utils/format';
import { stabilityToBaseQuality, BATCH_CYCLE } from '../data/supplierStability';
import { isMonthEnd, monthOfDay, clamp } from '../utils/constants';
import {
  canTakeAction,
  takeAction,
  takeCrisisAction as applyCrisisAction,
  resetDailyActionState,
} from '../core/actionSystem';
import { applyEventShock } from '../core/eventVisibleShock';
import { takeCrisisLoan as takeLoanCore, canTakeCrisisLoan, isBankPrivateLocked } from '../core/loanSystem';
import { applySegmentModulation } from '../core/segmentProfiles';
import { rollBatchIfDue, batchQualityMods } from '../core/supplierStability';
import { decayHeat, computeRepurchase } from '../core/repurchaseHeat';
import { evaluateEndings } from '../core/endingEngine';
import type { Candidate } from '../types/employee';
import {
  generateCandidates,
  generateEmployee,
  fireEmployee as fireEmployeeCore,
  setEmployeeSchedule,
  applyMoraleDecay,
  advanceWarningAndResign,
  checkResignOrStrike,
  tryExposeAttributes,
  resetWeeklyWorkDays,
  applyFullWeekWarning,
  getDayOfWeek,
  getWeekNumber,
  applyAllRest,
  applySalaryRaise,
  getMaxEmployees,
} from '../core/staffSystem';
import { REFRESH_CANDIDATES_AP_COST, ALL_REST_MORALE_BONUS } from '../data/staffConstants';

type Phase = 'tutorial' | 'opening' | 'playing';

interface GameStore {
  phase: Phase;
  game: GameState | null;
  // —— UI 弹窗/临时状态 ——
  eventModal: (EventDef & {
    /** 员工类事件关联的雇员 id（供 story 中 {name} 插值）；无关联则为 null。 */
    relatedEmployeeId?: string | null;
    /** 员工类事件关联的雇员姓名（供 story 中 {name} 插值）；无关联则为 null。 */
    relatedEmployeeName?: string | null;
  }) | null;
  resolvedEvent: {
    event: EventDef;
    option: EventOption;
    /** 员工类事件关联的雇员 id（供 story 中 {name} 插值）；无关联则为 null。 */
    relatedEmployeeId?: string | null;
    /** 员工类事件关联的雇员姓名（供 story 中 {name} 插值）；无关联则为 null。 */
    relatedEmployeeName?: string | null;
  } | null;
  crisisOpen: boolean;
  /** 顶部/底部短暂提示（借款/危机行动结果），约 2.5s 自动消失后由 Toast 组件调用 clearToast 清除。 */
  toast: { type: 'success' | 'fail' | 'info'; msg: string } | null;
  /** 叙事卡片（借款/危机应对的逐字故事），点击遮罩关闭；与 toast 并存不冲突。 */
  story: { text: string; tone: 'success' | 'fail' | 'info' } | null;
  settlementModal: DailyResult | null;
  monthModal: MonthlyReport | null;
  lastEnding: EndingResult | null;
  // —— 员工系统 UI 状态 ——
  candidates: Candidate[];
  staffPageOpen: boolean;
  hirePageOpen: boolean;

  // —— actions ——
  init: () => void;
  dismissTutorial: (neverShow: boolean) => void;
  reopenTutorial: () => void;
  startGame: (cfg: OpeningConfig) => void;
  chooseEventOption: (optionId: string) => void;
  setDecision: (key: keyof DecisionState, value: DecisionState[keyof DecisionState]) => void;
  chooseAction: (actionId: string) => void;
  chooseFocus: (focusId: string | null) => void;
  takeCrisisLoan: (kind: LoanChannel) => void;
  takeCrisisAction: (crisisId: string) => void;
  clearToast: () => void;
  dismissStory: () => void;
  endDay: () => void;
  closeSettlement: () => void;
  chooseMonthOption: (optionId: string) => void;
  resetGame: () => void;
  // —— 员工系统 actions ——
  openStaffPage: () => void;
  closeStaffPage: () => void;
  openHirePage: () => void;
  closeHirePage: () => void;
  refreshCandidates: () => void;
  hireEmployee: (candidateId: string) => void;
  setSchedule: (employeeId: string, scheduled: boolean) => void;
  fireEmployee: (employeeId: string) => void;
  adjustSalary: (employeeId: string, amount: number) => void;
  allRestDay: () => void;
  dismissStaffNotifications: () => void;
}

// 模块级 RNG（可被开局 seed 重置）
let rng: RNG = createRng();

function commit(state: GameState, extra: Partial<GameStore> = {}): Partial<GameStore> {
  saveGame(state);
  return { game: state, ...extra };
}

/** 取主店第一名员工作为员工类事件的关联对象（供 story 中 {name} 插值）。 */
function staffRelated(state: GameState): {
  relatedEmployeeId?: string | null;
  relatedEmployeeName?: string | null;
} {
  const staff = state.stores[0]?.employees ?? [];
  if (staff.length === 0) return { relatedEmployeeId: null, relatedEmployeeName: null };
  return { relatedEmployeeId: staff[0].id, relatedEmployeeName: staff[0].name };
}

/** 开启新的一天（不推进 day）：重置行动点/冷却、检查危机、抽事件。 */
function beginDay(state: GameState): Partial<GameStore> {
  let s = cloneState(state);
  s = applyDuePendingEffects(s);
  // 重置行动点上限（老板透支高则 −1）并 tick 冷却
  s = resetDailyActionState(s);
  s.dayModifiers = emptyModifiers();

  // 现金流危机（cash<0）：取消自动兜底，直接弹完整危机面板让玩家自己选
  if (s.cash < 0) {
    return commit(s, { crisisOpen: true, eventModal: null, resolvedEvent: null });
  }

  // 抽普通事件
  const ev = drawEvent(s, rng);
  if (ev) {
    if (ev.level === 'small' && ev.options.length === 1 && ev.options[0].id === 'auto') {
      // 小事件自动发生（含当天明线冲击）
      const opt = ev.options[0];
      s = applyEffects(s, opt.effects, rng, { accumulateMods: true, source: `${ev.id}:auto` });
      s = applyEventShock(s, ev);
      s.eventHistory = [
        ...s.eventHistory,
        { day: s.day, eventId: ev.id, optionId: opt.id, title: ev.title, visibleEffect: opt.visibleEffect, story: opt.story },
      ];
      return commit(s, { resolvedEvent: { event: ev, option: opt }, eventModal: null, crisisOpen: false });
    }
    // 中/大事件需玩家选择
    const modalEv =
      ev.category === 'staff'
        ? { ...ev, ...staffRelated(s) }
        : ev;
    return commit(s, { eventModal: modalEv, resolvedEvent: null, crisisOpen: false });
  }

  return commit(s, { eventModal: null, resolvedEvent: null, crisisOpen: false });
}

/** 结算后推进阶段：结局 > 危机 > 月结 > 进入下一天。 */
function proceedAfterSettlement(state: GameState): Partial<GameStore> {
  // 1) 结局（单判定表，终端展示）
  const ending = evaluateEndings(state);
  if (ending) {
    const s = cloneState(state);
    if (!s.endingsUnlocked.includes(ending.def.id)) s.endingsUnlocked.push(ending.def.id);
    s.gameOver = true;
    return commit(s, { lastEnding: ending, crisisOpen: false });
  }
  // 2) 现金流危机（cash<0）：取消自动兜底，直接弹完整危机面板让玩家自己选
  if (state.cash < 0) {
    return commit(state, { crisisOpen: true });
  }
  // 3) 月结
  if (isMonthEnd(state.day)) {
    const { state: ms, report } = runMonthSettlement(state, rng);
    return commit(ms, { monthModal: report });
  }
  // 4) 进入下一天
  return advanceDayState(state);
}

/** 推进到新一天（day+1 后 beginDay）。 */
function advanceDayState(state: GameState): Partial<GameStore> {
  let s = cloneState(state);
  s.day += 1;
  s.currentWeek = getWeekNumber(s.day);
  s.month = monthOfDay(s.day);
  s = decaySoftHidden(s);
  return beginDay(s);
}

// 危机应对行动结果 toast 文案（按行动 id 给一句简短提示）
const CRISIS_ACTION_LABEL: Record<string, string> = {
  sell_equipment: '变卖设备',
  clearance_sale: '清仓促销',
  delay_rent: '拖欠房租',
  delay_supplier_payment: '拖欠供应商',
  layoff: '裁员',
};

/** 根据危机行动 id 与现金变动，拼出一句结果 toast（close_shop 走结局不弹）。 */
function crisisActionToast(
  id: string,
  cashDelta: number,
): { type: 'success' | 'fail' | 'info'; msg: string } | null {
  if (id === 'close_shop') return null; // 收店走结局屏，不弹 toast
  if (id === 'temporary_price_increase') {
    return { type: 'info', msg: '临时提价生效（转化 −4%）' };
  }
  const label = CRISIS_ACTION_LABEL[id] ?? '危机应对';
  return { type: cashDelta > 0 ? 'success' : 'info', msg: `${label} ${fmtSignedMoney(cashDelta)}` };
}

export const useGameStore = create<GameStore>((set, get) => ({
  phase: 'tutorial',
  game: null,
  eventModal: null,
  resolvedEvent: null,
  crisisOpen: false,
  toast: null,
  story: null,
  settlementModal: null,
  monthModal: null,
  lastEnding: null,
  candidates: [],
  staffPageOpen: false,
  hirePageOpen: false,

  init: () => {
    const save = loadGameRespectingBuild();
    if (save) {
      rng = createRng(save.seed);
      set({ game: save, phase: 'playing' });
      set(beginDay(save));
      return;
    }
    if (!isTutorialSeen()) {
      set({ phase: 'tutorial', game: null });
    } else {
      set({ phase: 'opening', game: null });
    }
  },

  dismissTutorial: (neverShow) => {
    if (neverShow) setTutorialSeen(true);
    const save = loadGameRespectingBuild();
    if (save) {
      rng = createRng(save.seed);
      set({ game: save, phase: 'playing' });
      set(beginDay(save));
    } else {
      set({ phase: 'opening', game: null });
    }
  },

  reopenTutorial: () => {
    set({ phase: 'tutorial' });
  },

  startGame: (cfg) => {
    rng = createRng(cfg.seed);
    const state = createNewGame(cfg, rng);
    set({
      game: state,
      phase: 'playing',
      eventModal: null,
      resolvedEvent: null,
      crisisOpen: false,
      settlementModal: null,
      monthModal: null,
      lastEnding: null,
    });
    set(beginDay(state));
  },

  chooseEventOption: (optionId) => {
    const g = get().game;
    const ev = get().eventModal;
    if (!g || !ev) return;
    const opt = ev.options.find((o) => o.id === optionId) ?? ev.options[0];
    let s = applyEffects(g, opt.effects, rng, { accumulateMods: true, source: `${ev.id}:${opt.id}` });
    // 事件当天明线冲击（叠加层，玩家当天可见）
    s = applyEventShock(s, ev);
    s.eventHistory = [
      ...s.eventHistory,
      { day: s.day, eventId: ev.id, optionId: opt.id, title: ev.title, visibleEffect: opt.visibleEffect, story: opt.story },
    ];
    if (ev.level === 'large' || ev.level === 'fate') s.lastLargeEventDay = s.day;
    s.netWorth = computeNetWorth(s);
    s.brandRating = s.stores[0]?.rating ?? s.brandRating;
    // 员工类事件：附带一名关联员工，供 story 中 {name} 插值（无特定员工则回退「店员」）
    let relatedEmployeeId: string | null = null;
    let relatedEmployeeName: string | null = null;
    if (ev.category === 'staff') {
      const staff = s.stores[0]?.employees ?? [];
      if (staff.length > 0) {
        relatedEmployeeId = staff[0].id;
        relatedEmployeeName = staff[0].name;
      }
    }
    set(commit(s, { eventModal: null, resolvedEvent: { event: ev, option: opt, relatedEmployeeId, relatedEmployeeName } }));
  },

  setDecision: (key, value) => {
    const g = get().game;
    if (!g) return;
    // 装修为开局专属，运行期不可改（§4）
    if (key === 'decorationLevel') return;
    let s = cloneState(g);
    const decisions = { ...s.decisions, [key]: value } as DecisionState;
    s.decisions = decisions;
    // 同步所有门店的对应档位
    s.stores = s.stores.map((st) => {
      const next = { ...st, [key]: value } as typeof st;
      if (key === 'supplierTier') {
        const stability = getOption('supplierTier', value as string)?.stability ?? st.supplierStability;
        next.supplierStability = stability;
        next.currentBatchQuality = stabilityToBaseQuality(stability);
        next.batchRenewDay = s.day + BATCH_CYCLE;
      }
      return next;
    });
    // 应用该决策项的即时效果（hidden/soft/cash 等；Pct 由结算处理）
    const cat = key as 'supplierTier' | 'priceStrategy' | 'decorationLevel' | 'promotionTier';
    const eff = getDecisionEffects(cat, value as string);
    s = applyEffects(s, eff, rng, { accumulateMods: false });
    s.bossStrain = s.softHidden.ownerFatigue;
    set(commit(s));
  },

  chooseAction: (actionId) => {
    const g = get().game;
    if (!g) return;
    const res = takeAction(g, actionId, rng);
    set(commit(res.state));
  },

  chooseFocus: (focusId) => {
    const g = get().game;
    if (!g) return;
    const s = cloneState(g);
    s.selectedDailyFocus = focusId;
    set(commit(s));
  },

  takeCrisisLoan: (kind) => {
    const g = get().game;
    if (!g) return;
    // 锁死分支：银行/亲友借满 CRISIS_LOAN_BANK_CUTOFF 笔后点按钮直接弹"风控拒/彻底拒绝"故事，不借款
    if (kind === 'bank' && isBankPrivateLocked(g)) {
      set({ story: { text: pickStory(LOAN_STORIES.bank.reject), tone: 'info' }, crisisOpen: false });
      return;
    }
    if (kind === 'private' && isBankPrivateLocked(g)) {
      set({ story: { text: pickStory(LOAN_STORIES.private.reject2), tone: 'fail' }, crisisOpen: false });
      return;
    }
    // 玩家手动发起：强制 80% 净资上限校验（含 AP 校验；setup 一次性贷款/自动兜底不受此限）
    const check = canTakeCrisisLoan(g, kind);
    if (!check.ok) return; // 上限命中或 AP 耗尽：拒绝（UI 已禁用对应按钮，无故事/无 toast）

    const { state: ns, result } = takeLoanCore(g, kind, rng);
    ns.netWorth = computeNetWorth(ns);
    ns.bossStrain = ns.softHidden.ownerFatigue;

    // 通道文案标签
    const channelLabel = kind === 'bank' ? '银行' : kind === 'private' ? '亲友' : '周转';

    // —— 选故事 + toast 摘要 ——
    let storyText = '';
    let tone: 'success' | 'fail' | 'info' = 'info';
    let toastType: 'success' | 'fail' | 'info' = 'info';
    let summary = '';

    if (result.rejected) {
      // 亲友拒绝（成功次数决定档位故事）或 高利贷无油水拒
      if (kind === 'private') {
        const sc = result.successCount ?? g.friendLoanSuccessCount ?? 0;
        storyText =
          sc >= 2
            ? pickStory(LOAN_STORIES.private.reject2)
            : sc === 1
              ? pickStory(LOAN_STORIES.private.reject1)
              : pickStory(LOAN_STORIES.private.reject0);
        tone = 'fail';
      } else {
        // predatory 无油水拒
        storyText = pickStory(LOAN_STORIES.predatory.reject);
        tone = 'fail';
      }
      summary = `${channelLabel}拒绝借款`;
      toastType = 'fail';
      // Bug 1：被拒后当天禁用危机借款（次日 resetDailyActionState 重置），并关闭面板回游戏页
      ns.crisisLoanBlockedToday = true;
    } else {
      // 成功借款（动态金额插值：文案说的金额 = 实际到账金额）
      if (kind === 'bank') {
        storyText = fillStory(pickStory(LOAN_STORIES.bank.success), result.amount);
        tone = 'success';
        toastType = 'success';
      } else if (kind === 'private') {
        storyText = fillStory(pickStory(LOAN_STORIES.private.success), result.amount);
        tone = 'success';
        toastType = 'success';
      } else {
        storyText = fillStory(pickStory(LOAN_STORIES.predatory.success), result.amount);
        tone = 'fail'; // 高利贷提示风险
        toastType = 'fail';
      }
      summary = `${channelLabel}借款到账 +¥${fmtMoney(result.amount)}（周息 ${Math.round(result.apr * 100)}%）`;
    }

    // Bug 5：任意危机选项结算后一律关闭危机面板，由 StoryCard 在游戏页之上展示故事
    set(
      commit(ns, {
        crisisOpen: false,
        toast: { type: toastType, msg: summary },
        story: { text: storyText, tone },
      }),
    );
  },

  takeCrisisAction: (crisisId) => {
    const g = get().game;
    if (!g) return;
    // Bug 5：零员工时裁员不可用（不执行、不计数，仅提示并保留面板供改选）
    if (crisisId === 'layoff') {
      const noEmployees = (g.stores[0]?.employees?.length ?? 0) === 0;
      if (noEmployees) {
        set({
          toast: { type: 'info', msg: '店里已无员工可裁' },
          story: { text: '店里已无员工可裁，裁员无从谈起。', tone: 'info' },
        });
        return;
      }
    }
    // 防无限拖延：有限次数的应对行动用尽后直接拦截
    const maxUses = getCrisisActionMaxUses(crisisId);
    if (maxUses !== Infinity && (g.crisisActionUsed?.[crisisId] ?? 0) >= maxUses) {
      return; // 已用尽，不再执行
    }
    const res = applyCrisisAction(g, crisisId, rng);
    let s = res.state;
    // 更新使用计数（id → 次数）
    s.crisisActionUsed = {
      ...(s.crisisActionUsed ?? {}),
      [crisisId]: (s.crisisActionUsed?.[crisisId] ?? 0) + 1,
    };
    s.netWorth = computeNetWorth(s);
    s.bossStrain = s.softHidden.ownerFatigue;
    if (crisisId === 'close_shop') {
      // 主动关店 → 进入结局判定（不结束存档，走结局屏，不弹故事）
      set(commit(s, { crisisOpen: false }));
      set(proceedAfterSettlement(s));
      return;
    }
    // 拼装结果 toast（按行动效果给一句提示）
    const cashDelta = s.cash - g.cash;
    const toast = crisisActionToast(crisisId, cashDelta);
    // 危机应对行动故事（close_shop 走结局不弹；其余在 LOAN_STORIES.action 表内的弹叙事卡片）
    const actionStory = (LOAN_STORIES.action as Record<string, readonly string[]>)[crisisId];
    const story =
      actionStory && actionStory.length > 0
        ? { text: pickStory(actionStory), tone: 'info' as const }
        : null;
    // Bug 5：一律关闭危机面板，由 StoryCard 在游戏页之上展示故事
    set(commit(s, { crisisOpen: false, toast, story }));
  },

  clearToast: () => {
    set({ toast: null });
  },

  dismissStory: () => {
    set({ story: null });
  },

  endDay: () => {
    const g = get().game;
    if (!g) return;
    let s = cloneState(g);

    // 1) 供应商批次到期重抽
    s = rollBatchIfDue(s, rng);

    // 2) 客群敏感 + 供应商品质 → 并入当日修正（结算前）
    const main = s.stores[0];
    if (main) {
      const seg = applySegmentModulation(s, main);
      s.dayModifiers = addEffectModifiers(s.dayModifiers, seg);
      const sup = batchQualityMods(main);
      s.dayModifiers = addEffectModifiers(s.dayModifiers, sup);
    }

    // 3) 复购率由 computeRepurchase 覆盖（取代 store.repurchaseRate 基线）
    s.stores = s.stores.map((st) => ({
      ...st,
      repurchaseRate: computeRepurchase(st, s.hiddenLines),
    }));

    // 4) 天气波动叠加到 dayModifiers（结算前）
    s.dayModifiers = {
      ...s.dayModifiers,
      exposurePct: s.dayModifiers.exposurePct + dailyWeatherFluctuation(rng),
    };

    // 4b) 老板顶班兜底：主店无人排班 → 老板被迫顶班。须在结算前置位，承载加成才当日生效。
    {
      const coverStore = s.stores[0];
      const hasScheduled = coverStore?.employees?.some((e) => e.isScheduledToday);
      if (!hasScheduled && coverStore) {
        s.ownerCoverToday = true;
        s.softHidden = {
          ...s.softHidden,
          ownerFatigue: clamp(s.softHidden.ownerFatigue + 15, 0, 100),
        };
      }
    }

    // 5) 结算全门店
    const settle = settleAllStores(s, rng);
    const mainDaily: DailyResult = {
      ...settle.mainDaily,
      eventId:
        get().resolvedEvent?.event.id ??
        get().eventModal?.id ??
        null,
    };
    s = {
      ...s,
      stores: settle.stores,
      cash: s.cash + settle.totalNetProfit,
      lastSettlement: mainDaily,
    };

    // 6) 员工每日逻辑：士气衰减、属性暴露、离职/罢工检测
    const staffEvents: string[] = [];
    s.stores = s.stores.map((store) => {
      let employees = store.employees;

      // 自动排班：今日已排班的员工 daysWorkedThisWeek +1
      employees = employees.map((e) => {
        if (e.isScheduledToday) {
          return { ...e, daysWorkedThisWeek: e.daysWorkedThisWeek + 1 };
        }
        return e;
      });

      // 士气衰减/恢复
      const moraleResult = applyMoraleDecay(employees, s.day);
      employees = moraleResult.employees;
      for (const ev of moraleResult.events) {
        staffEvents.push(ev.description);
      }

      // 属性暴露检查
      employees = employees.map((e) => {
        const result = tryExposeAttributes(e, s.day);
        if (result.exposed) {
          staffEvents.push(`${e.name} 的属性已揭示！`);
        }
        return result.employee;
      });

      // 离职过渡状态机：warning 员工连续出勤满 WARN_GRACE_DAYS 且士气仍低 → 必然离职
      const warnResult = advanceWarningAndResign(employees);
      employees = warnResult.employees;
      for (const r of warnResult.resigning) {
        staffEvents.push(`${r.name} 撑了又撑，最后还是递了辞呈。`);
      }

      // 属性暴露检查
      employees = employees.map((e) => {
        const result = tryExposeAttributes(e, s.day);
        if (result.exposed) {
          staffEvents.push(`${e.name} 的属性已揭示！`);
        }
        return result.employee;
      });

      // 罢工检测（仅刺头；离职已由上一步 warning 状态机接管，不再即时离职）
      const strikeResult = checkResignOrStrike(employees, store);
      if (strikeResult.type === 'strike') {
        // 罢工：所有员工取消今日排班
        employees = employees.map((e) => ({ ...e, isScheduledToday: false }));
        staffEvents.push(strikeResult.description);
      }

      // 周重置：周日结束后重置，为新周一准备
      if (getDayOfWeek(s.day) === 7) {
        employees = resetWeeklyWorkDays(employees);
        // 连续满勤周计数更新后，检测濒临离职 warning（基于 consecutiveFullWeeks）
        const fw = applyFullWeekWarning(employees);
        employees = fw.employees;
        for (const ev of fw.events) staffEvents.push(ev);
      }

      return { ...store, employees };
    });

    // 6b) 老板顶班模式兜底已在步骤 4b（结算前）处理（无人排班 → 置 ownerCoverToday + 老板透支+15）。

    // 如果有员工事件，保存到通知（供 StaffPage 展示）
    s.staffNotifications = staffEvents;

    // 同步当前周数
    s.currentWeek = getWeekNumber(s.day);

    // 7) 偶发暗线重罚（现金 + 评级 + 日志）
    const hits = applyHiddenLineDailyHits(s, rng);
    s = hits.state;

    s.netWorth = computeNetWorth(s);
    s.brandRating = s.stores[0]?.rating ?? s.brandRating;

    // 8) 峰值净资 / 现金负连续 / 累计净利 / 暗线健康
    s.peakNetWorth = Math.max(s.peakNetWorth, s.netWorth);
    s.cashNegativeStreak = s.cash < 0 ? s.cashNegativeStreak + 1 : 0;
    s.cumulativeNetProfit += mainDaily.netProfit;
    const allHealthy = (Object.values(s.hiddenLines ?? {}) as number[]).every(
      (v) => v <= 40,
    );
    s.hiddenHealthyStreak = allHealthy ? s.hiddenHealthyStreak + 1 : 0;

    // 9) 隐藏暗线夹紧
    s = updateHiddenLines(s, s.dayModifiers);

    // 10) 品质波动导致评分抖动
    if (s.softHidden.qualityVariance > 50 && s.stores[0]) {
      const jitter = (rng() - 0.5) * 2 * (s.softHidden.qualityVariance / 100) * 4;
      s.stores[0].rating = clamp(s.stores[0].rating + jitter, 0, 100);
      s.brandRating = s.stores[0].rating;
    }

    // 11) 店里风向
    const wind = generateWind(s);
    s.windMessages = [...s.windMessages, wind].slice(-30);

    // 12) 经营日志
    const logEntries: BusinessLogEntry[] = [
      {
        day: s.day,
        eventId: mainDaily.eventId,
        eventTitle: get().resolvedEvent?.event.title,
        decisions: s.decisions,
        revenue: mainDaily.revenue,
        netProfit: mainDaily.netProfit,
        cashAfter: s.cash,
      },
    ];
    for (const log of hits.logs) {
      logEntries.push({
        day: log.day,
        eventId: null,
        note: log.note,
        decisions: s.decisions,
        revenue: 0,
        netProfit: log.cashDelta,
        cashAfter: s.cash,
      });
    }
    s.businessLog = [...s.businessLog, ...logEntries].slice(-200);

    // 13) 复购热度衰减（每日 ~8）
    s = decayHeat(s);

    s.bossStrain = s.softHidden.ownerFatigue;

    set(commit(s, { settlementModal: mainDaily, eventModal: null, resolvedEvent: null }));
  },

  closeSettlement: () => {
    const g = get().game;
    if (!g) return;
    set({ settlementModal: null });
    set(proceedAfterSettlement(g));
  },

  chooseMonthOption: (optionId) => {
    const g = get().game;
    if (!g) return;
    let s = applyMonthOption(g, optionId, rng);
    set({ monthModal: null });
    set(advanceDayState(s));
  },

  resetGame: () => {
    clearSave();
    set({
      game: null,
      phase: 'opening',
      eventModal: null,
      resolvedEvent: null,
      crisisOpen: false,
      settlementModal: null,
      monthModal: null,
      lastEnding: null,
      toast: null,
      story: null,
      candidates: [],
      staffPageOpen: false,
      hirePageOpen: false,
    });
  },

  // ====== 员工系统 actions ======

  openStaffPage: () => {
    set({ staffPageOpen: true, hirePageOpen: false });
  },

  closeStaffPage: () => {
    set({ staffPageOpen: false });
  },

  openHirePage: () => {
    const g = get().game;
    if (!g) return;
    // 首次打开免费生成候选人
    const store = g.stores[0];
    if (store) {
      const candidates = generateCandidates(rng, g.day, store.decorationLevel);
      set({ hirePageOpen: true, staffPageOpen: false, candidates });
    }
  },

  closeHirePage: () => {
    set({ hirePageOpen: false, candidates: [] });
  },

  refreshCandidates: () => {
    const g = get().game;
    if (!g) return;
    let s = cloneState(g);
    // 消耗 AP
    if (s.actionPointsCurrent < REFRESH_CANDIDATES_AP_COST) return;
    s.actionPointsCurrent -= REFRESH_CANDIDATES_AP_COST;
    s.bossStrain = s.softHidden.ownerFatigue;
    const store = s.stores[0];
    if (store) {
      const candidates = generateCandidates(rng, s.day, store.decorationLevel);
      set(commit(s, { candidates }));
    }
  },

  hireEmployee: (candidateId) => {
    const g = get().game;
    const allCandidates = get().candidates;
    if (!g || allCandidates.length === 0) return;
    const candidate = allCandidates.find((c) => c.id === candidateId);
    if (!candidate) return;

    let s = cloneState(g);
    // 检查行动点
    if (s.actionPointsCurrent < 1) return;
    s.actionPointsCurrent -= 1;

    // 检查员工上限
    const store = s.stores[0];
    if (!store) return;
    const maxEmp = getMaxEmployees(store.decorationLevel);
    if (store.employees.length >= maxEmp) return; // 已达上限

    // 生成员工并加入
    const emp = generateEmployee(candidate, s.day, false, rng);
    const newStore = { ...store, employees: [...store.employees, emp] };
    const newStores = [...s.stores];
    newStores[0] = newStore;
    s.stores = newStores;
    s.bossStrain = s.softHidden.ownerFatigue;

    // 从候选人列表中移除已聘用的
    const remaining = allCandidates.filter((c) => c.id !== candidateId);
    set(commit(s, { candidates: remaining }));
  },

  setSchedule: (employeeId, scheduled) => {
    const g = get().game;
    if (!g) return;
    const s = cloneState(g);
    const store = s.stores[0];
    if (!store) return;

    const empIndex = store.employees.findIndex((e) => e.id === employeeId);
    if (empIndex < 0) return;

    const result = setEmployeeSchedule(store.employees[empIndex], scheduled, s.day);
    const newEmployees = [...store.employees];
    newEmployees[empIndex] = result.employee;
    const newStore = { ...store, employees: newEmployees };
    const newStores = [...s.stores];
    newStores[0] = newStore;
    s.stores = newStores;
    set(commit(s));
  },

  fireEmployee: (employeeId) => {
    const g = get().game;
    if (!g) return;
    const result = fireEmployeeCore(employeeId, g);
    set(commit(result.state));
  },

  adjustSalary: (employeeId, amount) => {
    const g = get().game;
    if (!g) return;
    let s = cloneState(g);
    const store = s.stores[0];
    if (!store) return;

    const empIndex = store.employees.findIndex((e) => e.id === employeeId);
    if (empIndex < 0) return;

    const emp = applySalaryRaise(store.employees[empIndex], amount);
    const newEmployees = [...store.employees];
    newEmployees[empIndex] = emp;
    const newStore = { ...store, employees: newEmployees };
    const newStores = [...s.stores];
    newStores[0] = newStore;
    s.stores = newStores;
    s.cash -= amount;
    set(commit(s));
  },

  allRestDay: () => {
    const g = get().game;
    if (!g) return;
    let s = cloneState(g);
    const store = s.stores[0];
    if (!store) return;

    const newEmployees = applyAllRest(store.employees, ALL_REST_MORALE_BONUS);
    const newStore = { ...store, employees: newEmployees };
    const newStores = [...s.stores];
    newStores[0] = newStore;
    s.stores = newStores;
    set(commit(s));
  },

  dismissStaffNotifications: () => {
    const g = get().game;
    if (!g) return;
    const s = cloneState(g);
    s.staffNotifications = [];
    set(commit(s));
  },
}));

// 供测试/调试访问
export { clearTutorialSeen };
export { canTakeAction };
