// 裁人确认弹窗（《开店说》员工系统重构 v3）
// 展示补偿金、影响预览（employeePressure + 品牌 + 关系户额外惩罚）
import { useGameStore } from '../store/gameStore';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import {
  LAYOFF_COMPENSATION_DAYS,
} from '../data/staffConstants';
import {
  ATTRIBUTE_LABELS,
  ATTRIBUTE_EMOJI,
} from '../types/employee';
import type { Employee } from '../types/employee';
import { fmtMoney } from '../utils/format';

interface LayoffConfirmModalProps {
  employee: Employee;
  onClose: () => void;
  onConfirm: () => void;
}

export function LayoffConfirmModal({ employee, onClose, onConfirm }: LayoffConfirmModalProps) {
  const game = useGameStore((s) => s.game);
  const fireEmployee = useGameStore((s) => s.fireEmployee);

  if (!game) return null;

  const dailySalary = Math.floor(employee.monthlySalary / 30);
  const compensation = dailySalary * LAYOFF_COMPENSATION_DAYS;
  const isGuanxi = employee.attribute === 'guanxi_hire';

  const handleConfirm = () => {
    fireEmployee(employee.id);
    onConfirm();
  };

  return (
    <Modal open title="确认裁人" onClose={onClose}>
      {/* 员工信息 */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center text-xl">
          {employee.isExposed ? ATTRIBUTE_EMOJI[employee.attribute] : '👤'}
        </div>
        <div>
          <div className="text-base font-bold text-ink">
            {employee.name}
            {employee.isExposed && (
              <span className="text-sm font-normal text-sub ml-1">
                · {ATTRIBUTE_LABELS[employee.attribute]}
              </span>
            )}
          </div>
          <div className="text-xs text-sub">月薪 {fmtMoney(employee.monthlySalary)}</div>
        </div>
      </div>

      <div className="border-t border-black/5 my-3" />

      {/* 补偿金 */}
      <div className="mb-4">
        <div className="text-sm font-semibold text-ink mb-1">补偿金</div>
        <div className="text-lg font-bold text-risk">
          {fmtMoney(compensation)}
          <span className="text-sm font-normal text-sub ml-1">
            （= {LAYOFF_COMPENSATION_DAYS} 天工资）
          </span>
        </div>
      </div>

      {/* 影响预览 */}
      <div className="bg-risk/5 rounded-card px-3 py-3 mb-3">
        <div className="text-sm font-semibold text-ink mb-2">影响</div>
        <ul className="space-y-1 text-sm text-sub">
          <li>• 员工压力 +15</li>
          <li>• 品牌评级 -1</li>
          {isGuanxi && (
            <li className="text-risk font-medium">
              • ⚠️ 关系户额外惩罚：品牌再 -5、员工压力再 +25
            </li>
          )}
        </ul>
      </div>

      {/* 当日现金 */}
      <div className="text-xs text-sub mb-4">
        当前现金: {fmtMoney(game.cash)}
        {game.cash < compensation && (
          <span className="text-risk ml-1">⚠️ 现金可能不足</span>
        )}
      </div>

      {/* 按钮 */}
      <div className="flex gap-3">
        <Button variant="secondary" fullWidth onClick={onClose}>
          取消
        </Button>
        <Button variant="danger" fullWidth onClick={handleConfirm}>
          确认裁人
        </Button>
      </div>
    </Modal>
  );
}
