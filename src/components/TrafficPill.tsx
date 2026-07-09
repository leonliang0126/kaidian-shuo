// 客流 pill（T02 · 核心接入）
// 在状态栏展示主店今日客流档位与预估到店人数；点击可展开 5×5 组合效果表。
import { useState } from 'react';
import {
  getTrafficWaves,
  estimateExposure,
  getTrafficLevel,
  isWeekend,
} from '../data/trafficPatterns';
import { getTrafficPillContent, formatEstimatedCount } from '../utils/trafficUI';
import { Modal } from './ui/Modal';
import TrafficComboTable from './TrafficComboTable';
import type { LocationType, StoreType } from '../types';

interface Props {
  day: number;
  locationType: LocationType;
  storeType: StoreType;
  /** 多店时显示"主店"小字 */
  showMain?: boolean;
}

export default function TrafficPill({
  day,
  locationType,
  storeType,
  showMain,
}: Props) {
  const [open, setOpen] = useState<boolean>(false);
  const waves = getTrafficWaves(day, locationType, storeType);
  const level = getTrafficLevel(waves.combined);
  const weekendFlag = isWeekend(day);
  const content = getTrafficPillContent(level, weekendFlag);
  const est = formatEstimatedCount(estimateExposure(day, locationType, storeType));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-left"
        aria-label="查看客流波动详情"
      >
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${content.className}`}
        >
          {content.emoji} {content.text}
        </span>
        <span className="text-xs text-sub">{est}</span>
        {showMain && <span className="text-xs text-sub">（主店）</span>}
      </button>

      <Modal open={open} title="客流波动 · 组合效果" onClose={() => setOpen(false)}>
        <p className="mb-3 text-xs text-sub">
          综合系数 = 选址波动 × 品类波动。点击不同「选址 × 品类」可预览工作日 / 周末的客流档位。
        </p>
        <TrafficComboTable day={day} />
      </Modal>
    </>
  );
}
