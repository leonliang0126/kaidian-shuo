// 《开店说》v3 行动/重点/危机/贷款 类型定义（数据驱动 schema）
// 数据真相源：actions.v0.2.json / business-focus.v0.2.json / crisis-actions.v0.2.json（只读拷贝）
import type { EndingDef } from './events';
import type { DayModifiers, HiddenLines, SoftHidden } from './index';

/** 行动分类（与 actions.v0.2.json 的 category 对齐）。 */
export type ActionCategory =
  | '稳口碑'
  | '拉客流'
  | '管员工'
  | '救现金'
  | '控风险'
  | '谈资源';

/** 暗线字母代号 → HiddenLines/SoftHidden/credit 键（见 actionScale.HIDDEN_LETTER_TO_KEY）。 */
export type HiddenLetter =
  | 'TRUST'
  | 'PRICE'
  | 'HYPE'
  | 'LAND'
  | 'STAFF'
  | 'BOSS_STRAIN'
  | 'HYGIENE'
  | 'SUPPLY'
  | 'PLATFORM'
  | 'CREDIT';

/** 行动卡（来自 actions.v0.2.json，只读）。 */
export interface ActionDef {
  actionId: string;
  name: string;
  category: ActionCategory;
  costAP: number;
  costCash: { min: number; max: number };
  cooldownDays: number;
  visibleEffects: Record<string, string>;
  hiddenEffects: Record<string, number | string>;
  eventWeightEffects: Record<string, number | string>;
  windMessages: string[];
  tradeoff: string;
  crisisAvailable: boolean;
  requiresNonCrisis: boolean;
  requiresConfirmation?: boolean;
  confirmationText?: string;
  resultChances?: { success: number; neutral: number; fail: number };
}

/** 经营重点（来自 business-focus.v0.2.json，只读）。 */
export interface FocusDef {
  id: string;
  name: string;
  description: string;
  effectTags: string[];
  modifiers: Record<string, number>;
}

/** 危机行动（来自 crisis-actions.v0.2.json，只读文本；数值效果见 data/crisisActionDefs.ts）。 */
export interface CrisisActionDef {
  id: string;
  name: string;
  effect: string;
  risk: string;
}

/** 真实债务渠道。 */
export type LoanChannel = 'bank' | 'private' | 'predatory';

/** 真实债务（放入 GameState.loans）。 */
export interface Loan {
  id: string;
  channel: LoanChannel;
  principal: number;
  apr: number;
  balance: number;
  accruedInterest: number;
  startDate: number;
  overdueDays: number;
  /** 可选：第几笔高利贷（仅 UI 文案展示用，如"第3笔 81%"），非逻辑必需。 */
  loanNo?: number;
  /** 可选：是否为开局一次性 setup 超额贷款（非危机贷）。收店判定不计此类贷款，避免超额开局误判收店。 */
  isSetup?: boolean;
}

/** 玩家发起危机贷款前的可借性检查结果。 */
export interface CrisisLoanCheck {
  ok: boolean;
  reason: 'cap' | 'ap' | null;
}

/** 行动翻译后的可结算效果（纯数据，进入 dayModifiers / hidden / soft / eventWeights）。 */
export interface ActionEffects {
  mods: DayModifiers;
  hidden: Partial<Record<keyof HiddenLines, number>>;
  soft: Partial<Record<keyof SoftHidden, number>>;
  credit: number;
  eventWeights: Record<string, number>;
  windMessages: string[];
  costMultiplier: number;
}

/** 经营重点解析后的修正描述（供 UI 展示，actionSystem 内部复用）。 */
export interface FocusModifiers {
  categoryVisibleMult?: { category: ActionCategory; fields: (keyof DayModifiers)[]; mult: number }[];
  costMultiplier?: number;
  hiddenGain?: { key: keyof HiddenLines; amount: number }[];
}

/** 事件明线冲击结果。 */
export interface ShockResult {
  mods: Partial<DayModifiers>;
  cashDelta: number;
  ratingDelta: number;
  hardHit: boolean;
}

/** 行动结算日志（供 UI 展示，不持久化进 GameState）。 */
export interface ActionLog {
  day: number;
  actionId: string;
  name: string;
  cashDelta: number;
  visibleSummary: string;
}

/** 结局判定结果（endingEngine 返回，EndingScreen 展示）。 */
export interface EndingResult {
  def: EndingDef;
  tone: 'win' | 'lose';
  cause: string;
  stats: {
    days: number;
    peakNetWorth: number;
    cumulativeNetProfit: number;
    storeCount: number;
    netWorth: number;
  };
}
