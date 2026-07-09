// 全流程模拟测试：120 天可复现运行 + 危机分支 + 结局可触发性（v3 引擎）。
import { describe, it, expect } from 'vitest';
import { createRng } from '../src/core/rng';
import { createNewGame } from '../src/core/createNewGame';
import { runDailyLoop } from '../src/core/gameLoop';
import { evaluateEndings } from '../src/core/endingEngine';

describe('120 天可复现模拟', () => {
  it('固定种子下连续运行 120 天不抛错，且阶段正确推进', () => {
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

    let monthReports = 0;
    for (let i = 0; i < 120; i++) {
      const res = runDailyLoop(state, rng);
      state = res.state;
      if (res.monthReport) monthReports += 1;
    }

    expect(state.day).toBe(121); // 120 次推进 → day 121
    expect(state.month).toBe(5); // floor((121-1)/30)+1 = 5
    // 偶发暗线罚款会追加日志条目，故日志数 ≥ 120（不强制恰好 120）
    expect(state.businessLog.length).toBeGreaterThanOrEqual(120);
    expect(monthReports).toBeGreaterThanOrEqual(3); // 第 30/60/90 天月结
  });

  it('运营中现金变负会进入现金流危机分支（F001）且不抛错', () => {
    const rng = createRng(999);
    // 统一 10 万起手下开业现金不为负；此处模拟运营中现金流断裂
    let state = createNewGame(
      {
        storeType: '奶茶饮品',
        locationType: '学校门口',
        decorationLevel: 'clean',
        storeName: '危机店',
        seed: 999,
      },
      rng,
    );
    state.cash = -20000;

    for (let i = 0; i < 30; i++) {
      const res = runDailyLoop(state, rng);
      state = res.state;
    }

    expect(state.day).toBe(31);
    // 至少出现过一次现金流危机（F001）
    const crisis = state.eventHistory.find((e) => e.eventId === 'F001');
    expect(crisis).toBeDefined();
  });
});

describe('结局可触发性（v3 单判定表）', () => {
  it('全新存档不触发任何结局', () => {
    const rng = createRng(5);
    const state = createNewGame(
      {
        storeType: '奶茶饮品',
        locationType: '学校门口',
        decorationLevel: 'clean',
        storeName: '新店',
        seed: 5,
      },
      rng,
    );
    expect(evaluateEndings(state)).toBeNull();
  });

  it('现金连续为负 5 天触发「暂停营业」失败结局', () => {
    const rng = createRng(5);
    const state = createNewGame(
      {
        storeType: '奶茶饮品',
        locationType: '学校门口',
        decorationLevel: 'clean',
        storeName: '新店',
        seed: 5,
      },
      rng,
    );
    state.cashNegativeStreak = 5;
    const ending = evaluateEndings(state);
    expect(ending).not.toBeNull();
    expect(ending?.def.id).toBe('suspended');
  });

  it('峰值净资≥1200万触发「财富自由」隐藏结局', () => {
    const rng = createRng(5);
    const state = createNewGame(
      {
        storeType: '奶茶饮品',
        locationType: '学校门口',
        decorationLevel: 'clean',
        storeName: '新店',
        seed: 5,
      },
      rng,
    );
    state.peakNetWorth = 12_000_000;
    const ending = evaluateEndings(state);
    expect(ending).not.toBeNull();
    expect(ending?.def.id).toBe('financial_freedom');
  });
});
