// 决策选项数据（原样 import 交接包 JSON，并补充查找助手）
import raw from './decision-options.json';
import type { EffectObject } from '../types/events';

export interface DecisionOptionEntry {
  id: string;
  label: string;
  effects: EffectObject;
  initialCost?: number; // decorationLevel
  cost?: number; // promotionTier 当日成本
  dailyCost?: number; // staffTier 日成本
  capacity?: number; // staffTier 承载
  stability?: number; // supplierTier 稳定性（v3，0–1）
}

type DecisionOptionsData = Record<string, DecisionOptionEntry[]>;

// 原文件直接 import，不改内容
export const DECISION_OPTIONS = raw as unknown as DecisionOptionsData;

const CATEGORIES = [
  'supplierTier',
  'priceStrategy',
  'decorationLevel',
  'promotionTier',
] as const;

export type DecisionCategory = (typeof CATEGORIES)[number];

/** 取某个决策分类下指定 id 的选项。 */
export function getOption(
  category: DecisionCategory,
  id: string,
): DecisionOptionEntry | undefined {
  return DECISION_OPTIONS[category]?.find((o) => o.id === id);
}

/** 取某个决策选项的 effects。 */
export function getDecisionEffects(
  category: DecisionCategory,
  id: string,
): EffectObject {
  return getOption(category, id)?.effects ?? {};
}

/** 推广档位的当日成本。 */
export function getPromotionCost(id: string): number {
  return getOption('promotionTier', id)?.cost ?? 0;
}

/** 人工档位的承载上限（已废弃，保留兼容） */
export function getStaffCapacity(_id: string): number {
  return 0;
}

/** 人工档位的日成本（已废弃，保留兼容） */
export function getStaffDailyCost(_id: string): number {
  return 0;
}

/** 装修档位的初始成本。 */
export function getDecorationCost(id: string): number {
  return getOption('decorationLevel', id)?.initialCost ?? 0;
}

/** 供 UI 列出某分类的全部选项。 */
export function listOptions(category: DecisionCategory): DecisionOptionEntry[] {
  return DECISION_OPTIONS[category] ?? [];
}
