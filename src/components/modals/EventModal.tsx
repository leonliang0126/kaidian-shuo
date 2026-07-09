// 普通事件弹窗：列出选项，玩家选择后调用 chooseEventOption。不可点遮罩关闭。
import { useGameStore } from '../../store/gameStore';
import { Modal } from '../ui/Modal';

const LEVEL_LABEL: Record<string, string> = {
  small: '小事',
  medium: '事件',
  large: '大事',
  fate: '命运',
  forced: '危机',
};

export function EventModal() {
  const ev = useGameStore((s) => s.eventModal);
  const choose = useGameStore((s) => s.chooseEventOption);
  if (!ev) return null;

  return (
    <Modal open title={ev.title} dismissable={false}>
      <div className="text-xs text-sub mb-1">
        {LEVEL_LABEL[ev.level] ?? '事件'} · {ev.category}
      </div>
      {ev.trigger && <p className="text-xs text-sub mb-3">{ev.trigger}</p>}
      <div className="space-y-2">
        {ev.options.map((o) => (
          <button
            key={o.id}
            onClick={() => choose(o.id)}
            className="w-full text-left rounded-card border border-black/5 bg-black/[0.02] px-4 py-3 active:bg-black/5"
          >
            <div className="text-sm font-semibold text-ink">{o.label}</div>
            {o.visibleEffect && (
              <div className="text-xs text-sub mt-1 leading-snug">{o.visibleEffect}</div>
            )}
          </button>
        ))}
      </div>
    </Modal>
  );
}
