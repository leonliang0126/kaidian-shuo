// playing 阶段外壳（分页重构 · T03/T09）。
// 持有 activeTab 本地 state（不进 store）；4 页同挂载 keep-alive，
// 仅用 visible / invisible+pointer-events-none 切换显隐，各自滚动位置天然保留、零 JS 记账。
import { useState } from 'react';
import type { TabKey } from '../types/navigation';
import { TAB_BAR_HEIGHT, ENDDAY_HEIGHT } from '../types/navigation';
import { TabBar } from './TabBar';
import { EndDayButton } from './EndDayButton';
import { HomePage } from './pages/HomePage';
import { StaffTab } from './pages/StaffTab';
import { ActionTab } from './pages/ActionTab';
import { BusinessTab } from './pages/BusinessTab';

// 4 页容器（顺序即 keep-alive 挂载顺序，全部常驻）。
const TAB_ORDER: TabKey[] = ['home', 'staff', 'action', 'business'];

// 页区底部留白：TabBar 高度 + EndDayButton 高度 + 缓冲，确保末屏内容不被遮挡。
const BOTTOM_PAD = TAB_BAR_HEIGHT + ENDDAY_HEIGHT + 8; // = 144

export function AppShell() {
  // activeTab 仅存在于 AppShell 本地 state；AppShell 仅在 playing 挂载，
  // 离开 playing 即卸载，state 自然重置为 'home'，无需额外重置逻辑。
  const [activeTab, setActiveTab] = useState<TabKey>('home');

  return (
    <div className="relative mx-auto flex h-[100dvh] max-w-[480px] flex-col bg-bg sm:max-w-[720px]">
      {/* 页区：relative 容器，4 页 absolute 同挂载、各自独立滚动 */}
      <div className="relative flex-1 overflow-hidden">
        {TAB_ORDER.map((key) => {
          const isActive = key === activeTab;
          return (
            <section
              key={key}
              aria-hidden={!isActive}
              className={[
                'absolute inset-0 overflow-y-auto no-scrollbar',
                // 仅可见性切换：invisible 仍保留布局与 scrollTop（满足决策③「保留各页滚动位置」）
                isActive ? 'visible' : 'invisible pointer-events-none',
              ].join(' ')}
            >
              {/* 末屏留白：避让底部 TabBar + EndDayButton */}
              <div style={{ paddingBottom: BOTTOM_PAD }}>
                {key === 'home' && <HomePage />}
                {key === 'staff' && <StaffTab />}
                {key === 'action' && <ActionTab />}
                {key === 'business' && <BusinessTab />}
              </div>
            </section>
          );
        })}
      </div>

      {/* 全局常驻：结束今天（位于 TabBar 之上）+ 底部 TabBar（最底） */}
      <EndDayButton />
      <TabBar active={activeTab} onChange={setActiveTab} />
    </div>
  );
}
