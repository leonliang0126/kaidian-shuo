// 行动符号令牌 → 数值换算表（数据驱动：所有平衡数值集中此处，逻辑函数禁止硬编码）。
import type { RNG } from '../core/rng';
import type { DayModifiers, HiddenLines, SoftHidden } from '../types';
import type { ActionEffects } from '../types/actions';

// —— 固定符号令牌 → 数值（百分点 / 绝对）——
export const TOKEN_SCALE: Record<string, number> = {
  '+tiny': 1,
  '+small': 3,
  '+medium': 8,
  '+large': 15,
  '+very_large': 30,
  '-small': -3,
  '-medium': -8,
  '-large': -15,
  'no_change': 0,
  // —— "_today" 当日变体（行动效果本就作用于当天 dayModifiers，等价处理）——
  '+small_today': 3,
  '+medium_today': 8,
  '+large_today': 15,
  '-small_today': -3,
  '-medium_today': -8,
  // —— 临时类（视为小幅修正）——
  '+temporary': 3,
  '-temporary': -3,
};

// —— chance 类令牌解析（需 rng）——
export type ChanceTokenSpec =
  | { kind: 'pos'; mag: number } // 50% 给 +mag，否则 0
  | { kind: 'neg'; mag: number } // 50% 给 -mag，否则 0
  | { kind: 'both'; mag: number } // 50% +mag，50% -mag
  | { kind: 'reroll'; mag: number }; // 在 [-mag, +mag] 间随机取整

export const CHANCE_TOKENS: Record<string, ChanceTokenSpec> = {
  chance_up: { kind: 'pos', mag: 12 },
  chance_down: { kind: 'neg', mag: 8 },
  chance_improve: { kind: 'pos', mag: 8 },
  chance_very_large_up: { kind: 'pos', mag: 30 },
  'chance_-8_or_+8': { kind: 'both', mag: 8 },
  'chance_-5': { kind: 'neg', mag: 5 },
  'chance_change': { kind: 'both', mag: 5 },
  'chance_+8': { kind: 'pos', mag: 8 },
  'chance_+6_or_-6': { kind: 'both', mag: 6 },
  'chance_+6': { kind: 'pos', mag: 6 },
  reroll: { kind: 'reroll', mag: 10 },
  // 仅用于 eventWeight 的模糊令牌（不参与 visible/hidden 数值，给 0）
  'chance_-0.15_or_+0.1': { kind: 'both', mag: 0 },
  'chance_-0.2_or_+0.15': { kind: 'both', mag: 0 },
  'chance_-0.15_or_+0.1_2': { kind: 'both', mag: 0 },
  // —— 行动 JSON 中出现的额外 chance 令牌 ——
  'chance_-10_or_+10': { kind: 'both', mag: 10 },
  'chance_down_or_no_change': { kind: 'pos', mag: 6 },
};

// —— 行动 visibleEffects 键 → DayModifiers 字段（累加型）——
// null 表示该键由其它机制（如 focus 的 exposureGrowth / cost 已由 costCash 处理）处理，跳过。
export const VISIBLE_KEY_TO_MOD: Record<string, keyof DayModifiers | null> = {
  exposure: 'exposurePct',
  newCustomers: 'exposurePct',
  dineInExposure: 'dineInExposurePct',
  deliveryExposure: 'deliveryExposurePct',
  entryRate: 'entryRatePct',
  conversionRate: 'conversionRatePct',
  repurchaseRate: 'repurchaseRatePct',
  avgOrderValue: 'avgOrderValuePct',
  margin: 'marginPct',
  revenue: 'revenuePct',
  orders: 'ordersPct',
  deliveryOrders: 'deliveryOrdersPct',
  rating: 'ratingAdd',
  promoCost: 'promoCostAdd',
  staffCost: 'staffCostAdd',
  efficiency: 'marginPct',
  capacity: 'ordersPct',
  waste: 'marginPct',
  serviceStability: 'conversionRatePct',
  ratingStability: 'ratingAdd',
  equipmentFailureRisk: 'miscCostAdd',
  shutdownRisk: 'miscCostAdd',
  netProfit: 'marginPct',
  cashPressure: 'promoCostAdd',
  complexity: 'staffCostAdd',
  menuBreadth: 'conversionRatePct',
  supplierCost: 'promoCostAdd',
  paymentTerms: 'miscCostAdd',
  supplyStability: 'conversionRatePct',
  productStability: 'marginPct',
  quality: 'avgOrderValuePct',
  cash: null,
  relocationOption: null,
  futureRentPressure: null,
  exposureGrowth: null,
  delayRisk: null,
  stockoutRisk: null,
};

// —— 暗线字母 → 落点 ——
export const HIDDEN_LETTER_TO_KEY: Record<
  string,
  { kind: 'hidden' | 'soft' | 'credit'; key: string }
> = {
  TRUST: { kind: 'hidden', key: 'customerTrust' },
  PRICE: { kind: 'hidden', key: 'priceControversy' },
  HYPE: { kind: 'hidden', key: 'promoHype' },
  LAND: { kind: 'hidden', key: 'landlordAttention' },
  STAFF: { kind: 'hidden', key: 'employeePressure' },
  BOSS_STRAIN: { kind: 'soft', key: 'ownerFatigue' },
  HYGIENE: { kind: 'hidden', key: 'hygieneRisk' },
  SUPPLY: { kind: 'hidden', key: 'supplyRisk' },
  PLATFORM: { kind: 'hidden', key: 'platformDependence' },
  CREDIT: { kind: 'credit', key: 'credit' },
};

/** 解析一个令牌为数值（固定令牌直查；chance 令牌走 rng；未知令牌返回 0 不报错）。 */
export function resolveToken(token: string, rng: RNG): number {
  if (token in TOKEN_SCALE) return TOKEN_SCALE[token];
  if (token in CHANCE_TOKENS) {
    const spec = CHANCE_TOKENS[token];
    const r = rng();
    switch (spec.kind) {
      case 'pos':
        return r < 0.5 ? spec.mag : 0;
      case 'neg':
        return r < 0.5 ? -spec.mag : 0;
      case 'both':
        return r < 0.5 ? spec.mag : -spec.mag;
      case 'reroll':
        return Math.round((rng() * 2 - 1) * spec.mag);
    }
  }
  return 0;
}

/** 创建一个空的 ActionEffects（mods 基于 emptyModifiers）。 */
export function emptyActionEffects(): ActionEffects {
  return {
    mods: {
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
      miscCostAdd: 0,
      efficiencyPct: 0,
      ratingAdd: 0,
      creditAdd: 0,
      cashAdd: 0,
      accountsPayableAdd: 0,
      ownerFatigueAdd: 0,
      hidden: {},
      soft: {},
    },
    hidden: {},
    soft: {},
    credit: 0,
    eventWeights: {},
    windMessages: [],
    costMultiplier: 1,
  };
}

export type { HiddenLines, SoftHidden };
