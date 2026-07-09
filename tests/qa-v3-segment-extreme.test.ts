// QA 独立验证：客群极端敏感度（架构 §5.4）
// 学校高价→进店−30%；商场装修不足→进店−40% 且 heat 衰减×1.5；写字楼出餐不足→转化降；
// 社区复购+15%；冷清新商圈季节剧震。
import { describe, it, expect } from 'vitest';
import { applySegmentModulation } from '../src/core/segmentProfiles';
import { decayHeat } from '../src/core/repurchaseHeat';
import { createNewGame } from '../src/core/createNewGame';
import { createRng } from '../src/core/rng';
import type { StoreState } from '../src/types';

function storeWith(over: Partial<StoreState> = {}): StoreState {
  const s = createNewGame(
    { storeType: '奶茶饮品', locationType: '学校门口', decorationLevel: 'clean', storeName: 'QA', seed: 1 },
    createRng(1),
  );
  return { ...s.stores[0], ...over };
}

const mod = (state: any, store: StoreState) => applySegmentModulation(state, store);

describe('价格敏感（学校门口）', () => {
  it('raise/premium → 进店 −30%；normal → 0', () => {
    expect(mod({} as any, storeWith({ locationType: '学校门口', priceStrategy: 'raise' })).entryRatePct).toBe(-30);
    expect(mod({} as any, storeWith({ locationType: '学校门口', priceStrategy: 'premium' })).entryRatePct).toBe(-30);
    expect(mod({} as any, storeWith({ locationType: '学校门口', priceStrategy: 'normal' })).entryRatePct).toBe(0);
  });
});

describe('装修敏感（商场）', () => {
  it('装修低于 memorable → 进店 −40%；memorable 及以上 → 0', () => {
    expect(mod({} as any, storeWith({ locationType: '商场', decorationLevel: 'clean' })).entryRatePct).toBe(-40);
    expect(mod({} as any, storeWith({ locationType: '商场', decorationLevel: 'memorable' })).entryRatePct).toBe(0);
  });
  it('商场 heat 衰减 ×1.5：heat=60 → 48（非商场 → 52）', () => {
    const mall = createNewGame(
      { storeType: '奶茶饮品', locationType: '商场', decorationLevel: 'memorable', storeName: 'QA', seed: 1 },
      createRng(1),
    );
    mall.stores[0].heat = 60;
    expect(decayHeat(mall).stores[0].heat).toBe(60 - 8 * 1.5); // 48
    const school = createNewGame(
      { storeType: '奶茶饮品', locationType: '学校门口', decorationLevel: 'clean', storeName: 'QA', seed: 1 },
      createRng(1),
    );
    school.stores[0].heat = 60;
    expect(decayHeat(school).stores[0].heat).toBe(52);
  });
});

describe('出餐敏感（写字楼）', () => {
  it('承载不足基线(220) → 转化按缺口比例×40 惩罚', () => {
    expect(mod({} as any, storeWith({ locationType: '写字楼', capacity: 110 })).conversionRatePct).toBe(-20); // gap=0.5 → −20
    expect(mod({} as any, storeWith({ locationType: '写字楼', capacity: 300 })).conversionRatePct).toBe(0); // 充足
  });
});

describe('复购加成（社区底商）', () => {
  it('社区底商 → repurchase +15%', () => {
    expect(mod({} as any, storeWith({ locationType: '社区底商' })).repurchaseRatePct).toBe(15);
  });
});

describe('季节波动（冷清新商圈）', () => {
  it('day=7 → exposure +25；day=22 → exposure −25（正弦）', () => {
    expect(mod({ day: 7 } as any, storeWith({ locationType: '冷清新商圈' })).exposurePct).toBe(25);
    expect(mod({ day: 22 } as any, storeWith({ locationType: '冷清新商圈' })).exposurePct).toBe(-25);
  });
});
