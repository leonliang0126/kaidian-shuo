// 金额/百分比/日期格式化助手
import type { StoreState } from '../types';

/**
 * 与 ICU 无关的千分位分组：避免依赖 webview 的本地化数据。
 * 部分移动端内嵌 webview（微信/QQ 等）缺少 zh-CN 的 ICU 数据，
 * Number.prototype.toLocaleString('zh-CN') 会抛 RangeError 导致整页白屏。
 */
function groupThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 整数千分位：1234567 -> "1,234,567"（与 locale 无关，绝不抛错） */
export function fmtInt(n: number): string {
  const v = Math.round(Math.abs(n));
  const sign = n < 0 ? '-' : '';
  return `${sign}${groupThousands(String(v))}`;
}

/** 金额格式：¥1,234 */
export function fmtMoney(n: number): string {
  return `¥${fmtInt(n)}`;
}

/** 带正负号金额：+¥1,234 / -¥1,234 */
export function fmtSignedMoney(n: number): string {
  if (n > 0) return `+${fmtMoney(n)}`;
  return fmtMoney(n);
}

/** 百分比：0.1234 → 12.3% */
export function fmtPct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}

/** 星级显示：rating(0-100) / 20，clamp 0-5.0（架构 §10.8） */
export function ratingToStars(rating: number): string {
  const stars = Math.max(0, Math.min(5, rating / 20));
  return stars.toFixed(1);
}

/** 第 X 天｜第 Y 月 */
export function fmtDayMonth(day: number, month: number): string {
  return `第 ${day} 天｜第 ${month} 月`;
}

/** 现金占净资产百分比等，按需补充 */
export function storeSummary(store: StoreState): string {
  return `${store.name}（${store.storeType}·${store.locationType}）`;
}
