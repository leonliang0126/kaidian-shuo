// 员工详情弹窗（《开店说》员工系统重构 v3）
// 展示属性、士气条、效率系数、排班统计、操作按钮
import { useGameStore } from '../store/gameStore';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { computeDailyEfficiency } from '../core/staffSystem';
import {
  ATTRIBUTE_LABELS,
  ATTRIBUTE_EMOJI,
  ATTRIBUTE_DESCRIPTIONS,
} from '../types/employee';
import type { Employee } from '../types/employee';
import { fmtMoney } from '../utils/format';

interface EmployeeDetailModalProps {
  employee: Employee;
  onClose: () => void;
  onLayoff: (emp: Employee) => void;
}

export function EmployeeDetailModal({ employee, onClose, onLayoff }: EmployeeDetailModalProps) {
  const setSchedule = useGameStore((s) => s.setSchedule);
  const adjustSalary = useGameStore((s) => s.adjustSalary);
  const game = useGameStore((s) => s.game);

  const efficiency = computeDailyEfficiency(employee, game?.day ?? employee.joinDay);

  const moraleBarWidth = `${employee.morale}%`;
  const moraleColor =
    employee.morale <= 20
      ? 'bg-risk'
      : employee.morale <= 40
        ? 'bg-warning'
        : 'bg-primary';

  return (
    <Modal open title={`员工详情`} onClose={onClose}>
      {/* 基本信息 */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl">
          {employee.isExposed ? ATTRIBUTE_EMOJI[employee.attribute] : '👤'}
        </div>
        <div>
          <div className="text-lg font-bold text-ink">{employee.name}</div>
          <div className="text-sm text-sub">
            {employee.isExposed ? (
              <span>
                {ATTRIBUTE_EMOJI[employee.attribute]} {ATTRIBUTE_LABELS[employee.attribute]}
              </span>
            ) : (
              <span>⏳ 入职 {employee.joinDay} 天（7 天后揭示属性）</span>
            )}
          </div>
        </div>
      </div>

      {/* 效率 & 士气 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-black/[0.03] rounded-card px-3 py-2.5">
          <div className="text-xs text-sub mb-0.5">效率系数</div>
          <div className="text-lg font-bold text-ink">{efficiency}×</div>
        </div>
        <div className="bg-black/[0.03] rounded-card px-3 py-2.5">
          <div className="text-xs text-sub mb-0.5">士气</div>
          <div className="h-4 bg-black/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${moraleColor}`}
              style={{ width: moraleBarWidth }}
            />
          </div>
          <div className="text-xs text-sub mt-0.5 text-right">{employee.morale}/100</div>
        </div>
      </div>

      {/* 排班统计 */}
      <div className="space-y-1.5 mb-4 text-sm">
        <div className="flex justify-between">
          <span className="text-sub">本周已上班</span>
          <span className="text-ink font-medium">{employee.daysWorkedThisWeek} 天</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sub">连续工作</span>
          <span className="text-ink font-medium">{employee.consecutiveWorkDays} 天</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sub">今日状态</span>
          <span className={employee.isScheduledToday ? 'text-primary font-medium' : 'text-sub'}>
            {employee.isScheduledToday ? '排班中 ✅' : '休息中 💤'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sub">月薪</span>
          <span className="text-ink font-medium">{fmtMoney(employee.monthlySalary)}/月</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sub">入职天数</span>
          <span className="text-ink font-medium">{employee.joinDay} 天</span>
        </div>
        {employee.isTempStaff && (
          <div className="flex justify-between">
            <span className="text-sub">员工类型</span>
            <span className="text-primary font-medium">临时员工</span>
          </div>
        )}
      </div>

      {/* 特性说明 */}
      {employee.isExposed && (
        <div className="bg-primary/5 rounded-card px-3 py-2.5 mb-4">
          <div className="text-xs text-sub mb-1">💡 特性说明</div>
          <div className="text-sm text-ink">{ATTRIBUTE_DESCRIPTIONS[employee.attribute]}</div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="space-y-2">
        <Button
          variant="secondary"
          fullWidth
          onClick={() => setSchedule(employee.id, !employee.isScheduledToday)}
        >
          {employee.isScheduledToday ? '💤 今天休息' : '✅ 今天排班'}
        </Button>
        <Button
          variant="secondary"
          fullWidth
          onClick={() => {
            const amount = 500;
            if (window.confirm(`确认给 ${employee.name} 涨薪 ${fmtMoney(amount)}？`)) {
              adjustSalary(employee.id, amount);
            }
          }}
        >
          💰 涨工资 ¥500
        </Button>
        {!employee.isTempStaff && (
          <Button
            variant="danger"
            fullWidth
            onClick={() => onLayoff(employee)}
          >
            💔 裁人
          </Button>
        )}
      </div>
    </Modal>
  );
}
