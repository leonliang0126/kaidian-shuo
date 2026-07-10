// QA 独立验证：贷款"卡死"bug 是否真修（架构 §5.3 / §5.7 / §8.6）
// 重点：setup 超支生成一次性贷款后当天绝不弹强制贷款弹窗、游戏正常推进；
// 危机贷款仅在 cash<0 出现、点完精确扣 1 行动点且当天不结束；AP=0 时不可贷；
// 绝无"选贷款→自动结束当天→次日又弹"循环。
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { useGameStore } from '../src/store/gameStore';
import { saveGame } from '../src/core/storage';
import { LOAN_STORIES } from '../src/data/loanStories';

const store = () => useGameStore.getState();

// node 环境默认无 localStorage，提供内存桩以测试 init() → beginDay 的存档加载路径。
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null {
    return this.m.has(k) ? (this.m.get(k) as string) : null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, String(v));
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
  clear(): void {
    this.m.clear();
  }
}
beforeAll(() => {
  (globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage();
});
beforeEach(() => {
  (globalThis as unknown as { localStorage?: MemStorage }).localStorage?.clear();
});

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

    // 结束当天：endDay 仅打开结算弹窗；closeSettlement 结算后现金打负（奶茶首月常为负），
    // 按新行为直接弹危机面板让玩家自己选，而非偷偷自动银行兜底。
    store().endDay();
    store().closeSettlement();
    expect(store().crisisOpen).toBe(true); // 归零即弹面板（Fix 核心：取消自动兜底）
    expect(store().game!.loans.length).toBe(1); // 仅开局 setup 一次性贷款，无自动兜底新增
    expect(store().game!.day).toBe(1); // 不穿透进下一天，等玩家自行应对
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
    expect(g.cash).toBeGreaterThanOrEqual(0); // 续命回正（buffer 30000）
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

describe('现金流危机：cash<0 直接弹危机面板（取消自动兜底，玩家自己选）', () => {
  beforeEach(() => {
    store().startGame({
      storeType: '奶茶饮品',
      locationType: '学校门口',
      decorationLevel: 'clean',
      storeName: 'QA危机面板',
      seed: 7,
    });
  });

  it('beginDay：归零存档加载（init）→ 直接弹危机面板、不自动银行兜底', () => {
    const g0 = store().game!;
    // 模拟一份已归零的存档，init() 加载后 beginDay 应直接弹面板
    saveGame({ ...g0, cash: -500000 });
    useGameStore.getState().init();
    expect(store().crisisOpen).toBe(true);
    // 无自动银行兜底贷款（clean 配置无 setup 贷款，应为 0）
    expect(store().game!.loans.length).toBe(0);
  });

  it('proceedAfterSettlement：结算后 cash<0 → 直接弹面板、不自动兜底、不穿透进下一天', () => {
    const g0 = store().game!;
    const loansBefore = g0.loans.length;
    const dayBefore = g0.day;
    // 打负现金（足够负，结算净利多也拉不回正）
    useGameStore.setState({ game: { ...g0, cash: -500000 } });
    store().endDay();
    store().closeSettlement();
    // 关键：不自动银行兜底（无新贷款），直接弹面板
    expect(store().crisisOpen).toBe(true);
    expect(store().game!.loans.length).toBe(loansBefore); // 未自动加银行兜底贷款
    expect(store().game!.day).toBe(dayBefore); // 未穿透进下一天
  });
});

describe('危机应对行动上限（store 层防无限拖延） + toast', () => {
  beforeEach(() => {
    store().startGame({
      storeType: '奶茶饮品',
      locationType: '学校门口',
      decorationLevel: 'clean',
      storeName: 'QA上限店',
      seed: 7,
    });
  });

  it('sell_equipment 仅可用 1 次：第 2 次被上限拦截（count 不增、现金不变）', () => {
    const g0 = store().game!;
    useGameStore.setState({ game: { ...g0, cash: -20000 }, crisisOpen: true });
    store().takeCrisisAction('sell_equipment');
    let g = store().game!;
    expect(g.crisisActionUsed?.['sell_equipment']).toBe(1);
    expect(g.cash).toBe(-20000 + 5000); // -15000 仍为负
    expect(store().crisisOpen).toBe(false); // Bug 5：现金仍负也一律关闭面板

    // 第 2 次：应被上限拦截，不执行、不计数
    store().takeCrisisAction('sell_equipment');
    g = store().game!;
    expect(g.crisisActionUsed?.['sell_equipment']).toBe(1); // 不增
    expect(g.cash).toBe(-15000); // 不变
  });

  it('temporary_price_increase 无限次：可连续多次使用', () => {
    const g0 = store().game!;
    useGameStore.setState({ game: { ...g0, cash: -20000 }, crisisOpen: true });
    store().takeCrisisAction('temporary_price_increase');
    store().takeCrisisAction('temporary_price_increase');
    store().takeCrisisAction('temporary_price_increase');
    const g = store().game!;
    expect(g.crisisActionUsed?.['temporary_price_increase'] ?? 0).toBe(3);
  });

  it('危机行动后写入 toast，clearToast 可清除', () => {
    const g0 = store().game!;
    useGameStore.setState({ game: { ...g0, cash: -20000 }, crisisOpen: true });
    store().takeCrisisAction('sell_equipment');
    expect(store().toast).not.toBeNull();
    expect(store().toast!.msg).toContain('+¥5,000');
    store().clearToast();
    expect(store().toast).toBeNull();
  });
});

describe('Bug 修复：被拒关面板 + 当天禁用贷款（Bug 1/5）+ 零员工裁员（Bug 5）', () => {
  beforeEach(() => {
    store().startGame({
      storeType: '奶茶饮品',
      locationType: '学校门口',
      decorationLevel: 'clean',
      storeName: 'Bug修复店',
      seed: 7,
    });
  });

  it('高利贷无油水拒（确定性）：关闭危机面板 + crisisLoanBlockedToday=true（Bug 1/5）', () => {
    const g0 = store().game!;
    useGameStore.setState({
      game: { ...g0, cash: -1000, predatoryLoanCount: 3, actionPointsCurrent: 3 },
      crisisOpen: true,
    });
    store().takeCrisisLoan('predatory');
    const g = store().game!;
    expect(store().crisisOpen).toBe(false); // 回游戏页
    expect(g.crisisLoanBlockedToday).toBe(true); // 当天禁用危机借款
    expect(store().story).not.toBeNull();
    expect(LOAN_STORIES.predatory.reject).toContain(store().story!.text);
  });

  it('任意危机行动结算后一律关闭危机面板（Bug 5）', () => {
    const g0 = store().game!;
    useGameStore.setState({ game: { ...g0, cash: -20000 }, crisisOpen: true });
    store().takeCrisisAction('sell_equipment');
    expect(store().crisisOpen).toBe(false);
  });

  it('零员工时裁员被拦截：不执行/不计数/面板保持，仅提示（Bug 5）', () => {
    const g0 = store().game!;
    const emptyStore = { ...g0.stores[0], employees: [] };
    useGameStore.setState({
      game: { ...g0, stores: [emptyStore], cash: -20000, crisisActionUsed: {} },
      crisisOpen: true,
    });
    store().takeCrisisAction('layoff');
    const g = store().game!;
    expect(g.crisisActionUsed?.['layoff']).toBeUndefined(); // 不计数
    expect(g.cash).toBe(-20000); // 未发补偿金，现金不变
    expect(store().crisisOpen).toBe(true); // 面板保持，可改选
    expect(store().toast).not.toBeNull(); // 提示
  });
});
