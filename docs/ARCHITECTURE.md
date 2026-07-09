# 《开店说》v0.1 系统架构设计 + 任务分解

> 作者：架构师（高见远） ｜ 版本：v0.1 ｜ 唯一事实来源：`handoff/开店说_v0.1_开发交接包/`
> 本文档只做**设计 + 拆解**，不写游戏业务实现代码。所有数值、类型、算法均力求让工程师"照着写就能通过测试"。
> 配套图：`docs/class-diagram.mermaid`（类型/类图）、`docs/sequence-diagram.mermaid`（每日循环时序图）。

---

## 0. 设计原则与硬约束（来自用户）

- 纯前端网页小游戏：**Vite + React + TypeScript + Tailwind CSS**，localStorage 存档，**无后端/登录/数据库/支付/云同步/多人排行/加盟/合伙/复杂 SKU**。
- 手机优先：白/暖白背景、圆角卡片、橙色主按钮、绿色盈利、红色风险、单列卡片流；电脑自适应。
- **不做**：3D 店铺、复杂地图、员工小人走路、装修摆放游戏、把所有隐藏数值直接展示给玩家、"30天=通关终点"、删掉现金流危机/月度结算/店里风向/随机事件/分店/隐藏结局。
- **"勇哥这样说"已删除**，统一用"店里风向"呈现暗线症状。
- 事件/状态/UI/结算公式**严格分离**，便于扩展（用户明确要求）。
- 数据文件（`decision-options.json`、`events.v0.1.json`、`endings.json`、`tutorial-modal.json`）**必须被游戏直接 import，不得重构其内容**。

---

## 1. 实现方案与框架选型

### 1.1 技术栈

