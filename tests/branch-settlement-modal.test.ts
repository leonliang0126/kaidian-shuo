// 分店结算展示回归测试（卡住「开分店后每日结算弹窗/对外展示仍 = 主店单店」的 Bug）。
//
// 现象：开分店后，每日结算弹窗（"第 N 天 · 结算"）里的流水/毛利/人工/房租日摊/平台抽成/净利，
// 与没开分店时一模一样，完全没有变成两倍。
//
// 根因：底层 settleAllStores 已正确返回 aggregateDaily（全店汇总，字段均已翻倍），但两套每日结算
// 实现（store.endDay / gameLoop.runDailyLoop）把"主店单店 mainDaily"错当成了对外展示/累计的值。
//
// 本测试覆盖两条路径：
//   A. store.endDay → 读 settlementModal（用户点「结束今天」走的 UI 路径）
//   B. gameLoop.runDailyLoop → 读返回 daily（月结后推进 / chooseMonthOption 走的纯函数路径）
//
// 两条路径修复后，2 家门店的对外展示 DailyResult 各金额字段 ≈ 单店对应值 × 2；
// 修复前（settlementModal / daily 仍取 mainDaily 主店单店）则 = 单店，下面断言会失败。
import { describe, it, expect, beforeEach } from 'vitest';
import { createRng } from '../src/core/rng';
import { createNewGame } from '../src/core/createNewGame';
import { runDailyLoop } from '../src/core/gameLoop';
import { useGameStore } from '../src/store/gameStore';
import type { DailyResult, GameState } from '../src/types';

/** 起一局并排班所有员工，确保有正常收入。 */
function freshGame(seed = 42): GameState {
  const rng = createRng(seed);
  const state = createNewGame(
    {
      initialCashTier: 300000,
      storeType: '奶茶饮品',
      locationType: '学校门口',
      decorationLevel: 'clean',
      storeName: '测试店',
      seed,
    },
    rng,
  );
  if (state.stores[0]?.employees) {
    state.stores[0].employees = state.stores[0].employees.map((e) => ({
      ...e,
      isScheduledToday: true,
      weeklyWorkDays: [1],
      daysWorkedThisWeek: 1,
    }));
  }
  return state;
}

/** 深拷贝（GameState 可 JSON 序列化，故可 structuredClone），避免 1 店/2 店共享 employees 引用。 */
function deepClone(state: GameState): GameState {
  return structuredClone(state);
}

/** 在单店 state 基础上复制主店为第 n 家分店（rent/employees 一致），并深拷贝。 */
function withStores(base: GameState, count: number): GameState {
  const main = base.stores[0];
  const stores = [main];
  for (let i = 1; i < count; i++) {
    stores.push({ ...main, id: `store_${String(i + 1).padStart(3, '0')}`, name: `${main.name} 分店${i}` });
  }
  return deepClone({ ...base, stores, storeCount: count });
}

/**
 * 断言「对外展示」的聚合 DailyResult ≈ 单店的 count 倍。
 * - 求和型金额字段（流水/毛利/人工/推广/平台抽成/订单）：各店四舍五入后求和，相同门店 = 单店 × count，精确相等。
 * - 净利 / 房租日摊：聚合时含一次性的四舍五入（总部日摊只在单店取 0 的基础上再叠加），与「单店 × count」可能差 1~2，放宽容差。
 */
function expectAggregatedByCount(modal: DailyResult, single: DailyResult, count: number): void {
  expect(modal.revenue).toBe(single.revenue * count);
  expect(modal.grossProfit).toBe(single.grossProfit * count);
  expect(modal.staffCost).toBe(single.staffCost * count);
  expect(modal.promoCost).toBe(single.promoCost * count);
  expect(modal.platformCost).toBe(single.platformCost * count);
  expect(modal.orders).toBe(single.orders * count);
  expect(Math.abs(modal.netProfit - single.netProfit * count)).toBeLessThanOrEqual(3);
  expect(Math.abs(modal.fixedCostDaily - single.fixedCostDaily * count)).toBeLessThanOrEqual(2);
}

/**
 * 驱动 store.endDay 并读回 settlementModal 与更新后的 game。
 * 通过 startGame 把模块级 rng 重置到固定 seed，保证 1 店 / 2 店两次 endDay 的天气/事件修正一致，
 * 从而每店结算值严格相等、聚合恰好 = 2× 单店（不依赖随机数）。
 */
