// 故事系统 + 贷款修复的串联测试：
//   - LOAN_STORIES 结构（每键 ≥1 条、逐字文案非空）
//   - pickStory 在确定性 rng 下返回预期索引
//   - store 层：银行/亲友锁死 → 对应风控拒/彻底拒绝故事；高利贷无油水拒故事；危机应对行动故事
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { useGameStore } from '../src/store/gameStore';
import { LOAN_STORIES, pickStory, fillStory } from '../src/data/loanStories';
import { PREDATORY_REJECT_CUTOFF } from '../src/data/setupCosts';

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
  useGameStore.getState().resetGame();
});

function startCrisis(): void {
  store().startGame({
    storeType: '奶茶饮品',
    locationType: '学校门口',
    decorationLevel: 'clean',
    storeName: '故事店',
    seed: 7,
  });
}

describe('LOAN_STORIES 结构（逐字文案非空、每键 ≥1 条）', () => {
  it('bank/private/predatory/action 各键都有 ≥1 条且非空', () => {
    const all = [
      ...LOAN_STORIES.bank.success,
      ...LOAN_STORIES.bank.reject,
      ...LOAN_STORIES.private.success,
      ...LOAN_STORIES.private.reject0,
      ...LOAN_STORIES.private.reject1,
      ...LOAN_STORIES.private.reject2,
      ...LOAN_STORIES.predatory.success,
      ...LOAN_STORIES.predatory.reject,
      ...LOAN_STORIES.action.sell_equipment,
      ...LOAN_STORIES.action.clearance_sale,
      ...LOAN_STORIES.action.delay_rent,
      ...LOAN_STORIES.action.delay_supplier_payment,
      ...LOAN_STORIES.action.layoff,
      ...LOAN_STORIES.action.temporary_price_increase,
    ];
    expect(all.length).toBeGreaterThan(0);
    for (const t of all) expect(typeof t === 'string' && t.length > 0).toBe(true);
  });

  it('借款类每条恰 2 条备选（A/B），拒绝档位齐全', () => {
    expect(LOAN_STORIES.bank.success.length).toBe(2);
    expect(LOAN_STORIES.bank.reject.length).toBeGreaterThanOrEqual(1);
    expect(LOAN_STORIES.private.success.length).toBe(2);
    expect(LOAN_STORIES.private.reject0.length).toBe(2);
    expect(LOAN_STORIES.private.reject1.length).toBe(2);
    expect(LOAN_STORIES.private.reject2.length).toBe(2);
    expect(LOAN_STORIES.predatory.success.length).toBe(2);
    expect(LOAN_STORIES.predatory.reject.length).toBe(2);
  });

  it('危机应对行动表含全部 6 个行动', () => {
    const ids = Object.keys(LOAN_STORIES.action);
    expect(ids).toEqual(
      expect.arrayContaining([
        'sell_equipment',
        'clearance_sale',
        'delay_rent',
        'delay_supplier_payment',
        'layoff',
        'temporary_price_increase',
      ]),
    );
  });
});

describe('pickStory 确定性 rng', () => {
  it('rng()=0 → 返回第 0 条；rng()=0.999 → 返回最后一条', () => {
    const arr = ['A', 'B', 'C'];
    expect(pickStory(arr, () => 0)).toBe('A');
    expect(pickStory(arr, () => 0.999)).toBe('C');
  });

  it('默认 rng=Math.random：返回数组内某条（不越界、不 undefined）', () => {
    const arr = LOAN_STORIES.private.reject2;
    for (let i = 0; i < 50; i++) {
      const t = pickStory(arr);
      expect(arr).toContain(t);
    }
  });
});

