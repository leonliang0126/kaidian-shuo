// 客流组合效果表（T03 · P1 增强）
// 渲染 5×5 矩阵（选址 × 品类），展示综合波动系数并按下线着色。
import {
  generateTrafficComboRows,
  isWeekend,
  TRAFFIC_LEVEL_HIGH,
  TRAFFIC_LEVEL_LOW,
  LOCATION_TRAFFIC_WAVE,
  STORE_TRAFFIC_WAVE,
} from '../data/trafficPatterns';
import { levelClassName } from '../utils/trafficUI';
import type { LocationType, StoreType } from '../types';

interface Props {
  day: number;
}

const LOCATION_TYPES = Object.keys(LOCATION_TRAFFIC_WAVE) as LocationType[];
const STORE_TYPES = Object.keys(STORE_TRAFFIC_WAVE) as StoreType[];

export default function TrafficComboTable({ day }: Props) {
  const weekendFlag = isWeekend(day);
  const rows = generateTrafficComboRows(weekendFlag);

  // 用 `${locationType}|${storeType}` 建立查找表，便于按矩阵取数
  const rowMap = new Map<string, (typeof rows)[number]>();
  rows.forEach((r) => rowMap.set(`${r.locationType}|${r.storeType}`, r));

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-center text-xs">
        <thead>
          <tr>
            <th className="p-1 text-left text-sub">选址 ＼ 品类</th>
            {STORE_TYPES.map((st) => (
              <th key={st} className="p-1 font-semibold text-ink">
                {st}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LOCATION_TYPES.map((loc) => (
            <tr key={loc}>
              <td className="p-1 text-left font-semibold text-ink">{loc}</td>
              {STORE_TYPES.map((st) => {
                const r = rowMap.get(`${loc}|${st}`);
                if (!r) return <td key={st} className="p-1" />;
                return (
                  <td key={st} className="p-1">
                    <span
                      className={`inline-block min-w-[3rem] rounded px-1.5 py-0.5 font-semibold ${levelClassName(
                        r.level,
                      )}`}
                    >
                      {r.combined.toFixed(2)}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-sub">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-orange-100" /> 暴增 ≥ {TRAFFIC_LEVEL_HIGH.toFixed(2)}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-zinc-100" /> 平稳 {TRAFFIC_LEVEL_LOW.toFixed(2)}–{(TRAFFIC_LEVEL_HIGH - 0.01).toFixed(2)}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-blue-100" /> 清淡 &lt; {TRAFFIC_LEVEL_LOW.toFixed(2)}
        </span>
        <span>当前视图：{weekendFlag ? '周末' : '工作日'}</span>
      </div>
    </div>
  );
}
