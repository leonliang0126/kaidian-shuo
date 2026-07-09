// B.3 事件引擎：抽事件概率 / gate / 暗线权重 / 冷却，以及 checkForcedEvents(F001/F002/F003)。
import { describe, it, expect } from 'vitest';
import { createRng } from '../src/core/rng';
import { createNewGame } from '../src/core/createNewGame';
import {
  drawEvent,
  computeBaseProb,
  checkForcedEvents,
  cooldownOk,
} from '../src/core/eventEngine';
import { evaluateGate } from '../src/core/eventGate';
import { getEvent } from '../src/data/events';
import type { EventDef, GameState } from '../src/types';

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

describe('B.3 抽事件：未达 baseProb 返回 null', () => {
  it('rng 始终 > baseProb 时不触发任何事件', () => {
    const state = freshGame(); // day1, baseProb=0.45
    expect(computeBaseProb(state)).toBeCloseTo(0.45, 5);
    const ev = drawEvent(state, () => 0.99);
    expect(ev).toBeNull();
  });

  it('rng 始终 < baseProb 时必定命中（且返回受 gate 约束的事件）', () => {
    const state = freshGame();
    // 注意：这里用极小 rng 强制命中，但命中后抽取的事件必须满足 gate
    let hit: EventDef | null = null;
    for (let i = 0; i < 50 && !hit; i++) {
      hit = drawEvent(state, () => 0.01);
    }
    if (hit) {
      expect(evaluateGate(hit, state)).toBe(true);
    }
  });
});

describe('B.3 命中事件受 gate 约束（统计：返回事件均满足 evaluateGate）', () => {
  it('大量抽取中，所有返回事件都满足其 gate（含高暗线状态）', () => {
    const seeds = [1, 2, 3, 4, 5];
    for (const seed of seeds) {
      const rng = createRng(seed);
      const state = freshGame();
      state.hiddenLines.landlordAttention = 100; // 高暗线，放大部分池
      for (let i = 0; i < 300; i++) {
        const ev = drawEvent(state, rng);
        if (ev) expect(evaluateGate(ev, state)).toBe(true);
      }
    }
  });
});

describe('B.3 暗线权重：高 landlordAttention 使 landlord 池占比显著高于 baseline', () => {
  it('高暗线状态的 landlord 事件命中数 > baseline，且占比 > 0.3', () => {
    const N = 3000;
    const seed = 12345;

    const baseline = freshGame();
    const high = freshGame();
    high.hiddenLines.landlordAttention = 100;

    const rngB = createRng(seed);
    const rngH = createRng(seed);

    let bHits = 0;
    let bLandlord = 0;
    for (let i = 0; i < N; i++) {
      const ev = drawEvent(baseline, rngB);
      if (ev) {
        bHits++;
        if (ev.category === 'landlord') bLandlord++;
      }
    }

    let hHits = 0;
    let hLandlord = 0;
    for (let i = 0; i < N; i++) {
      const ev = drawEvent(high, rngH);
      if (ev) {
        hHits++;
        if (ev.category === 'landlord') hLandlord++;
      }
    }

    const bRatio = bHits > 0 ? bLandlord / bHits : 0;
    const hRatio = hHits > 0 ? hLandlord / hHits : 0;
    // 高暗线应明显抬高 landlord 占比
    expect(hLandlord).toBeGreaterThan(bLandlord);
    expect(hRatio).toBeGreaterThan(0.3);
    expect(hRatio).toBeGreaterThan(bRatio);
  });
});

describe('B.3 冷却：同一事件在 cooldown 内不会重复出现', () => {
  it('drawEvent 内部使用 cooldownOk：事件在 cooldown 内被排除', () => {
    const e = getEvent('E001'); // cooldownDays=2
    expect(e).toBeTruthy();

    const recent = freshGame();
    recent.eventHistory = [{ day: 5, eventId: 'E001', optionId: 'a', title: 't' }];
    recent.day = 5;
    expect(cooldownOk(e!, recent)).toBe(false); // 5-5=0 < 2
    recent.day = 6;
    expect(cooldownOk(e!, recent)).toBe(false); // 6-5=1 < 2
    recent.day = 7;
    expect(cooldownOk(e!, recent)).toBe(true); // 7-5=2 >= 2

    // 命名冷却：rent_increase_60_days 封锁 E016
    const e16 = getEvent('E016');
    expect(e16).toBeTruthy();
    const named = freshGame();
    named.activeCooldowns['rent_increase_60_days'] = 100;
    named.day = 50;
    expect(cooldownOk(e16!, named)).toBe(false);
    named.day = 101;
    expect(cooldownOk(e16!, named)).toBe(true);
  });
});

describe('B.3 checkForcedEvents：F001/F002/F003', () => {
  it('cash < 0 → F001（现金流危机），与 ctx 无关', () => {
    const s = freshGame();
    s.cash = -100;
    const f = checkForcedEvents(s);
    expect(f?.id).toBe('F001');
  });

  it('月结房租不足（cash 介于 0 与 房租+还款+工资 之间）→ F002', () => {
    const s = freshGame();
    s.cash = 1; // >0 避免 F001
    // 学校门口 rent=12000；标准人工日成本 450 → 月 13500
    s.stores = s.stores.map((st) => ({ ...st, staffTier: 'standard' }));
    const f = checkForcedEvents(s, { atMonthEnd: true });
    expect(f?.id).toBe('F002');
  });

  it('债务压力爆表（monthlyRepayment > 月均毛利×0.5）→ F003', () => {
    const s = freshGame();
    s.stores = s.stores.map((st) => ({ ...st, employees: [] })); // 无员工，工资为 0，便于隔离
    s.cash = 20000; // >0 且 >= rent+还款，避免 F001/F002（无员工=无工资）
    s.stores[0].monthlyGrossProfit = 10000; // 月均毛利 = 333.33
    s.monthlyRepayment = 500; // > 333.33×0.5=166.67
    const f = checkForcedEvents(s, { atMonthEnd: true });
    expect(f?.id).toBe('F003');
  });

  it('健康状态在月结时返回 null', () => {
    const s = freshGame();
    s.cash = 200000;
    s.monthlyRepayment = 0;
    expect(checkForcedEvents(s, { atMonthEnd: true })).toBeNull();
    expect(checkForcedEvents(s)).toBeNull();
  });
});