describe('store 层：锁死 / 无油水 / 危机行动 故事', () => {
  beforeEach(() => startCrisis());

  it('银行借满 2 笔锁死：点击 bank 弹"风控拒"故事（info），不借款、crisisLoanCount 不变', () => {
    const g0 = store().game!;
    useGameStore.setState({
      game: { ...g0, cash: -20000, crisisLoanCount: 2, actionPointsCurrent: 3 },
      crisisOpen: true,
    });
    store().takeCrisisLoan('bank');
    const g = store().game!;
    expect(store().story).not.toBeNull();
    expect(store().story!.text).toBe(LOAN_STORIES.bank.reject[0]); // 风控拒（唯一一条，确定性）
    expect(store().story!.tone).toBe('info');
    expect(g.crisisLoanCount).toBe(2); // 不借款
    expect(g.loans.length).toBe(0);
    expect(g.cash).toBe(-20000);
  });

  it('亲友借满 2 笔锁死：点击 private 弹 reject2 故事（fail），不借款', () => {
    const g0 = store().game!;
    useGameStore.setState({
      game: { ...g0, cash: -20000, crisisLoanCount: 2, actionPointsCurrent: 3 },
      crisisOpen: true,
    });
    store().takeCrisisLoan('private');
    const g = store().game!;
    expect(store().story).not.toBeNull();
    expect(LOAN_STORIES.private.reject2).toContain(store().story!.text);
    expect(store().story!.tone).toBe('fail');
    expect(g.crisisLoanCount).toBe(2);
    expect(g.loans.length).toBe(0);
  });

  it('高利贷借满 3 笔后第 4 次：弹"无油水拒"故事（fail），不增计数、不写 Loan', () => {
    // 前 3 笔正常借到（消耗 3 行动点）
    let g = store().game!;
    for (let i = 1; i <= PREDATORY_REJECT_CUTOFF; i++) {
      useGameStore.setState({ game: { ...g, cash: -1000, actionPointsCurrent: 3 }, crisisOpen: true });
      store().takeCrisisLoan('predatory');
      g = store().game!;
    }
    expect(g.predatoryLoanCount).toBe(PREDATORY_REJECT_CUTOFF);
    const loansBefore = g.loans.length;

    // 第 4 笔：恢复行动点后点击，应弹无油水拒
    useGameStore.setState({ game: { ...g, cash: -1000, actionPointsCurrent: 3 }, crisisOpen: true });
    store().takeCrisisLoan('predatory');
    const after = store().game!;
    expect(store().story).not.toBeNull();
    expect(LOAN_STORIES.predatory.reject).toContain(store().story!.text);
    expect(store().story!.tone).toBe('fail');
    expect(after.predatoryLoanCount).toBe(PREDATORY_REJECT_CUTOFF); // 不增
    expect(after.loans.length).toBe(loansBefore); // 不写新贷款
  });

  it('危机应对行动：sell_equipment 触发后 story 来自 action 表（info）；第 2 次上限拦截不弹新故事', () => {
    const g0 = store().game!;
    useGameStore.setState({ game: { ...g0, cash: -20000 }, crisisOpen: true });
    store().takeCrisisAction('sell_equipment');
    expect(store().story).not.toBeNull();
    expect(LOAN_STORIES.action.sell_equipment).toContain(store().story!.text);
    expect(store().story!.tone).toBe('info');
    expect(store().game!.crisisActionUsed?.['sell_equipment']).toBe(1);

    // 清除故事后第 2 次：被上限拦截，不执行、不弹新故事
    useGameStore.getState().dismissStory();
    expect(store().story).toBeNull();
    store().takeCrisisAction('sell_equipment');
    expect(store().story).toBeNull();
    expect(store().game!.crisisActionUsed?.['sell_equipment']).toBe(1); // 不增
  });
});

describe('借款类 success 文案含动态 {amount}（修复写死金额，Bug 2/3/4）', () => {
  it('bank/private/predatory success 均含 {amount} 占位，且不再写死「十万」「五千」', () => {
    for (const t of LOAN_STORIES.bank.success) {
      expect(t).toContain('{amount}');
      expect(t).not.toContain('十万');
    }
    for (const t of LOAN_STORIES.private.success) {
      expect(t).toContain('{amount}');
      expect(t).not.toContain('十万');
    }
    for (const t of LOAN_STORIES.predatory.success) {
      expect(t).toContain('{amount}');
      expect(t).not.toContain('五千');
    }
  });

  it('fillStory 把 {amount} 替换为 fmtMoney(amount)', () => {
    expect(fillStory('到账 {amount}，收好', 30000)).toBe('到账 ¥30,000，收好');
    expect(fillStory('无占位', 1234)).toBe('无占位');
  });
});
