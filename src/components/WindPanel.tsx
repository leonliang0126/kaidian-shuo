// 店里风向面板：只显示症状文案与等级，绝不展示数值（架构 §9.4）。
import { useGameStore } from '../store/gameStore';
import type { WindLevel } from '../types';
import { Card } from './ui/Card';

const LEVEL_META: Record<WindLevel, { label: string; color: string; bg: string }> = {
  calm: { label: '平稳', color: 'text-profit', bg: 'bg-profit/10' },
  watch: { label: '留意', color: 'text-primary', bg: 'bg-primary/10' },
  warn: { label: '警惕', color: 'text-primary-dark', bg: 'bg-primary/10' },
  danger: { label: '危险', color: 'text-risk', bg: 'bg-risk/10' },
};

export function WindPanel() {
  const game = useGameStore((s) => s.game);
  const wind = game?.windMessages[game.windMessages.length - 1];

  if (!wind) {
    return (
      <Card className="px-4 py-3">
        <div className="text-sm font-semibold text-ink mb-1">店里风向</div>
        <div className="text-sm text-sub">经营几天后，店里会透出一些苗头。</div>
      </Card>
    );
  }

  const meta = LEVEL_META[wind.level];
  return (
    <Card className="px-4 py-3">
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm font-semibold text-ink">店里风向</div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
          {meta.label}
        </span>
      </div>
      <ul className="space-y-1">
        {wind.lines.map((l, i) => (
          <li key={i} className="text-sm text-ink/80 leading-snug">
            · {l}
          </li>
        ))}
      </ul>
    </Card>
  );
}
