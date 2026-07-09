// 通用 effect 解析器（核心）：applyEffects(state, eff, rng)
// 所有「改状态」的入口。即时/持久字段直接作用到 state；当日 Pct 字段累加进 state.dayModifiers。
import type { EffectObject, GameState } from '../types';
import type { RNG } from './rng';
import { addEffectModifiers, cloneModifiers } from './modifiers';
import { resolveFutureEffect, resolveUnlock } from './futureEffect';
import { clamp } from '../utils/constants';
import { getStaffCapacity } from '../data/decisionOptions';

/** 深拷贝游戏状态（仅克隆会被修改的嵌套结构）。 */
export function cloneState(s: GameState): GameState {
  return {
    ...s,
    hiddenLines: { ...s.hiddenLines },
    softHidden: { ...s.softHidden },
    stores: s.stores.map((st) => ({ ...st })),
    eventHistory: [...s.eventHistory],
    businessLog: [...s.businessLog],
    windMessages: [...s.windMessages],
    pendingEffects: s.pendingEffects.map((p) => ({ ...p, effects: { ...p.effects } })),
    tempModifiers: s.tempModifiers.map((t) => ({ ...t, effects: { ...t.effects } })),
    dayModifiers: cloneModifiers(s.dayModifiers),
    activeCooldowns: { ...s.activeCooldowns },
    unlockedRoutes: [...s.unlockedRoutes],
    endingsUnlocked: [...s.endingsUnlocked],
    decisions: { ...s.decisions },
    lastSettlement: s.lastSettlement ? { ...s.lastSettlement } : undefined,
  };
}

/** 提取 EffectObject 中的「当日 Pct/成本」字段（用于 durationDays 临时效果）。 */
function extractPctFields(eff: EffectObject): EffectObject {
  const out: EffectObject = {};
  const keys: (keyof EffectObject)[] = [
    'exposurePct',
    'dineInExposurePct',
    'deliveryExposurePct',
    'entryRatePct',
    'conversionRatePct',
    'repurchaseRatePct',
    'avgOrderValuePct',
    'marginPct',
    'revenuePct',
    'ordersPct',
    'deliveryOrdersPct',
    'promoCost',
    'staffCost',
    'staffCostPct',
    'platformCostPct',
  ];
  keys.forEach((k) => {
    const v = eff[k];
    if (typeof v === 'number') (out as Record<string, number>)[k as string] = v;
  });
  return out;
}

/** 解析现金令牌（架构 §6.3）。 */
function resolveCashValue(cash: number | string, store: GameState['stores'][number]): number {
  if (typeof cash === 'number') return cash;
  switch (cash) {
    case '-1_month_rent':
      return -store.rent;
    case '+half_month_rent':
      return store.rent / 2;
    case '-deposit':
      return -store.deposit;
    default: {
      const n = Number(cash);
      return Number.isFinite(n) ? n : 0;
    }
  }
}

/**
 * 软效果文本 → 近似 EffectObject（架构 §6.5）。
 * 用注入的 rng 做确定性分支，覆盖数据中出现的结构化表述。
 */
export function resolveRandom(text: string, rng: RNG): EffectObject {
  const roll = rng();
  switch (text) {
    case '50%涨幅降至8%；30%无效；20% landlordAttention +15':
      if (roll < 0.5) return { rentPct: 8 };
      if (roll < 0.8) return {};
      return { hidden: { landlordAttention: 15 } };
    case '成功则现金压力较低；失败 landlordAttention +5':
      if (roll < 0.5) return { cash: 3000 };
      return { hidden: { landlordAttention: 5 } };
    case '信用好则现金压力下降；失败 supplyRisk +8':
      if (roll < 0.5) return { cash: 3000 };
      return { hidden: { supplyRisk: 8 } };
    case '50% exposure +15%':
      if (roll < 0.5) return { exposurePct: 15 };
      return {};
    case '可能无效':
      if (roll < 0.5) return {};
      return { hidden: { promoHype: -3 } };
    case '可能小火，也可能争议':
      if (roll < 0.5) return { exposurePct: 20, hidden: { promoHype: 5 } };
      return { hidden: { priceControversy: 8 } };
    case '可能反噬':
      if (roll < 0.5) return { exposurePct: 10, hidden: { promoHype: 5 } };
      return { hidden: { customerTrust: -8, promoHype: 10 } };
    case '50%通过；失败停业':
      if (roll < 0.5) return { hidden: { hygieneRisk: -10 } };
      return { revenuePct: -100, hidden: { hygieneRisk: 5 } };
    case '成功则延后支付；失败 landlordAttention +20':
      if (roll < 0.5) return { cash: 5000 };
      return { hidden: { landlordAttention: 20 } };
    case '可能翻盘，也可能暴雷':
      if (roll < 0.5) return { revenuePct: 30, promoCost: -1000 };
      return { hidden: { promoHype: 15 }, rating: -3 };
    default:
      // 兜底：未识别文本 → 合理近似，二选一
      if (roll < 0.5) return { exposurePct: 10 };
      return { hidden: { customerTrust: -5 } };
  }
}

/** 命名冷却 → 持续天数。 */
function cooldownDuration(key: string): number {
  const m = key.match(/(\d+)/);
  return m ? Number(m[1]) : 60;
}

/**
 * 应用一个 EffectObject 到 GameState。
 * @param accumulateMods 是否把当日 Pct 累加进 state.dayModifiers（事件=true，决策=false）。
 * @param source 来源标识（事件 id:optionId），用于日志/冷却上下文。
 */
