// 经营重点选择：7 选 1（含"不指定"），展示副作用提示。
import { useGameStore } from '../store/gameStore';
import { FOCUSES } from '../data/focusDefs';
import { Card } from './ui/Card';
import clsx from 'clsx';

export function FocusSelector() {
  const game = useGameStore((s) => s.game);
  const chooseFocus = useGameStore((s) => s.chooseFocus);
  if (!game) return null;
  const selected = game.selectedDailyFocus;

  return (
    <Card className="px-4 py-3">
      <div className="text-sm font-semibold text-ink mb-2">今日经营重点</div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => chooseFocus(null)}
          className={clsx(
            'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
            selected === null
              ? 'bg-primary text-white border-primary'
              : 'bg-black/[0.03] text-ink border-transparent active:bg-black/10',
          )}
        >
          不指定
        </button>
        {FOCUSES.map((f) => (
          <button
            key={f.id}
            onClick={() => chooseFocus(f.id)}
            className={clsx(
              'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
              selected === f.id
                ? 'bg-primary text-white border-primary'
                : 'bg-black/[0.03] text-ink border-transparent active:bg-black/10',
            )}
            title={f.description}
          >
            {f.name}
          </button>
        ))}
      </div>
      {selected && (
        <div className="text-xs text-sub mt-2">
          {FOCUSES.find((f) => f.id === selected)?.description}
        </div>
      )}
    </Card>
  );
}
