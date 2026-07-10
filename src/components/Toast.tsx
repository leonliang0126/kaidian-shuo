// 轻量结果提示（toast）：借款 / 危机行动后短暂显示，约 2.5s 自动消失。
// 读取 store.toast；非空时渲染顶部居中卡片（success 绿 / fail 红 / info 灰）。
import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import clsx from 'clsx';

/** toast 自动消失时长（毫秒）。 */
const TOAST_DURATION_MS = 2500;

export function Toast() {
  const toast = useGameStore((s) => s.toast);
  const clearToast = useGameStore((s) => s.clearToast);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => clearToast(), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast, clearToast]);

  if (!toast) return null;

  const colorClass =
    toast.type === 'success'
      ? 'bg-green-600'
      : toast.type === 'fail'
        ? 'bg-red-600'
        : 'bg-gray-700';

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] pointer-events-none px-4 w-full max-w-[480px]">
      <div
        className={clsx(
          'mx-auto w-fit max-w-full px-4 py-2 rounded-card text-white text-sm font-medium shadow-card text-center',
          colorClass,
        )}
      >
        {toast.msg}
      </div>
    </div>
  );
}
