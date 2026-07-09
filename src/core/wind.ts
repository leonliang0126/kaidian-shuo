// 店里风向生成（架构 §9.4）：绝不显示数值，只显示症状文案。
import type { GameState, HiddenLines, WindLevel, WindMessage } from '../types';

interface WindRule {
  key: keyof HiddenLines;
  min: number; // 触发阈值（高于此值才可能显示）
  level: WindLevel;
  // 满足阈值时返回的文案（阈值越高越严重）
  texts: { threshold: number; text: string; level: WindLevel }[];
}

// 风向规则：按暗线从高到低取 top 1-4 条风险，映射等级与文案。
const RULES: WindRule[] = [
  {
    key: 'landlordAttention',
    min: 30,
    level: 'watch',
    texts: [
      { threshold: 50, text: '房东最近出现得有点频繁，他不像是来消费的。', level: 'warn' },
      { threshold: 70, text: '房东已经在盘算，这间店什么时候能换成别的人。', level: 'danger' },
      { threshold: 30, text: '房东好像多看了一眼你的店。', level: 'watch' },
    ],
  },
  {
    key: 'employeePressure',
    min: 40,
    level: 'watch',
    texts: [
      { threshold: 70, text: '里面的人已经不太想配合你演了。', level: 'danger' },
      { threshold: 55, text: '今天收档，里面的人明显变慢了。', level: 'warn' },
      { threshold: 40, text: '排班开始有点排不动了。', level: 'watch' },
    ],
  },
  {
    key: 'promoHype',
    min: 40,
    level: 'watch',
    texts: [
      { threshold: 60, text: '热闹是热闹，但你分不清哪些是真客人。', level: 'warn' },
      { threshold: 40, text: '热闹是热闹，但转化没跟上。', level: 'watch' },
    ],
  },
  {
    key: 'supplyRisk',
    min: 40,
    level: 'watch',
    texts: [
      { threshold: 60, text: '供应商那边，开始有点拿捏你了。', level: 'warn' },
      { threshold: 40, text: '供应链开始有点不稳。', level: 'watch' },
    ],
  },
  {
    key: 'platformDependence',
    min: 40,
    level: 'watch',
    texts: [
      { threshold: 60, text: '你越依赖平台，平台调规则时你越像乘客。', level: 'warn' },
      { threshold: 40, text: '平台的一点变动，你都得跟着抖。', level: 'watch' },
    ],
  },
  {
    key: 'hygieneRisk',
    min: 30,
    level: 'watch',
    texts: [
      { threshold: 50, text: '有些味道，检查的人比客人先闻到。', level: 'warn' },
      { threshold: 70, text: '后厨的味道，已经开始自己人了。', level: 'danger' },
      { threshold: 30, text: '后厨的味道，自己人先闻到了。', level: 'watch' },
    ],
  },
  {
    key: 'priceControversy',
    min: 30,
    level: 'watch',
    texts: [
      { threshold: 45, text: '评论区开始讨论你贵不贵了。', level: 'warn' },
      { threshold: 30, text: '有人开始嫌贵了。', level: 'watch' },
    ],
  },
  {
    key: 'customerTrust',
    min: 0,
    level: 'watch',
    // customerTrust 低才是风险（反向）
    texts: [
      { threshold: -1, text: '', level: 'watch' }, // 占位，见下方反向处理
    ],
  },
];

const LEVEL_RANK: Record<WindLevel, number> = { calm: 0, watch: 1, warn: 2, danger: 3 };

function maxLevel(lines: { level: WindLevel }[]): WindLevel {
  let best: WindLevel = 'calm';
  for (const l of lines) {
    if (LEVEL_RANK[l.level] > LEVEL_RANK[best]) best = l.level;
  }
  return best;
}

/** 生成当日店里风向（不暴露数值）。 */
export function generateWind(state: GameState): WindMessage {
  const h = state.hiddenLines;
  const candidates: { text: string; level: WindLevel; score: number }[] = [];

  for (const rule of RULES) {
    if (rule.key === 'customerTrust') {
      // 反向：信任越低风险越高
      if (h.customerTrust < 50) {
        const score = 50 - h.customerTrust;
        let text = '老客好像没那么愿意回来了。';
        let level: WindLevel = 'warn';
        if (h.customerTrust < 35) {
          text = '老客好像没那么愿意回来了。';
          level = 'danger';
        } else if (h.customerTrust < 42) {
          text = '老客来的频率，没以前高了。';
          level = 'warn';
        } else {
          text = '老客来的频率，没以前高了。';
          level = 'watch';
        }
        candidates.push({ text, level, score });
      }
      continue;
    }
    const val = h[rule.key];
    if (val < rule.min) continue;
    // 取满足阈值且最接近该值的文案
    const matched = rule.texts
      .filter((t) => val >= t.threshold)
      .sort((a, b) => b.threshold - a.threshold)[0];
    if (matched && matched.text) {
      candidates.push({ text: matched.text, level: matched.level, score: val });
    }
  }

  // 按分数从高到低取 top 4
  candidates.sort((a, b) => b.score - a.score);
  const top = candidates.slice(0, 4);

  if (top.length === 0) {
    return {
      day: state.day,
      level: 'calm',
      lines: ['今天店里还算平稳，没什么特别的苗头。'],
    };
  }

  return {
    day: state.day,
    level: maxLevel(top),
    lines: top.map((c) => c.text),
  };
}
