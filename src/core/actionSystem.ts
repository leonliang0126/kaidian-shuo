// 行动点结算系统（架构 V3-1）：校验 AP/冷却/危机态 → 扣 AP + 扣现金 →
// 翻译行动符号（visible/hidden/eventWeight）→ 应用经营重点修正 → 写风力向/冷却/事件权重。
// 纯函数，无 React。所有随机走注入的 rng。
import type { GameState } from '../types';
import type { RNG } from './rng';
import type { ActionDef, ActionEffects, ActionLog } from '../types/actions';
import { getAction } from '../data/actionDefs';
import {
  emptyActionEffects,
  resolveToken,
  VISIBLE_KEY_TO_MOD,
  HIDDEN_LETTER_TO_KEY,
} from '../data/actionScale';
import { applyFocusToAction } from './focusSystem';
import { cloneState, applyEffects } from './effectResolver';
import { addEffectModifiers } from './modifiers';
import { clamp } from '../utils/constants';
import { ACTION_POINTS_BASE, BOSS_STRAIN_AP_PENALTY } from '../data/setupCosts';
import type { EffectObject } from '../types/events';
import { getCrisisActionEffect } from '../data/crisisActionDefs';

/** 把一个 ActionDef 翻译为可结算的 ActionEffects（含经营重点修正）。 */
function translateAction(action: ActionDef, focusId: string | null, rng: RNG): ActionEffects {
  const eff = emptyActionEffects();

  // 1) 明线：visibleEffects（符号令牌）→ DayModifiers 累加字段
  for (const [key, token] of Object.entries(action.visibleEffects)) {
    const modKey = VISIBLE_KEY_TO_MOD[key];
    if (!modKey) continue; // null 键（cash / exposureGrowth 等）跳过或另处理
    (eff.mods as unknown as Record<string, number>)[modKey] += resolveToken(token, rng);
  }

  // 2) 暗线 / 软暗线 / 信用：hiddenEffects（字母代号 → 落点）
  for (const [letter, val] of Object.entries(action.hiddenEffects)) {
    const map = HIDDEN_LETTER_TO_KEY[letter];
    if (!map) continue;
    const amount = typeof val === 'number' ? val : resolveToken(val, rng);
    if (map.kind === 'hidden') {
      const k = map.key as keyof typeof eff.hidden;
      eff.hidden[k] = (eff.hidden[k] ?? 0) + amount;
    } else if (map.kind === 'soft') {
      const k = map.key as keyof typeof eff.soft;
      eff.soft[k] = (eff.soft[k] ?? 0) + amount;
    } else {
      eff.credit += amount;
    }
  }

  // 3) 事件权重：eventWeightEffects → 未来事件偏置累加器
  for (const [k, v] of Object.entries(action.eventWeightEffects)) {
    const delta = typeof v === 'number' ? v : resolveToken(v, rng);
    eff.eventWeights[k] = (eff.eventWeights[k] ?? 0) + delta;
  }

  // 4) 风向文案
  eff.windMessages = [...action.windMessages];

  // 5) 经营重点修正（数据驱动倍率 + 副作用）
  return applyFocusToAction(eff, focusId, action.category);
}

/** 校验某行动当前是否可执行。 */
export function canTakeAction(
  state: GameState,
  actionId: string,
): { ok: boolean; reason?: string } {
  const action = getAction(actionId);
  if (!action) return { ok: false, reason: '未知行动' };
  const inCrisis = state.cash < 0;
  if (inCrisis && !action.crisisAvailable) {
    return { ok: false, reason: '危机态不可用' };
  }
  if (state.actionPointsCurrent < action.costAP) {
    return { ok: false, reason: '行动点不足' };
  }
  const cd = state.actionCooldowns[actionId];
  if (cd !== undefined && cd > state.day) {
    return { ok: false, reason: '冷却中' };
  }
  if (action.costCash.max > 0 && state.cash < action.costCash.min) {
    return { ok: false, reason: '现金不足' };
  }
  return { ok: true };
}

