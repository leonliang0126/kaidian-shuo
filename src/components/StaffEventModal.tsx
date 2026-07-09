// 员工动态通知弹窗：每日结算后如有员工事件（离职/罢工/士气警告），在此弹窗集中展示。
// 用户点"知道了"后关闭并清空通知。
import { useGameStore } from '../store/gameStore';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

export function StaffEventModal() {
  const game = useGameStore((s) => s.game);
  const dismissStaffNotifications = useGameStore((s) => s.dismissStaffNotifications);

  const notifications = game?.staffNotifications ?? [];
  if (notifications.length === 0) return null;

  return (
    <Modal
      open
      title="📋 员工动态"
      dismissable={false}
    >
      <div className="space-y-2">
        {notifications.map((note, i) => (
          <div
            key={i}
            className="rounded-card bg-risk/10 border border-risk/20 px-3 py-2 text-sm text-risk flex items-start gap-2"
          >
            <span className="shrink-0 mt-0.5">⚠️</span>
            <span>{note}</span>
          </div>
        ))}
      </div>
      <Button
        fullWidth
        size="lg"
        className="mt-4"
        onClick={dismissStaffNotifications}
      >
        知道了
      </Button>
    </Modal>
  );
}