| 层 | 选型 | 理由 |
|---|---|---|
| 构建 | Vite 5 + `@vitejs/plugin-react` | 极快 HMR；原生支持 JSON import（`import events from '../data/events.v0.1.json'`），正好满足"数据文件直接 import"的约束 |
| 语言 | TypeScript 5.4（strict） | 状态模型字段多、结算链路长，类型即文档，能挡住大量低级 bug |
| UI | React 18 + Tailwind CSS 3.4 | 手机卡片流用 Tailwind 原子类最快；配色用 CSS 变量约定（见 §9） |
| 状态管理 | **Zustand 4.5**（推荐） | 见下；core/* 保持纯函数，store 只是壳 |
| 图表 | **自建轻量 SVG 组件**（不引图表库） | 只有"四率漏斗"和"现金曲线"两个简单图，自建 SVG 零依赖、包体小、移动端样式完全可控；若后续图表变多再考虑 recharts |
| 随机 | 自实现可注入种子的 RNG（`core/rng.ts`） | 结算/事件可确定性复现，便于单元测试（见 §9） |

### 1.2 为什么选 Zustand 而非 useReducer+Context

- 游戏状态是一棵**单一、频繁整体更新**的树（GameState），每天结算一次性产生新状态。用纯函数 `resolveSettlement / applyEventEffect / runMonthSettlement` 计算新状态，`store.setState(newState)` 提交即可，无需拆 reducer 的样板。
- 纯函数 core/* 不依赖 React，可直接被 Vitest 单测（给定输入得到确定输出）。
- Zustand 支持 `subscribe`，便于"状态变化→落盘 localStorage"做自动持久化。
- 若团队更保守，可退回 `useReducer + Context`，但核心层（core/*）不变——本设计 core/* 与 UI 解耦，切换成本为零。

### 1.3 分层架构（事件/状态/UI/结算公式分离）

```
UI 层 (components/*)  ──只负责渲染与派发 action──▶  Store (store/gameStore.ts)
                                                          │ 调用
                                                          ▼
Core 层 (core/*)  ──纯函数：结算/事件/暗线/风向/月结/分店/危机/结局──▶  数据 (data/*.json + 新建议常量)
                          │ 读写
                          ▼
                    Types (types/*)  ←── 所有接口/类型单一来源
```

> 关键：**core/* 不 import React，不 import 任何组件**。UI 只调用 store action；store action 调用 core 纯函数得到新 GameState 后 setState + 存档。这样"结算公式"完全独立于"渲染"，方便扩展与测试。

---

## 2. 文件列表及相对路径

> 约定：项目根 `kaidian-shuo/`。`data/*.json` 为交接包原文件，**直接拷贝进 `src/data/` 并 import**，不改内容。`storeProfiles.ts / locationProfiles.ts / eventGate.ts / futureEffect.ts` 为本文档**新增建议文件**（放基准参数与触发判定），不属于用户数据文件。

```
kaidian-shuo/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── main.tsx                      # 入口
    ├── App.tsx                       # 路由/阶段切换：教程→开局→主循环
    ├── index.css                     # Tailwind 指令 + CSS 变量（配色）
    ├── types/
    │   ├── index.ts                  # GameState/StoreState/HiddenLines/SoftHidden/DailyResult/MonthlyReport/DecisionState 等
    │   └── events.ts                 # EventDef/EventOption/EffectObject/ForcedEvent
    ├── data/                         # 交接包数据，原样 import
    │   ├── decision-options.json     # （原文件，不改）
    │   ├── events.v0.1.json          # （原文件，不改）
    │   ├── endings.json              # （原文件，不改）
    │   ├── tutorial-modal.json       # （原文件，不改）
    │   ├── decisionOptions.ts        # export const DECISION_OPTIONS = import('./decision-options.json')
    │   ├── events.ts                 # export const EVENTS = import('./events.v0.1.json'); 并建 id→EventDef 索引
    │   ├── endings.ts                # export const ENDINGS = import('./endings.json')
    │   ├── tutorial.ts               # export const TUTORIAL = import('./tutorial-modal.json')
    │   ├── storeProfiles.ts          # 【新增】5 种店型基准参数表 STORE_PROFILES
    │   └── locationProfiles.ts       # 【新增】5 种商圈基准参数表 LOCATION_PROFILES
    ├── core/
    │   ├── rng.ts                    # 可注入种子的确定性随机 createRng(seed?)
    │   ├── storage.ts                # localStorage 存档层 save/load/clear，key 约定见 §9
    │   ├── createNewGame.ts          # 开局：由 OpeningConfig 生成 GameState（扣装修/开店成本）
    │   ├── modifiers.ts              # 聚合"决策 effects + 事件 effects"为 DayModifiers（统一修正累加器）
    │   ├── effectResolver.ts         # 【核心】通用 effect 解析器 applyEffects(state, effects, rng)
    │   ├── settlement.ts             # 每日结算 resolveSettlement(state, decisions, mods, rng) → DailyResult
    │   ├── hiddenLines.ts            # updateHiddenLines(state, mods) + 软暗线衰减
    │   ├── wind.ts                   # generateWind(state) → WindMessage[]（不暴露数值）
    │   ├── eventGate.ts              # 【新增】evaluateGate(event, state)：把 trigger 文本转成布尔判定
    │   ├── eventEngine.ts            # 抽事件：computeBaseProb → drawEvent（池权重/冷却/强制）
    │   ├── futureEffect.ts           # 【新增】pendingEffects 队列 + futureEffect/unlock 文本解析器
    │   ├── crisis.ts                 # 现金流危机判定与选项效果（F001/F002/F003 + 失败结局）
    │   ├── monthlyReport.ts          # 月度结算 runMonthSettlement(state) → MonthlyReport + 月结后选项
    │   ├── branch.ts                 # 分店：checkBranchUnlock / openBranch / 总部成本
    │   ├── endings.ts                # checkEndings(state) → EndingDef | null（隐藏+失败+止损）
    │   └── gameLoop.ts               # runDailyLoop(state, rng)：编排"新一天→…→写日志→风向→(月结)"
    ├── store/
    │   └── gameStore.ts              # Zustand store：持有 GameState + actions（startDay/chooseEventOption/setDecision/endDay/...）
    ├── components/
    │   ├── StatusBar.tsx             # 顶部状态栏：店名/店型/第X天第Y月/现金/今日净利
    │   ├── EventCard.tsx             # 今日事件卡（小/中/大 三档）
    │   ├── DecisionPanel.tsx         # 五项决策卡（默认压缩，点击展开）
    │   ├── RiskEstimate.tsx          # 今日风险预估（区间 + 风险文案）
    │   ├── EndDayButton.tsx          # 底部固定"结束今天"
    │   ├── BusinessLog.tsx           # 经营日志（列表）
    │   ├── WindPanel.tsx             # 店里风向
    │   ├── Dashboard.tsx             # 数据看板：流水/净利/保本线/安全线/毛利率/评分
    │   ├── FunnelChart.tsx           # 四率漏斗（自建 SVG）
    │   ├── CashCurve.tsx             # 现金曲线（自建 SVG）
    │   ├── OpeningSetup.tsx          # 开局选择：初始资金/店型/商圈/装修
    │   ├── modals/
    │   │   ├── TutorialModal.tsx     # 玩法说明弹窗
    │   │   ├── EventModal.tsx        # 事件弹窗（复用 EventCard + 选项交互）
    │   │   ├── SettlementModal.tsx   # 今日结算弹窗
    │   │   ├── CrisisModal.tsx       # 现金流危机弹窗
    │   │   ├── MonthModal.tsx        # 月度结算弹窗
    │   │   └── EndingModal.tsx       # 隐藏/失败/止损结局弹窗
    │   └── ui/
    │       ├── Card.tsx              # 圆角卡片容器
    │       ├── Button.tsx            # 主/次按钮（橙色主、灰次）
    │       └── Modal.tsx             # 弹窗壳（移动端底部抽屉式）
    └── utils/
        ├── format.ts                 # 金额/百分比/日期格式化
        └── constants.ts              # localStorage key、阈值常量、周末/月末判定助手
```

---

## 3. 数据结构和接口（类图 / 类型草图）

> 完整可编译版见 `docs/class-diagram.mermaid`。下面是关键类型与模块函数签名。

### 3.1 核心类型（`types/index.ts`）

```ts
// —— 枚举/联合 ——
type StoreType = '奶茶饮品' | '小吃快餐' | '粉面店' | '咖啡主理人店' | '加盟连锁店';
type LocationType = '学校门口' | '写字楼' | '社区底商' | '商场' | '冷清新商圈';
type SupplierTier = 'cheap' | 'local' | 'stable' | 'premium';
type PriceStrategy = 'low' | 'normal' | 'raise' | 'premium';
type DecorationLevel = 'bare' | 'clean' | 'memorable' | 'viral' | 'designer';
type PromotionTier = 'none' | 'light' | 'normal' | 'heavy' | 'gamble';
type StaffTier = 'owner' | 'basic' | 'standard' | 'peak' | 'redundant';
type EventLevel = 'small' | 'medium' | 'large' | 'fate' | 'forced';
type EventCategory = 'weather' | 'district' | 'landlord' | 'staff' | 'supplier'
                   | 'promotion' | 'platform' | 'competitor' | 'equipment' | 'compliance';
type CashflowStatus = '健康' | '紧张' | '危险';

// —— 隐藏暗线（0-100）——
interface HiddenLines {
  landlordAttention: number;   // 房东关注
  employeePressure: number;    // 员工压力
  customerTrust: number;       // 顾客信任（初始 50）
  priceControversy: number;    // 价格争议
  promoHype: number;           // 推广虚火
  supplyRisk: number;          // 供应链隐患
  platformDependence: number;  // 平台依赖
  hygieneRisk: number;         // 卫生风险
}

// —— 软暗线（0-100，近似实现，不直接展示）——
interface SoftHidden {
  ownerFatigue: number;        // 老板透支
  wasteRisk: number;           // 损耗风险
  qualityVariance: number;     // 品质波动
  landlordPatience: number;    // 房东耐心
  accountingErrorRisk: number; // 账目误差风险
  stability: number;           // 经营稳定性
}

// —— 单店状态 ——
interface StoreState {
  id: string;
  name: string;
  storeType: StoreType;
  locationType: LocationType;
  rent: number;                // 月租（可被 rentPct 持久修改）
  deposit: number;             // 押金（= 2 × 初始 rent，见 §9）
  decorationLevel: DecorationLevel;
  supplierTier: SupplierTier;
  priceStrategy: PriceStrategy;
  promotionTier: PromotionTier;
  staffTier: StaffTier;
  rating: number;              // 0-100 内部分（UI 显示 = rating/20，clamp 0-5）→ 见 §9/§10
  repurchaseRate: number;      // 0-1
  efficiency: number;          // 0-100 经营效率（efficiencyPct 持久修改）
  capacity: number;            // 当前人工承载 = staffTier.capacity × efficiency/100
  deliveryRatio: number;       // 外卖占比 0-1（默认 0.30）
  platformRate: number;        // 平台抽成率（默认 0.18，platformCostPct 持久修改）
  isInCrisis: boolean;
  crisisDays: number;
  cashflowStatus: CashflowStatus;
  monthlyRevenue: number;      // 本月累计
  monthlyGrossProfit: number;
  monthlyNetProfit: number;
  lastMonthNetProfit: number;  // 上月净利（月结用）
  monthlyNetProfitPositiveStreak: number; // 连续正净利月数（结局用）
}

// —— 五项每日决策（与单店当前决策一致）——
interface DecisionState {
  supplierTier: SupplierTier;
  priceStrategy: PriceStrategy;
  decorationLevel: DecorationLevel;
  promotionTier: PromotionTier;
  staffTier: StaffTier;
}

// —— 全局游戏状态 ——
interface GameState {
  day: number;                 // 1..
  month: number;               // 1..
  cash: number;
  debt: number;
  monthlyRepayment: number;
  credit: number;              // 0-100
  netWorth: number;            // 净资产 = cash + ΣstoreValuation - debt
  storeCount: number;
  brandRating: number;         // 0-100（UI /20）
  stores: StoreState[];        // 第 0 家为主店
  hiddenLines: HiddenLines;
  softHidden: SoftHidden;
  eventHistory: EventLogEntry[];
  businessLog: BusinessLogEntry[];
  windMessages: WindMessage[];
  pendingEffects: PendingEffect[]; // 未来效果队列（futureEffect/unlock/durationDays）
  activeCooldowns: Record<string, number>; // 命名冷却：key→到期 day
  unlockedRoutes: string[];    // unlock 收集
  endingsUnlocked: string[];
  accountsPayable: number;     // 应付账款（月结到期）
  reserve: number;             // 储备现金（月结"储备现金"选项转入）
  lastLargeEventDay: number;   // 大事件后降概率用
  lastSettlement?: DailyResult;
  seed?: number;               // 可复现随机种子（可选）
  tutorialSeen: boolean;
  gameOver: boolean;
  activeEnding?: string;
}

// —— 结算结果 ——
interface DailyResult {
  day: number;
  eventId: string | null;
  decisions: DecisionState;
  exposure: number; dineInExposure: number; deliveryExposure: number;
  entryRate: number; conversionRate: number; repurchaseRate: number;
  orders: number; avgOrderValue: number;
  revenue: number; grossMarginRate: number; grossProfit: number;
  promoCost: number; staffCost: number; fixedCostDaily: number; platformCost: number;
  netProfit: number; cashAfter: number;
  breakEvenRevenue: number; safeRevenue: number;
  capacityOverload: boolean;   // 订单超出人工承载
}

// —— 店里风向 ——
interface WindMessage {
  day: number;
  level: 'calm' | 'watch' | 'warn' | 'danger'; // 风险等级（不显示数值）
  lines: string[];
}

// —— 月度报表 ——
interface MonthlyReport {
  month: number;
  revenue: number; grossProfit: number; netProfit: number;
  cash: number; debt: number; debtPressure: 'light' | 'medium' | 'heavy';
  rentRatio: number; staffRatio: number; promoEfficiency: number;
  deliveryRatio: number; repurchaseChange: number; ratingChange: number;
  wind: WindMessage;
  options: MonthOption[];      // 进入下月/优化/提前还贷/储备/准备分店/关店
}

// —— 结局 ——
interface EndingDef {
  id: string; title: string; type: 'hidden' | 'stop_loss' | 'failure';
  conditions?: string[]; netWorthFormula?: string; text: string;
  buttons: string[];
}
```

### 3.2 事件类型（`types/events.ts`）

```ts
// 通用 effect 对象（decision-options.json 与 events.v0.1.json 共用同一 schema）
interface EffectObject {
  cash?: number | string;        // number 直接加减；string 为令牌（见 §6）
  revenuePct?: number; ordersPct?: number;
  marginPct?: number;            // 毛利率「百分点加法」
  avgOrderValuePct?: number;     // 客单价「百分比乘法」
  conversionRatePct?: number; entryRatePct?: number; repurchaseRatePct?: number; // 百分点加法
  exposurePct?: number; dineInExposurePct?: number; deliveryExposurePct?: number;
  deliveryOrdersPct?: number;
  rating?: number;               // 0-100 内部分 加法
  repurchaseRatePct?: number;
  staffCost?: number; staffCostPct?: number;
  promoCost?: number; rentPct?: number; platformCostPct?: number;
  efficiencyPct?: number;
  accountsPayable?: number; ownerFatigue?: number; credit?: number;
  hidden?: Partial<Record<keyof HiddenLines, number>>;
  soft?: Partial<Record<keyof SoftHidden, number>>;
  random?: string;               // 软效果：按描述近似（见 §6）
  futureEffect?: string;         // → pendingEffects
  unlock?: string;               // → unlockedRoutes
  durationDays?: number;         // 与 entryRatePct 等配合：持续 N 天
  stability?: number; wasteRisk?: number; qualityVariance?: number;
  landlordPatience?: number; accountingErrorRisk?: number;
  ending?: string;               // 触发结局 id
  cooldown?: string;             // 命名冷却（如 rent_increase_60_days）
}

interface EventOption {
  id: string; label: string; visibleEffect?: string;
  effects: EffectObject;
}
interface EventDef {
  id: string; title: string; category: EventCategory; level: EventLevel;
  trigger: string; cooldownDays: number;
  options: EventOption[];
  wind: string;
}

// 未来效果队列项
interface PendingEffect {
  applyAtDay: number;            // 到期 day（含）
  source: string;                // 来源事件 id
  effects: EffectObject;         // 到期时应用的修正
  label?: string;
}
```

### 3.3 模块函数签名（`core/*`）

```ts
// rng.ts
export type RNG = () => number;                       // 返回 [0,1)
export function createRng(seed?: number): RNG;        // mulberry32；无 seed 则用 Date.now()

// storage.ts
export function saveGame(state: GameState): void;     // key: SAVE_KEY
export function loadGame(): GameState | null;
export function clearSave(): void;
export function isTutorialSeen(): boolean;            // key: tutorialSeen
export function setTutorialSeen(v: boolean): void;

// createNewGame.ts
export interface OpeningConfig {
  initialCashTier: 100000 | 300000 | 600000 | 1000000;
  storeType: StoreType; locationType: LocationType;
  decorationLevel: DecorationLevel; storeName: string;
}
export function createNewGame(cfg: OpeningConfig, rng: RNG): GameState;

// modifiers.ts —— 把"决策 effects + 事件 effects"累计进 DayModifiers
export interface DayModifiers {
  exposurePct: number; dineInExposurePct: number; deliveryExposurePct: number;
  entryRatePct: number; conversionRatePct: number; repurchaseRatePct: number;
  avgOrderValuePct: number; marginPct: number;
  revenuePct: number; ordersPct: number; deliveryOrdersPct: number;
  staffCostAdd: number; staffCostPct: number;
  promoCostAdd: number; rentPct: number; platformCostPct: number; efficiencyPct: number;
  ratingAdd: number; creditAdd: number; cashAdd: number;
  accountsPayableAdd: number; ownerFatigueAdd: number;
  hidden: Partial<Record<keyof HiddenLines, number>>;
  soft: Partial<Record<keyof SoftHidden, number>>;
  durationDays?: number; futureEffect?: string; unlock?: string;
  cooldown?: string; ending?: string; random?: string;
}
export function emptyModifiers(): DayModifiers;
export function addDecisionModifiers(mods: DayModifiers, decisions: DecisionState): DayModifiers;
export function addEffectModifiers(mods: DayModifiers, eff: EffectObject): DayModifiers;

// effectResolver.ts —— 通用解析器（核心）
export function applyEffects(state: GameState, eff: EffectObject, rng: RNG): GameState;

// settlement.ts
export function resolveSettlement(
  state: GameState, store: StoreState, decisions: DecisionState,
  mods: DayModifiers, rng: RNG
): { daily: DailyResult; cashAfter: number };

// hiddenLines.ts
export function updateHiddenLines(state: GameState, mods: DayModifiers): GameState;
export function decaySoftHidden(state: GameState): GameState;   // 每日小衰减（见 §6）

// wind.ts
export function generateWind(state: GameState): WindMessage;

// eventGate.ts
export function evaluateGate(ev: EventDef, state: GameState): boolean;

// eventEngine.ts
export function computeBaseProb(state: GameState): number;
export function drawEvent(state: GameState, rng: RNG): EventDef | null;
export function checkForcedEvents(state: GameState): EventDef | null; // F001/F002/F003

// futureEffect.ts
export function pushPendingEffect(state: GameState, eff: EffectObject, day: number): GameState;
export function applyDuePendingEffects(state: GameState): GameState; // 新一天开始时调用
export function resolveFutureEffect(text: string): { applyAtDayOffset: number; effects: EffectObject } | null;
export function resolveUnlock(text: string): string | null;

// crisis.ts
export function enterCrisis(state: GameState, forcedId: string): GameState;
export function resolveCrisisOption(state: GameState, optionId: string, rng: RNG): GameState;

// monthlyReport.ts
export function runMonthSettlement(state: GameState, rng: RNG): { state: GameState; report: MonthlyReport };

// branch.ts
export function checkBranchUnlock(state: GameState): boolean;
export function openBranch(state: GameState, rng: RNG): GameState;
export function headquartersDailyCost(storeCount: number): number; // storeCount>=3 起算

// endings.ts
export function checkEndings(state: GameState): EndingDef | null;

// gameLoop.ts —— 主循环编排
export function runDailyLoop(prev: GameState, rng: RNG): {
  state: GameState; daily: DailyResult | null;
  todayEvent: EventDef | null; forced: EventDef | null;
  monthReport: MonthlyReport | null;
};
```

---

## 4. 程序调用流程（时序图）

> 完整 Mermaid 见 `docs/sequence-diagram.mermaid`。下图是"每日循环 + 月结"的浓缩版。

```mermaid
sequenceDiagram
    autonumber
    actor P as 玩家
    participant UI as UI 组件
    participant Store as gameStore
    participant Loop as gameLoop
    participant Eng as eventEngine
    participant FX as effectResolver
    participant Set as settlement
    participant HL as hiddenLines
    participant Wind as wind
    participant Mon as monthlyReport
    participant Sto as storage

    P->>UI: 打开游戏
    UI->>Store: loadGame()
    Store->>Sto: load(SAVE_KEY)
    alt 无存档 & 未看教程
        UI->>P: TutorialModal（玩法说明）
        P->>UI: 我知道了/不再显示
        UI->>Sto: setTutorialSeen()
    end

    loop 每一天
        P->>UI: 进入新一天
        UI->>Loop: runDailyLoop(state, rng)
        Loop->>Eng: checkForcedEvents(state)
        alt cash<0 / 账单不足 / 还款>50%毛利 → 强制事件
            Eng-->>Loop: forcedEvent(F001/F002/F003)
            Loop->>UI: CrisisModal
            P->>UI: 选择续命方案
            UI->>FX: applyEffects(state, option.effects, rng)
            FX-->>Loop: state'
        else 普通日
            Loop->>Eng: drawEvent(state, rng)
            Eng->>Eng: computeBaseProb→roll→选池(权重)→抽事件(冷却+gate)
            Eng-->>Loop: event | null
            opt 有事件
                Loop->>UI: EventCard/EventModal
                P->>UI: 选择选项
                UI->>FX: applyEffects(state, option.effects, rng)
                FX-->>Loop: state' (+pendingEffects)
            end
        end
        UI->>P: DecisionPanel（五项决策）
        P->>UI: 调整并确认
        UI->>Loop: 携带 decisions
        Loop->>Set: resolveSettlement(state, store, decisions, mods, rng)
        Set->>Set: exposure→orders→revenue→毛利→净利→cash
        Set-->>Loop: DailyResult
        Loop->>HL: updateHiddenLines(state, mods)
        Loop->>Wind: generateWind(state)
        Loop->>Sto: save(state)
        Loop->>UI: 渲染 Dashboard/Log/Wind/Funnel/CashCurve
        alt day % 30 == 0
            Loop->>Mon: runMonthSettlement(state)
            Mon-->>UI: MonthModal(报表+选项)
            P->>UI: 进入下月/优化/还贷/储备/分店/关店
            UI->>Loop: 应用月结选项
        end
        Loop->>Loop: day += 1; applyDuePendingEffects
    end
```

---

## 5. 结算数学规格（工程师核心依据）

### 5.1 基准参数表（推荐默认值，可 playtest 调参）

**店型基准**（`data/storeProfiles.ts`，`STORE_PROFILES`）：

| 店型 | entryRate | conversionRate | repurchaseRate | avgOrderValue | grossMargin | exposureFactor |
|---|---:|---:|---:|---:|---:|---:|
| 奶茶饮品 | 0.30 | 0.62 | 0.28 | 18 | 0.55 | 1.00 |
| 小吃快餐 | 0.32 | 0.70 | 0.22 | 22 | 0.50 | 1.10 |
| 粉面店 | 0.28 | 0.66 | 0.35 | 26 | 0.52 | 0.95 |
| 咖啡主理人店 | 0.25 | 0.58 | 0.30 | 32 | 0.60 | 0.85 |
| 加盟连锁店 | 0.30 | 0.64 | 0.25 | 24 | 0.42 | 1.00 |

**商圈基准**（`data/locationProfiles.ts`，`LOCATION_PROFILES`）：

| 商圈 | 月租 baseMonthlyRent | 人流系数 trafficCoef | 波动 | 备注 |
|---|---:|---:|---|---|
| 学校门口 | 12000 | 1.00 | 高（假期） | 价格敏感 |
| 写字楼 | 20000 | 1.20 | 中（搬迁） | 午餐强 |
| 社区底商 | 10000 | 0.85 | 低 | 复购重要 |
| 商场 | 35000 | 1.50 | 中（活动） | 人流高/租金高 |
| 冷清新商圈 | 6000 | 0.70 | 高 | 人流不稳 |

**派生常量**：`BASE_EXPOSURE = 1000`；`DEFAULT_DELIVERY_RATIO = 0.30`；`DEFAULT_PLATFORM_RATE = 0.18`；`DEPOSIT_MULTIPLIER = 2`（押金 = 2 × 初始月租）。

> 初始曝光 = `BASE_EXPOSURE × location.trafficCoef × storeType.exposureFactor`（再叠加当日 exposurePct/dineIn/delivery 修正）。这些是常数起点，团队应通过 playtest 微调到"普通开店档位能撑过 90 天但会紧张"的体感（见 §10）。

### 5.2 统一修正叠加算法（决策 effects + 事件 effects → 当日修正）

所有 `Pct` 字段按**§9 契约**分为两类：
- **百分点加法**（加到"率/值"本身）：`marginPct`、`entryRatePct`、`conversionRatePct`、`repurchaseRatePct`。例：`entryRatePct:+5` ⇒ `entryRate += 0.05`。
- **百分比乘法**（乘到"量"上）：`exposurePct`、`dineInExposurePct`、`deliveryExposurePct`、`avgOrderValuePct`、`revenuePct`、`ordersPct`、`deliveryOrdersPct`。例：`exposurePct:+8` ⇒ `exposure ×= 1.08`。

`modifiers.ts` 把"五项决策的 effects"与"今日事件所选选项的 effects"**逐项相加**累加进同一个 `DayModifiers`（同类 Pct 相加；hidden/soft 各暗线相加；cash 相加；staffCost/promoCost 相加）。结算时一次性应用。

### 5.3 每日结算公式（严格顺序）

```
// 1) 基准（来自店型/商圈 + 当日修正）
baseExposure   = BASE_EXPOSURE × loc.trafficCoef × store.exposureFactor
dineInExp      = baseExposure × (1 - store.deliveryRatio) × (1 + mods.dineInExposurePct/100) × (1 + mods.exposurePct/100)
deliveryExp    = baseExposure × store.deliveryRatio        × (1 + mods.deliveryExposurePct/100) × (1 + mods.exposurePct/100)
exposure       = dineInExp + deliveryExp

entryRate      = clamp(storeBase.entryRate + mods.entryRatePct/100, 0, 0.95)
conversionRate = clamp(storeBase.conversionRate + mods.conversionRatePct/100, 0, 0.95)
repurchaseRate = clamp(store.repurchaseRate + mods.repurchaseRatePct/100, 0, 0.9)
avgOrderValue  = storeBase.avgOrderValue × (1 + mods.avgOrderValuePct/100)
grossMargin    = clamp(storeBase.grossMargin + mods.marginPct/100, 0.05, 0.95)

// 2) 订单（按堂食/外卖拆分，再合计；revenuePct/ordersPct 作总乘子）
dineInOrders   = dineInExp × entryRate × conversionRate × (1 + repurchaseRate)
deliveryOrders = deliveryExp × entryRate × conversionRate × (1 + repurchaseRate) × (1 + mods.deliveryOrdersPct/100)
orders0        = dineInOrders + deliveryOrders
orders         = round(orders0 × (1 + mods.ordersPct/100) × (1 + mods.revenuePct/100))
                 // 注意：revenuePct 同时作用于流水，故也作用于订单基数（见 §10 说明）

// 3) 承载上限
effectiveCap   = store.staffTier.capacity × (store.efficiency/100)
capacityOverload = orders > effectiveCap
if capacityOverload:
    orders = effectiveCap
    mods.hidden.customerTrust -= 3   // 排长队掉信任（一次性）
    riskNote = "当前订单量超过人工承载上限，部分客人流失"

// 4) 金额
revenue        = orders × avgOrderValue × (1 + mods.revenuePct/100)
grossProfit    = revenue × grossMargin
promoCost      = (promotionTier.cost + mods.promoCostAdd) × (1 + mods.staffCostPct? 否)   // 推广成本由 promotionTier.cost + mods.promoCostAdd
staffCost      = (staffTier.dailyCost + mods.staffCostAdd) × (1 + mods.staffCostPct/100)
fixedCostDaily = store.rent/30 + headquartersDailyCost(storeCount)
platformCost   = revenue × store.deliveryRatio × store.platformRate × (1 + mods.platformCostPct/100)
netProfit      = grossProfit − promoCost − staffCost − fixedCostDaily − platformCost
cashAfter      = state.cash + netProfit

// 5) 保本线 / 安全线
breakEvenRevenue = (promoCost + staffCost + fixedCostDaily + platformCost) / grossMargin
safeRevenue      = breakEvenRevenue × 1.4
```

> **关于 STATE_MODEL 示例的出入**：示例 `orders:183` 是用 `exposure×entry×conv`（未乘 1+repurchase）算的；而 GAME_SPEC 公式写的是 `× (1 + 复购率)`。本设计**以 GAME_SPEC 公式为准**（乘 1+repurchase），因为这是唯一明确给出的公式；示例视为早期占位值。若团队决定"复购只影响曝光基数而非订单乘子"，把 `repurchaseRate` 的作用位改到 exposure 即可，结算函数集中在一处，便于切换（见 §10）。

### 5.4 平台成本 / 外卖占比

- `platformCost = revenue × deliveryRatio × platformRate`（平台只对订单中的外卖部分抽成）。
- 月结"外卖占比" = `ΣdeliveryRevenue / ΣtotalRevenue`。
- 推广效率（月结）= `ΣpromoAttributedRevenue / ΣpromoCost`（简化：用 `revenue / promoCost` 作为 ROAS 近似，见 §10）。

---

## 6. 事件引擎规格

### 6.1 抽事件算法（普通日）

```
computeBaseProb(state):
  p = 0.30                                   // 普通日
  if isWeekend(day):              p = max(p, 0.40)
  if isLast3DaysOfMonth(day):     p = max(p, 0.40)
  if maxHiddenLine(state) > 60:   p = max(p, 0.55)   // 高风险风向 50%-60%
  if day - lastLargeEventDay <= 3:p = min(p, 0.20)   // 刚发生大事件后 15%-20%
  return clamp(p, 0, 0.95)

drawEvent(state, rng):
  if rng() > computeBaseProb(state): return null       // 未触发
  pool = selectPool(state, rng)                        // 按暗线权重选池（见下）
  candidates = EVENTS.filter(e => e.category===pool
        && evaluateGate(e, state)
        && cooldownOk(e, state)
        && levelWeight(e) > 0)
  if candidates.empty: candidates = fallbackAnyPool(state, rng)  // 跨池兜底
  return weightedPick(candidates, levelWeight, rng)

selectPool(state, rng):    // 10 个池，基础权重 1.0，按暗线修正后加权随机
  w = { weather:1, district:1, landlord:1, staff:1, supplier:1,
        promotion:1, platform:1, competitor:1, equipment:1, compliance:1 }
  hl = state.hiddenLines; sh = state.softHidden
  w.landlord   += hl.landlordAttention/20
  w.staff      += hl.employeePressure/20
  w.promotion  += hl.promoHype/20 + hl.priceControversy/30
  w.supplier   += hl.supplyRisk/20
  w.platform   += hl.platformDependence/20
  w.compliance += hl.hygieneRisk/20
  w.equipment  += hl.hygieneRisk/30
  w.competitor += hl.priceControversy/30
  if hl.customerTrust > 60: w.weather += 0.5; w.staff += 0.5  // 好事件略增
  return weightedPickKey(w, rng)

levelWeight(e): small=3, medium=2, large=1, fate=0.5   // 小事件更常出现
cooldownOk(e, state): state.day - (eventHistory.lastDayOf(e.id) ?? -999) >= e.cooldownDays
                   && 命名冷却 activeCooldowns 未封锁该池/事件
```

### 6.2 强制事件（不走普通池）

`checkForcedEvents(state)` 按优先级返回第一个满足条件者：
- **F001 现金流危机**：`state.cash < 0`（任意时刻）或月结账单无法支付。
- **F002 月底房租不足**：月结时 `cash < rent + monthlyRepayment + staffMonthlyCost`。
- **F003 债务压力爆表**：`monthlyRepayment > 月均毛利 × 0.5`（月均毛利 = 近 30 天 grossProfit 均值）。

> 强制事件 `cooldownDays:0`，但同一强制事件用 `eventHistory` 去重避免连续弹出阻断操作。

### 6.3 cash 令牌解析（effectResolver 核心）

`cash` 字段可為 number 或 string 令牌：
- number（如 `-3000`、`30000`）：`state.cash += n`。
- `"-1_month_rent"` ⇒ `cash -= store.rent`（当月月租）。
- `"+half_month_rent"` ⇒ `cash += store.rent / 2`。
- `"-deposit"` ⇒ `cash -= store.deposit`（押金 = `2 × 初始 rent`）。
- 纯数字字符串（如 `"-5000"`）⇒ 解析为 number。

### 6.4 必须真正作用到状态/结算的字段

`cash(含令牌) / revenuePct / ordersPct / marginPct / avgOrderValuePct / conversionRatePct / entryRatePct / repurchaseRatePct / exposurePct / dineInExposurePct / deliveryExposurePct / deliveryOrdersPct / rating / repurchaseRatePct / staffCost / staffCostPct / promoCost / rentPct / platformCostPct / efficiencyPct / credit / accountsPayable / hidden(8条) / soft(6条) / ownerFatigue / ending / cooldown` —— 这些由 `effectResolver` 直接修改 `GameState` 或 `StoreState`，**立即生效**（rentPct/platformCostPct/efficiencyPct 为持久修改对应 store 字段）。

### 6.5 软效果近似实现约定（允许合理近似）

以下字段不进入硬结算，按描述施加"适度暗线/现金变化 + 叙事写入日志"：
- `random`（文本）：`effectResolver` 调用 `resolveRandom(text, rng)`。对数据中出现的结构化表述做**确定性分支**（用注入的 rng）：
  - `"50%涨幅降至8%；30%无效；20% landlordAttention +15"`（E016 谈判）→ 50%：`rentPct` 改为 +8（覆盖原 +15）；30%：无效果；20%：`hidden.landlordAttention +15`。
  - `"可能小火，也可能争议"`（E041 免费探店）→ 50%：`exposurePct +20, promoHype +5`；50%：`priceControversy +8`。
  - `"可能反噬"/"可能无效"/"可能翻盘，也可能暴雷"` → 50% 施加正向效果，50% 施加对等负向（如 `promoHype +10` ↔ `customerTrust -8`）。
  - 通用兜底：未识别文本 → 按 `rng()<0.5` 二选一施加一组"合理近似"效果（工程师在 `resolveRandom` 内以 `eventId+optionId` 为 key 写死映射表，保证可测）。
- `futureEffect`（文本）→ `futureEffect.ts` 解析为 `PendingEffect{applyAtDay, effects}`，写入 `state.pendingEffects`；**新一天开始**时 `applyDuePendingEffects` 到期应用。已知文本映射（示例）：
  - `"未来30天午餐曝光 -25%"`（E008 none）→ `applyAtDay=day+30, effects:{exposurePct:-25}`。
  - `"暴雷权重上升"/"离职权重上升"/"罢工权重上升"/"差评权重上升"/"合规停业权重上升"/"债务结局权重上升"/"不确定事件权重上升"/"培训事件权重上升"/"决策失误权重上升"` → 分别给对应暗线小幅 +（如 `promoHype+8`/`employeePressure+8`/`hygieneRisk+8`/`landlordAttention+8`）并到期应用，模拟"后续隐患积累"。
- `unlock`（文本）→ `resolveUnlock(text)` 返回路由 key（如 `move_route`/`new_location_scouting`/`location_scouting`）写入 `state.unlockedRoutes`；后续 UI/事件可据此解锁新选项（第一版仅记录，不强制展开新玩法）。
- `stability` / `wasteRisk` / `qualityVariance` / `landlordPatience` / `accountingErrorRisk` / `durationDays` → 写入 `softHidden` 或 `pendingEffects`：
  - `durationDays`（如 E011 `durationDays:7` + `entryRatePct:-15`）→ 生成 `PendingEffect{applyAtDay:day+7, effects:{entryRatePct:-15}}` 持续 7 天。
  - `wasteRisk` 高 → 月结时 `marginPct` 轻微下修（如 `−wasteRisk/100×0.3`）。
  - `accountingErrorRisk` 高 → 月结时 `cash` 小额随机误差（±risk%）。
  - `landlordPatience` 低 → 提高 landlord 池权重（已在 `selectPool` 的 landlordAttention 体现，patience 额外修正）。
  - `qualityVariance` 高 → 评分波动增大（结算 rating 抖动 ±variance%）。
- `softHidden` 每日小幅衰减（回到基线），避免无限累积：`decaySoftHidden` 对 ownerFatigue/wasteRisk 等按 `-1~2/天` 衰减。

### 6.6 事件触发判定（`eventGate.ts`）

把 `trigger` 文本转成布尔函数 `evaluateGate(ev, state)`。关键 gate 清单（工程师据此实现）：

| 事件 | gate 条件 | 事件 | gate 条件 |
|---|---|---|---|
| E007/E008 | `locationType==='写字楼'` | E039 | `hidden.priceControversy > 45` |
| E009 | `locationType==='学校门口'` | E040 | `hidden.promoHype>50 && customerTrust<40` |
| E010 | `locationType==='商场'` | E041 | `hidden.promoHype>40 && rating>70` |
| E016 | `hidden.landlordAttention > 50` | E042 | `decorationLevel∈{viral,designer}` |
| E017 | `hidden.landlordAttention > 35 && cash>rent` | E044 | `hidden.promoHype > 50` |
| E021 | `hidden.employeePressure > 40` | E045 | `deliveryRatio>0 && rating>70` |
| E022 | `hidden.employeePressure > 70 \|\| 拖欠工资` | E046 | `hidden.platformDependence > 40` |
| E023 | `hidden.employeePressure > 50` | E047 | `隐藏 weather=雨 \|\| deliveryRatio>0.5` |
| E026 | `hidden.employeePressure > 80` | E048 | `rating近降 && deliveryRatio>0.3` |
| E027 | `soft.ownerFatigue > 50` | E049 | `hidden.platformDependence > 60` |
| E028 | `cash>50000 && hidden.employeePressure>40` | E050 | `deliveryRatio > 0.4` |
| E030 | `hidden.supplyRisk > 50` | E053/E055 | 低概率（基础权重×0.3）+ 商圈热度高 |
| E032 | `hidden.supplyRisk > 65` | E056 | `softHidden 设备低 \|\| storeType∈甜品/轻食` |
| E033 | `supplierTier==='cheap'` | E058 | `weather=暴雨后 && hygieneRisk>30` |
| E034 | `supplierTier==='premium'`（咖啡/甜品权重↑） | E059 | `hidden.hygieneRisk > 50` |
| E038 | `hidden.promoHype > 50` | E060 | `hidden.hygieneRisk > 70 \|\| (supplierTier==='cheap' && 差评)` |

> fate 级（E012）无 gate、基础权重极低（0.5）且 `cooldownDays:180`，靠低概率偶发。所有 gate 失败的事件从候选池剔除；若选中池无候选则跨池兜底，保证"每天可能触发事件但不是纯随机"。

---

## 7. 任务列表（映射到用户的 11 个开发阶段）

> 每个任务产出多个文件（见 §2）。依赖沿阶段顺序；T10（UI 完善）依赖前面所有玩法任务，T11（自测）最后。这是给**工程师的实现顺序**，也可合并为 5 个宏迭代（见末尾注）。

| Task | 名称 | 映射阶段 | 依赖 | 产出关键文件 | 优先级 |
|---|---|---|---|---|---|
| **T01** | 项目脚手架 + 类型 + 状态管理 + 存档层 + RNG | 阶段1 项目/基础UI（骨架） | — | `package.json`,`vite.config.ts`,`tailwind.config.js`,`tsconfig*.json`,`index.html`,`src/main.tsx`,`src/App.tsx`,`src/index.css`,`types/*`,`core/rng.ts`,`core/storage.ts`,`store/gameStore.ts`,`utils/*` | P0 |
| **T02** | 状态模型 + 教程弹窗 + 开局初始化 | 阶段1 基础UI + 阶段2 状态+存档 + Task2 教程 | T01 | `core/createNewGame.ts`,`components/OpeningSetup.tsx`(占位),`components/modals/TutorialModal.tsx`,`data/tutorial.ts`,`types/index.ts`(GameState 初始化) | P0 |
| **T03** | 五项决策 + 每日结算引擎 + 数据看板/日志/风险预估 | 阶段3 决策+结算 + Task3/4/5 | T02 | `data/decisionOptions.ts`,`data/storeProfiles.ts`,`data/locationProfiles.ts`,`core/modifiers.ts`,`core/settlement.ts`,`core/hiddenLines.ts`,`components/DecisionPanel.tsx`,`components/RiskEstimate.tsx`,`components/Dashboard.tsx`,`components/BusinessLog.tsx`,`components/StatusBar.tsx`,`components/FunnelChart.tsx`,`components/CashCurve.tsx` | P0 |
| **T04** | 事件引擎核心（抽/池/冷却/强制）+ 通用 effect 解析器 + 12 核心事件 | 阶段5 事件引擎 + Task6 | T02,T03 | `core/eventEngine.ts`,`core/eventGate.ts`,`core/effectResolver.ts`,`core/futureEffect.ts`,`data/events.ts`(索引+12事件接入),`components/EventCard.tsx`,`components/modals/EventModal.tsx` | P0 |
| **T05** | 全部 60 事件接入 + 店里风向 | 阶段6 店里风向 + Task7/8 | T04 | `data/events.ts`(全量),`core/wind.ts`,`components/WindPanel.tsx` | P1 |
| **T06** | 现金流危机（F001/F002/F003 + 续命选项 + 失败结局） | 阶段7 现金流危机 + Task10 | T03,T04 | `core/crisis.ts`,`components/modals/CrisisModal.tsx`,`core/endings.ts`(失败分支) | P1 |
| **T07** | 月度结算（报表 + 月结后选项） | 阶段8 月结 + Task9 | T03,T06 | `core/monthlyReport.ts`,`components/modals/MonthModal.tsx`,`components/modals/SettlementModal.tsx` | P1 |
| **T08** | 分店系统（解锁/开分店/多店收入/总部成本） | 阶段9 分店 + Task11 | T07 | `core/branch.ts` | P2 |
| **T09** | 隐藏结局（连锁帝国/财富自由/体面撤退/失败收尾 + 保存继续） | 阶段10 隐藏结局 + Task12 | T06,T07,T08 | `data/endings.ts`,`core/endings.ts`(全量),`components/modals/EndingModal.tsx` | P2 |
| **T10** | 玩法弹窗整合 + 全部 UI 组件完善 + 路由串联 | 阶段4 玩法弹窗 + 整体打磨 | T03–T09 | `App.tsx`(阶段机),`OpeningSetup.tsx`(完整),`ui/*`,`EndDayButton.tsx`,各 `modals/*` | P1 |
| **T11** | 手机端优化与可玩性自测（day1→day90+ 闭环验收） | 阶段11 手机端优化自测 | 全部 | 响应式样式微调、`index.css` 断点、性能/可玩性验收脚本 | P2 |

> **依赖图（Mermaid）**：
> ```mermaid
> graph TD
>   T01 --> T02
>   T01 --> T03
>   T02 --> T03
>   T02 --> T04
>   T03 --> T04
>   T04 --> T05
>   T03 --> T06
>   T04 --> T06
>   T03 --> T07
>   T06 --> T07
>   T07 --> T08
>   T06 --> T09
>   T07 --> T09
>   T08 --> T09
>   T03 --> T10
>   T04 --> T10
>   T05 --> T10
>   T06 --> T10
>   T07 --> T10
>   T08 --> T10
>   T09 --> T10
>   T01 --> T11
>   T02 --> T11
>   T10 --> T11
> ```
> 注：若需压成 5 个宏迭代，可合并为：M1=T01+T02（地基）；M2=T03（决策+结算）；M3=T04+T05+T06（事件+风向+危机）；M4=T07+T08+T09（月结+分店+结局）；M5=T10+T11（UI+自测）。

---

## 8. 依赖包列表

```
# 运行时
react@^18.3.1
react-dom@^18.3.1
zustand@^4.5.2            # 轻量状态管理（推荐，详见 §1.2）

# 构建/开发
vite@^5.2.0
@vitejs/plugin-react@^4.3.0
typescript@^5.4.5
@types/react@^18.3.0
@types/react-dom@^18.3.0
tailwindcss@^3.4.4
postcss@^8.4.38
autoprefixer@^10.4.19
clsx@^2.1.1              # 可选：className 条件拼接
vitest@^1.6.0            # 测试（结算/事件引擎确定性单测，配合可注入 RNG）
```

> **图表取舍**：默认**自建 SVG**（`FunnelChart.tsx`/`CashCurve.tsx`），零依赖、移动端完全可控。仅当后续图表需求增多（>4 种）再引入 `recharts@^2`（但会增大包体，需权衡）。本版不建议引入。

---

## 9. 共享知识（跨文件约定）

1. **数值修正契约（全局唯一）**：
   - `marginPct / entryRatePct / conversionRatePct / repurchaseRatePct` = **百分点加法**（值 += pct/100）。
   - `exposurePct / dineInExposurePct / deliveryExposurePct / avgOrderValuePct / revenuePct / ordersPct / deliveryOrdersPct` = **百分比乘法**（值 ×= 1+pct/100）。
   - `staffCostPct / platformCostPct` = 乘到对应成本/费率；`rentPct / efficiencyPct` = **持久**修改 `store.rent / store.efficiency`。
   - `rating` 加法作用在 **0-100 内部评分**（UI 显示 = `rating/20`，clamp 0–5.0）。
   - `cash` 支持 number 与令牌（§6.3）。
2. **effect 解析器契约**：所有"修改状态"的入口只有 `effectResolver.applyEffects(state, eff, rng)`；decision-options 与 events 共用 `EffectObject`。新增字段须在此集中解析，禁止在 UI 里散落改状态。
3. **localStorage key 约定**（`utils/constants.ts`）：
   - 存档：`'kaidian-shuo:save:v1'`（整个 `GameState` 序列化）。
   - 教程：`'tutorialSeen'`（布尔，严格沿用 `tutorial-modal.json` 的 `storageKey`，UI_SPEC 亦要求此名）。
   - 版本号 v1 用于未来迁移；读不到或解析失败 → 回到开局。
4. **隐藏暗线 0-100 与风向映射约定**（`wind.ts`）：风向**绝不显示数值**，只显示症状文案；按暗线从高到低取 top 1-4 条风险，映射等级与文案（节选）：
   - `landlordAttention>50` → "房东最近出现得有点频繁，他不像是来消费的。"
   - `employeePressure>70` → "里面的人已经不太想配合你演了。"
   - `promoHype>60` → "热闹是热闹，但你分不清哪些是真客人。"
   - `supplyRisk>60` → "供应商那边，开始有点拿捏你了。"
   - `platformDependence>60` → "你越依赖平台，平台调规则时你越像乘客。"
   - `hygieneRisk>50` → "有些味道，检查的人比客人先闻到。"
   - `customerTrust<35` → "老客好像没那么愿意回来了。"
   - `priceControversy>45` → "评论区开始讨论你贵不贵了。"
   - 等级：`max(line) >=70 → danger`，`>=50 → warn`，`>=30 → watch`，否则 `calm`。
5. **确定性随机（可测试）**：全局用 `RNG = () => number`；`createRng(seed?)`（mulberry32）。生产环境可无 seed（用时间）；单测注入固定 seed 使结算/事件可复现。`GameState.seed` 可选持久化以便"重开同一局"。
6. **工作日/周末/月末判定**（`utils/constants.ts`）：
   - 周末：`(day % 7 === 0) || (day % 7 === 6)`。
   - 月末前 3 天：`(day % 30) >= 28`（即 28/29/0 视为月末）。
   - 月结触发：`day % 30 === 0`。
7. **配色 CSS 变量**（`index.css`，手机优先）：`--bg:#FFFDF9`（暖白）/`--card:#FFFFFF`/`--primary:#FF7A1A`（橙主按钮）/`--profit:#1FA971`（绿盈利）/`--risk:#E5484D`（红风险）/`--radius:16px`。

---

## 10. 待明确事项（规格未给定，给出推荐默认值）

| # | 待明确点 | 推荐默认值 / 设计判断 |
|---|---|---|
| 1 | 各店型/商圈精确基准值 | 采用 §5.1 表（奶茶/小吃/粉面/咖啡/加盟 + 5 商圈）。需 playtest 微调，目标："普通开店(30万)"能撑过 90 天但偏紧张。 |
| 2 | 月结"外卖占比"计算 | `外卖占比 = ΣdeliveryRevenue / ΣtotalRevenue`（用 deliveryRatio×platformCost 反推或单独累计 deliveryRevenue）。 |
| 3 | 月结"推广效率"计算 | `推广效率(ROAS) = Σrevenue / ΣpromoCost`；同时给出 `毛利/推广成本` 作为补充。第一版取 ROAS。 |
| 4 | 总部成本具体数值 | `headquartersDailyCost(n) = n>=3 ? (8000 + 4000*(n-3)) / 30 : 0`（月 8000 起，每多一店 +4000，按 30 天日摊）。 |
| 5 | 分店解锁阈值 | `cash>=200000 && monthlyNetProfitPositiveStreak>=1 && brandRating>=80(4.0★) && debt<=0.3*netWorth && !isInCrisis && storeCount<10`。月结后出现"准备分店"选项。 |
| 6 | 债务压力等级 light/medium/heavy | `ratio = monthlyRepayment / 月均毛利`：`<0.2→light`，`0.2–0.5→medium`，`>0.5→heavy`（F003 在 >0.5 触发，即 heavy）。 |
| 7 | 储备现金 / 提前还贷 | 储备现金：月结"储备"选项把 `cash` 转入 `state.reserve`（仍计入净资产，日常不可用，危机时可动用）；提前还贷：`cash-=amt; debt-=amt; monthlyRepayment=重算(等额本息或按比例)`。 |
| 8 | rating 0-100 vs 0-5 | 内部统一 **0-100**（`brandRating` 示例 4.2★ = 84 分）；UI 显示 `score/20` clamp 0-5.0。事件 `rating:+3` 等按 100 分制加法。解决样例里 +8 溢出问题。 |
| 9 | 复购率在订单公式的位置 | 以 GAME_SPEC `×(1+repurchase)` 为准；STATE_MODEL 示例未乘视为早期占位。结算函数集中实现，若改只需动一处。 |
| 10 | deliveryRatio 初值与变更 | 默认 `0.30`；事件可改（如 E045 控制接单微调、E047 暂停外卖降 platformDependence）。 |
| 11 | ownerFatigue 阈值效果 | `>70` 时结算对 `efficiency` 施加 −5% 临时惩罚且 `conversionRatePct−3`（老板过劳影响出品）。 |
| 12 | futureEffect / unlock 文本解析 | 第一版用 `futureEffect.ts` 内**文本→PendingEffect 映射表**（覆盖数据中全部出现文本，见 §6.5）；未识别文本按"对应暗线 +8 并 30 天后到期"兜底。 |
| 13 | 周末/月末定义 | 见 §9.6 固定公式。 |
| 14 | 月均毛利（F003 用） | 取近 30 天 `grossProfit` 均值；不足 30 天用已有均值。 |
| 15 | storeValuation（净资产用） | `storeValuation = store.rent × 6`（经验值，代表押金+装修残值近似）；`netWorth = cash + ΣstoreValuation − debt`。 |
| 16 | 容量超载处理 | `orders>effectiveCap` 时截断到 capacity，掉 `customerTrust−3` 一次性，并在风险预估/风向提示"订单超人工承载"。 |

> 以上默认值均为"可启动工程的可玩初值"，应在 T11 自测阶段用 day1→day90+ 多档位跑通后微调平衡（尤其 §5.1 的曝光/毛利常数与 §10.4 总部成本）。**核心机制、玩法、结算公式结构、事件/暗线/风向/危机/月结/分店/结局的存在性均不可删改**（用户硬约束）。
