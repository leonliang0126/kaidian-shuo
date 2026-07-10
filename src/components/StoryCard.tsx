// 叙事卡片：借款 / 危机应对的逐字故事，点击遮罩或"知道了"按钮关闭。
// 复用 Modal 的 createPortal + 滚动锁模式（自渲染到 body，打开时锁定背景滚动）。
// 与 Toast 并存不冲突：StoryCard 承载叙事文案（z 更高），Toast 承载数字摘要。
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { useGameStore } from '../store/gameStore';

/** 不同 tone 的配色（success 绿 / fail 红 / info 灰）。 */
const TONE_CLASS: Record<'success' | 'fail' | 'info', string> = {
  success: 'border-green-500/40 bg-green-50',
  fail: 'border-red-500/40 bg-red-50',
  info: 'border-black/10 bg-card',
};

/** 顶部色条（强化情绪）。 */
const TONE_BAR: Record<'success' | 'fail' | 'info', string> = {
  success: 'bg-green-500',
  fail: 'bg-red-500',
  info: 'bg-black/40',
};

export function StoryCard() {
  const story = useGameStore((s) => s.story);
  const dismissStory = useGameStore((s) => s.dismissStory);

  // 打开时锁定背景滚动；卸载/关闭时恢复（与 Modal 一致）。SSR/测试环境做空值守卫。
  useEffect(() => {
    if (!story) return;
    if (typeof document === 'undefined') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [story]);

  if (!story) return null;

  const content = (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4"
      onClick={() => dismissStory()}
    >
      <div
        className={clsx('w-full max-w-[480px] rounded-card shadow-card overflow-hidden', TONE_CLASS[story.tone])}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={clsx('h-1 w-full', TONE_BAR[story.tone])} />
        <div className="px-5 py-4">
          <p className="text-[15px] leading-relaxed text-ink whitespace-pre-wrap">{story.text}</p>
          <button
            type="button"
            onClick={() => dismissStory()}
            className={clsx(
              'mt-4 w-full rounded-card py-2 text-sm font-semibold transition-colors',
              story.tone === 'fail'
                ? 'bg-red-600 text-white active:bg-red-700'
                : story.tone === 'success'
                  ? 'bg-green-600 text-white active:bg-green-700'
                  : 'bg-black/80 text-white active:bg-black',
            )}
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return content;
  return createPortal(content, document.body);
}
