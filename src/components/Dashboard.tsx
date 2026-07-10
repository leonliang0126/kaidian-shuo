// 今日经营仪表盘：流水/毛利/净利 + 成本拆解 + 漏斗 + 现金曲线 + 复购/供应。
// 分页重构（T04）：新增 showCashCurve（默认 true）；HomePage 传 false 自行在末尾渲染现金曲线。
import { useGameStore } from '../store/gameStore';
import { Card } from './ui/Card';
import { FunnelChart } from './FunnelChart';
import { CashCurve } from './CashCurve';
import { fmtMoney, fmtSignedMoney, fmtPct } from '../utils/format';

interface DashboardProps {
  /** 是否渲染「现金曲线」卡。默认 true 向后兼容；HomePage 传 false 自行在末尾渲染。 */
  showCashCurve?: boolean;
}

export function Dashboard({ showCashCurve = true }: DashboardProps) {
  const game = useGameStore((s) => s.game);
  if (!game) return null;
  const r = game.lastSettlement;
  const main = game.stores[0];

  return (
    <div className="space-y-3">
      <Card className="px-4 py-3">
        <div className="text-sm font-semibold text-ink mb-2">今日经营</div>
        {r ? (
          <div className="grid grid-cols-3 gap-2 text-center">
            <Metric label="流水" value={fmtMoney(r.revenue)} />
            <Metric label="毛利" value={fmtMoney(r.grossProfit)} tone="profit" />
            <Metric
              label="净利"
              value={fmtSignedMoney(r.netProfit)}
              tone={r.netProfit >= 0 ? 'profit' : 'risk'}
            />
          </div>
        ) : (
          <div className="text-sm text-sub py-2 text-center">结束今天后，这里会显示今日结算。</div>
        )}
        {r && (
          <div className="mt-3 text-xs text-sub flex flex-wrap gap-x-4 gap-y-1">
            <span>推广 -{fmtMoney(r.promoCost)}</span>
            <span>人工 -{fmtMoney(r.staffCost)}</span>
            <span>房租日摊 -{fmtMoney(r.fixedCostDaily)}</span>
            <span>平台 -{fmtMoney(r.platformCost)}</span>
          </div>
        )}
      </Card>

      {r && (
        <Card className="px-4 py-3">
          <div className="text-sm font-semibold text-ink mb-1">经营漏斗</div>
          <FunnelChart result={r} />
        </Card>
      )}

      {/* 复购 & 供应（v3 增量） */}
      {main && (
        <Card className="px-4 py-3">
          <div className="text-sm font-semibold text-ink mb-2">复购 & 供应</div>
          <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-sm">
            <KeyValue label="复购热度" value={`${Math.round(main.heat)} / 100`} />
            <KeyValue label="复购率" value={fmtPct(main.repurchaseRate, 0)} />
            <KeyValue label="批次品质" value={`${Math.round(main.currentBatchQuality)} / 100`} />
            <KeyValue label="供应稳定" value={`${Math.round(main.supplierStability * 100)}%`} />
            <KeyValue label="月供" value={fmtMoney(game.monthlyRepayment)} />
            <KeyValue label="负债" value={fmtMoney(game.debt)} />
          </div>
        </Card>
      )}

      {/* 现金曲线（决策①：HomePage 传 false，自行在末尾渲染） */}
      {showCashCurve && (
        <Card className="px-4 py-3">
          <div className="text-sm font-semibold text-ink mb-1">现金曲线</div>
          <CashCurve log={game.businessLog} />
        </Card>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'profit' | 'risk';
}) {
  const color = tone === 'profit' ? 'text-profit' : tone === 'risk' ? 'text-risk' : 'text-ink';
  return (
    <div className="rounded-xl bg-black/[0.03] px-2 py-2">
      <div className="text-xs text-sub">{label}</div>
      <div className={`text-base font-bold mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sub">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}
