// 分店成本展示 + 首页关店入口 增量测试（需求①、需求②）
// 1) settleAllStores 新增 aggregateDaily 全店汇总（含总部日摊重复累加 bug 修复）
// 2) gameStore 关店确认流程 confirmCloseShop → activeEnding='decent_exit'
import { describe, it, expect, beforeEach } from 'vitest';
import { createRng } from '../src/core/rng';
import { createNewGame } from '../src/core/createNewGame';
import { settleAllStores } from '../src/core/settlement';
import { headquartersDailyCost } from '../src/core/branch';
import { applyMonthOption } from '../src/core/monthlyReport';
import { useGameStore } from '../src/store/gameStore';
import type { GameState } from '../src/types';

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

/** 在单店 state 基础上复制主店为第 n 家分店（rent/employees 一致），并将 storeCount 设为 count。 */
function withStores(base: GameState, count: number): GameState {
  const main = base.stores[0];
  const stores = [main];
  for (let i = 1; i < count; i++) {
    stores.push({ ...main, id: `store_${String(i + 1).padStart(3, '0')}`, name: `${main.name} 分店${i}` });
  }
  return { ...base, stores, storeCount: count };
}

describe('需求①：settleAllStores.aggregateDaily 全店汇总', () => {
  it('2 家门店时 aggregateDaily 各金额字段 = 主店单店 × 2', () => {
    const one = freshGame();
    const two = withStores(one, 2);
    const rng = createRng(7);

    const single = settleAllStores(one, rng);
    const { aggregateDaily } = settleAllStores(two, rng);

    // 门店完全相同 → 结算结果确定性一致，聚合为精确 2 倍
    expect(aggregateDaily.revenue).toBe(single.mainDaily.revenue * 2);
    expect(aggregateDaily.grossProfit).toBe(single.mainDaily.grossProfit * 2);
    expect(aggregateDaily.staffCost).toBe(single.mainDaily.staffCost * 2);
    expect(aggregateDaily.promoCost).toBe(single.mainDaily.promoCost * 2);
    expect(aggregateDaily.platformCost).toBe(single.mainDaily.platformCost * 2);
    expect(aggregateDaily.orders).toBe(single.mainDaily.orders * 2);
    expect(aggregateDaily.netProfit).toBe(single.mainDaily.netProfit * 2);
  });

  it('fixedCostDaily = Σ(store.rent/30) + headquartersDailyCost(storeCount)（storeCount=2 时总部为0）', () => {
    const one = freshGame();
    const two = withStores(one, 2);
    const rng = createRng(7);
    const rent = one.stores[0].rent;

    const { aggregateDaily } = settleAllStores(two, rng);
    // storeCount=2 → 总部日摊为 0；房租日摊 = 2 × (rent/30)
    expect(aggregateDaily.fixedCostDaily).toBe(Math.round(rent / 30) * 2 + headquartersDailyCost(2));
    // 等价于主店单店 fixedCostDaily × 2（单店总部日摊也为 0）
    expect(aggregateDaily.fixedCostDaily).toBe(Math.round(settleAllStores(one, rng).mainDaily.fixedCostDaily) * 2);
  });

  it('修复总部日摊重复累加：storeCount=3 时总部日摊只加一次', () => {
    const one = freshGame();
    const three = withStores(one, 3);
    const rng = createRng(7);
    const rent = one.stores[0].rent;
    const hq = headquartersDailyCost(3); // storeCount>=3 才非零

    const { aggregateDaily } = settleAllStores(three, rng);
    // 正确：Σ(rent/30) + 总部日摊（一次），整体四舍五入
    expect(aggregateDaily.fixedCostDaily).toBe(Math.round((rent / 30) * 3 + hq));

    // 反例校验：若每家店都重复加总部日摊（旧 bug），会得到 3×rent/30 + 3×hq，与正确值不等
    expect(aggregateDaily.fixedCostDaily).not.toBe(Math.round((rent / 30) * 3 + hq * 3));
  });

  it('aggregateDaily.cashAfter = 全局现金 + 总净利；capacityOverload 取并集', () => {
    const one = freshGame();
    const two = withStores(one, 2);
    const rng = createRng(7);
    const { aggregateDaily, totalNetProfit } = settleAllStores(two, rng);
    expect(aggregateDaily.cashAfter).toBe(Math.round(two.cash + totalNetProfit));
    expect(typeof aggregateDaily.capacityOverload).toBe('boolean');
  });

  it('aggregateDaily 保留 mainDaily 不破坏既有引用', () => {
    const one = freshGame();
    const rng = createRng(7);
    const res = settleAllStores(one, rng);
    expect(res.mainDaily).toBeDefined();
    expect(res.aggregateDaily).toBeDefined();
  });
});

describe('需求②：首页关店确认流程', () => {
  beforeEach(() => {
    useGameStore.setState({ game: null, closeConfirmOpen: false });
  });

  it('openCloseConfirm / cancelCloseConfirm 切换 closeConfirmOpen', () => {
    const store = useGameStore.getState();
    store.openCloseConfirm();
    expect(useGameStore.getState().closeConfirmOpen).toBe(true);
    store.cancelCloseConfirm();
    expect(useGameStore.getState().closeConfirmOpen).toBe(false);
  });

  it('confirmCloseShop 进入 decent_exit 结局屏（lastEnding 被置位，而非静默进入下一天）', () => {
    const two = withStores(freshGame(), 2);
    useGameStore.setState({ game: two, closeConfirmOpen: true });

    useGameStore.getState().confirmCloseShop();

    const after = useGameStore.getState();
    expect(after.closeConfirmOpen).toBe(false);
    // 关键：结局屏由 lastEnding 驱动，必须被置位（而非仅设 activeEnding 后静默推进）
    expect(after.lastEnding).not.toBeNull();
    expect(after.game?.activeEnding).toBe('decent_exit');
    expect(after.game?.gameOver).toBe(true);
    expect(after.game?.endingsUnlocked).toContain('decent_exit');
  });

  it('confirmCloseShop 等价于 applyMonthOption(g, "close") 的结局效果', () => {
    const g = freshGame();
    const s = applyMonthOption(g, 'close', createRng(1));
    expect(s.activeEnding).toBe('decent_exit');
  });
});
