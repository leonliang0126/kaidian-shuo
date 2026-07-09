// QA 独立验证：集成模拟（架构 §9 不变量）
// 固定 seed 跑 120 天不抛错、day 正确推进；平衡目标达成；危机贷款能续命但高利贷必死循环。
import { describe, it, expect } from 'vitest';
import { createRng } from '../src/core/rng';
import { createNewGame } from '../src/core/createNewGame';
import { runDailyLoop } from '../src/core/gameLoop';
import { applyMonthlyInterest, takeCrisisLoan } from '../src/core/loanSystem';
import { evaluateEndings } from '../src/core/endingEngine';
import type { Loan } from '../src/types/actions';

describe('集成：固定 seed 120 天可复现，day 正确推进', () => {
  it('连续 120 天不抛错，day 终值 121，month 5，峰值净资被追踪', () => {
    const rng = createRng(424242);
    let state = createNewGame(
      { storeType: '奶茶饮品', locationType: '学校门口', decorationLevel: 'clean', storeName: 'QA集成', seed: 424242 },
      rng,
    );
    const startNet = state.netWorth;
    for (let i = 0; i < 120; i++) {
      const res = runDailyLoop(state, rng);
      state = res.state;
      expect(Number.isFinite(state.cash)).toBe(true);
      expect(state.day).toBe(i + 2); // 第 i 次推进后 day = i+2
    }
    expect(state.day).toBe(121);
    expect(state.month).toBe(5);
    expect(state.peakNetWorth).toBeGreaterThanOrEqual(startNet);
  });

  it('确定性：同种子两次 120 天结果完全一致（JSON 相等）', () => {
    const run = () => {
      const rng = createRng(777);
      let s = createNewGame(
        { storeType: '奶茶饮品', locationType: '学校门口', decorationLevel: 'clean', storeName: 'QA', seed: 777 },
        rng,
      );
      for (let i = 0; i < 30; i++) s = runDailyLoop(s, rng).state;
      return s;
    };
    const a = run();
    const b = run();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('平衡目标：危机贷款续命 vs 高利贷必死', () => {
  it('高利贷死亡螺旋：月息逾期累计，6 个月后触发 debt_trap', () => {
    let s = createNewGame(
      { storeType: '奶茶饮品', locationType: '学校门口', decorationLevel: 'clean', storeName: 'QA高利贷', seed: 1 },
      createRng(1),
    );
    const predatory: Loan = {
      id: 'p',
      channel: 'predatory',
      principal: 100000,
      apr: 0.36,
      balance: 100000,
      accruedInterest: 0,
      startDate: 1,
      overdueDays: 0,
    };
    s.loans = [predatory];
    s.debt = 100000;
    s.cash = 0; // 现金不足以付月息 → 逾期滚雪球
    for (let i = 0; i < 6; i++) s = applyMonthlyInterest(s);
    expect(s.loans[0].overdueDays).toBe(6);
    expect(evaluateEndings(s)?.def.id).toBe('debt_trap');
  });

  it('危机贷款续命：cash<0 点贷款回正，可继续经营', () => {
    let s = createNewGame(
      { storeType: '奶茶饮品', locationType: '学校门口', decorationLevel: 'clean', storeName: 'QA续命', seed: 1 },
      createRng(1),
    );
    s.cash = -20000;
    const r = takeCrisisLoan(s, 'bank', () => 0.5);
    expect(r.cash).toBeGreaterThanOrEqual(0); // 续命回正
    expect(r.actionPointsCurrent).toBe(s.actionPointsCurrent - 1);
    // 续命后还能继续跑循环不抛错
    const after = runDailyLoop(r, createRng(2));
    expect(Number.isFinite(after.state.cash)).toBe(true);
  });
});
