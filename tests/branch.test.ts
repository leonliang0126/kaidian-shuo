// B.7 分店系统：解锁条件 / 开店扣现金 / 总部日摊成本起算。
import { describe, it, expect } from 'vitest';
import { createRng } from '../src/core/rng';
import { createNewGame } from '../src/core/createNewGame';
import { checkBranchUnlock, openBranch, headquartersDailyCost } from '../src/core/branch';
import type { GameState } from '../src/types';

function freshGame(): GameState {
  const rng = createRng(42);
  return createNewGame(
    {
      initialCashTier: 300000,
      storeType: '奶茶饮品',
      locationType: '学校门口',
      decorationLevel: 'clean',
      storeName: '测试店',
      seed: 42,
    },
    rng,
  );
}

// 构造满足解锁条件的状态
function unlockable(): GameState {
  const s = freshGame();
  s.cash = 200000;
  s.stores[0].monthlyNetProfitPositiveStreak = 1;
  s.brandRating = 84;
  s.stores[0].isInCrisis = false;
  s.debt = 0;
  return s;
}

describe('B.7 总部日摊成本', () => {
  it('storeCount<3 为 0；>=3 起算（8000+4000*(n-3) 按 30 天日摊）', () => {
    expect(headquartersDailyCost(1)).toBe(0);
    expect(headquartersDailyCost(2)).toBe(0);
    expect(headquartersDailyCost(3)).toBeCloseTo(8000 / 30, 6);
    expect(headquartersDailyCost(5)).toBeCloseTo((8000 + 4000 * 2) / 30, 6);
  });
});

describe('B.7 分店解锁条件', () => {
  it('满足全部条件 → true', () => {
    expect(checkBranchUnlock(unlockable())).toBe(true);
  });

  it('逐项违反 → false', () => {
    const violate = (mut: (s: GameState) => void): boolean => {
      const s = unlockable();
      mut(s);
      return checkBranchUnlock(s);
    };
    expect(violate((s) => (s.cash = 100000))).toBe(false); // 现金不足
    expect(violate((s) => (s.stores[0].monthlyNetProfitPositiveStreak = 0))).toBe(false); // 连续正净利月不足
    expect(violate((s) => (s.brandRating = 70))).toBe(false); // 品牌不足
    expect(violate((s) => (s.debt = 300000))).toBe(false); // 债务超 0.3×净资产
    expect(violate((s) => (s.stores[0].isInCrisis = true))).toBe(false); // 危机中
    expect(violate((s) => (s.storeCount = 10))).toBe(false); // 已达上限
  });
});

describe('B.7 开店：扣现金、门店数+1', () => {
  it('openBranch 扣除租金×2 的现金，门店+1，新增分店记录', () => {
    const s = unlockable();
    const rent = s.stores[0].rent;
    const cashBefore = s.cash;
    const r = openBranch(s, () => 0.5);
    expect(r.cash).toBe(cashBefore - rent * 2);
    expect(r.storeCount).toBe(s.storeCount + 1);
    expect(r.stores.length).toBe(s.stores.length + 1);
    expect(r.stores[r.stores.length - 1].name).toContain('分店');
  });

  it('不满足条件时不新增门店', () => {
    const s = freshGame(); // 不满足解锁条件
    const r = openBranch(s, () => 0.5);
    expect(r.storeCount).toBe(s.storeCount);
    expect(r.stores.length).toBe(s.stores.length);
  });
});
