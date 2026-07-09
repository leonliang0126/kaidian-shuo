// 每日循环编排（架构 §4）：新一天 → 强制/随机事件 → 结算 → 风向 →（月结）→ 推进。
// 该纯函数版本用于单元测试（自动选择首个选项）；与 store.endDay 对齐：
// 客群敏感 / 供应商品质 / 复购热度 / 事件冲击 / 贷款月息 均在此反映。
import type { EventDef, GameState, BusinessLogEntry } from '../types';
import type { RNG } from './rng';
import { cloneState, applyEffects, applyDuePendingEffects } from './effectResolver';
import { emptyModifiers, addEffectModifiers } from './modifiers';
import { settleAllStores } from './settlement';
import { computeNetWorth } from './branch';
import { updateHiddenLines, decaySoftHidden } from './hiddenLines';
import { generateWind } from './wind';
import { drawEvent, checkForcedEvents, dailyWeatherFluctuation } from './eventEngine';
import { applyHiddenLineDailyHits } from './hiddenPenalties';
import { runMonthSettlement } from './monthlyReport';
import { isMonthEnd, monthOfDay, clamp } from '../utils/constants';
import { resetDailyActionState } from './actionSystem';
import { applyEventShock } from './eventVisibleShock';
import { takeCrisisLoan } from './loanSystem';
import { AUTO_BAILOUT_MAX } from '../data/setupCosts';
import { applySegmentModulation } from './segmentProfiles';
import { rollBatchIfDue, batchQualityMods } from './supplierStability';
import { decayHeat, computeRepurchase } from './repurchaseHeat';

export interface DailyLoopResult {
  state: GameState;
  daily: GameState['lastSettlement'];
  todayEvent: EventDef | null;
  forced: EventDef | null;
  monthReport: ReturnType<typeof runMonthSettlement>['report'] | null;
}