export function applyEffects(
  state: GameState,
  eff: EffectObject,
  rng: RNG,
  opts: { accumulateMods?: boolean; source?: string } = {},
): GameState {
  const accumulateMods = opts.accumulateMods ?? true;
  const source = opts.source ?? 'effect';
  const s = cloneState(state);
  const main = s.stores[0];

  // —— 现金（含令牌）——
  if (eff.cash !== undefined) {
    s.cash += resolveCashValue(eff.cash, main);
  }

  // —— 隐藏暗线 ——
  if (eff.hidden) {
    (Object.keys(eff.hidden) as (keyof typeof eff.hidden)[]).forEach((k) => {
      const v = eff.hidden![k] ?? 0;
      s.hiddenLines[k] = clamp(s.hiddenLines[k] + v, 0, 100);
    });
  }

  // —— 软暗线 ——
  if (eff.soft) {
    (Object.keys(eff.soft) as (keyof typeof eff.soft)[]).forEach((k) => {
      const v = eff.soft![k] ?? 0;
      s.softHidden[k] = clamp(s.softHidden[k] + v, 0, 100);
    });
  }

  // —— 评分（0-100 内部，作用于主店）——
  if (typeof eff.rating === 'number') {
    main.rating = clamp(main.rating + eff.rating, 0, 100);
  }

  // —— 信用 ——
  if (typeof eff.credit === 'number') {
    s.credit = clamp(s.credit + eff.credit, 0, 100);
  }

  // —— 应付账款 ——
  if (typeof eff.accountsPayable === 'number') {
    s.accountsPayable += eff.accountsPayable;
  }

  // —— 借款负债（即时累加，夹紧 ≥0）——
  if (typeof eff.debt === 'number') {
    s.debt = Math.max(0, s.debt + eff.debt);
  }

  // —— 月供（即时累加，夹紧 ≥0）——
  if (typeof eff.monthlyRepayment === 'number') {
    s.monthlyRepayment = Math.max(0, s.monthlyRepayment + eff.monthlyRepayment);
  }

  // —— 租金（持久）——
  if (typeof eff.rentPct === 'number') {
    main.rent = Math.round(main.rent * (1 + eff.rentPct / 100));
  }

  // —— 效率（持久）——
  if (typeof eff.efficiencyPct === 'number') {
    main.efficiency = clamp(main.efficiency * (1 + eff.efficiencyPct / 100), 0, 100);
    main.capacity = Math.round(getStaffCapacity(main.staffTier) * (main.efficiency / 100));
  }

  // —— 软暗线顶层的独立字段 ——
  const softTop = [
    'ownerFatigue',
    'stability',
    'wasteRisk',
    'qualityVariance',
    'landlordPatience',
    'accountingErrorRisk',
  ] as const;
  softTop.forEach((k) => {
    const v = eff[k];
    if (typeof v === 'number') {
      s.softHidden[k] = clamp(s.softHidden[k] + v, 0, 100);
    }
  });

  // —— 随机软效果 ——
  if (eff.random) {
    const resolved = resolveRandom(eff.random, rng);
    return applyEffects(s, resolved, rng, { accumulateMods: false, source });
  }

  // —— 未来效果 ——
  if (eff.futureEffect) {
    const fe = resolveFutureEffect(eff.futureEffect);
    if (fe) {
      s.pendingEffects.push({
        applyAtDay: s.day + fe.applyAtDayOffset,
        source,
        effects: fe.effects,
        label: eff.futureEffect,
      });
    }
  }

  // —— 解锁路线 ——
  if (eff.unlock) {
    const key = resolveUnlock(eff.unlock);
    if (key && !s.unlockedRoutes.includes(key)) {
      s.unlockedRoutes.push(key);
    }
  }

  // —— 持续 N 天的临时效果 ——
  if (typeof eff.durationDays === 'number') {
    const pct = extractPctFields(eff);
    s.tempModifiers.push({
      expiresDay: s.day + eff.durationDays,
      effects: pct,
      label: `持续${eff.durationDays}天效果`,
    });
    // 注意：durationDays 的 Pct 由 tempModifier 在持续期内每日叠加，不再写入 dayModifiers
  } else if (accumulateMods) {
    // —— 当日 Pct/成本 累加进 dayModifiers（供今日结算）——
    s.dayModifiers = addEffectModifiers(s.dayModifiers, eff);
  }

  // —— 结局 ——
  if (eff.ending) {
    s.activeEnding = eff.ending;
    if (!s.endingsUnlocked.includes(eff.ending)) {
      s.endingsUnlocked.push(eff.ending);
    }
  }

  // —— 命名冷却 ——
  if (eff.cooldown) {
    s.activeCooldowns[eff.cooldown] = s.day + cooldownDuration(eff.cooldown);
  }

  return s;
}

/** 新一天开始时应用到期的 pendingEffects（架构 §6.5）。 */
export function applyDuePendingEffects(state: GameState): GameState {
  let s = state;
  const due = s.pendingEffects.filter((p) => s.day >= p.applyAtDay);
  if (due.length === 0) {
    // 仍然清掉过期项（保活）
    if (s.pendingEffects.some((p) => s.day > p.applyAtDay)) {
      s = { ...s, pendingEffects: s.pendingEffects.filter((p) => s.day <= p.applyAtDay) };
    }
    return s;
  }
  for (const p of due) {
    s = applyEffects(s, p.effects, () => 0.5, { accumulateMods: true, source: p.source });
  }
  s = { ...s, pendingEffects: s.pendingEffects.filter((p) => s.day < p.applyAtDay) };
  return s;
}
