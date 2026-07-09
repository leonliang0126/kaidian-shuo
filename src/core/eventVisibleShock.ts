// 事件当天明线冲击（架构 V3-2）：只读 event.category + level + eventShock.json，
// 计算相关明线幅度；硬砸事件腰斩某明线 + 即时现金/口碑。纯函数。
import raw from '../data/eventShock.json';
import type { EventDef, GameState, DayModifiers } from '../types';
import { emptyModifiers, addEffectModifiers } from './modifiers';
import { cloneState } from './effectResolver';
import { clamp } from '../utils/constants';

interface CatShockDef {
  metric: string;
  polarity: 'good' | 'bad';
  mag: Record<string, number>;
}
interface HardHitDef {
  metric: string;
  cashDelta: number;
  ratingDelta: number;
}
interface ShockData {
  CATEGORY_DEFAULT: Record<string, CatShockDef>;
  HARD_HIT: Record<string, HardHitDef>;
  HARD_HIT_MAGNITUDE: Record<string, number>;
}

const SHOCK = raw as unknown as ShockData;

/** 明线指标 → DayModifiers 字段（累加型）。 */
const METRIC_TO_MOD: Record<string, keyof DayModifiers> = {
  exposure: 'exposurePct',
  deliveryExposure: 'deliveryExposurePct',
  conversionRate: 'conversionRatePct',
  repurchaseRate: 'repurchaseRatePct',
  orders: 'ordersPct',
};

/** 事件等级 → 幅度档（small=1, medium=2, large/fate=3）。 */
function levelTier(level: EventDef['level']): 'small' | 'medium' | 'large' {
  if (level === 'small') return 'small';
  if (level === 'medium') return 'medium';
  return 'large';
}

export interface ShockResult {
  mods: DayModifiers;
  cashDelta: number;
  ratingDelta: number;
  hardHit: boolean;
}

/** 计算一个事件带来的当天明线冲击（只读 category+level）。 */
export function computeEventShock(event: EventDef): ShockResult {
  const mods = emptyModifiers();
  let cashDelta = 0;
  let ratingDelta = 0;
  let hardHit = false;

  if (event.category === 'forced') {
    return { mods, cashDelta, ratingDelta, hardHit };
  }

  // 1) 分类默认冲击
  const def = SHOCK.CATEGORY_DEFAULT[event.category];
  if (def) {
    const tier = levelTier(event.level);
    const mag = def.mag[tier] ?? 0;
    const sign = def.polarity === 'good' ? 1 : -1;
    if (def.metric === 'rating') {
      ratingDelta += sign * mag;
    } else     if (def.metric !== 'cash') {
      const modKey = METRIC_TO_MOD[def.metric];
      if (modKey) (mods as unknown as Record<string, number>)[modKey] += sign * mag;
    }
  }

  // 2) 硬砸清单（腰斩 + 罚款/血条）
  const hh = SHOCK.HARD_HIT[event.id];
  if (hh) {
    hardHit = true;
    cashDelta += hh.cashDelta;
    ratingDelta += hh.ratingDelta;
    const mult = SHOCK.HARD_HIT_MAGNITUDE[hh.metric];
    if (mult !== undefined && (hh.metric === 'exposure' || hh.metric === 'orders')) {
      const modKey = METRIC_TO_MOD[hh.metric];
      if (modKey) (mods as unknown as Record<string, number>)[modKey] += mult;
    }
  }

  return { mods, cashDelta, ratingDelta, hardHit };
}

/** 把事件冲击并入状态：dayModifiers 累加 + 即时现金/口碑（仅非 forced）。 */
export function applyEventShock(state: GameState, event: EventDef): GameState {
  if (event.category === 'forced') return state;
  const shock = computeEventShock(event);
  const s = cloneState(state);
  s.dayModifiers = addEffectModifiers(s.dayModifiers, shock.mods);
  if (shock.cashDelta !== 0) s.cash += shock.cashDelta;
  if (shock.ratingDelta !== 0 && s.stores[0]) {
    s.stores[0].rating = clamp(s.stores[0].rating + shock.ratingDelta, 0, 100);
    s.brandRating = s.stores[0].rating;
  }
  return s;
}
