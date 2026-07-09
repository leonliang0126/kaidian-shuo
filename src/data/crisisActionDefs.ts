// 危机行动（文本只读拷贝自 crisis-actions.v0.2.json；数值效果在此数据驱动定义）。
// 说明：bank_loan / friend_family_loan / micro_loan 为"危机贷款"，由 loanSystem 处理，
// 不在此表。本表仅覆盖其余 7 个非贷款危机行动（见 doc §5.7 / §5.1）。
import raw from './crisis-actions.v0.2.json';
import type { CrisisActionDef } from '../types/actions';
import type { EffectObject } from '../types/events';

export const CRISIS_ACTIONS = raw as unknown as CrisisActionDef[];

/** 非贷款危机行动 id → 数值效果（数据驱动，可单独校准）。 */
export const CRISIS_ACTION_EFFECTS: Record<string, EffectObject> = {
  delay_rent: {
    cash: '+half_month_rent',
    hidden: { landlordAttention: 15 },
  },
  delay_supplier_payment: {
    cash: 3000,
    hidden: { supplyRisk: 10 },
  },
  layoff: {
    cash: 2500,
    staffCost: -250,
    conversionRatePct: -3,
    soft: { stability: -3 },
    hidden: { employeePressure: -10, customerTrust: -3 },
  },
  sell_equipment: {
    cash: 5000,
    efficiencyPct: -8,
    hidden: { hygieneRisk: -2 },
  },
  clearance_sale: {
    cash: 2000,
    marginPct: -8,
    hidden: { priceControversy: 5 },
  },
  temporary_price_increase: {
    cash: 1500,
    avgOrderValuePct: 10,
    conversionRatePct: -4,
    hidden: { priceControversy: 8, customerTrust: -3 },
  },
  close_shop: {
    ending: 'decent_exit',
  },
};

/** 返回某危机行动的数值效果（贷款类返回 undefined，交由 loanSystem 处理）。 */
export function getCrisisActionEffect(id: string): EffectObject | undefined {
  return CRISIS_ACTION_EFFECTS[id];
}

/** 是否为"危机贷款"类行动（由 loanSystem 处理）。 */
export function isCrisisLoan(id: string): boolean {
  return id === 'bank_loan' || id === 'friend_family_loan' || id === 'micro_loan';
}
