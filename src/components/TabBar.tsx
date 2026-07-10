// 底部 4 tab 导航：纯展示组件，不依赖 store（分页重构 · T01）。
// 仅负责定义/高亮/点击回调，activeTab 状态由 AppShell 持有。
import { TAB_LIST, TAB_BAR_HEIGHT, type TabKey } from '../types/navigation';
import clsx from 'clsx';

interface TabBarProps {
  active: TabKey;
  onChange: (t: TabKey) => void;
}

export function TabBar({ active, onChange }: TabBarProps) {
  return (
    <nav
      className="fixed bottom-0 left-1/2 z-40 w-full max-w-[480px] -translate-x-1/2 border-t border-black/5 bg-bg sm:max-w-[720px]"
      style={{ height: TAB_BAR_HEIGHT }}
      aria-label="主导航"
    >
      <ul className="flex h-full items-stretch">
        {TAB_LIST.map((t) => {
          const isActive = t.key === active;
          return (
            <li key={t.key} className="flex-1">
              <button
                type="button"
                onClick={() => onChange(t.key)}
                aria-current={isActive ? 'page' : undefined}
                className={clsx(
                  'flex h-full w-full flex-col items-center justify-center gap-0.5 text-xs transition-colors',
                  isActive ? 'font-semibold text-primary' : 'text-sub',
                )}
              >
                <span className="text-lg leading-none">{t.icon}</span>
                <span>{t.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
