// 结局判定引擎（架构 V3-7）：单一判定表（5 v3 + 4 遗留），返回 EndingResult|null。
// 取代 core/endings.ts（其 getEnding 文本入口保留在 data/endings.ts）。纯函数。
import type { GameState } from '../types';
import type { EndingResult } from '../types/actions';
import type { EndingDef } from '../types/events';
import { getEnding } from '../data/endings';
import {
  CASH_NEGATIVE_STREAK_BANKRUPTCY,
  CHAIN_EMPIRE_STORES,
  CHAIN_EMPIRE_NET_WORTH,
  FINANCIAL_FREEDOM_NET_WORTH,
  PREDATORY_OVERDUE_DEBT_RUN,
} from '../data/endingTriggers';

function make(
  def: EndingDef,
  tone: 'win' | 'lose',
  cause: string,
  state: GameState,
): EndingResult {
  return {
    def,
    tone,
    cause,
    stats: {
      days: state.day,
      peakNetWorth: state.peakNetWorth,
      cumulativeNetProfit: state.cumulativeNetProfit,
      storeCount: state.storeCount,
      netWorth: state.netWorth,
    },
  };
}

/**
 * 评估当前应触发的结局（全部进一张判定表，阈值放 endingTriggers.ts）。
 * 首次触发门控：已解锁的结局不再重复弹出（玩家可继续经营，不强制结束存档）。
 */
export function evaluateEndings(state: GameState): EndingResult | null {
  const h = state.hiddenLines;

  // 0) 显式触发（危机/月结选项的 ending 字段）
  if (state.activeEnding) {
    const def = getEnding(state.activeEnding);
    if (def) return make(def, 'lose', `触发结局：${def.title}`, state);
  }

  // 1) 高利贷跑路（predatory 逾期）
  if (
    state.loans.some((l) => l.channel === 'predatory' && l.overdueDays >= PREDATORY_OVERDUE_DEBT_RUN)
  ) {
    const def = getEnding('debt_trap');
    if (def && !state.endingsUnlocked.includes('debt_trap')) {
      return make(def, 'lose', '高利贷逾期催收', state);
    }
  }

  // 2) 破产倒闭（现金连续为负）
  if (state.cashNegativeStreak >= CASH_NEGATIVE_STREAK_BANKRUPTCY) {
    const def = getEnding('suspended');
    if (def && !state.endingsUnlocked.includes('suspended')) {
      return make(def, 'lose', '现金流连续断裂', state);
    }
  }

  // 3) 连锁帝国（隐藏正：≥3 店 且 峰值净资 ≥ 600 万，与财务自由同口径）
  if (state.storeCount >= CHAIN_EMPIRE_STORES && state.peakNetWorth >= CHAIN_EMPIRE_NET_WORTH) {
    const def = getEnding('chain_empire');
    if (def && !state.endingsUnlocked.includes('chain_empire')) {
      return make(def, 'win', '连锁帝国达成', state);
    }
  }

  // 4) 财务自由（隐藏正：峰值净资 ≥ 1200 万）
  if (state.peakNetWorth >= FINANCIAL_FREEDOM_NET_WORTH) {
    const def = getEnding('financial_freedom');
    if (def && !state.endingsUnlocked.includes('financial_freedom')) {
      return make(def, 'win', '财务自由达成', state);
    }
  }

  // 5) 遗留失败结局（首次触发）
  const fails: { id: string; test: () => boolean }[] = [
    { id: 'landlord_win', test: () => h.landlordAttention >= 90 },
    { id: 'viral_failure', test: () => h.promoHype >= 80 && h.customerTrust <= 30 },
    {
      id: 'menu_without_supply',
      test: () => h.supplyRisk >= 80 && h.customerTrust <= 25,
    },
    {
      id: 'one_person_shop',
      test: () => state.day > 30 && state.stores.every((s) => s.staffTier === 'owner'),
    },
  ];
  for (const f of fails) {
    if (!state.endingsUnlocked.includes(f.id) && f.test()) {
      const def = getEnding(f.id);
      if (def) return make(def, 'lose', `${def.title}`, state);
    }
  }

  return null;
}
