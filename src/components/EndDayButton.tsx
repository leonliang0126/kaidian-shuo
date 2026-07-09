// 底部固定「结束今天」按钮。任意弹窗开启时禁用，避免流程冲突。
import { useGameStore } from '../store/gameStore';
import { Button } from './ui/Button';

export function EndDayButton() {
  const endDay = useGameStore((s) => s.endDay);
  const hasModal = useGameStore((s) =>
    !!(s.eventModal || s.crisisOpen || s.settlementModal || s.monthModal || s.lastEnding),
  );

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] px-4 py-4 bg-gradient-to-t from-bg via-bg to-transparent z-40 sm:max-w-[720px]">
      <Button fullWidth size="lg" onClick={endDay} disabled={hasModal}>
        结束今天，看结算
      </Button>
    </div>
  );
}
