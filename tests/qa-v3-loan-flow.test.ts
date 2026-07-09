// QA 独立验证：贷款"卡死"bug 是否真修（架构 §5.3 / §5.7 / §8.6）
// 重点：setup 超支生成一次性贷款后当天绝不弹强制贷款弹窗、游戏正常推进；
// 危机贷款仅在 cash<0 出现、点完精确扣 1 行动点且当天不结束；AP=0 时不可贷；
// 绝无"选贷款→自动结束当天→次日又弹"循环。
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../src/store/gameStore';

const store = () => useGameStore.getState();

describe('贷款卡死 bug：setup 超支一次性贷款，当天绝不弹强制贷款弹窗', () => {
  it('超支配置开局：cash 恒为 0（非负）→ 无强制贷款弹窗，游戏正常推进到次日', () => {
    // 学校门口/designer 超支 over≈144000 → 民间贷款，cash 应恰好为 0（绝不为负）
    store().startGame({
      storeType: '奶茶饮品',
      locationType: '学校门口',
      decorationLevel: 'designer',
      storeName: 'QA超支店',
      seed: 7,
    });
    const g = store().game!;
    expect(g.loans.length).toBe(1); // 一次性 setup 贷款已生成
    expect(g.cash).toBe(0); // 超支被贷款全额覆盖，cash 恰好 0（绝不 <0）
    expect(store().crisisOpen).toBe(false); // 当天绝不弹强制贷款弹窗
    expect(store().game!.gameOver).toBe(false);
    expect(g.day).toBe(1);

    // 结束当天：endDay 仅打开结算弹窗，closeSettlement 才推进到次日
    store().endDay();
    store().closeSettlement();
    expect(store().game!.day).toBe(2);
    expect(store().crisisOpen).toBe(false);
  });

  it('不超支配置开局：无 setup 贷款，cash 为正', () => {
    store().startGame({
      storeType: '奶茶饮品',
      locationType: '学校门口',
      decorationLevel: 'clean',
      storeName: 'QA低配店',
      seed: 7,
    });
    const g = store().game!;
    expect(g.loans.length).toBe(0);
    expect(g.cash).toBeGreaterThan(0);
    expect(store().crisisOpen).toBe(false);
  });
});

describe('危机贷款：仅在 cash<0 出现，扣 1 AP 且当天不结束', () => {
  beforeEach(() => {
    store().startGame({
      storeType: '奶茶饮品',
      locationType: '学校门口',
      decorationLevel: 'clean',
      storeName: 'QA危机店',
      seed: 7,
    });
  });

  it('cash<0 点危机贷款：精确扣 1 AP、回正现金、day 不前进、危机关闭', () => {
    const g0 = store().game!;
    // 模拟已进入现金流危机（crisisOpen 是 store 字段，非 game 字段）
    useGameStore.setState({ game: { ...g0, cash: -20000 }, crisisOpen: true });
    const dayBefore = store().game!.day;
    const apBefore = store().game!.actionPointsCurrent; // 应为 3

    store().takeCrisisLoan('bank');

    const g = store().game!;
    expect(g.cash).toBeGreaterThanOrEqual(0); // 续命回正（buffer 10000）
    expect(g.loans.length).toBe(1); // 写入一笔危机贷款
    expect(g.actionPointsCurrent).toBe(apBefore - 1); // 精确扣 1
    expect(g.day).toBe(dayBefore); // 当天不结束（day 计数器不前进）
    expect(store().crisisOpen).toBe(false); // 现金回正后危机面板关闭
  });

  it('AP=0 时危机贷款被禁用：不写贷款、不扣现金、不扣 AP', () => {
    const g0 = store().game!;
    useGameStore.setState({ game: { ...g0, cash: -20000, actionPointsCurrent: 0 }, crisisOpen: true });
    const loansBefore = store().game!.loans.length;

    store().takeCrisisLoan('bank');

    const g = store().game!;
    expect(g.loans.length).toBe(loansBefore); // 未新增贷款
    expect(g.cash).toBe(-20000); // 现金不变（未借）
    expect(g.actionPointsCurrent).toBe(0); // AP 仍为 0
  });

  it('危机贷款绝不触发"选贷款→自动结束当天→次日又弹"循环', () => {
    const g0 = store().game!;
    useGameStore.setState({ game: { ...g0, cash: -20000 }, crisisOpen: true });
    const dayBefore = store().game!.day;

    store().takeCrisisLoan('bank'); // 不推进 day
    expect(store().game!.day).toBe(dayBefore); // 关键：贷款不结束当天

    // 玩家仍可继续操作并于当日主动结束（endDay 展示结算弹窗，closeSettlement 才推进 day）
    store().endDay();
    store().closeSettlement();
    expect(store().game!.day).toBe(dayBefore + 1); // 当天仅结束一次，day 精确 +1
  });
});
