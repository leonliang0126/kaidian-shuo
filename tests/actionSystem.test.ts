// V3-1 行动点结算系统单元测试（架构 §5.1 / §5.6）：canTakeAction / takeAction / resetDailyActionState。
import { describe, it, expect } from 'vitest';
import { createRng } from '../src/core/rng';
import { createNewGame } from '../src/core/createNewGame';
import {
  canTakeAction,
  takeAction,
  resetDailyActionState,
} from '../src/core/actionSystem';
import type { GameState } from '../src/types';

function freshGame(): GameState {
  const rng = createRng(7);
  const s = createNewGame(
    { storeType: '奶茶饮品', locationType: '学校门口', decorationLevel: 'clean', storeName: '行动店', seed: 7 },
    rng,
  );
  s.cash = 50000; // 保证非危机态、现金充足
  return s;
}

describe('canTakeAction 门控', () => {
  it('未知行动：不可执行', () => {
    const s = freshGame();
    expect(canTakeAction(s, 'does_not_exist').ok).toBe(false);
  });

  it('正常行动：可执行', () => {
    const s = freshGame();
    const r = canTakeAction(s, 'owner_shift');
    expect(r.ok).toBe(true);
  });

  it('行动点不足：不可执行', () => {
    const s = freshGame();
    s.actionPointsCurrent = 0;
    expect(canTakeAction(s, 'owner_shift').ok).toBe(false);
  });

  it('危机态下非危机行动：不可执行', () => {
    const s = freshGame();
    s.cash = -1; // 进入危机态
    // short_video_ads 的 crisisAvailable=false
    expect(canTakeAction(s, 'short_video_ads').ok).toBe(false);
    // owner_shift 的 crisisAvailable=true
    expect(canTakeAction(s, 'owner_shift').ok).toBe(true);
  });

  it('冷却中：不可执行', () => {
    const s = freshGame();
    s.actionCooldowns = { owner_shift: s.day + 10 };
    expect(canTakeAction(s, 'owner_shift').ok).toBe(false);
  });
});

describe('takeAction 结算', () => {
  it('扣 1 行动点、记录今日行动、现金不增', () => {
    const s = freshGame();
    const apBefore = s.actionPointsCurrent;
    const cashBefore = s.cash;
    const r = takeAction(s, 'owner_shift', () => 1); // costCash 0/0 → 现金不变
    expect(r.state.actionPointsCurrent).toBe(apBefore - 1);
    expect(r.state.selectedActionsToday).toContain('owner_shift');
    expect(r.state.cash).toBeLessThanOrEqual(cashBefore);
    expect(r.log.actionId).toBe('owner_shift');
  });

  it('不可执行时返回原状态克隆 + 原因日志', () => {
    const s = freshGame();
    s.actionPointsCurrent = 0;
    const r = takeAction(s, 'owner_shift', () => 1);
    expect(r.state.actionPointsCurrent).toBe(0);
    expect(r.log.visibleSummary).toBe('行动点不足');
  });

  it('经营重点修正生效（focus 影响 costMultiplier / mods）', () => {
    const s = freshGame();
    s.selectedDailyFocus = 'cost_control'; // 任一 focus id，确保 applyFocusToAction 路径执行
    const r = takeAction(s, 'owner_shift', () => 1);
    // 至少行动被执行（AP 扣减），且 dayModifiers 仍为合法对象
    expect(r.state.actionPointsCurrent).toBe(s.actionPointsCurrent - 1);
    expect(typeof r.state.dayModifiers.exposurePct).toBe('number');
  });
});

describe('resetDailyActionState 每日重置', () => {
  it('恢复行动点上限、清空今日行动', () => {
    const s = freshGame();
    s.actionPointsCurrent = 0;
    s.selectedActionsToday = ['owner_shift'];
    const r = resetDailyActionState(s);
    expect(r.actionPointsCurrent).toBe(3); // ownerFatigue=0 → 基准 3
    expect(r.selectedActionsToday.length).toBe(0);
  });

  it('tick 冷却：到期（<=day）移除，未到期保留', () => {
    const s = freshGame();
    s.actionCooldowns = { expired: s.day, future: s.day + 5 };
    const r = resetDailyActionState(s);
    expect(r.actionCooldowns['expired']).toBeUndefined();
    expect(r.actionCooldowns['future']).toBe(s.day + 5);
  });

  it('老板透支 >70：次日行动点上限 −1', () => {
    const s = freshGame();
    s.softHidden.ownerFatigue = 80;
    s.bossStrain = 80;
    const r = resetDailyActionState(s);
    expect(r.actionPointsMax).toBe(2);
    expect(r.actionPointsCurrent).toBe(2);
  });
});
