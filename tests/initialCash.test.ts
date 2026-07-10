import { describe, it, expect } from 'vitest';
import {
  randomInitialCash,
  INITIAL_CASH_MIN,
  INITIAL_CASH_MAX,
} from '../src/data/setupCosts';
import { createNewGame } from '../src/core/createNewGame';
import { createRng } from '../src/core/rng';

describe('randomInitialCash', () => {
  it('始终落在 [5000, 200000) 且为整数', () => {
    for (let i = 0; i < 1000; i++) {
      const v = randomInitialCash();
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(INITIAL_CASH_MIN);
      expect(v).toBeLessThan(INITIAL_CASH_MAX);
    }
  });
});

describe('createNewGame 使用传入的 initialCash', () => {
  const base = {
    storeType: '奶茶饮品' as const,
    locationType: '学校门口' as const,
    decorationLevel: 'clean' as const,
    storeName: '测试店',
    seed: 12345,
  };

  it('净资产恒等于传入的 initialCash（不再固定 10 万）', () => {
    expect(
      createNewGame({ ...base, initialCash: 5000 }, createRng(base.seed)).netWorth,
    ).toBe(5000);
    expect(
      createNewGame({ ...base, initialCash: 200000 }, createRng(base.seed)).netWorth,
    ).toBe(200000);
    expect(
      createNewGame({ ...base, initialCash: 80000 }, createRng(base.seed)).netWorth,
    ).toBe(80000);
  });
});
