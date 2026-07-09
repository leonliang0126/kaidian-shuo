// 每日五项决策面板：供应商 / 售价 / 装修 / 推广 / 人工。
// 切换即调用 store.setDecision，由 core 应用即时效果（hidden/soft/cash）与结算 Pct。
import { useGameStore } from '../store/gameStore';
import { Card } from './ui/Card';
import {
  listOptions,
  getPromotionCost,
  type DecisionCategory,
} from '../data/decisionOptions';
import type { DecisionState } from '../types';
import { fmtInt } from '../utils/format';
import clsx from 'clsx';

interface CategoryDef {
  key: keyof DecisionState;
  label: string;
  cat: DecisionCategory;
  hint?: (id: string) => string | null;
}

const CATEGORIES: CategoryDef[] = [
  { key: 'supplierTier', label: '供应商', cat: 'supplierTier' },
  { key: 'priceStrategy', label: '售价', cat: 'priceStrategy' },
  {
    key: 'promotionTier',
    label: '推广',
    cat: 'promotionTier',
    hint: (id) => {
      const c = getPromotionCost(id);
      return c > 0 ? `每日 ¥${fmtInt(c)}` : null;
    },
  },
];

export function DecisionPanel() {
  const decisions = useGameStore((s) => s.game?.decisions);
  const setDecision = useGameStore((s) => s.setDecision);
  if (!decisions) return null;

  return (
    <div className="space-y-3">
      {CATEGORIES.map((c) => {
        const options = listOptions(c.cat);
        const current = decisions[c.key];
        return (
          <Card key={c.key} className="px-4 py-3">
            <div className="text-sm font-semibold text-ink mb-2">{c.label}</div>
            <div className="flex flex-wrap gap-2">
              {options.map((o) => {
                const active = o.id === current;
                const hint = c.hint?.(o.id);
                return (
                  <button
                    key={o.id}
                    onClick={() => setDecision(c.key, o.id as DecisionState[keyof DecisionState])}
                    className={clsx(
                      'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                      active
                        ? 'bg-primary text-white border-primary'
                        : 'bg-black/[0.03] text-ink border-transparent active:bg-black/10',
                    )}
                  >
                    {o.label}
                    {hint && (
                      <span className={clsx('ml-1 text-xs', active ? 'text-white/80' : 'text-sub')}>
                        {hint}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
