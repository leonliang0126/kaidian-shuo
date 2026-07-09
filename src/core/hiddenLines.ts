// 隐藏暗线更新与软暗线衰减（架构 §6.5）
import type { DayModifiers, GameState } from '../types';
import { cloneState } from './effectResolver';
import { clamp } from '../utils/constants';

/**
 * 更新隐藏暗线。防御性地把 mods.hidden/mods.soft 施加到状态（正常流程中隐藏/软暗线
 * 已由 applyEffects 一次性作用，mods 中为空，因此此处为 no-op 兜底），并做 [0,100] 夹紧。
 * @param mods 当日修正（通常不含 hidden/soft）
 */
export function updateHiddenLines(state: GameState, mods: DayModifiers): GameState {
  const s = cloneState(state);
  (Object.keys(mods.hidden) as (keyof typeof mods.hidden)[]).forEach((k) => {
    const v = mods.hidden[k] ?? 0;
    s.hiddenLines[k] = clamp(s.hiddenLines[k] + v, 0, 100);
  });
  (Object.keys(mods.soft) as (keyof typeof mods.soft)[]).forEach((k) => {
    const v = mods.soft[k] ?? 0;
    s.softHidden[k] = clamp(s.softHidden[k] + v, 0, 100);
  });
  return s;
}

/**
 * 软暗线每日小幅衰减（回到基线，避免无限累积）。
 * ownerFatigue/wasteRisk/qualityVariance/accountingErrorRisk/stability 逐日 -1；
 * landlordPatience 缓慢恢复 +1。
 */
export function decaySoftHidden(state: GameState): GameState {
  const s = cloneState(state);
  const decayKeys: (keyof typeof s.softHidden)[] = [
    'ownerFatigue',
    'wasteRisk',
    'qualityVariance',
    'accountingErrorRisk',
    'stability',
  ];
  decayKeys.forEach((k) => {
    s.softHidden[k] = clamp(s.softHidden[k] - 1, 0, 100);
  });
  s.softHidden.landlordPatience = clamp(s.softHidden.landlordPatience + 1, 0, 100);
  return s;
}
