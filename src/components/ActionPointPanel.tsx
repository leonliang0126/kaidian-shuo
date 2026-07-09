// 行动点面板：展示行动点 N/max + 行动卡（成本/预估/代价/冷却/二次确认）。
// 危机态（cash<0）下普通行动被 canTakeAction 拦截，由 CrisisModal 处理。
import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { canTakeAction } from '../core/actionSystem';
import { listActionsByCategory } from '../data/actionDefs';
import type { ActionCategory, ActionDef } from '../types/actions';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { fmtMoney } from '../utils/format';
import clsx from 'clsx';

const CATEGORIES: ActionCategory[] = [
  '稳口碑',
  '拉客流',
  '管员工',
  '救现金',
  '控风险',
  '谈资源',
];

export function ActionPointPanel() {
  const game = useGameStore((s) => s.game);
  const chooseAction = useGameStore((s) => s.chooseAction);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  if (!game) return null;

  const ap = game.actionPointsCurrent;
  const apMax = game.actionPointsMax;
  const inCrisis = game.cash < 0;

  const handleClick = (a: ActionDef) => {
    if (a.requiresConfirmation) {
      setConfirmId(a.actionId);
      return;
    }
    chooseAction(a.actionId);
  };

  return (
    <div className="space-y-3">
      <Card className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-ink">行动点</div>
          <div className={clsx('text-sm font-bold', ap > 0 ? 'text-primary' : 'text-risk')}>
            {ap} / {apMax}
          </div>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-black/10 overflow-hidden">
          <div
            className="h-full bg-primary"
            style={{ width: `${apMax > 0 ? (ap / apMax) * 100 : 0}%` }}
          />
        </div>
        {inCrisis && (
          <div className="text-xs text-risk mt-2">现金流为负，普通行动已暂停，请先在危机面板处理。</div>
        )}
      </Card>

      {CATEGORIES.map((cat) => {
        const actions = listActionsByCategory(cat);
        if (actions.length === 0) return null;
        return (
          <Card key={cat} className="px-4 py-3">
            <div className="text-sm font-semibold text-ink mb-2">{cat}</div>
            <div className="grid grid-cols-1 gap-2">
              {actions.map((a) => {
                const check = canTakeAction(game, a.actionId);
                const disabled = !check.ok;
                const onCooldown =
                  game.actionCooldowns[a.actionId] !== undefined &&
                  game.actionCooldowns[a.actionId] > game.day;
                return (
                  <div
                    key={a.actionId}
                    className={clsx(
                      'rounded-card border px-3 py-2',
                      disabled ? 'border-black/5 bg-black/[0.02]' : 'border-black/10 bg-white',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-ink">{a.name}</div>
                      <div className="flex items-center gap-2 text-xs text-sub">
                        <span>AP {a.costAP}</span>
                        {a.costCash.max > 0 && (
                          <span>¥{fmtMoney(a.costCash.min)}~{fmtMoney(a.costCash.max)}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-sub mt-0.5">{a.tradeoff}</div>
                    <div className="mt-2 flex items-center gap-2">
                      {a.requiresConfirmation && confirmId === a.actionId ? (
                        <>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => {
                              chooseAction(a.actionId);
                              setConfirmId(null);
                            }}
                          >
                            确认
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => setConfirmId(null)}>
                            取消
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          disabled={disabled}
                          variant={disabled ? 'secondary' : 'primary'}
                          onClick={() => handleClick(a)}
                        >
                          {disabled
                            ? check.reason ?? '不可用'
                            : onCooldown
                              ? '冷却中'
                              : '执行'}
                        </Button>
                      )}
                    </div>
                    {a.requiresConfirmation && confirmId === a.actionId && (
                      <div className="text-xs text-risk mt-1 whitespace-pre-line">
                        {a.confirmationText}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
