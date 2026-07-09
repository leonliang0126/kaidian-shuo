# 开店说（KaiDianShuo）

一个**完整可玩**的纯前端餐饮开店模拟经营网页小游戏。你从一笔启动资金开始经营一家餐饮店，
核心不是比流水高低，而是经营好**现金流、毛利、房租、员工、供应商、推广与复购**，并在「店里风向」里读出隐藏风险。

技术栈：**Vite 5 + React 18 + TypeScript 5（strict）+ Tailwind CSS 3.4 + Zustand 4.5**，
结算/事件/结局等核心逻辑为纯函数（不依赖 React），自研轻量 SVG 图表（无图表库），可注入种子的 `mulberry32` 随机数。

---

## 快速开始

```bash
# 使用受管 Node 二进制（也可换成你自己的 node/npm）
export PATH="/Users/yoren/.workbuddy/binaries/node/versions/22.22.2/bin:$PATH"

npm install            # 安装依赖
npm run dev            # 本地开发：http://localhost:5173
npm run typecheck      # tsc --noEmit 类型检查
npm run build          # tsc -b && vite build 生产构建
npm test               # vitest 单元测试
```

> 说明：游戏**纯前端、无后端**。进度通过 `localStorage` 自动存档（key：`kaidian-shuo:save:v1`），
> 玩法说明首次访问展示（key：`tutorialSeen`）。

---

## 玩法概览

1. **开局（Opening）**：选择店名、启动资金、店型、位置、装修，决定开业后可用现金。
2. **每日循环（Playing）**：
   - 每天会遇到**随机事件**（天气 / 商圈 / 房东 / 员工 / 供应商 / 推广 / 平台 / 对手 / 设备 / 监管），中/大事件需要你做选择；
   - 调整**五项经营决策**：供应商、售价、装修、推广、人工；
   - 点「结束今天，看结算」→ 查看当日流水、毛利、净利、现金，以及经营漏斗与现金曲线；
   - 当日结算后可能触发**月结**（每 30 天）或**现金流危机**（现金为负）。
3. **店里风向**：只给你**症状文案与风险等级**，绝不显示概率数值——靠你判断苗头。
4. **月度结算**：核算月报，可选「优化效率 / 提前还贷 / 储备现金 / 准备分店 / 关店止损」。
5. **分店与结局**：后期满足条件可开直营分店；达成**连锁帝国 / 财富自由**等隐藏结局后仍可继续经营。

---

## 目录结构（架构 §2）

```
kaidian-shuo/
├── index.html
├── package.json / vite.config.ts / tsconfig*.json / tailwind.config.js / postcss.config.js
├── docs/ARCHITECTURE.md            # 详细设计文档（实现圣经）
├── src/
│   ├── main.tsx / App.tsx          # 入口 + 阶段机（tutorial→opening→playing，弹窗调度）
│   ├── index.css
│   ├── types/                      # 单一事实来源（events.ts / index.ts）
│   ├── data/                       # 交接包数据（JSON 原样 import）+ 索引/助手
│   │   ├── decision-options.json / decisionOptions.ts
│   │   ├── events.v0.1.json / events.ts
│   │   ├── endings.json / endings.ts
│   │   ├── tutorial-modal.json / tutorial.ts
│   │   ├── storeProfiles.ts / locationProfiles.ts
│   ├── utils/                      # constants.ts（localStorage key、周末/月末判定）/ format.ts
│   ├── core/                       # 纯函数核心（不 import React）
│   │   ├── rng.ts / modifiers.ts / effectResolver.ts / futureEffect.ts
│   │   ├── settlement.ts           # 结算公式（严格 §5.3 顺序）
│   │   ├── hiddenLines.ts / wind.ts / eventGate.ts / eventEngine.ts
│   │   ├── crisis.ts / monthlyReport.ts / endings.ts / branch.ts
│   │   ├── createNewGame.ts / gameLoop.ts
│   ├── store/gameStore.ts          # Zustand：持有 GameState + actions（只调 core）
│   └── components/
│       ├── ui/                     # Card / Button / Modal（圆角卡片、橙色主按钮、底部抽屉弹窗）
│       ├── StatusBar / Dashboard / FunnelChart / CashCurve / DecisionPanel
│       ├── WindPanel / RiskEstimate / BusinessLog / EventCard / EndDayButton
│       ├── OpeningSetup.tsx
│       └── modals/                 # Tutorial / Event / Settlement / Crisis / Month / Ending
└── tests/                          # settlement.test.ts（结算公式）/ simulate.test.ts（120 天模拟）
```

### 分层约束

- **core/**：纯函数，绝不 `import React`；只读状态、返回新状态。
- **store/**：Zustand store 只调用 core 纯函数；UI 只调用 store actions。
- **components/**：UI 只通过 store 读取状态、派发 action。
- 核心机制（结算公式、暗线、事件引擎、风向、结局）不可删除；不实现 3D/地图/员工走动/装修小游戏；
  不出现「勇哥这样说」，统一用「**店里风向**」。

---

## 核心契约速查

- **结算顺序（§5.3）**：基准曝光 → 堂食/外卖拆分 → 进店率/成交率/复购率/客单价/毛利率修正
  → 订单（含复购，承载上限截断，超载顾客信任 -3）→ 流水/毛利/净利/现金 → 保本线/安全线。
- **Pct 契约（§9.1）**：`marginPct/entryRatePct/conversionRatePct/repurchaseRatePct` 为「百分点加法」；
  `exposurePct/dineInExposurePct/deliveryExposurePct/avgOrderValuePct/revenuePct/ordersPct/deliveryOrdersPct` 为「百分比乘法」；
  `rentPct/efficiencyPct` 为持久修改；`staffCostPct/platformCostPct` 为当日成本乘子。
- **效果解析（effectResolver）**：cash 令牌（`-1_month_rent`、`+half_month_rent`、`-deposit`、数值字符串）、
  隐藏暗线/软暗线、评分/信用/应付账款、`rentPct/efficiencyPct` 持久修改、
  `resolveRandom / futureEffect / unlock / durationDays / cooldown / ending`。
- **事件引擎**：`computeBaseProb / drawEvent / selectPool / cooldown`，强制事件 F001（现金<0）/ F002（月末房租）/ F003（债务压力）。
- **风向**：不显示数值，仅按暗线阈值映射到症状文案（平稳/留意/警惕/危险）。
- **评分**：内部 `rating` 0–100，UI 显示 `rating/20`（clamp 0–5 星）。
- **颜色**：暖白背景 `#FFFDF9`、卡片 `#FFFFFF`、主色橙 `#FF7A1A`、盈利绿 `#1FA971`、风险红 `#E5484D`。

---

## 测试

```bash
npm test
```

- `tests/settlement.test.ts`：严格校验 §5.3 结算公式（基准曝光、订单、承载截断、金额、净利、cashAfter 契约）。
- `tests/simulate.test.ts`：固定种子下连续运行 120 天不抛错、阶段正确推进；验证现金流危机分支（F001）；
  验证结局可触发性（全新存档无结局、现金破 -5 万触发「暂停营业」、满足财富自由条件触发隐藏结局）。

---

## 构建产物

`npm run build` 输出到 `dist/`，可直接用任意静态服务器托管（纯静态资源，无服务端依赖）。
