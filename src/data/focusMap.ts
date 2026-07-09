// 经营重点修正映射（数据驱动）：focus.modifiers 的键 → 对行动明线/暗线/成本的语义。
import type { DayModifiers, HiddenLines } from '../types';
import type { ActionCategory, ActionEffects, FocusDef, FocusModifiers } from '../types/actions';
import { getFocus } from './focusDefs';
import { emptyActionEffects } from './actionScale';

export interface FocusModifierMeta {
  type: 'categoryVisibleMult' | 'categoryHiddenAdd' | 'costMultiplier' | 'hiddenGain';
  category?: ActionCategory; // categoryVisibleMult / categoryHiddenAdd 限定分类
  fields?: (keyof DayModifiers)[]; // categoryVisibleMult 作用的明线字段
  hiddenKey?: keyof HiddenLines; // categoryHiddenAdd / hiddenGain 作用的暗线键
  base?: number; // 每单位 v 的缩放基数（用于 hiddenGain 等的数值换算）
}

// focus.modifiers 键 → 语义元数据（数据驱动；v 来自 focus 数据本身）。
export const FOCUS_MODIFIER_META: Record<string, FocusModifierMeta> = {
  promotionEffect: { type: 'categoryVisibleMult', category: '拉客流', fields: ['exposurePct', 'ordersPct', 'deliveryOrdersPct'] },
  employeePressureGain: { type: 'categoryHiddenAdd', category: '拉客流', hiddenKey: 'employeePressure', base: 20 },
  handleBadReviewsEffect: { type: 'categoryVisibleMult', category: '稳口碑', fields: ['ratingAdd', 'conversionRatePct'] },
  trainingEffect: { type: 'categoryVisibleMult', category: '管员工', fields: ['ordersPct', 'conversionRatePct'] },
  costMultiplier: { type: 'costMultiplier' },
  supplierNegotiationEffect: { type: 'categoryVisibleMult', category: '谈资源', fields: ['promoCostAdd', 'marginPct'] },
  inventoryEffect: { type: 'categoryVisibleMult', category: '控风险', fields: ['marginPct', 'ordersPct'] },
  loyalCustomerEffect: { type: 'categoryVisibleMult', category: '稳口碑', fields: ['repurchaseRatePct'] },
  exposureGrowth: { type: 'categoryVisibleMult', category: '拉客流', fields: ['exposurePct', 'ordersPct'] },
  maintenanceEffect: { type: 'categoryVisibleMult', category: '控风险', fields: ['marginPct', 'miscCostAdd'] },
  hygieneCheckEffect: { type: 'categoryVisibleMult', category: '控风险', fields: ['ratingAdd', 'conversionRatePct'] },
  hypeGain: { type: 'hiddenGain', hiddenKey: 'promoHype', base: 20 },
  revenueGrowth: { type: 'categoryVisibleMult', category: '拉客流', fields: ['revenuePct', 'ordersPct'] },
  landlordAttentionGain: { type: 'hiddenGain', hiddenKey: 'landlordAttention', base: 20 },
  trustGain: { type: 'hiddenGain', hiddenKey: 'customerTrust', base: 20 },
  wasteCost: { type: 'costMultiplier' },
};

/** 读取某重点的解析后修正描述（供 UI 展示）。 */
export function getFocusModifiers(focusId: string | null): FocusModifiers {
  const focus = getFocus(focusId);
  if (!focus) return {};
  const result: FocusModifiers = {};
  const catMult: NonNullable<FocusModifiers['categoryVisibleMult']> = [];
  const hiddenGain: NonNullable<FocusModifiers['hiddenGain']> = [];
  for (const [key, v] of Object.entries(focus.modifiers)) {
    const meta = FOCUS_MODIFIER_META[key];
    if (!meta) continue;
    if (meta.type === 'categoryVisibleMult' && meta.category && meta.fields) {
      catMult.push({ category: meta.category, fields: meta.fields, mult: v });
    } else if (meta.type === 'categoryHiddenAdd' && meta.category && meta.hiddenKey) {
      hiddenGain.push({ key: meta.hiddenKey, amount: v * (meta.base ?? 1) });
    } else if (meta.type === 'costMultiplier') {
      result.costMultiplier = (result.costMultiplier ?? 1) * (1 + v);
    } else if (meta.type === 'hiddenGain' && meta.hiddenKey) {
      hiddenGain.push({ key: meta.hiddenKey, amount: v * (meta.base ?? 1) });
    }
  }
  if (catMult.length) result.categoryVisibleMult = catMult;
  if (hiddenGain.length) result.hiddenGain = hiddenGain;
  return result;
}

function cloneEffects(e: ActionEffects): ActionEffects {
  return {
    mods: { ...e.mods, hidden: { ...e.mods.hidden }, soft: { ...e.mods.soft } },
    hidden: { ...e.hidden },
    soft: { ...e.soft },
    credit: e.credit,
    eventWeights: { ...e.eventWeights },
    windMessages: [...e.windMessages],
    costMultiplier: e.costMultiplier,
  };
}

/**
 * 把经营重点修正作用到一份行动效果上。
 * @param base 行动翻译后的基础效果
 * @param focusId 当前经营重点 id（null 表示无）
 * @param actionCategory 该行动的分类（用于分类限定的修正）
 */
export function applyFocusToAction(
  base: ActionEffects,
  focusId: string | null,
  actionCategory: ActionCategory,
): ActionEffects {
  const focus: FocusDef | undefined = getFocus(focusId);
  if (!focus) return base;
  const result = cloneEffects(base);
  for (const [key, v] of Object.entries(focus.modifiers)) {
    const meta = FOCUS_MODIFIER_META[key];
    if (!meta) continue;
    switch (meta.type) {
      case 'categoryVisibleMult': {
        if (meta.category === actionCategory && meta.fields) {
          const mult = 1 + v;
          for (const f of meta.fields) {
            (result.mods as unknown as Record<string, number>)[f] =
              ((result.mods as unknown as Record<string, number>)[f] ?? 0) * mult;
          }
        }
        break;
      }
      case 'categoryHiddenAdd': {
        if (meta.category === actionCategory && meta.hiddenKey) {
          const amt = v * (meta.base ?? 1);
          result.hidden[meta.hiddenKey] = (result.hidden[meta.hiddenKey] ?? 0) + amt;
        }
        break;
      }
      case 'costMultiplier': {
        result.costMultiplier = (result.costMultiplier ?? 1) * (1 + v);
        break;
      }
      case 'hiddenGain': {
        if (meta.hiddenKey) {
          const amt = v * (meta.base ?? 1);
          result.hidden[meta.hiddenKey] = (result.hidden[meta.hiddenKey] ?? 0) + amt;
        }
        break;
      }
    }
  }
  return result;
}

export { emptyActionEffects };