function runStoreEndDay(state: GameState): { modal: DailyResult; game: GameState } {
  useGameStore.getState().startGame({
    initialCashTier: 300000,
    storeType: '奶茶饮品',
    locationType: '学校门口',
    decorationLevel: 'clean',
    storeName: '测试店',
    seed: 777,
  });
  // 用目标 state 替换开局生成的单店，并清掉弹窗/事件残留，避免影响 eventId 取值。
  useGameStore.setState({
    game: state,
    phase: 'playing',
    eventModal: null,
    resolvedEvent: null,
    settlementModal: null,
    crisisOpen: false,
  });
  useGameStore.getState().endDay();
  const modal = useGameStore.getState().settlementModal;
  const game = useGameStore.getState().game;
  if (!modal || !game) throw new Error('endDay 后未生成 settlementModal / game');
  return { modal, game };
}

describe('分店结算展示 Bug 回归（开分店后对外展示须翻倍）', () => {
  beforeEach(() => {
    useGameStore.setState({ game: null, settlementModal: null, eventModal: null, resolvedEvent: null });
  });

  it('路径 A：store.endDay → settlementModal 在 2 店时各字段 ≈ 单店 × 2（修复前 = 单店，会失败）', () => {
    const one = freshGame();
    const two = withStores(one, 2);

    const single = runStoreEndDay(one).modal;
    const modal = runStoreEndDay(two).modal;

    // 关键断言：对外展示 = 全店汇总（≈ 2× 单店）。修复前 settlementModal 取 mainDaily = 单店 → 此断言失败。
    expectAggregatedByCount(modal, single, 2);
    // 反例：明确要求「展示值不等于单店单值」，才能卡住 Bug（而非恰好相等）。
    expect(modal.netProfit).not.toBe(single.netProfit);
    expect(modal.revenue).not.toBe(single.revenue);
  });

  it('路径 A（续）：store.endDay 的累计净利按全店汇总累加（2 店增量 ≈ 单店增量 × 2）', () => {
    const one = freshGame();
    const two = withStores(one, 2);

    const cumBeforeOne = one.cumulativeNetProfit;
    const incOne = runStoreEndDay(one).game.cumulativeNetProfit - cumBeforeOne;

    const cumBeforeTwo = two.cumulativeNetProfit;
    const incTwo = runStoreEndDay(two).game.cumulativeNetProfit - cumBeforeTwo;

    // 累计净利须按全店汇总累加：2 店增量 ≈ 单店增量 × 2。修复前 += mainDaily（单店）→ 此断言失败。
    expect(Math.abs(incTwo - incOne * 2)).toBeLessThanOrEqual(3);
    expect(incTwo).toBeGreaterThan(incOne);
  });

  it('路径 B：gameLoop.runDailyLoop 返回的 daily 在 2 店时各字段 ≈ 单店 × 2（修复前 = 单店，会失败）', () => {
    const SEED = 2024;
    const one = freshGame();
    const two = withStores(one, 2);

    // 注入相同 seed → 完全相同的 rng 序列 → 相同天气/事件修正 → 每店结算值相等。
    const loopOne = runDailyLoop(one, createRng(SEED));
    const loopTwo = runDailyLoop(two, createRng(SEED));
    const oneDaily = loopOne.daily;
    const twoDaily = loopTwo.daily;
    expect(oneDaily).toBeDefined();
    expect(twoDaily).toBeDefined();

    // 关键断言：对外返回的 daily = 全店汇总（≈ 2× 单店）。修复前 daily 取 mainDaily = 单店 → 此断言失败。
    expectAggregatedByCount(twoDaily!, oneDaily!, 2);
    expect(twoDaily!.netProfit).not.toBe(oneDaily!.netProfit);
    expect(twoDaily!.revenue).not.toBe(oneDaily!.revenue);
  });

  it('路径 B（续）：gameLoop.runDailyLoop 的累计净利按全店汇总累加（2 店增量 ≈ 单店增量 × 2）', () => {
    const SEED = 2024;
    const one = freshGame();
    const two = withStores(one, 2);

    const cumBeforeOne = one.cumulativeNetProfit;
    const cumBeforeTwo = two.cumulativeNetProfit;
    const loopOne = runDailyLoop(one, createRng(SEED));
    const loopTwo = runDailyLoop(two, createRng(SEED));

    const incOne = loopOne.state.cumulativeNetProfit - cumBeforeOne;
    const incTwo = loopTwo.state.cumulativeNetProfit - cumBeforeTwo;

    // 累计净利须按全店汇总累加：2 店增量 ≈ 单店增量 × 2。修复前 += mainDaily（单店）→ 此断言失败。
    expect(Math.abs(incTwo - incOne * 2)).toBeLessThanOrEqual(3);
    expect(incTwo).toBeGreaterThan(incOne);
  });
});
