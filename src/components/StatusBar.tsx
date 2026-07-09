// 顶部状态栏：天数、现金、净资产、品牌评分、现金流状态、行动点、负债月供、复购热度。
import { useGameStore } from '../store/gameStore';
import { fmtMoney, ratingToStars } from '../utils/format';
import clsx from 'clsx';

const CASHFLOW_COLOR: Record<string, string> = {
  健康: 'text-profit',
  紧张: 'text-primary',
  危险: 'text-risk',
};

export function StatusBar() {
  const game = useGameStore((s) => s.game);
  if (!game) return null;
  const main = game.stores[0];
  const cashflow = main?.cashflowStatus ?? '健康';
  const ap = game.actionPointsCurrent;
  const apMax = game.actionPointsMax;

  return (
    <div className="px-4 pt-4 pb-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-sub">
            第 {game.day} 天 · 第 {game.month} 月
          </div>
          <div className="text-lg font-bold text-ink">现金 {fmtMoney(game.cash)}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-sub">净资产</div>
          <div className="text-sm font-semibold text-ink">{fmtMoney(game.netWorth)}</div>
          <div className="text-xs text-sub">品牌 {ratingToStars(game.brandRating)}★</div>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs flex-wrap">
        <span className={`font-medium ${CASHFLOW_COLOR[cashflow]}`}>现金流 {cashflow}</span>
        {game.storeCount > 1 && <span className="text-sub">· {game.storeCount} 家店</span>}
        {game.reserve > 0 && <span className="text-sub">· 储备 {fmtMoney(game.reserve)}</span>}
        <span className={clsx('font-medium', ap > 0 ? 'text-primary' : 'text-risk')}>
          · 行动点 {ap}/{apMax}
        </span>
        {game.debt > 0 && <span className="text-sub">· 负债 {fmtMoney(game.debt)}</span>}
        {game.monthlyRepayment > 0 && (
          <span className="text-sub">· 月供 {fmtMoney(game.monthlyRepayment)}</span>
        )}
        {main && <span className="text-sub">· 复购热 {Math.round(main.heat)}</span>}
      </div>
    </div>
  );
}
