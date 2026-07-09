// 玩法说明弹窗（仅 phase==='tutorial' 时显示）。不可点遮罩关闭，必须点按钮。
import { useGameStore } from '../../store/gameStore';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { TUTORIAL } from '../../data/tutorial';

export function TutorialModal() {
  const phase = useGameStore((s) => s.phase);
  const dismissTutorial = useGameStore((s) => s.dismissTutorial);
  if (phase !== 'tutorial') return null;

  return (
    <Modal open title={TUTORIAL.title} dismissable={false}>
      <div className="space-y-2 text-sm text-ink/85 leading-relaxed">
        {TUTORIAL.body.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      <div className="mt-5 flex flex-col gap-2">
        <Button fullWidth size="lg" onClick={() => dismissTutorial(false)}>
          {TUTORIAL.primaryButton}
        </Button>
        <Button fullWidth variant="ghost" onClick={() => dismissTutorial(true)}>
          {TUTORIAL.secondaryButton}
        </Button>
      </div>
    </Modal>
  );
}
