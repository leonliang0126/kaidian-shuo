// 客流展示映射（T01 · 客流波动 UI 层）
// 档位分类由 trafficPatterns.getTrafficLevel 统一完成（阈值常量只在 trafficPatterns 定义），
// 本层仅做「档位 → 展示内容」的映射，不重复任何 1.2 / 0.8 阈值。
import type { TrafficLevel } from '../data/trafficPatterns';

/** 客流 pill 的展示内容 */
export interface TrafficPillContent {
  emoji: string;
  text: string;
  className: string;
}

/** 根据档位与是否周末，返回 pill 的 emoji、文案与配色类名。 */
export function getTrafficPillContent(
  level: TrafficLevel,
  isWeekendFlag: boolean,
): TrafficPillContent {
  if (level === 'surge') {
    return isWeekendFlag
      ? { emoji: '🔥', text: '周末客流暴增', className: 'bg-orange-100 text-orange-600' }
      : { emoji: '📈', text: '工作日高峰', className: 'bg-orange-100 text-orange-600' };
  }
  if (level === 'normal') {
    return { emoji: '😐', text: '客流平稳', className: 'bg-zinc-100 text-zinc-600' };
  }
  return { emoji: '😴', text: '客流清淡', className: 'bg-blue-100 text-blue-600' };
}

/** 把预估到店人数格式化为中文文案。 */
export function formatEstimatedCount(n: number): string {
  return `预估到店 ~${Math.round(n).toLocaleString('zh-CN')} 人`;
}

/** 档位配色（供 5×5 矩阵着色复用）。 */
export function levelClassName(level: TrafficLevel): string {
  switch (level) {
    case 'surge':
      return 'bg-orange-100 text-orange-600';
    case 'normal':
      return 'bg-zinc-100 text-zinc-600';
    case 'quiet':
    default:
      return 'bg-blue-100 text-blue-600';
  }
}
