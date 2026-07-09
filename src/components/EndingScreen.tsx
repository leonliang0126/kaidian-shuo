// 结局独立页（架构 V3-7）：标题 + 全文案 + 本局数据回顾 + 胜负基调 + 重新开始。
// 结局为终端展示：点「重新开始」清空存档回到开局（doc §7）。
import { useGameStore } from '../store/gameStore';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { fmtMoney, fmtSignedMoney } from '../utils/format';
import clsx from 'clsx';

export function EndingScreen() {
  const ending = useGameStore((s) => s.lastEnding);
  const game = useGameStore((s) => s.game);
  const resetGame = useGameStore((s) => s.resetGame);
  if (!ending) return null;

  const win = ending.tone === 'win';
  const accent = win ? 'text-profit' : 'text-risk';
  const accentBg = win ? 'bg-profit/[0.08]' : 'bg-risk/[0.08]';
  const s = ending.stats;

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center px-4">
      <div className="w-full max-w-[480px] bg-card rounded-card shadow-card max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className={clsx('px-6 pt-8 pb-5 text-center', accentBg)}>
          <div className={clsx('text-xs font-medium tracking-wide')}>
            {win ? '通关结局' : '经营结局'}
          </div>
          <h1 className={clsx('text-3xl font-bold mt-1', accent)}>{ending.def.title}</h1>
          <div className={clsx('text-sm font-medium mt-2', accent)}>
            {win ? '★★★★ 你守住了这家店' : '这一局到这里了'}
          </div>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm text-ink/85 leading-relaxed">{ending.def.text}</p>

          {/* 本局数据回顾 */}
          <div className="mt-5">
            <div className="text-sm font-semibold text-ink mb-2">本局数据回顾</div>
            <Card className="px-4 py-3 grid grid-cols-2 gap-y-2 gap-x-3">
              <Stat label="存活天数" value={`${s.days} 天`} />
              <Stat label="门店数" value={`${s.storeCount} 家`} />
              <Stat label="峰值净资" value={fmtMoney(s.peakNetWorth)} />
              <Stat
                label="累计净利"
                value={fmtSignedMoney(s.cumulativeNetProfit)}
                tone={s.cumulativeNetProfit >= 0 ? 'profit' : 'risk'}
              />
              <Stat label="当前净资" value={fmtMoney(s.netWorth)} />
              <Stat
                label="暗线健康连胜"
                value={`${game?.hiddenHealthyStreak ?? 0} 天`}
              />
            </Card>
          </div>

          {/* 触发原因 */}
          <div className="mt-4 rounded-card bg-black/[0.03] px-4 py-3">
            <div className="text-xs text-sub">触发原因</div>
            <div className={clsx('text-sm font-medium mt-0.5', accent)}>{ending.cause}</div>
          </div>

          <Button fullWidth size="lg" className="mt-6" onClick={resetGame}>
            重新开始
          </Button>
          <div className="text-[11px] text-sub text-center mt-2">
            重新开始会清空当前存档，回到开店设置。
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'profit' | 'risk';
}) {
  const color = tone === 'profit' ? 'text-profit' : tone === 'risk' ? 'text-risk' : 'text-ink';
  return (
    <div>
      <div className="text-xs text-sub">{label}</div>
      <div className={clsx('text-base font-bold mt-0.5', color)}>{value}</div>
    </div>
  );
}
