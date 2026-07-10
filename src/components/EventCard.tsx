// 已发生（自动）事件的行内提示卡（store.resolvedEvent）。
import { useGameStore } from '../store/gameStore';
import { Card } from './ui/Card';
import { interpolateStory } from '../utils/interpolateStory';

export function EventCard() {
  const resolved = useGameStore((s) => s.resolvedEvent);
  const storeName = useGameStore((s) => s.game?.stores[0]?.name ?? '小店');
  const employees = useGameStore((s) => s.game?.stores[0]?.employees ?? []);
  if (!resolved) return null;
  const { event, option, relatedEmployeeId, relatedEmployeeName } = resolved;

  // 优先取事件携带的关联员工名；否则按 id 反查；都拿不到则交给 interpolateStory 兜底「店员」
  const relatedName =
    relatedEmployeeName ??
    (relatedEmployeeId ? employees.find((e) => e.id === relatedEmployeeId)?.name : undefined) ??
    null;

  const text = interpolateStory(option.story ?? option.visibleEffect ?? '', {
    name: relatedName,
    storeName,
  });

  return (
    <Card className="px-4 py-3 border-l-4 border-l-primary">
      <div className="text-xs text-sub">{event.category} · 已发生</div>
      <div className="text-sm font-semibold text-ink mt-0.5">{event.title}</div>
      {text && <div className="text-sm text-ink/80 mt-1 leading-snug">{text}</div>}
    </Card>
  );
}
