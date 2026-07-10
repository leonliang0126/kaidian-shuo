// 经营日志：最近若干天（倒序）的流水与净利，以及当日事件标题与叙事文案。
// 叙事文案优先展示 EventLogEntry.story（含 {name}/{店名} 占位符），渲染时统一经
// interpolateStory 做运行时插值；无 story 则 fallback visibleEffect。
import { useGameStore } from '../store/gameStore';
import { Card } from './ui/Card';
import { fmtMoney, fmtSignedMoney } from '../utils/format';
import { interpolateStory } from '../utils/interpolateStory';

export function BusinessLog() {
  const game = useGameStore((s) => s.game);
  if (!game) return null;
  const log = [...game.businessLog].slice(-12).reverse();

  // 主店名 / 第一名在册员工名（供 {name}/{店名} 插值兜底）
  const mainStore = game.stores[0];
  const storeName = mainStore?.name ?? '小店';
  const firstName: string | null = mainStore?.employees?.[0]?.name ?? null;

  // 按 day 归集事件叙事（优先 story，fallback visibleEffect）。一天至多一个主事件。
  const storyByDay = new Map<number, string>();
  for (const h of game.eventHistory) {
    const tpl = h.story ?? h.visibleEffect;
    if (tpl) {
      storyByDay.set(h.day, interpolateStory(tpl, { name: firstName, storeName }));
    }
  }

  return (
    <Card className="px-4 py-3">
      <div className="text-sm font-semibold text-ink mb-2">经营日志</div>
      {log.length === 0 ? (
        <div className="text-sm text-sub py-2 text-center">还没有记录，结束今天看看。</div>
      ) : (
        <ul className="divide-y divide-black/5">
          {log.map((e, i) => {
            const story = storyByDay.get(e.day);
            return (
              <li key={i} className="py-2 flex items-center justify-between text-sm">
                <div className="min-w-0">
                  <span className="text-sub">D{e.day}</span>
                  {e.eventTitle && (
                    <span className="ml-2 text-ink/80 truncate">{e.eventTitle}</span>
                  )}
                  {story && (
                    <div className="text-xs text-ink/70 mt-0.5 leading-snug">{story}</div>
                  )}
                  {e.note && <div className="text-xs text-risk/80 mt-0.5">{e.note}</div>}
                </div>
                <div className="text-right shrink-0 ml-3">
                  <div className="text-ink">{fmtMoney(e.revenue)}</div>
                  <div className={e.netProfit >= 0 ? 'text-profit text-xs' : 'text-risk text-xs'}>
                    {fmtSignedMoney(e.netProfit)}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
