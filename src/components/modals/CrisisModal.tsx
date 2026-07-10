// 现金流危机面板：数据驱动的 3 类应急借款 + 7 个危机应对行动。
// 借款/部分行动消耗 1 行动点；AP=0 时全部禁用（不可透支，doc §5.1 / §5.7）。
// 贷款子系统增量修复（INCREMENTAL_LOANFIX）：
//   - 玩家危机借款满 CRISIS_LOAN_BANK_CUTOFF 笔后（isBankPrivateLocked）禁用 银行/亲友，仅许高利贷；
//   - 触及 80% 净资上限（isCrisisLoanOverCap）时禁用全部借款按钮并提示；
//   - 高利贷按钮文案展示当前飙升利率（周转 X%）。
import { useGameStore } from '../../store/gameStore';
import { Modal } from '../ui/Modal';
import { CRISIS_ACTIONS, getCrisisActionMaxUses } from '../../data/crisisActionDefs';
import type { LoanChannel } from '../../types/actions';
import { fmtMoney } from '../../utils/format';
import clsx from 'clsx';
import { predatoryLoanApr } from '../../data/setupCosts';
import { isCrisisLoanOverCap, isBankPrivateLocked } from '../../core/loanSystem';

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
  // 玩家危机借款满 CRISIS_LOAN_BANK_CUTOFF 笔 → 银行/亲友禁用、仅许高利贷
  const bankPrivateLocked = isBankPrivateLocked(game);
  // 触及 80% 净资上限：全部借款禁用
  const overCap = isCrisisLoanOverCap(game);
  // 高利贷当前飙升利率文案（如 周转 54%）
  const predatoryTag = `周转 ${Math.round(predatoryLoanApr(game.predatoryLoanCount) * 100)}%`;

  // 银行/亲友锁死（bankPrivateLocked）时按钮不硬 disabled，点击仍会触发 takeCrisisLoan，
  // 由 store 拦截并弹出"风控拒/彻底拒绝"故事；其余非锁死情况（noAp / overCap / 当天被拒）仍禁用。
  const loanBlocked = game.crisisLoanBlockedToday;
  const loanDisabled = (l: { channel: LoanChannel }): boolean =>
    noAp || (l.channel !== 'predatory' && overCap) || loanBlocked;

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

      {overCap && (
        <div className="rounded-card bg-risk/15 border border-risk/30 px-4 py-2 mb-3 text-xs text-risk font-semibold">
          债务已达净资 80% 上限，银行和亲友不再出借——但高利贷仍可尝试（利率逐笔飙升）。
        </div>
      )}
      {!overCap && bankPrivateLocked && (
        <div className="rounded-card bg-risk/10 border border-risk/20 px-4 py-2 mb-3 text-xs text-risk/90">
          银行/亲友续命已用尽，仅可借高利贷（利率逐笔飙升）。
        </div>
      )}

      {/* 应急借款 */}
      <div className="text-sm font-semibold text-ink mb-2">应急借款</div>
      <div className="space-y-2">
        {LOAN_ACTIONS.map((l) => {
          const def = loanDef(l.id);
          const disabled = loanDisabled(l);
          const tag = l.channel === 'predatory' ? predatoryTag : l.tag;
          return (
            <button
              key={l.id}
              disabled={disabled}
              onClick={() => takeCrisisLoan(l.channel)}
              className={clsx(
                'w-full text-left rounded-card border px-4 py-3 transition-colors',
                disabled
                  ? 'border-black/5 bg-black/[0.02] opacity-50'
                  : 'border-risk/30 bg-risk/[0.04] active:bg-risk/10',
              )}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-ink">{def?.name}</div>
                <span className="text-xs text-sub">{tag}</span>
              </div>
              {def?.effect && <div className="text-xs text-sub mt-1 leading-snug">{def.effect}</div>}
              <div className="text-[11px] text-risk mt-1">消耗 1 行动点（剩 {ap}）</div>
              {loanBlocked && (
                <div className="text-[11px] text-risk mt-1 font-semibold">今日已被拒，明天再来</div>
              )}
            </button>
          );
        })}
      </div>

      {/* 危机应对（非借款） */}
      <div className="text-sm font-semibold text-ink mt-4 mb-2">危机应对</div>
      <div className="space-y-2">
        {nonLoanActions.map((a) => {
          const isClose = a.id === 'close_shop';
          const isLayoff = a.id === 'layoff';
          // 零员工时裁员不可用（Bug 5）
          const noEmployees = isLayoff && (game.stores[0]?.employees?.length ?? 0) === 0;
          // 使用次数上限（防无限拖延）：temporary_price_increase / close_shop 不设限制
          const max = getCrisisActionMaxUses(a.id);
          const isLimited = max !== Infinity;
          const used = game.crisisActionUsed?.[a.id] ?? 0;
          const exhausted = isLimited && used >= max;
          const actionDisabled = (noAp && !isClose) || exhausted || noEmployees;
          return (
            <button
              key={a.id}
              disabled={actionDisabled}
              onClick={() => takeCrisisAction(a.id)}
              className={clsx(
                'w-full text-left rounded-card border px-4 py-3 transition-colors',
                isClose
                  ? 'border-black/15 bg-black/[0.03] active:bg-black/[0.06]'
                  : actionDisabled
                  ? 'border-black/5 bg-black/[0.02] opacity-50'
                  : 'border-black/10 bg-white active:bg-black/[0.04]',
              )}
            >
              <div className="text-sm font-semibold text-ink">{a.name}</div>
              {a.effect && <div className="text-xs text-sub mt-1 leading-snug">{a.effect}</div>}
              {a.risk && <div className="text-[11px] text-risk/80 mt-1">风险：{a.risk}</div>}
              {isLimited && (
                <div className="text-[11px] text-sub mt-1">
                  {exhausted ? `已用尽（${max}/${max}）` : `已用 ${used}/${max}`}
                </div>
              )}
              {noEmployees && (
                <div className="text-[11px] text-risk mt-1 font-semibold">无员工可裁</div>
              )}
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
