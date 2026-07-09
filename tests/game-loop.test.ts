// B.9 主循环：120 天可复现、day 单调、月结、危机分支、可序列化。
import { describe, it, expect } from 'vitest';
import { createRng } from '../src/core/rng';
import { createNewGame } from '../src/core/createNewGame';
import { runDailyLoop } from '../src/core/gameLoop';

describe('B.9 120 天可复现主循环', () => {
  it('固定种子连续 120 天无异常，day 单调递增，第30/60/90天月结', () => {
    const rng = createRng(12345);
    let state = createNewGame(
      {
        initialCashTier: 600000,
        storeType: '奶茶饮品',
        locationType: '学校门口',
        decorationLevel: 'clean',
        storeName: '模拟店',
        seed: 12345,
      },
      rng,
    );
    let prevDay = state.day;
    let monthReports = 0;
    for (let i = 0; i < 120; i++) {
      const res = runDailyLoop(state, rng);
      state = res.state;
      expect(state.day).toBeGreaterThan(prevDay); // 单调
      prevDay = state.day;
      if (res.monthReport) monthReports += 1;
    }
    expect(state.day).toBe(121);
    expect(monthReports).toBeGreaterThanOrEqual(3);
  });

  it('状态可序列化（JSON.stringify 不抛错）', () => {
    const rng = createRng(999);
    let state = createNewGame(
      {
        initialCashTier: 300000,
        storeType: '奶茶饮品',
        locationType: '学校门口',
        decorationLevel: 'clean',
        storeName: '序列化店',
        seed: 999,
      },
      rng,
    );
    for (let i = 0; i < 30; i++) state = runDailyLoop(state, rng).state;
    expect(() => JSON.stringify(state)).not.toThrow();
    expect(typeof JSON.stringify(state)).toBe('string');
  });

  it('运营中现金变负会触发 F001 且不崩溃（统一 10 万起手，开局不再为负）', () => {
    const rng = createRng(7);
    let state = createNewGame(
      {
        storeType: '奶茶饮品',
        locationType: '学校门口',
        decorationLevel: 'clean',
        storeName: '危机店',
        seed: 7,
      },
      rng,
    );
    // 统一起手下开业现金不会为负；此处模拟运营中出现现金流断裂
    state.cash = -10000;
    for (let i = 0; i < 30; i++) {
      state = runDailyLoop(state, rng).state;
    }
    expect(state.day).toBe(31);
    expect(state.eventHistory.some((e) => e.eventId === 'F001')).toBe(true);
  });
});
