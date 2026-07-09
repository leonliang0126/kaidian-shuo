// B.6 月度结算：报表字段齐全 + 比例计算合理 + 月推进/重置。
import { describe, it, expect } from 'vitest';
import { createRng } from '../src/core/rng';
import { createNewGame } from '../src/core/createNewGame';
import { runMonthSettlement, applyMonthOption } from '../src/core/monthlyReport';
import { runDailyLoop } from '../src/core/gameLoop';
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

function requiredFields(report: any) {
  for (const k of [
    'month',
    'revenue',
    'grossProfit',
    'netProfit',
    'cash',
    'debt',
    'debtPressure',
    'rentRatio',
    'staffRatio',
    'promoEfficiency',
    'deliveryRatio',
    'repurchaseChange',
    'ratingChange',
    'wind',
    'options',
  ]) {
    expect(report[k]).toBeDefined();
  }
}

describe('B.6 月度报表字段与比例计算', () => {
  it('受控月度累计 → 各项比例精确成立', () => {
    const s = freshGame();
    const st = s.stores[0];
    st.monthlyRevenue = 100000;
    st.monthlyGrossProfit = 50000;
    st.monthlyNetProfit = 10000;
    st.monthlyPromoCost = 10000;
    st.monthlyDeliveryRevenue = 30000;
    st.monthlyStaffCost = 20000;
    // 学校门口 rent=12000

    const { report } = runMonthSettlement(s, () => 0.5);
    requiredFields(report);

    expect(report.revenue).toBe(100000);
    expect(report.grossProfit).toBe(50000);
    expect(report.netProfit).toBe(10000);
    expect(report.rentRatio).toBeCloseTo(12000 / 100000, 6); // 0.12
    expect(report.staffRatio).toBeCloseTo(20000 / 100000, 6); // 0.20
    expect(report.promoEfficiency).toBeCloseTo(100000 / 10000, 6); // 10
    expect(report.deliveryRatio).toBeCloseTo(30000 / 100000, 6); // 0.30
    expect(report.debtPressure).toBe('light'); // 月供 0 / 月均毛利>0
    expect(report.repurchaseChange).toBe(0);
    expect(report.ratingChange).toBe(0);
    expect(Array.isArray(report.options)).toBe(true);
    expect(report.options.length).toBeGreaterThan(0);
  });

  it('月结后月份+1，且月度累计被重置为 0', () => {
    const s = freshGame();
    s.stores[0].monthlyRevenue = 100000;
    s.stores[0].monthlyNetProfit = 10000;
    const before = s.month;
    const { state } = runMonthSettlement(s, () => 0.5);
    expect(state.month).toBe(before + 1);
    expect(state.stores[0].monthlyRevenue).toBe(0);
    expect(state.stores[0].monthlyNetProfit).toBe(0);
  });

  it('月结选项：优化→效率+5%；储备→现金转储备；关店→decent_exit', () => {
    const s = freshGame();
    s.stores[0].efficiency = 80; // 初始 100 会被 [0,100] 夹紧，先降到 80 验证 +5%
    const eff = applyMonthOption(s, 'optimize', () => 0.5);
    expect(eff.stores[0].efficiency).toBe(Math.round(80 * 1.05)); // 84

    const s2 = freshGame();
    const cashBefore = s2.cash;
    const res = applyMonthOption(s2, 'reserve', () => 0.5);
    expect(res.reserve).toBe(Math.round(cashBefore * 0.2));
    expect(res.cash).toBe(cashBefore - Math.round(cashBefore * 0.2));

    const s3 = freshGame();
    const close = applyMonthOption(s3, 'close', () => 0.5);
    expect(close.activeEnding).toBe('decent_exit');
    expect(close.endingsUnlocked).toContain('decent_exit');
  });
});

describe('B.6 第 30/60/90 天产生月结报表', () => {
  it('连续 90 天，第 30/60/90 天各产出一份字段齐全的报表', () => {
    const rng = createRng(2024);
    let state = createNewGame(
      {
        initialCashTier: 600000,
        storeType: '奶茶饮品',
        locationType: '学校门口',
        decorationLevel: 'clean',
        storeName: '模拟店',
        seed: 2024,
      },
      rng,
    );
    const reports: any[] = [];
    for (let i = 0; i < 90; i++) {
      const res = runDailyLoop(state, rng);
      state = res.state;
      if (res.monthReport) reports.push(res.monthReport);
    }
    expect(reports.length).toBe(3); // 第 30/60/90 天
    reports.forEach((r) => requiredFields(r));
    expect(state.day).toBe(91);
  });
});
