// 修正累加器：把「决策 effects + 事件 effects」聚合进 DayModifiers（架构 §5.2）
import type {
  DayModifiers,
  DecisionState,
  EffectObject,
  GameState,
  HiddenLines,
  SoftHidden,
} from '../types';
import type { DecisionCategory } from '../data/decisionOptions';
import { getDecisionEffects } from '../data/decisionOptions';

/** 空修正累加器。 */
export function emptyModifiers(): DayModifiers {
  return {
    exposurePct: 0,
    dineInExposurePct: 0,
    deliveryExposurePct: 0,
    entryRatePct: 0,
    conversionRatePct: 0,
    repurchaseRatePct: 0,
    avgOrderValuePct: 0,
    marginPct: 0,
    revenuePct: 0,
    ordersPct: 0,
    deliveryOrdersPct: 0,
    staffCostAdd: 0,
    staffCostPct: 0,
    promoCostAdd: 0,
    rentPct: 0,
    platformCostPct: 0,
    miscCostAdd: 0, // 房东日摊杂费等偶发固定成本（暗线耦合，§2.2）
    efficiencyPct: 0,
    ratingAdd: 0,
    creditAdd: 0,
    cashAdd: 0,
    accountsPayableAdd: 0,
    ownerFatigueAdd: 0,
    hidden: {},
    soft: {},
  };
}

/** 深拷贝（hidden/soft 为嵌套对象）。 */
export function cloneModifiers(m: DayModifiers): DayModifiers {
  return {
    ...m,
    hidden: { ...m.hidden },
    soft: { ...m.soft },
  };
}

/**
 * 把单个 EffectObject 的「当日结算修正」字段累加进 mods。
 * 仅处理 Pct/成本类；cash/隐藏暗线/软暗线/持久字段等由 effectResolver.applyEffects 处理。
 */
export function addEffectModifiers(mods: DayModifiers, eff: EffectObject): DayModifiers {
  const m = cloneModifiers(mods);
  m.exposurePct += eff.exposurePct ?? 0;
  m.dineInExposurePct += eff.dineInExposurePct ?? 0;
  m.deliveryExposurePct += eff.deliveryExposurePct ?? 0;
  m.entryRatePct += eff.entryRatePct ?? 0;
  m.conversionRatePct += eff.conversionRatePct ?? 0;
  m.repurchaseRatePct += eff.repurchaseRatePct ?? 0;
  m.avgOrderValuePct += eff.avgOrderValuePct ?? 0;
  m.marginPct += eff.marginPct ?? 0;
  m.revenuePct += eff.revenuePct ?? 0;
  m.ordersPct += eff.ordersPct ?? 0;
  m.deliveryOrdersPct += eff.deliveryOrdersPct ?? 0;
  m.staffCostAdd += eff.staffCost ?? 0;
  m.staffCostPct += eff.staffCostPct ?? 0;
  m.promoCostAdd += eff.promoCost ?? 0;
  m.platformCostPct += eff.platformCostPct ?? 0;
  m.miscCostAdd += eff.miscCostAdd ?? 0;
  return m;
}

/**
 * 把暗线派生惩罚（deriveDailyPenalties 的输出）合并进当日修正。
 * 仅累加与暗线相关的数值字段，不影响其它决策/事件修正。
 */
export function addPenaltyModifiers(mods: DayModifiers, pen: DayModifiers): DayModifiers {
  const m = cloneModifiers(mods);
  m.marginPct += pen.marginPct;
  m.ordersPct += pen.ordersPct;
  m.conversionRatePct += pen.conversionRatePct;
  m.platformCostPct += pen.platformCostPct;
  m.entryRatePct += pen.entryRatePct;
  m.repurchaseRatePct += pen.repurchaseRatePct;
  m.miscCostAdd += pen.miscCostAdd;
  return m;
}

/**
 * 把五项决策的 effects 累加进 mods。
 * 注意：决策 effects 既含 Pct（当日），也含 hidden/soft 等（即时持久）。
 * Pct 部分在此累加进 mods；hidden/soft 等即时部分在玩家「做出决策」时由 applyEffects 一次性作用。
 */
export function addDecisionModifiers(
  mods: DayModifiers,
  decisions: DecisionState,
): DayModifiers {
  let m = mods;
  const categories: DecisionCategory[] = [
    'supplierTier',
    'priceStrategy',
    'promotionTier',
    'staffTier',
  ];
  const ids: string[] = [
    decisions.supplierTier,
    decisions.priceStrategy,
    decisions.promotionTier,
    decisions.staffTier,
  ];
  categories.forEach((cat, i) => {
    const eff = getDecisionEffects(cat, ids[i]);
    m = addEffectModifiers(m, eff);
  });
  return m;
}

/**
 * 构建当日完整修正：事件 Pct（state.dayModifiers）+ 决策 Pct + 持续效果（tempModifiers）。
 */
export function buildDailyModifiers(
  state: GameState,
  decisions: DecisionState,
): DayModifiers {
  let m = cloneModifiers(state.dayModifiers);
  m = addDecisionModifiers(m, decisions);
  for (const tm of state.tempModifiers) {
    if (state.day <= tm.expiresDay) {
      m = addEffectModifiers(m, tm.effects);
    }
  }
  return m;
}

/** 工具：合并 hidden 增量。 */
export function addHidden(
  target: Partial<Record<keyof HiddenLines, number>>,
  src: Partial<Record<keyof HiddenLines, number>>,
): void {
  (Object.keys(src) as (keyof HiddenLines)[]).forEach((k) => {
    target[k] = (target[k] ?? 0) + (src[k] ?? 0);
  });
}

/** 工具：合并 soft 增量。 */
export function addSoft(
  target: Partial<Record<keyof SoftHidden, number>>,
  src: Partial<Record<keyof SoftHidden, number>>,
): void {
  (Object.keys(src) as (keyof SoftHidden)[]).forEach((k) => {
    target[k] = (target[k] ?? 0) + (src[k] ?? 0);
  });
}
