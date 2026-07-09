// 现金曲线（自研 SVG，无图表库）：以经营日志的每日结算后现金绘制。
import type { BusinessLogEntry } from '../types';

interface CashCurveProps {
  log: BusinessLogEntry[];
}

export function CashCurve({ log }: CashCurveProps) {
  if (log.length < 2) {
    return (
      <div className="text-sm text-sub py-6 text-center">
        经营几天后，这里会画出你的现金曲线。
      </div>
    );
  }

  const w = 320;
  const h = 120;
  const pad = 10;
  const days = log.map((e) => e.day);
  const cashs = log.map((e) => e.cashAfter);
  const minDay = Math.min(...days);
  const maxDay = Math.max(...days);
  const minC = Math.min(0, ...cashs);
  const maxC = Math.max(0, ...cashs);
  const spanC = maxC - minC || 1;
  const spanD = maxDay - minDay || 1;

  const xOf = (d: number) => pad + ((d - minDay) / spanD) * (w - 2 * pad);
  const yOf = (c: number) => h - pad - ((c - minC) / spanC) * (h - 2 * pad);

  const pts = log.map((e) => `${xOf(e.day).toFixed(1)},${yOf(e.cashAfter).toFixed(1)}`).join(' ');
  const areaPts = `${pad},${h - pad} ${pts} ${w - pad},${h - pad}`;
  const zeroY = yOf(0);
  const stroke = cashs[cashs.length - 1] >= cashs[0] ? '#1FA971' : '#E5484D';
  const last = log[log.length - 1];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="现金曲线">
      {minC < 0 && maxC > 0 && (
        <line
          x1={pad}
          y1={zeroY}
          x2={w - pad}
          y2={zeroY}
          stroke="#E5484D"
          strokeDasharray="4 3"
          strokeWidth={1}
          opacity={0.5}
        />
      )}
      <polygon points={areaPts} fill={stroke} opacity={0.1} />
      <polyline
        points={pts}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={xOf(last.day)} cy={yOf(last.cashAfter)} r={3} fill={stroke} />
    </svg>
  );
}
