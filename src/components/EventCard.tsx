// 已发生（自动）事件的行内提示卡（store.resolvedEvent）。
import { useGameStore } from '../store/gameStore';
import { Card } from './ui/Card';

export function EventCard() {
  const resolved = useGameStore((s) => s.resolvedEvent);
  if (!resolved) return null;
  const { event, option } = resolved;

  return (
    <Card className="px-4 py-3 border-l-4 border-l-primary">
      <div className="text-xs text-sub">{event.category} · 已发生</div>
      <div className="text-sm font-semibold text-ink mt-0.5">{event.title}</div>
      {option.visibleEffect && (
        <div className="text-sm text-ink/80 mt-1 leading-snug">{option.visibleEffect}</div>
      )}
    </Card>
  );
}
