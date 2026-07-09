// B.4 暗线更新方向 + 店里风向（绝不暴露数值 / 高风险优先 / 等级映射）。
import { describe, it, expect } from 'vitest';
import { createRng } from '../src/core/rng';
import { createNewGame } from '../src/core/createNewGame';
import { updateHiddenLines, decaySoftHidden } from '../src/core/hiddenLines';
import { generateWind } from '../src/core/wind';
import { emptyModifiers } from '../src/core/modifiers';
import type { GameState, DayModifiers } from '../src/types';

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

describe('B.4 hiddenLines 更新方向正确', () => {
  it('updateHiddenLines 把 mods.hidden/soft 累加到状态并夹紧', () => {
    const s = freshGame();
    const mods: DayModifiers = {
      ...emptyModifiers(),
      hidden: { landlordAttention: 10, customerTrust: 5 },
      soft: { ownerFatigue: 7 },
    };
    const r = updateHiddenLines(s, mods);
    expect(r.hiddenLines.landlordAttention).toBe(s.hiddenLines.landlordAttention + 10);
    expect(r.hiddenLines.customerTrust).toBe(Math.min(100, s.hiddenLines.customerTrust + 5));
    expect(r.softHidden.ownerFatigue).toBe(s.softHidden.ownerFatigue + 7);
  });

  it('decaySoftHidden 每日衰减：ownerFatigue 等 -1，landlordPatience +1', () => {
    const s = freshGame();
    s.softHidden.ownerFatigue = 50;
    s.softHidden.wasteRisk = 50;
    s.softHidden.qualityVariance = 50;
    s.softHidden.accountingErrorRisk = 50;
    s.softHidden.stability = 50;
    s.softHidden.landlordPatience = 50;
    const r = decaySoftHidden(s);
    expect(r.softHidden.ownerFatigue).toBe(49);
    expect(r.softHidden.wasteRisk).toBe(49);
    expect(r.softHidden.qualityVariance).toBe(49);
    expect(r.softHidden.accountingErrorRisk).toBe(49);
    expect(r.softHidden.stability).toBe(49);
    expect(r.softHidden.landlordPatience).toBe(51);
  });
});

describe('B.4 店里风向', () => {
  it('输出绝不包含任何数值（只含症状文案）', () => {
    const s = freshGame();
    // 制造多个高风险暗线
    s.hiddenLines.landlordAttention = 90;
    s.hiddenLines.promoHype = 80;
    s.hiddenLines.hygieneRisk = 70;
    s.hiddenLines.employeePressure = 85;
    const wind = generateWind(s);
    for (const line of wind.lines) {
      expect(line).not.toMatch(/\d/); // 不应出现任何数字（如 landlordAttention:72）
    }
  });

  it('平静状态返回 calm 与安抚文案（同样无数字）', () => {
    const s = freshGame(); // 所有暗线皆低，customerTrust=50 不触发反向
    const wind = generateWind(s);
    expect(wind.level).toBe('calm');
    expect(wind.lines[0]).not.toMatch(/\d/);
  });

  it('等级映射：landlordAttention 80→danger / 55→warn / 35→watch', () => {
    const mk = (v: number): GameState => {
      const s = freshGame();
      s.hiddenLines.landlordAttention = v;
      return s;
    };
    expect(generateWind(mk(80)).level).toBe('danger');
    expect(generateWind(mk(55)).level).toBe('warn');
    expect(generateWind(mk(35)).level).toBe('watch');
  });

  it('高风险暗线优先（分数更高者排在 lines 首位）', () => {
    const s = freshGame();
    s.hiddenLines.landlordAttention = 90; // score 90 → danger
    s.hiddenLines.promoHype = 45; // score 45 → watch
    const wind = generateWind(s);
    expect(wind.lines[0]).toContain('房东');
  });

  it('customerTrust 低（反向）作为风险出现', () => {
    const s = freshGame();
    s.hiddenLines.customerTrust = 33; // <35 → danger 反向文案
    const wind = generateWind(s);
    expect(wind.level).toBe('danger');
    expect(wind.lines.some((l) => l.includes('老客'))).toBe(true);
  });
});
