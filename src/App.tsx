// 《开店说》入口：阶段机（tutorial → opening → playing）+ 所有弹窗调度。
import { useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { StatusBar } from './components/StatusBar';
import { Dashboard } from './components/Dashboard';
import { DecisionPanel } from './components/DecisionPanel';
import { WindPanel } from './components/WindPanel';
import { RiskEstimate } from './components/RiskEstimate';
import { BusinessLog } from './components/BusinessLog';
import { EventCard } from './components/EventCard';
import { EndDayButton } from './components/EndDayButton';
import { FocusSelector } from './components/FocusSelector';
import { ActionPointPanel } from './components/ActionPointPanel';
import { StaffPage } from './components/StaffPage';
import { HirePage } from './components/HirePage';
import { StaffEventModal } from './components/StaffEventModal';
import { Button } from './components/ui/Button';
import { TutorialModal } from './components/modals/TutorialModal';
import { OpeningSetup } from './components/OpeningSetup';
import { EventModal } from './components/modals/EventModal';
import { SettlementModal } from './components/modals/SettlementModal';
import { CrisisModal } from './components/modals/CrisisModal';
import { MonthModal } from './components/modals/MonthModal';
import { EndingScreen } from './components/EndingScreen';

export default function App() {
  const phase = useGameStore((s) => s.phase);
  const init = useGameStore((s) => s.init);
  const eventModal = useGameStore((s) => s.eventModal);
  const crisisOpen = useGameStore((s) => s.crisisOpen);
  const monthModal = useGameStore((s) => s.monthModal);
  const settlementModal = useGameStore((s) => s.settlementModal);
  const lastEnding = useGameStore((s) => s.lastEnding);
  const staffNotifications = useGameStore((s) => s.game?.staffNotifications ?? []);
  const openStaffPage = useGameStore((s) => s.openStaffPage);

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

  // playing
  return (
    <div className="app-shell">
      <StatusBar />
      <div className="px-4 space-y-3 pb-2">
        <EventCard />
        <FocusSelector />
        <ActionPointPanel />
        <Dashboard />
        <RiskEstimate />
        <WindPanel />
        <DecisionPanel />
        <Button variant="secondary" fullWidth onClick={openStaffPage}>
          👥 员工管理
        </Button>
        <BusinessLog />
      </div>
      <EndDayButton />

      {/* 弹窗优先级：结局 > 危机 > 月结 > 员工动态 > 事件 > 结算 */}
      {lastEnding && <EndingScreen />}
      {!lastEnding && crisisOpen && <CrisisModal />}
      {!lastEnding && !crisisOpen && monthModal && <MonthModal />}
      {!lastEnding && !crisisOpen && !monthModal && (
        <StaffEventModal />
      )}
      {!lastEnding && !crisisOpen && !monthModal && !staffNotifications.length && eventModal && <EventModal />}
      {!lastEnding && !crisisOpen && !monthModal && !eventModal && !staffNotifications.length && settlementModal && (
        <SettlementModal />
      )}

      {/* 员工系统页面（遮罩层最高） */}
      <StaffPage />
      <HirePage />
    </div>
  );
}
