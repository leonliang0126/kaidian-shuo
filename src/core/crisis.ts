// 现金流危机（F001/F002/F003 + 续命选项 + 失败结局）（架构 §6.2 / §10）
import type { GameState } from '../types';
import type { RNG } from './rng';
import { applyEffects, cloneState } from './effectResolver';
import { getEvent } from '../data/events';

/** 进入危机：标记主店 isInCrisis（危机弹窗由 UI 展示）。 */
export function enterCrisis(state: GameState, forcedId: string): GameState {
  const s = cloneState(state);
  const main = s.stores[0];
  if (main) {
    main.isInCrisis = true;
    main.crisisDays = main.crisisDays + 1;
  }
  void forcedId;
  return s;
}

/**
 * 处理危机选项（续命方案）。
 * 失败结局（如 close_shop → decent_exit）通过 option.effects.ending 触发，不强制结束存档。
 */
export function resolveCrisisOption(
  state: GameState,
  eventId: string,
  optionId: string,
  rng: RNG,
): GameState {
  const ev = getEvent(eventId);
  if (!ev) return state;
  const opt = ev.options.find((o) => o.id === optionId) ?? ev.options[0];
  let s = applyEffects(state, opt.effects, rng, {
    accumulateMods: true,
    source: `${eventId}:${optionId}`,
  });
  // 现金恢复为正则解除危机标记
  const main = s.stores[0];
  if (main && s.cash >= 0) {
    main.isInCrisis = false;
  }
  return s;
}
