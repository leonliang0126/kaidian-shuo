// 现金流危机面板：数据驱动的 3 类应急借款 + 7 个危机应对行动。
// 借款/部分行动消耗 1 行动点；AP=0 时全部禁用（不可透支，doc §5.1 / §5.7）。
import { useGameStore } from '../../store/gameStore';
import { Modal } from '../ui/Modal';
import { CRISIS_ACTIONS } from '../../data/crisisActionDefs';
import type { LoanChannel } from '../../types/actions';
import { fmtMoney } from '../../utils/format';
import clsx from 'clsx';

// 借款类危机行动 → 真实贷款渠道
const LOAN_ACTIONS: { id: string; channel: LoanChannel; tag: string }[] = [
  { id: 'bank_loan', channel: 'bank', tag: '银行 4%' },
  { id: 'friend_family_loan', channel: 'private', tag: '亲友 12%' },
  { id: 'micro_loan', channel: 'predatory', tag: '周转 36%' },
];

const LOAN_IDS = new Set(LOAN_ACTIONS.map((l) => l.id));

export function CrisisModal() {
  const open = useGameStore((s) => s.crisisOpen);
  const game = useGameStore((s) => s.game);
  const takeCrisisLoan = useGameStore((s) => s.takeCrisisLoan);
  const takeCrisisAction = useGameStore((s) => s.takeCrisisAction);
  if (!open || !game) return null;

  const ap = game.actionPointsCurrent;
  const noAp = ap <= 0;

  const loanDef = (id: string) => CRISIS_ACTIONS.find((a) => a.id === id);
  const nonLoanActions = CRISIS_ACTIONS.filter((a) => !LOAN_IDS.has(a.id));

  return (
    <Modal open title="现金流危机" dismissable={false}>
      <div className="rounded-card bg-risk/10 px-4 py-3 mb-3">
        <div className="text-base font-bold text-risk">现金 {fmtMoney(game.cash)}</div>
        <p className="text-xs text-risk/80 mt-1 leading-snug">
          现金流为负，必须先止血。借款或部分应对会消耗 1 行动点。
        </p>
      </div>

      {/* 应急借款 */}
      <div className="text-sm font-semibold text-ink mb-2">应急借款</div>
      <div className="space-y-2">
        {LOAN_ACTIONS.map((l) => {
          const def = loanDef(l.id);
          return (
            <button
              key={l.id}
              disabled={noAp}
              onClick={() => takeCrisisLoan(l.channel)}
              className={clsx(
                'w-full text-left rounded-card border px-4 py-3 transition-colors',
                noAp
                  ? 'border-black/5 bg-black/[0.02] opacity-50'
                  : 'border-risk/30 bg-risk/[0.04] active:bg-risk/10',
              )}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-ink">{def?.name}</div>
                <span className="text-xs text-sub">{l.tag}</span>
              </div>
              {def?.effect && <div className="text-xs text-sub mt-1 leading-snug">{def.effect}</div>}
              <div className="text-[11px] text-risk mt-1">消耗 1 行动点（剩 {ap}）</div>
            </button>
          );
        })}
      </div>

      {/* 危机应对（非借款） */}
      <div className="text-sm font-semibold text-ink mt-4 mb-2">危机应对</div>
      <div className="space-y-2">
        {nonLoanActions.map((a) => {
          const isClose = a.id === 'close_shop';
          return (
            <button
              key={a.id}
              disabled={noAp && !isClose}
              onClick={() => takeCrisisAction(a.id)}
              className={clsx(
                'w-full text-left rounded-card border px-4 py-3 transition-colors',
                isClose
                  ? 'border-black/15 bg-black/[0.03] active:bg-black/[0.06]'
                  : noAp
                  ? 'border-black/5 bg-black/[0.02] opacity-50'
                  : 'border-black/10 bg-white active:bg-black/[0.04]',
              )}
            >
              <div className="text-sm font-semibold text-ink">{a.name}</div>
              {a.effect && <div className="text-xs text-sub mt-1 leading-snug">{a.effect}</div>}
              {a.risk && <div className="text-[11px] text-risk/80 mt-1">风险：{a.risk}</div>}
            </button>
          );
        })}
      </div>

      {noAp && (
        <div className="text-[11px] text-sub mt-3 text-center">
          行动点已耗尽，借款与多数应对暂不可用——先结束今天恢复行动点再处理。
        </div>
      )}
    </Modal>
  );
}
