// 员工管理内容页（《开店说》员工系统重构 v3 · 分页重构 T05）。
// 排班摘要 + 员工卡片列表 + 招聘入口。
// 分页重构：由全屏遮罩改为 Tab2 内容页 —— 去除 fixed 遮罩外层、去除 staffPageOpen 开关门、去除 ✕ 关闭按钮。
// 内部「排班摘要 + 员工卡片 + 全员放假/+招聘」与 EmployeeDetailModal / LayoffConfirmModal 子浮层保留。
import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { EmployeeDetailModal } from './EmployeeDetailModal';
import { LayoffConfirmModal } from './LayoffConfirmModal';
import { computeCapacity, computeStaffCost, getScheduledCount, getMaxEmployees, dayOfWeekLabel } from '../core/staffSystem';
import { ATTRIBUTE_LABELS, ATTRIBUTE_EMOJI } from '../types/employee';
import type { Employee } from '../types/employee';
import { fmtMoney } from '../utils/format';
import { LOW_MORALE_THRESHOLD } from '../data/staffConstants';

export function StaffPage() {
  const game = useGameStore((s) => s.game);
  const setSchedule = useGameStore((s) => s.setSchedule);
  const openHirePage = useGameStore((s) => s.openHirePage);
  const allRestDay = useGameStore((s) => s.allRestDay);

  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [layoffTarget, setLayoffTarget] = useState<Employee | null>(null);

  if (!game) return null;
  const store = game.stores[0];
  if (!store) return null;

  const employees = store.employees ?? [];
  const scheduledCount = getScheduledCount(employees);
  const capacity = computeCapacity(employees);
  const staffCost = computeStaffCost(employees);
  const maxEmployees = getMaxEmployees(store.decorationLevel);

  return (
    // 内容页：普通流式容器（滚动由 AppShell 的页区负责），不再 fixed 全屏遮罩。
    <div className="space-y-3 px-4 py-2">
      {/* 标题行（无 ✕：作为 tab 内容页，随 tab 切换关闭） */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">员工管理</h2>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={allRestDay}>
            🏖️ 全员放假
          </Button>
          <Button variant="primary" size="sm" onClick={openHirePage}>
            +招聘
          </Button>
        </div>
      </div>

      {/* 排班摘要 */}
      <Card className="px-4 py-3">
        <div className="text-sm font-semibold text-ink mb-2">📊 排班摘要</div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-xs text-sub">今日在岗</div>
            <div className="text-base font-bold text-ink">
              {scheduledCount}/{maxEmployees}
            </div>
          </div>
          <div>
            <div className="text-xs text-sub">承载上限</div>
            <div className="text-base font-bold text-ink">{capacity} 单</div>
          </div>
          <div>
            <div className="text-xs text-sub">今日成本</div>
            <div className="text-base font-bold text-ink">{fmtMoney(staffCost)}</div>
          </div>
        </div>
        {employees.length === 0 && (
          <div className="mt-2 text-xs text-risk bg-risk/10 rounded-card px-3 py-2">
            ⚠️ 没有员工！请尽快招聘，否则只能老板亲自顶班。
          </div>
        )}
      </Card>

      {/* 员工卡片列表 */}
      {employees.length === 0 ? (
        <Card className="px-4 py-8 text-center">
          <div className="text-sub text-sm">还没有员工，点击"+招聘"招人吧</div>
        </Card>
      ) : (
        <div className="space-y-2">
          {employees.map((emp) => {
            const isLowMorale = emp.morale <= LOW_MORALE_THRESHOLD;
            return (
              <Card
                key={emp.id}
                className={isLowMorale ? 'px-4 py-3 border-risk/40 bg-risk/[0.04]' : 'px-4 py-3'}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{emp.name}</span>
                    {emp.isExposed ? (
                      <span className="text-xs bg-black/5 px-1.5 py-0.5 rounded-full">
                        {ATTRIBUTE_EMOJI[emp.attribute]} {ATTRIBUTE_LABELS[emp.attribute]}
                      </span>
                    ) : (
                      <span className="text-xs bg-black/5 px-1.5 py-0.5 rounded-full text-sub">
                        ⏳ 待揭示
                      </span>
                    )}
                    {emp.isTempStaff && (
                      <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                        临时
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-sm">
                    <div
                      className={
                        isLowMorale
                          ? 'text-risk font-semibold'
                          : emp.morale <= 40
                            ? 'text-warning'
                            : 'text-ink'
                      }
                    >
                      {isLowMorale ? '⚠️ ' : ''}士气 {emp.morale}
                    </div>
                  </div>
                </div>

                {/* 本周排班信息 */}
                <div className="flex items-center justify-between text-xs text-sub mb-2">
                  <span>
                    {dayOfWeekLabel(game.day)} · 本周已上: {emp.daysWorkedThisWeek}天
                    {emp.daysWorkedThisWeek >= 5 && (
                      <span className="text-risk ml-1">⚠️ 超时</span>
                    )}
                  </span>
                  <span>月薪 {fmtMoney(emp.monthlySalary)}</span>
                </div>

                {/* 操作行 */}
                <div className="flex items-center gap-2">
                  {/* 排班开关 */}
                  <button
                    onClick={() => setSchedule(emp.id, !emp.isScheduledToday)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      emp.isScheduledToday
                        ? 'bg-primary text-white'
                        : 'bg-black/5 text-sub'
                    }`}
                  >
                    {emp.isScheduledToday ? '✅ 排班中' : '💤 休息'}
                  </button>

                  <Button variant="ghost" size="sm" onClick={() => setSelectedEmployee(emp)}>
                    详情
                  </Button>

                  {!emp.isTempStaff && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-risk/70 ml-auto"
                      onClick={() => setLayoffTarget(emp)}
                    >
                      裁人
                    </Button>
                  )}
                </div>

                {isLowMorale && (
                  <div className="mt-1.5 text-[11px] text-risk font-medium">
                    濒临离职，建议安排休息或涨工资
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* 详情弹窗 */}
      {selectedEmployee && (
        <EmployeeDetailModal
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
          onLayoff={(emp) => {
            setSelectedEmployee(null);
            setLayoffTarget(emp);
          }}
        />
      )}

      {/* 裁人确认弹窗 */}
      {layoffTarget && (
        <LayoffConfirmModal
          employee={layoffTarget}
          onClose={() => setLayoffTarget(null)}
          onConfirm={() => {
            setLayoffTarget(null);
          }}
        />
      )}
    </div>
  );
}
