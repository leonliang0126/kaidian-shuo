// 经营日志：最近若干天（倒序）的流水与净利，以及当日事件标题。
import { useGameStore } from '../store/gameStore';
import { Card } from './ui/Card';
import { fmtMoney, fmtSignedMoney } from '../utils/format';

export function BusinessLog() {
  const game = useGameStore((s) => s.game);
  if (!game) return null;
  const log = [...game.businessLog].slice(-12).reverse();

  return (
    <Card className="px-4 py-3">
      <div className="text-sm font-semibold text-ink mb-2">经营日志</div>
      {log.length === 0 ? (
        <div className="text-sm text-sub py-2 text-center">还没有记录，结束今天看看。</div>
      ) : (
        <ul className="divide-y divide-black/5">
          {log.map((e, i) => (
            <li key={i} className="py-2 flex items-center justify-between text-sm">
              <div className="min-w-0">
                <span className="text-sub">D{e.day}</span>
                {e.eventTitle && (
                  <span className="ml-2 text-ink/80 truncate">{e.eventTitle}</span>
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
          ))}
        </ul>
      )}
    </Card>
  );
}
