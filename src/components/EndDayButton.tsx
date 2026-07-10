// 底部固定「结束今天」按钮。任意弹窗开启时禁用，避免流程冲突。
// 分页重构（T08）：贴底避让 TabBar —— bottom 由 bottom-0 改为 bottom-[TAB_BAR_HEIGHT]，位于 TabBar 正上方。
import { useGameStore } from '../store/gameStore';
import { Button } from './ui/Button';
import { TAB_BAR_HEIGHT } from '../types/navigation';

export function EndDayButton() {
  const endDay = useGameStore((s) => s.endDay);
  const hasModal = useGameStore((s) =>
    !!(s.eventModal || s.crisisOpen || s.settlementModal || s.monthModal || s.lastEnding),
  );

  return (
    <div
      className="fixed left-1/2 z-40 w-full max-w-[480px] -translate-x-1/2 bg-gradient-to-t from-bg via-bg to-transparent px-4 py-4 sm:max-w-[720px]"
      style={{ bottom: TAB_BAR_HEIGHT }}
    >
      <Button fullWidth size="lg" onClick={endDay} disabled={hasModal}>
        结束今天，看结算
      </Button>
    </div>
  );
}
