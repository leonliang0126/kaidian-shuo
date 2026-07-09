// 暗线→结算耦合（增量设计 v2 §2）。
// 提供两套落点：
//  1) deriveDailyPenalties：纯函数、无 rng，把隐藏暗线换算成每日 Pct/成本增量（在结算时叠加）。
//  2) applyHiddenLineDailyHits：阈值触发的偶发重罚（现金罚款 + 评级下滑 + 日志），带 rng 可复现。
import type { DayModifiers, GameState, HiddenLines } from '../types';
import type { RNG } from './rng';
import { clamp } from '../utils/constants';
import { emptyModifiers } from './modifiers';
import { cloneState } from './effectResolver';

/** 阈值斜坡：v 低于 t 时为 0，到 100 时为 1。 */
export function ramp(v: number, t: number): number {
  return clamp((v - t) / (100 - t), 0, 1);
}

/** 信任低度：信任低于 50 时为正值（50 中性）。 */
export function lowTrust(v: number): number {
  return clamp((50 - v) / 50, 0, 1);
}

/** 偶发重罚所需的门店上下文（房东日摊杂费依赖月租）。 */
export interface PenaltyCtx {
  rent: number;
}

/**
 * 把隐藏暗线换算为每日结算修正累加器。
 * - init 态（hidden 全 0、customerTrust=50）返回全 0，因此现有结算契约测试（init 态）不破。
 * - 纯函数、无 rng、可断言。
 */
export function deriveDailyPenalties(h: HiddenLines, ctx: PenaltyCtx): DayModifiers {
  const m = emptyModifiers();

  // —— supplyRisk：毛利损耗 + 慢性缺货（订单少）——
  m.marginPct -= 0.08 * h.supplyRisk; // 满 100 → -8pp 毛利
  m.ordersPct -= 0.04 * h.supplyRisk; // 满 100 → -4% 订单（慢性缺货）

  // —— hygieneRisk：卫生差→转化掉（评级下滑由 dailyHits 处理）——
  m.conversionRatePct -= 6 * ramp(h.hygieneRisk, 30); // 满 100 → -6pp 转化

  // —— platformDependence：平台抽成上升 ——
  m.platformCostPct += 8 * ramp(h.platformDependence, 40); // 满 100 → 平台成本 ×1.08

  // —— customerTrust：直接作用于进店/复购/转化（50 为中性）——
  // 采用设计文档 §2.2 的权威系数；仅当信任偏离 50 时才生效，init 态（=50）净增量为 0。
  const td = h.customerTrust - 50; // [-50, +50]
  m.entryRatePct += 0.1 * td; // ±5pp 进店
  m.repurchaseRatePct += 0.15 * td; // ±7.5pp 复购
  m.conversionRatePct += 0.05 * td; // ±2.5pp 转化

  // —— promoHype 虚火：高虚火且信任低 → 进店被撑高、转化受罚 ——
  const hype = ramp(h.promoHype, 40);
  const lt = lowTrust(h.customerTrust);
  m.entryRatePct += 10 * hype; // 最多 +10pp 进店（来看热闹）
  m.conversionRatePct -= 12 * hype * lt; // 最多 -12pp 转化（不买）

  // —— landlordAttention：日常找茬杂费（阈值以上才咬，按租金 1%/天 封顶，设计文档 §2.2）——
  if (h.landlordAttention > 40) {
    m.miscCostAdd += ((h.landlordAttention - 40) / 60) * ctx.rent * 0.01; // 满 100 → +1% 月租/天
  }

  return m;
}

/** 偶发重罚日志条目。 */
export interface HiddenHitLog {
  day: number;
  line: keyof HiddenLines | 'ownerFatigue';
  kind: 'shortage' | 'foodSafety' | 'landlord' | 'burnout' | 'rating';
  cashDelta: number;
  note: string;
}

/**
 * 阈值触发的偶发重罚（走现金 + 评级 + 日志）。
 * 在 gameLoop/endDay 结算后调用：扣现金罚款、主店/分店评级下滑、写日志。
 * 带 rng，固定 seed 可复现。
 */
export function applyHiddenLineDailyHits(
  state: GameState,
  rng: RNG,
): { state: GameState; logs: HiddenHitLog[] } {
  let s = cloneState(state);
  const logs: HiddenHitLog[] = [];
  const main = s.stores[0];
  const rent = main?.rent ?? 0;

  // (a) 卫生：主店+分店评级逐日下滑（连续、确定性）
  const hygieneDecline = ramp(s.hiddenLines.hygieneRisk, 30) * 1.0; // 满 100 → -1.0/天
  if (hygieneDecline > 0) {
    s.stores = s.stores.map((st) => ({
      ...st,
      rating: clamp(st.rating - hygieneDecline, 0, 100),
    }));
    s.brandRating = s.stores[0].rating;
  }

  const roll = rng();

  // (b) 供应链隐患>70：偶发"到货短缺/食材损耗"
  if (s.hiddenLines.supplyRisk > 70 && roll < 0.15) {
    const fine = Math.round(rent * 0.05);
    s.cash -= fine;
    logs.push({
      day: s.day,
      line: 'supplyRisk',
      kind: 'shortage',
      cashDelta: -fine,
      note: '供应商到货短缺，部分食材损耗',
    });
  }
  // (c) 卫生>60：偶发"食安罚款"
  else if (s.hiddenLines.hygieneRisk > 60 && rng() < 0.12) {
    const fine = Math.round(rent * 0.1);
    s.cash -= fine;
    s.stores[0].rating = clamp(s.stores[0].rating - 3, 0, 100);
    logs.push({
      day: s.day,
      line: 'hygieneRisk',
      kind: 'foodSafety',
      cashDelta: -fine,
      note: '卫生抽检不合格，食安罚款',
    });
  }
  // (d) 房东关注>50：偶发"房东找茬"
  else if (s.hiddenLines.landlordAttention > 50 && rng() < 0.12) {
    const fine = Math.round(rent * 0.06);
    s.cash -= fine;
    logs.push({
      day: s.day,
      line: 'landlordAttention',
      kind: 'landlord',
      cashDelta: -fine,
      note: '房东上门找茬，额外杂费',
    });
  }
  // (e) 人力崩：ownerFatigue>85 或 employeePressure>70 → "累垮/罢工"
  else if (
    (s.softHidden.ownerFatigue > 85 || s.hiddenLines.employeePressure > 70) &&
    rng() < 0.1
  ) {
    const fine = 800;
    s.cash -= fine;
    logs.push({
      day: s.day,
      line: 'ownerFatigue',
      kind: 'burnout',
      cashDelta: -fine,
      note: '人手崩了，临时顶班/误工赔付',
    });
  }

  return { state: s, logs };
}
