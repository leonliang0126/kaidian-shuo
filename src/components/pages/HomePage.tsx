// 首页容器（分页重构 · T04）：StatusBar(home) + 各经营组件 + 末尾 CashCurve + 关店入口。
// 仅负责组装既有组件，不含新业务逻辑；现金曲线按决策①从 Dashboard 挪到末尾。
import { StatusBar } from '../StatusBar';
import { FocusSelector } from '../FocusSelector';
import { Dashboard } from '../Dashboard';
import { RiskEstimate } from '../RiskEstimate';
import { WindPanel } from '../WindPanel';
import { EventCard } from '../EventCard';
import { CashCurve } from '../CashCurve';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { useGameStore } from '../../store/gameStore';

export function HomePage() {
  const game = useGameStore((s) => s.game);
  const openCloseConfirm = useGameStore((s) => s.openCloseConfirm);
  const closeConfirmOpen = useGameStore((s) => s.closeConfirmOpen);
  const cancelCloseConfirm = useGameStore((s) => s.cancelCloseConfirm);
  const confirmCloseShop = useGameStore((s) => s.confirmCloseShop);

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

      {/* 关店入口：确认后进入 decent_exit 结局屏 */}
      <button
        onClick={openCloseConfirm}
        className="w-full rounded-card border border-risk/30 bg-risk/5 px-4 py-3 text-sm font-semibold text-risk active:bg-risk/10"
      >
        关店止损
      </button>

      <Modal
        open={closeConfirmOpen}
        title="关店止损"
        onClose={cancelCloseConfirm}
        dismissable={false}
      >
        <div className="text-sm text-sub leading-relaxed mb-4">
          确定要结束这一局经营吗？此操作会进入结局。
        </div>
        <div className="flex gap-2">
          <button
            onClick={cancelCloseConfirm}
            className="flex-1 rounded-card border border-black/10 bg-black/[0.02] px-4 py-3 text-sm font-semibold text-ink active:bg-black/5"
          >
            取消
          </button>
          <button
            onClick={confirmCloseShop}
            className="flex-1 rounded-card bg-risk px-4 py-3 text-sm font-semibold text-white active:opacity-90"
          >
            确认关店
          </button>
        </div>
      </Modal>
    </div>
  );
}
