// 月度结算弹窗：展示月度报表与下月经营选项。
import { useGameStore } from '../../store/gameStore';
import { Modal } from '../ui/Modal';
import { fmtMoney, fmtPct, fmtSignedMoney } from '../../utils/format';

const DEBT_PRESSURE_LABEL: Record<string, string> = {
  light: '轻',
  medium: '中',
  heavy: '重',
};

export function MonthModal() {
  const report = useGameStore((s) => s.monthModal);
  const choose = useGameStore((s) => s.chooseMonthOption);
  if (!report) return null;

  return (
    <Modal open title={`第 ${report.month} 月 · 月度结算`} dismissable={false}>
      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
        <Stat label="月流水" value={fmtMoney(report.revenue)} />
        <Stat label="月毛利" value={fmtMoney(report.grossProfit)} />
        <Stat
          label="月净利"
          value={fmtSignedMoney(report.netProfit)}
          tone={report.netProfit >= 0 ? 'profit' : 'risk'}
        />
        <Stat label="现金" value={fmtMoney(report.cash)} />
        <Stat label="债务" value={fmtMoney(report.debt)} />
        <Stat label="债务压力" value={DEBT_PRESSURE_LABEL[report.debtPressure] ?? report.debtPressure} />
      </div>
      <div className="rounded-card bg-black/[0.03] px-4 py-3 text-xs space-y-1 mb-3">
        <Line k="房租占比" v={fmtPct(report.rentRatio)} />
        <Line k="人工占比" v={fmtPct(report.staffRatio)} />
        <Line k="推广效率" v={report.promoEfficiency.toFixed(1)} />
        <Line k="外卖占比" v={fmtPct(report.deliveryRatio)} />
        <Line k="复购变化" v={fmtPct(report.repurchaseChange)} />
        <Line k="评分变化" v={`${report.ratingChange >= 0 ? '+' : ''}${report.ratingChange.toFixed(1)}`} />
      </div>
      {report.wind.lines.length > 0 && (
        <div className="text-xs text-sub mb-3">店里风向：{report.wind.lines[0]}</div>
      )}
      <div className="space-y-2">
        {report.options.map((o) => (
          <button
            key={o.id}
            onClick={() => choose(o.id)}
            className="w-full text-left rounded-card border border-black/5 bg-black/[0.02] px-4 py-3 active:bg-black/5"
          >
            <div className="text-sm font-semibold text-ink">{o.label}</div>
            <div className="text-xs text-sub mt-1 leading-snug">{o.desc}</div>
          </button>
        ))}
      </div>
    </Modal>
  );
}

function Stat({
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
    <div className="rounded-xl bg-black/[0.03] px-3 py-2">
      <div className="text-xs text-sub">{label}</div>
      <div className={`text-sm font-bold mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sub">{k}</span>
      <span className="text-ink font-medium">{v}</span>
    </div>
  );
}
