// 经营体检：现金流状态、承载是否超载、今日风向等级（不展示暗线数值）。
import { useGameStore } from '../store/gameStore';
import type { WindLevel } from '../types';
import { Card } from './ui/Card';

const WIND_LABEL: Record<WindLevel, string> = {
  calm: '平稳',
  watch: '留意',
  warn: '警惕',
  danger: '危险',
};

const TONE_CLASS: Record<string, string> = {
  profit: 'text-profit',
  primary: 'text-primary',
  risk: 'text-risk',
  sub: 'text-sub',
};

export function RiskEstimate() {
  const game = useGameStore((s) => s.game);
  if (!game) return null;
  const main = game.stores[0];
  const cashflow = main?.cashflowStatus ?? '健康';
  const overload = game.lastSettlement?.capacityOverload ?? false;
  const wind = game.windMessages[game.windMessages.length - 1];

  const items = [
    { label: '现金流', value: cashflow, tone: cashflow === '健康' ? 'profit' : cashflow === '紧张' ? 'primary' : 'risk' },
    { label: '承载', value: overload ? '已超载' : '充裕', tone: overload ? 'risk' : 'profit' },
    { label: '风向', value: wind ? WIND_LABEL[wind.level] : '—', tone: 'sub' },
  ];

  return (
    <Card className="px-4 py-3">
      <div className="text-sm font-semibold text-ink mb-2">经营体检</div>
      <div className="grid grid-cols-3 gap-2">
        {items.map((it) => (
          <div key={it.label} className="rounded-xl bg-black/[0.03] px-2 py-2 text-center">
            <div className="text-xs text-sub">{it.label}</div>
            <div className={`text-sm font-semibold mt-0.5 ${TONE_CLASS[it.tone]}`}>{it.value}</div>
          </div>
        ))}
      </div>
      {overload && <div className="text-xs text-risk mt-2">今日订单超过承载，顾客信任 -3。</div>}
    </Card>
  );
}