/** 执行一个普通行动（扣 AP + 扣现金 + 写效果）。返回新状态与日志。 */
export function takeAction(
  state: GameState,
  actionId: string,
  rng: RNG,
): { state: GameState; log: ActionLog } {
  const action = getAction(actionId);
  const check = canTakeAction(state, actionId);
  if (!action || !check.ok) {
    return {
      state: cloneState(state),
      log: {
        day: state.day,
        actionId,
        name: action?.name ?? actionId,
        cashDelta: 0,
        visibleSummary: check.reason ?? '不可执行',
      },
    };
  }

  const eff = translateAction(action, state.selectedDailyFocus, rng);

  // 现金成本：区间内 rng 取整，受经营重点倍率影响
  const span = Math.max(0, action.costCash.max - action.costCash.min);
  const baseCost = Math.round(rng() * span) + action.costCash.min;
  const cost = Math.round(baseCost * eff.costMultiplier);

  let s = cloneState(state);
  s.cash -= cost;
  s.actionPointsCurrent = Math.max(0, s.actionPointsCurrent - action.costAP);

  // 明线并入当日修正
  s.dayModifiers = addEffectModifiers(s.dayModifiers, eff.mods as unknown as EffectObject);

  // 暗线 / 软暗线 / 信用（即时持久，accumulateMods:false）
  s = applyEffects(
    s,
    { hidden: eff.hidden, soft: eff.soft, credit: eff.credit } as EffectObject,
    rng,
    { accumulateMods: false },
  );

  // 事件权重累加
  s.eventWeightMods = { ...(s.eventWeightMods ?? {}) };
  for (const [k, v] of Object.entries(eff.eventWeights)) {
    s.eventWeightMods[k] = (s.eventWeightMods[k] ?? 0) + v;
  }

  // 风向
  if (eff.windMessages.length) {
    s.windMessages = [
      ...s.windMessages,
      { day: s.day, level: 'watch' as const, lines: eff.windMessages },
    ].slice(-30);
  }

  // 冷却 + 今日行动记录
  s.actionCooldowns = { ...(s.actionCooldowns ?? {}) };
  if (action.cooldownDays > 0) {
    s.actionCooldowns[actionId] = s.day + action.cooldownDays;
  }
  s.selectedActionsToday = [...s.selectedActionsToday, actionId];

  // bossStrain 别名同步（= softHidden.ownerFatigue）
  s.bossStrain = s.softHidden.ownerFatigue;

  const log: ActionLog = {
    day: s.day,
    actionId,
    name: action.name,
    cashDelta: -cost,
    visibleSummary: `${action.name}：${action.tradeoff}`,
  };
  return { state: s, log };
}

/** 执行一个非贷款危机行动（delay_rent / layoff / close_shop 等）。 */
export function takeCrisisAction(
  state: GameState,
  crisisId: string,
  rng: RNG,
): { state: GameState; log: ActionLog } {
  const eff = getCrisisActionEffect(crisisId);
  let s = cloneState(state);
  if (!eff) {
    return {
      state: s,
      log: { day: s.day, actionId: crisisId, name: crisisId, cashDelta: 0, visibleSummary: '无效危机行动' },
    };
  }
  s = applyEffects(s, eff, rng, { accumulateMods: true, source: `crisis:${crisisId}` });
  s.bossStrain = s.softHidden.ownerFatigue;
  const log: ActionLog = {
    day: s.day,
    actionId: crisisId,
    name: crisisId,
    cashDelta: 0,
    visibleSummary: `危机应对：${crisisId}`,
  };
  return { state: s, log };
}

/** 新一天开始：重置行动点上限（老板透支高则 −1），清空今日行动，tick 冷却。 */
export function resetDailyActionState(state: GameState): GameState {
  const s = cloneState(state);
  const maxAp =
    s.softHidden.ownerFatigue > BOSS_STRAIN_AP_PENALTY ? ACTION_POINTS_BASE - 1 : ACTION_POINTS_BASE;
  s.actionPointsMax = maxAp;
  s.actionPointsCurrent = maxAp;
  s.selectedActionsToday = [];
  s.crisisLoanBlockedToday = false; // 新的一天解除"被拒禁用"标记
  const next: Record<string, number> = {};
  for (const [k, v] of Object.entries(s.actionCooldowns ?? {})) {
    if (v > s.day) next[k] = v;
  }
  s.actionCooldowns = next;
  s.bossStrain = s.softHidden.ownerFatigue;
  return s;
}

export { clamp };
