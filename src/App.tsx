// 《开店说》入口：阶段机（tutorial → opening → playing）+ 所有弹窗调度（分页重构 · T08）。
// playing 阶段重写为 <AppShell/>（4 tab keep-alive）+ 全局浮层；tutorial/opening 分支不变。
import { useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { AppShell } from './components/AppShell';
import { HirePage } from './components/HirePage';
import { StaffEventModal } from './components/StaffEventModal';
import { TutorialModal } from './components/modals/TutorialModal';
import { OpeningSetup } from './components/OpeningSetup';
import { EventModal } from './components/modals/EventModal';
import { SettlementModal } from './components/modals/SettlementModal';
import { CrisisModal } from './components/modals/CrisisModal';
import { MonthModal } from './components/modals/MonthModal';
import { EndingScreen } from './components/EndingScreen';
import { Toast } from './components/Toast';
import { StoryCard } from './components/StoryCard';

export default function App() {
  const phase = useGameStore((s) => s.phase);
  const init = useGameStore((s) => s.init);
  const eventModal = useGameStore((s) => s.eventModal);
  const crisisOpen = useGameStore((s) => s.crisisOpen);
  const monthModal = useGameStore((s) => s.monthModal);
  const settlementModal = useGameStore((s) => s.settlementModal);
  const lastEnding = useGameStore((s) => s.lastEnding);
  const staffNotifications = useGameStore((s) => s.game?.staffNotifications ?? []);

  useEffect(() => {
    init();
  }, [init]);

  if (phase === 'tutorial') {
    return (
      <div className="app-shell">
        <TutorialModal />
      </div>
    );
  }

  if (phase === 'opening') {
    return (
      <div className="app-shell">
        <OpeningSetup />
      </div>
    );
  }

  // playing：TabBar + 大卡仅在此阶段显示；教程/开店设置阶段隐藏（决策④）。
  // 不再包 .app-shell（其 padding-bottom 与 AppShell 自身的全高布局/末屏留白重复），AppShell 自带居中。
  return (
    <>
      <AppShell />

      {/* 弹窗优先级：结局 > 危机 > 月结 > 员工动态 > 事件 > 结算（与现状一致，不进 tab） */}
      {lastEnding && <EndingScreen />}
      {!lastEnding && crisisOpen && <CrisisModal />}
      {!lastEnding && !crisisOpen && monthModal && <MonthModal />}
      {!lastEnding && !crisisOpen && !monthModal && <StaffEventModal />}
      {!lastEnding && !crisisOpen && !monthModal && !staffNotifications.length && eventModal && (
        <EventModal />
      )}
      {!lastEnding && !crisisOpen && !monthModal && !eventModal && !staffNotifications.length && settlementModal && (
        <SettlementModal />
      )}

      {/* 招聘浮层（保持 Modal，不入 tab） */}
      <HirePage />

      {/* 顶部结果提示（借款/危机行动结果，约 2.5s 自动消失） */}
      <Toast />

      {/* 叙事卡片（借款/危机应对的逐字故事，点击关闭，与 Toast 并存） */}
      <StoryCard />
    </>
  );
}
