// 招聘页面（《开店说》员工系统重构 v3）
// 候选人卡片列表 + 隐晦描述 + 聘用/刷新按钮
import { useGameStore } from '../store/gameStore';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { fmtMoney } from '../utils/format';
import { REFRESH_CANDIDATES_AP_COST } from '../data/staffConstants';
import { getMaxEmployees } from '../core/staffSystem';

export function HirePage() {
  const open = useGameStore((s) => s.hirePageOpen);
  const game = useGameStore((s) => s.game);
  const candidates = useGameStore((s) => s.candidates);
  const hireEmployee = useGameStore((s) => s.hireEmployee);
  const refreshCandidates = useGameStore((s) => s.refreshCandidates);
  const closeHirePage = useGameStore((s) => s.closeHirePage);
  const openStaffPage = useGameStore((s) => s.openStaffPage);

  if (!open || !game) return null;

  const store = game.stores[0];
  if (!store) return null;

  const ap = game.actionPointsCurrent;
  const maxEmployees = getMaxEmployees(store.decorationLevel);
  const isFull = store.employees.length >= maxEmployees;

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      <div className="max-w-[480px] mx-auto px-4 py-4 space-y-3">
        {/* 标题行 */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">招聘新员工</h2>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => { closeHirePage(); openStaffPage(); }}>
              👥 员工管理
            </Button>
            <Button variant="ghost" size="sm" onClick={closeHirePage}>
              ✕
            </Button>
          </div>
        </div>

        {/* 行动点 & 员工上限 */}
        <div className="flex items-center justify-between text-sm">
          <div className="text-sub">
            行动点: <span className="font-semibold text-ink">{ap}/3</span>
          </div>
          <div className="text-sub">
            员工: <span className="font-semibold text-ink">{store.employees.length}/{maxEmployees}</span>
          </div>
        </div>

        {isFull && (
          <div className="rounded-card bg-warning/10 border border-warning/30 px-4 py-3 text-sm text-warning font-medium">
            ⚠️ 店铺已满（{maxEmployees} 人），无法再招聘新人。升级装修可增加员工上限。
          </div>
        )}

        {/* 候选人列表 */}
        {candidates.length === 0 ? (
          <Card className="px-4 py-8 text-center">
            <div className="text-sub text-sm mb-3">暂无候选人</div>
            <Button
              variant="primary"
              disabled={ap < REFRESH_CANDIDATES_AP_COST}
              onClick={refreshCandidates}
            >
              🔄 刷新候选人
              {ap >= REFRESH_CANDIDATES_AP_COST
                ? `（消耗 ${REFRESH_CANDIDATES_AP_COST} 行动点）`
                : '（行动点不足）'}
            </Button>
          </Card>
        ) : (
          <>
            <div className="space-y-3">
              {candidates.map((candidate) => (
                <Card key={candidate.id} className="px-4 py-3">
                  {/* 候选人姓名 */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-base font-bold text-ink">{candidate.name}</div>
                    <div className="text-sm text-sub">
                      期望 {fmtMoney(candidate.monthlySalary)}/月
                    </div>
                  </div>

                  {/* 隐晦自我介绍 */}
                  <div className="bg-black/[0.03] rounded-card px-3 py-2.5 mb-3 text-sm text-ink/80 leading-relaxed">
                    💬 "{candidate.hint}"
                  </div>

                  {/* 聘用按钮 */}
                  <Button
                    variant="primary"
                    fullWidth
                    disabled={ap < 1 || isFull}
                    onClick={() => hireEmployee(candidate.id)}
                  >
                    {isFull ? '店铺已满' : `聘用 - 消耗 1 行动点（剩 ${ap}）`}
                  </Button>
                </Card>
              ))}
            </div>

            {/* 刷新按钮 */}
            <div className="flex justify-center pt-1">
              <Button
                variant="secondary"
                disabled={ap < REFRESH_CANDIDATES_AP_COST}
                onClick={refreshCandidates}
              >
                🔄 刷新候选人
                {ap >= REFRESH_CANDIDATES_AP_COST
                  ? `（消耗 ${REFRESH_CANDIDATES_AP_COST} 行动点）`
                  : '（行动点不足）'}
              </Button>
            </div>
          </>
        )}

        {/* 底部留白 */}
        <div className="h-8" />
      </div>
    </div>
  );
}
