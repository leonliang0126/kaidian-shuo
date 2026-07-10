// 顶部状态栏：双形态（分页重构 · T02）。
//  home  = 首页大号主体数据卡（回应「太拥挤 → 要大、要可读」）。
//  mini  = 其它页精简条（周几·第X周·品牌★·现金），sticky 常驻顶部。
// 两形态共享同一份 store 数据，仅展示密度不同；默认 'home' 向后兼容。
import { useGameStore } from '../store/gameStore';
import { fmtMoney, ratingToStars } from '../utils/format';
import { getWeekNumber, dayOfWeekLabel } from '../core/staffSystem';
import TrafficPill from './TrafficPill';
import clsx from 'clsx';
import type { StatusBarVariant } from '../types/navigation';

const CASHFLOW_COLOR: Record<string, string> = {
  健康: 'text-profit',
  紧张: 'text-primary',
  危险: 'text-risk',
};

interface StatusBarProps {
  variant?: StatusBarVariant; // 默认 'home' 向后兼容
}

export function StatusBar({ variant = 'home' }: StatusBarProps) {
  const game = useGameStore((s) => s.game);
  if (!game) return null;
  const main = game.stores[0];
  const cashflow = main?.cashflowStatus ?? '健康';
  const ap = game.actionPointsCurrent;
  const apMax = game.actionPointsMax;
  const week = getWeekNumber(game.day);

  // —— mini 精简条：周几·第X周·品牌★·现金，sticky 常驻 ——
  if (variant === 'mini') {
    return (
      <div className="sticky top-0 z-10 border-b border-black/5 bg-bg px-4 py-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-sub">
            {dayOfWeekLabel(game.day)} · 第{week}周
          </span>
          <span className="text-sub">品牌 {ratingToStars(game.brandRating)}★</span>
          <span className="font-bold text-ink">{fmtMoney(game.cash)}</span>
        </div>
      </div>
    );
  }

  // —— home 大卡：月份进标题小字；多店仅 storeCount>1 极简显示 ——
  const monthLabel = `第${week}周 · 第${game.month}月`;
  const multiStore = game.storeCount > 1;

  return (
    <div className="px-4 pb-3 pt-4">
      {/* 标题小字：月份 + 多店数（仅 storeCount>1 极简显示） */}
      <div className="flex items-center justify-between text-xs text-sub">
        <span>{monthLabel}</span>
        {multiStore && <span>· {game.storeCount} 家店</span>}
      </div>

      {/* 主数字：现金 / 净资产 大号粗体（回应「要大到可读」） */}
      <div className="mt-1 flex items-end justify-between">
        <div>
          <div className="text-xs text-sub">现金</div>
          <div className="text-3xl font-extrabold leading-tight text-ink">
            {fmtMoney(game.cash)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-sub">净资产</div>
          <div className="text-xl font-bold text-ink">{fmtMoney(game.netWorth)}</div>
        </div>
      </div>

      {/* 预估到店成块（客流 pill 单独成块，突出可读） */}
      {main && (
        <div className="mt-3">
          <TrafficPill
            day={game.day}
            locationType={main.locationType}
            storeType={main.storeType}
            showMain={game.storeCount > 1}
          />
        </div>
      )}

      {/* 次级指标降级小字（现金流/行动点/月供/负债/复购热/储备） */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-sub">
        <span className={clsx('font-medium', CASHFLOW_COLOR[cashflow])}>现金流 {cashflow}</span>
        <span>· 行动点 {ap}/{apMax}</span>
        {game.monthlyRepayment > 0 && <span>· 月供 {fmtMoney(game.monthlyRepayment)}</span>}
        {game.debt > 0 && <span>· 负债 {fmtMoney(game.debt)}</span>}
        {main && <span>· 复购热 {Math.round(main.heat)}</span>}
        {game.reserve > 0 && <span>· 储备 {fmtMoney(game.reserve)}</span>}
      </div>
    </div>
  );
}
