// B.2 通用 effect 解析器：cash 令牌 / hidden 8 暗线 / soft 6 暗线 / 结局标记 / 命名冷却。
import { describe, it, expect } from 'vitest';
import { createRng } from '../src/core/rng';
import { createNewGame } from '../src/core/createNewGame';
import { applyEffects } from '../src/core/effectResolver';
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

describe('B.2 cash 字段：数字加减与令牌换算', () => {
  it('纯数字 / 纯数字字符串直接加减', () => {
    const s = freshGame();
    const r1 = applyEffects(s, { cash: 30000 }, () => 0.5, { accumulateMods: false });
    expect(r1.cash).toBe(s.cash + 30000);
    const r2 = applyEffects(s, { cash: '-5000' }, () => 0.5, { accumulateMods: false });
    expect(r2.cash).toBe(s.cash - 5000);
  });

  it('"-1_month_rent" 令牌 = 扣一个月租金', () => {
    const s = freshGame();
    const rent = s.stores[0].rent;
    const r = applyEffects(s, { cash: '-1_month_rent' }, () => 0.5, { accumulateMods: false });
    expect(r.cash).toBe(s.cash - rent);
  });

  it('"+half_month_rent" 令牌 = 加半个租金', () => {
    const s = freshGame();
    const rent = s.stores[0].rent;
    const r = applyEffects(s, { cash: '+half_month_rent' }, () => 0.5, { accumulateMods: false });
    expect(r.cash).toBe(s.cash + rent / 2);
  });

  it('"-deposit" 令牌 = 扣押金（=2×初始月租）', () => {
    const s = freshGame();
    const deposit = s.stores[0].deposit;
    const r = applyEffects(s, { cash: '-deposit' }, () => 0.5, { accumulateMods: false });
    expect(r.cash).toBe(s.cash - deposit);
    expect(deposit).toBe(s.stores[0].rent * 2);
  });
});

describe('B.2 hidden 8 暗线 / soft 6 暗线：累加正确且夹紧 [0,100]', () => {
  it('一次性施加全部 8 条 hidden + 6 条 soft 各 +5 被正确累加', () => {
    const s = freshGame();
    const hid = {
      landlordAttention: 5,
      employeePressure: 5,
      customerTrust: 5,
      priceControversy: 5,
      promoHype: 5,
      supplyRisk: 5,
      platformDependence: 5,
      hygieneRisk: 5,
    };
    const soft = {
      ownerFatigue: 5,
      wasteRisk: 5,
      qualityVariance: 5,
      landlordPatience: 5,
      accountingErrorRisk: 5,
      stability: 5,
    };
    const r = applyEffects(s, { hidden: hid, soft: soft }, () => 0.5, { accumulateMods: false });
    (Object.keys(hid) as (keyof typeof hid)[]).forEach((k) => {
      expect(r.hiddenLines[k]).toBe(s.hiddenLines[k] + 5);
    });
    (Object.keys(soft) as (keyof typeof soft)[]).forEach((k) => {
      expect(r.softHidden[k]).toBe(Math.min(100, s.softHidden[k] + 5)); // 含 [0,100] 夹紧
    });
  });

  it('soft 顶层字段（ownerFatigue 等）同样累加', () => {
    const s = freshGame();
    const r = applyEffects(
      s,
      { ownerFatigue: 8, wasteRisk: 8, qualityVariance: 8, landlordPatience: 8, accountingErrorRisk: 8, stability: 8 },
      () => 0.5,
      { accumulateMods: false },
    );
    expect(r.softHidden.ownerFatigue).toBe(s.softHidden.ownerFatigue + 8);
    expect(r.softHidden.wasteRisk).toBe(s.softHidden.wasteRisk + 8);
    expect(r.softHidden.qualityVariance).toBe(s.softHidden.qualityVariance + 8);
    expect(r.softHidden.landlordPatience).toBe(Math.min(100, s.softHidden.landlordPatience + 8)); // 初始 100 → 夹紧
    expect(r.softHidden.accountingErrorRisk).toBe(s.softHidden.accountingErrorRisk + 8);
    expect(r.softHidden.stability).toBe(Math.min(100, s.softHidden.stability + 8)); // 初始 100 → 夹紧
  });

  it('暗线数值被夹紧在 [0,100]', () => {
    const s = freshGame();
    const r = applyEffects(s, { hidden: { landlordAttention: 200 }, soft: { ownerFatigue: 200 } }, () => 0.5, { accumulateMods: false });
    expect(r.hiddenLines.landlordAttention).toBe(100);
    expect(r.softHidden.ownerFatigue).toBe(100);
  });
});

describe('B.2 ending / cooldown 记录', () => {
  it('ending 令牌设置 activeEnding 与 endingsUnlocked，且不改 gameOver', () => {
    const s = freshGame();
    const r = applyEffects(s, { ending: 'financial_freedom' }, () => 0.5, { accumulateMods: false });
    expect(r.activeEnding).toBe('financial_freedom');
    expect(r.endingsUnlocked).toContain('financial_freedom');
    expect(r.gameOver).toBe(false);
  });

  it('命名冷却被记录为 day + 数字后缀天数', () => {
    const s = freshGame(); // day = 1
    const r = applyEffects(s, { cooldown: 'rent_increase_60_days' }, () => 0.5, { accumulateMods: false });
    expect(r.activeCooldowns['rent_increase_60_days']).toBe(s.day + 60);
  });
});
