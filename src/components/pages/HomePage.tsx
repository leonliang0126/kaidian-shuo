// 首页容器（分页重构 · T04）：StatusBar(home) + 各经营组件 + 末尾 CashCurve。
// 仅负责组装既有组件，不含新业务逻辑；现金曲线按决策①从 Dashboard 挪到末尾。
import { StatusBar } from '../StatusBar';
import { FocusSelector } from '../FocusSelector';
import { Dashboard } from '../Dashboard';
import { RiskEstimate } from '../RiskEstimate';
import { WindPanel } from '../WindPanel';
import { EventCard } from '../EventCard';
import { CashCurve } from '../CashCurve';
import { Card } from '../ui/Card';
import { useGameStore } from '../../store/gameStore';

export function HomePage() {
  const game = useGameStore((s) => s.game);
  return (
    <div className="space-y-3 px-4">
      <StatusBar variant="home" />
      <EventCard />
      <FocusSelector />
      <Dashboard showCashCurve={false} />
      <RiskEstimate />
      <WindPanel />
      {/* 现金曲线（决策①：移到首页末尾，不丢） */}
      <Card className="px-4 py-3">
        <div className="text-sm font-semibold text-ink mb-1">现金曲线</div>
        <CashCurve log={game?.businessLog ?? []} />
      </Card>
    </div>
  );
}
