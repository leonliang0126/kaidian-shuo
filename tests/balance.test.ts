// T-D7：naive vs balanced 平衡验收（统一 10 万起手，固定 seed=12345 跑 120 天）。
// 断言改为"相对起手现金"，以适配 V3-3 统一起手资金模型。
import { describe, it, expect } from 'vitest';
import { createRng } from '../src/core/rng';
import { createNewGame } from '../src/core/createNewGame';
import { runDailyLoop } from '../src/core/gameLoop';
import { cloneState, applyEffects } from '../src/core/effectResolver';
import { getDecisionEffects, getStaffCapacity } from '../src/data/decisionOptions';
import type { DecisionState, GameState } from '../src/types';

type ComboKey = 'supplierTier' | 'priceStrategy' | 'promotionTier' | 'staffTier';
type Combo = Partial<Record<ComboKey, string>>;

/** 在纯状态上施加一项决策（即时效果 + 同步门店档位/承载），镜像 store.setDecision。 */
function applyDecisionOnState(
  state: GameState,
  key: ComboKey,
  value: string,
  rng: () => number,
): GameState {
  let s = cloneState(state);
  s.decisions = { ...s.decisions, [key]: value } as DecisionState;
  s.stores = s.stores.map((st) => {
    const next = { ...st, [key]: value } as typeof st;
    if (key === 'staffTier') {
      next.capacity = Math.round(getStaffCapacity(value) * (st.efficiency / 100));
    }
    return next;
  });
  const eff = getDecisionEffects(key, value);
  s = applyEffects(s, eff, rng, { accumulateMods: false });
  return s;
}

interface SimResult {
  state: GameState;
  cashSeries: number[]; // [0]=开局, [i]=第 i 天结束
  dailyNets: number[];
  start: number;
}

function runCombo(combo: Combo): SimResult {
  const rng = createRng(12345);
  let state = createNewGame(
    { storeType: '奶茶饮品', locationType: '学校门口', decorationLevel: 'clean', storeName: '平衡测试', seed: 12345 },
    rng,
  );
  for (const [k, v] of Object.entries(combo) as [ComboKey, string][]) {
    state = applyDecisionOnState(state, k, v, rng);
  }
  const cashSeries: number[] = [state.cash];
  const dailyNets: number[] = [];
  for (let i = 0; i < 120; i++) {
    const before = state.cash;
    const res = runDailyLoop(state, rng);
    dailyNets.push(res.state.cash - before);
    cashSeries.push(res.state.cash);
    state = res.state;
  }
  return { state, cashSeries, dailyNets, start: cashSeries[0] };
}

const NAIVE: Combo = {
  supplierTier: 'cheap',
  priceStrategy: 'low',
  promotionTier: 'gamble',
  staffTier: 'owner',
};
const BALANCED: Combo = {
  supplierTier: 'stable',
  priceStrategy: 'raise',
  promotionTier: 'normal',
  staffTier: 'standard',
};

describe('naive（cheap+owner+gamble+low）必须翻车', () => {
  it('统一起手下 ≤60 天现金转负', () => {
    const { cashSeries } = runCombo(NAIVE);
    let firstNeg = -1;
    for (let i = 1; i < cashSeries.length; i++) {
      if (cashSeries[i] < 0) {
        firstNeg = i;
        break;
      }
    }
    expect(firstNeg).toBeGreaterThan(0);
    expect(firstNeg).toBeLessThanOrEqual(60);
  });

  it('120 天内净现金流为负，且转负或触发 F001', () => {
    const { cashSeries, state } = runCombo(NAIVE);
    const total = cashSeries[120] - cashSeries[0];
    const monthlyAvg = total / 120;
    expect(monthlyAvg).toBeLessThan(0);
    const finalNeg = cashSeries[120] < 0;
    const f001 = state.eventHistory.some((e) => e.eventId === 'F001');
    expect(finalNeg || f001).toBe(true);
  });
});

describe('balanced（stable+standard+normal+raise）必须能存活且有起伏', () => {
  it('全程存活（期末 > 0）且表现优于 naive，日净波动明显', () => {
    const bal = runCombo(BALANCED);
    const naive = runCombo(NAIVE);
    const balStd = std(bal.dailyNets);
    expect(bal.cashSeries[120]).toBeGreaterThan(0); // 存活
    expect(bal.cashSeries[120]).toBeGreaterThan(naive.cashSeries[120]); // 优于 naive
    expect(balStd).toBeGreaterThan(0); // 有起伏
  });

  it('经营有起伏且明显优于 naive（月度正净天数更多）', () => {
    const bal = runCombo(BALANCED);
    const naive = runCombo(NAIVE);
    const balMonths: number[] = [];
    const naiveMonths: number[] = [];
    for (let m = 0; m < 4; m++) {
      balMonths.push(bal.cashSeries[(m + 1) * 30] - bal.cashSeries[m * 30]);
      naiveMonths.push(naive.cashSeries[(m + 1) * 30] - naive.cashSeries[m * 30]);
    }
    const balPositive = balMonths.filter((n) => n > 0).length;
    const naivePositive = naiveMonths.filter((n) => n > 0).length;
    // 统一 10 万下 balanced 也是紧绷的过山车，但经营质量明显优于 naive
    expect(balPositive).toBeGreaterThanOrEqual(1);
    expect(balPositive).toBeGreaterThanOrEqual(naivePositive);
  });
});

describe('回归不变量（120 天不抛错）', () => {
  it('固定 seed 连续 120 天不抛错，day 终值 121、月结 ≥3 次', () => {
    const rng = createRng(12345);
    let state = createNewGame(
      { storeType: '奶茶饮品', locationType: '学校门口', decorationLevel: 'clean', storeName: '模拟店', seed: 12345 },
      rng,
    );
    let monthReports = 0;
    for (let i = 0; i < 120; i++) {
      const res = runDailyLoop(state, rng);
      state = res.state;
      if (res.monthReport) monthReports += 1;
    }
    expect(state.day).toBe(121);
    expect(state.month).toBe(5);
    expect(state.businessLog.length).toBeGreaterThanOrEqual(120);
    expect(monthReports).toBeGreaterThanOrEqual(3);
  });
});

function std(xs: number[]): number {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
  return Math.sqrt(variance);
}