/** 运行一天（不含 UI 暂停）。 */
export function runDailyLoop(prev: GameState, rng: RNG): DailyLoopResult {
  let state = cloneState(prev);

  // 1) 到期未来效果
  state = applyDuePendingEffects(state);

  // 2) 重置行动点（老板透支高则 −1）+ tick 冷却
  state = resetDailyActionState(state);

  // 3) 强制事件（现金流危机）→ 自动银行续命贷款（避免纯循环死锁；记录 F001）
  let forced: EventDef | null = null;
  const forcedEv = checkForcedEvents(state);
  if (forcedEv) {
    forced = forcedEv;
    state.eventHistory = [
      ...state.eventHistory,
      { day: state.day, eventId: forcedEv.id, optionId: 'auto_loan', title: forcedEv.title },
    ];
    // 自动兜底限次：仅前 AUTO_BAILOUT_MAX 次自动银行 4% 兜底并 +1；
    // 用尽后不再兜底（cash 保持负），由上层 store（beginDay/proceedAfterSettlement）弹危机面板。
    if (state.autoBailoutCount < AUTO_BAILOUT_MAX) {
      state = takeCrisisLoan(state, 'bank', rng);
      state.autoBailoutCount += 1;
    }
  }

  // 4) 普通随机事件（强制事件已处理则跳过）
  let todayEvent: EventDef | null = null;
  if (!forced) {
    todayEvent = drawEvent(state, rng);
    if (todayEvent) {
      const opt = todayEvent.options[0];
      state = applyEffects(state, opt.effects, rng, {
        accumulateMods: true,
        source: `${todayEvent.id}:${opt.id}`,
      });
      // 事件当天明线冲击（叠加层）
      state = applyEventShock(state, todayEvent);
      state.eventHistory = [
        ...state.eventHistory,
        {
          day: state.day,
          eventId: todayEvent.id,
          optionId: opt.id,
          title: todayEvent.title,
          visibleEffect: opt.visibleEffect,
        },
      ];
      if (todayEvent.level === 'large' || todayEvent.level === 'fate') {
        state.lastLargeEventDay = state.day;
      }
    }
  }

  // 5) 供应商批次到期重抽
  state = rollBatchIfDue(state, rng);

  // 6) 客群敏感 + 供应商品质 → 并入当日修正（结算前）
  const main = state.stores[0];
  if (main) {
    state.dayModifiers = addEffectModifiers(state.dayModifiers, applySegmentModulation(state, main));
    state.dayModifiers = addEffectModifiers(state.dayModifiers, batchQualityMods(main));
  }

  // 7) 复购率由 computeRepurchase 覆盖（取代基线）
  state.stores = state.stores.map((st) => ({
    ...st,
    repurchaseRate: computeRepurchase(st, state.hiddenLines),
  }));

  // 8) 天气波动叠加到 dayModifiers（结算前）
  state.dayModifiers = {
    ...state.dayModifiers,
    exposurePct: state.dayModifiers.exposurePct + dailyWeatherFluctuation(rng),
  };

  // 9) 结算全门店
  const settle = settleAllStores(state, rng);
  const mainDaily = {
    ...settle.mainDaily,
    eventId: todayEvent?.id ?? forced?.id ?? null,
  };
  state = {
    ...state,
    stores: settle.stores,
    cash: state.cash + settle.totalNetProfit,
    lastSettlement: mainDaily,
  };

  // 10) 员工每日逻辑（士气/离职/罢工等）
  // 由 gameStore.endDay 中的员工逻辑处理，此处仅保留老板顶班兜底
  const hasScheduledStaff = state.stores[0]?.employees?.some((e) => e.isScheduledToday);
  if (!hasScheduledStaff && state.stores[0]) {
    // 无人排班 → 老板被迫顶班
    state.softHidden = {
      ...state.softHidden,
      ownerFatigue: clamp(state.softHidden.ownerFatigue + 15, 0, 100),
    };
  }

  // 11) 偶发暗线重罚
  const hits = applyHiddenLineDailyHits(state, rng);
  state = hits.state;

  state.netWorth = computeNetWorth(state);
  state.brandRating = state.stores[0]?.rating ?? state.brandRating;

  // 12) 峰值净资 / 现金负连续 / 累计净利 / 暗线健康
  state.peakNetWorth = Math.max(state.peakNetWorth, state.netWorth);
  state.cashNegativeStreak = state.cash < 0 ? state.cashNegativeStreak + 1 : 0;
  state.cumulativeNetProfit += mainDaily.netProfit;
  const allHealthy = (Object.values(state.hiddenLines ?? {}) as number[]).every((v) => v <= 40);
  state.hiddenHealthyStreak = allHealthy ? state.hiddenHealthyStreak + 1 : 0;

  // 13) 隐藏暗线夹紧
  state = updateHiddenLines(state, state.dayModifiers);

  // 14) 品质波动导致评分抖动
  if (state.softHidden.qualityVariance > 50 && state.stores[0]) {
    const jitter = (rng() - 0.5) * 2 * (state.softHidden.qualityVariance / 100) * 4;
    state.stores[0].rating = clamp(state.stores[0].rating + jitter, 0, 100);
    state.brandRating = state.stores[0].rating;
  }

  // 15) 店里风向
  const wind = generateWind(state);
  state.windMessages = [...state.windMessages, wind].slice(-30);

  // 16) 经营日志
  const logEntries: BusinessLogEntry[] = [
    {
      day: state.day,
      eventId: mainDaily.eventId,
      eventTitle: todayEvent?.title,
      decisions: state.decisions,
      revenue: mainDaily.revenue,
      netProfit: mainDaily.netProfit,
      cashAfter: state.cash,
    },
  ];
  for (const log of hits.logs) {
    logEntries.push({
      day: log.day,
      eventId: null,
      note: log.note,
      decisions: state.decisions,
      revenue: 0,
      netProfit: log.cashDelta,
      cashAfter: state.cash,
    });
  }
  state.businessLog = [...state.businessLog, ...logEntries].slice(-200);

  // 17) 复购热度衰减
  state = decayHeat(state);

  // 18) 月结（含贷款月息）
  let monthReport: DailyLoopResult['monthReport'] = null;
  if (isMonthEnd(state.day)) {
    const res = runMonthSettlement(state, rng);
    state = res.state;
    monthReport = res.report;
  }

  // 19) 推进到新一天
  state.day += 1;
  state.month = monthOfDay(state.day);
  state.dayModifiers = emptyModifiers();
  state = decaySoftHidden(state);

  return { state, daily: mainDaily, todayEvent, forced, monthReport };
}
