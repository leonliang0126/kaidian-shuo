// 经营漏斗（自研 SVG，无图表库）：曝光 → 进店 → 成交 → 复购后订单。
// 架构 §5.3：订单 = (堂食+外卖)×(1+复购率)×… 故「复购后订单」可能宽于「成交」，属正常。
import type { DailyResult } from '../types';
import { fmtInt } from '../utils/format';

interface FunnelChartProps {
  result: DailyResult;
}

const COLORS = ['#FF7A1A', '#FF9A4D', '#34B98A', '#1FA971'];

export function FunnelChart({ result }: FunnelChartProps) {
  const exposure = Math.max(result.exposure, 1);
  const entered = exposure * result.entryRate;
  const converted = entered * result.conversionRate;
  const rows = [
    { label: '曝光', value: exposure },
    { label: '进店', value: entered },
    { label: '成交', value: converted },
    { label: '复购后订单', value: Math.max(result.orders, converted) },
  ];

  return (
    <svg viewBox="0 0 320 224" className="w-full" role="img" aria-label="经营漏斗">
      {rows.map((r, i) => {
        const barW = Math.max(12, (r.value / exposure) * 300);
        const x = (320 - barW) / 2;
        const y = 10 + i * 52;
        return (
          <g key={r.label}>
            <rect x={x} y={y} width={barW} height={36} rx={8} fill={COLORS[i]} opacity={0.92} />
            <text x={160} y={y + 23} textAnchor="middle" fontSize={13} fill="#fff" fontWeight={600}>
              {r.label} {fmtInt(Math.round(r.value))}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
