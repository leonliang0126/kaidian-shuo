# 《开店说》三处改动技术方案 + 任务分解

> 文档性质：**架构设计 + 任务分解**，不写任何实现代码、不改动任何 `.ts/.tsx/.json` 源文件。
> 适用版本：389 绿版本（`/Users/yoren/WorkBuddy/2026-07-08-20-34-45/kaidian-shuo`）
> 配套设计依据：许清楚 `docs/story-and-attrition-design.md`（离职/顶班根因 + 行号索引）、`docs/event-story-rich-design.md`（195 选项 story 文案定稿 + 占位符来源）。
> 已拍板决策（本文严格照此设计）：
> - **离职**：进入 `warning`（士气 ≤ 20）后，必须**连续排班出勤满 6 天**才可能离职；中途跳过排班即清零；窗口内士气回升 > 20 退出 warning；满 6 天且士气仍低 → **必然离职**（非概率）。
> - **顶班**：新增 `ownerCoverToday` 状态位（兜底与主动 `owner_shift` 都置 `true`）；结算 `effectiveCap = 员工承载 + (顶班 ? 70 : 0)`；无员工时顶班 → 承载 70 → 出基础流水。余额用 1 AP + 疲劳惩罚守住平衡。
> - **story**：`EventOption` 新增 `story?: string`（选项级，含 `{name}`/`{店名}` 占位符）；`EventCard`、经营日志、弹窗**优先显示 `option.story`，fallback `option.visibleEffect`**；渲染时把 `{name}`→涉事员工名、`{店名}`→店名，无关联时不注入或兜底「店员」。

---

## 1. 改动总览

| 块 | 现状（代码事实，引自 `story-and-attrition-design.md` §Step 1） | 本次改动 | 关键文件 |
|---|---|---|---|
| **A. 离职过渡状态机**（Q1/Q2/Q3） | `checkResignOrStrike` 在 `morale < 15` 时**次日立即离职**；`warning` 只是一次性文本提示，无状态、无计数（`staffSystem.ts:234-271`、`employee.ts:16-30`、`staffConstants.ts:32,62`）。 | 新增 `status:'stable'\|'warning'` + `warningWorkDays`；进入 warning 后**连续排班满 6 天才离职**，跳过排班清零，士气回升 > 20 退出；移除 `morale<15` 即时离职分支；罢工保留原逻辑。 | `types/employee.ts`、`types/index.ts`(迁移)、`core/staffSystem.ts`、`store/gameStore.ts`、`data/staffConstants.ts`、`core/migration.ts` |
| **B. 老板顶班修正**（Q4/Q5） | `owner_shift` 的 `capacity:"+small_today"` 被错映射到 `ordersPct(+3%)`（`actionScale.ts:75`）；结算承载只数员工（`settlement.ts:63`），从不读 `ownerCover`；无人排班兜底只加疲劳不加承载（`gameStore.ts:566`、`gameLoop.ts:116`）；`computeOwnerCapacity` 死代码（`staffSystem.ts:462`）。 | 新增 `ownerCoverToday` 状态位（每日重置）；结算 `effectiveCap += (ownerCoverToday ? 70 : 0)`；兜底/主动 `owner_shift` 都置 `true`；修 `capacity→ordersPct` 误导映射。 | `types/index.ts`、`core/settlement.ts`、`core/actionSystem.ts`、`store/gameStore.ts`、`core/gameLoop.ts`、`data/actionScale.ts`、`data/staffConstants.ts` |
| **C. 事件 story 挂载 + 占位符** | 随机事件弹窗只有 `visibleEffect`（汇报体）；无 story 叙事层；`EventOption` 只有 `visibleEffect?: string`（`events.ts:52-57`）。 | `EventOption` 新增 `story?: string`；`events.v0.1.json` 全 195 选项补 story 文案（`event-story-rich-design.md` §三）；新增 `interpolateStory` 工具做 `{name}`/`{店名}` 运行时注入；`EventCard`/`EventModal`/经营日志优先显示 `story`。 | `types/events.ts`、`types/index.ts`(EventLogEntry)、`utils/interpolateStory.ts`(新)、`data/events.v0.1.json`、`store/gameStore.ts`、`components/EventCard.tsx`、`components/modals/EventModal.tsx` |

---

## 2. 数据模型变更

### 2.1 `Employee`（`src/types/employee.ts`）
新增两个字段（仅描述，落地在任务 T01）：
```ts
status: 'stable' | 'warning';   // 默认 'stable'，入职即稳定
warningWorkDays: number;          // 进入 warning 后"连续排班出勤日"计数器，默认 0
```
> 不复用现有 `consecutiveWorkDays`（那是"连续工作 > 7 天"惩罚用的，语义不同），避免互相干扰。

**初始化位置**：
- `src/core/staffSystem.ts` 的 `generateEmployee()`（`:70-88`，hire / 开局初始员工都走这里）→ 新增 `status:'stable', warningWorkDays:0`。
- 旧档兼容：`src/core/migration.ts` 的 `migrateStore()`（`:52`）补 `status:'stable', warningWorkDays:0` 默认值，避免旧存档缺字段。

### 2.2 `EventOption`（`src/types/events.ts:52-57`）
与现有 `visibleEffect` 并列，**不动后者**：
```ts
export interface EventOption {
  id: string;
  label: string;
  visibleEffect?: string;   // 保留：数值结算 / 日志 / 弹窗说明
  story?: string;            // 新增：画面叙事版（含 {name}/{店名} 占位符），渲染优先
  effects: EffectObject;
}
```

### 2.3 `EventLogEntry`（`src/types/index.ts:178-184`）
为持久化选项故事（渲染时再做插值），新增 `story?: string`：
```ts
export interface EventLogEntry {
  day: number;
  eventId: string;
  optionId: string;
  title: string;
  visibleEffect?: string;
  story?: string;   // 新增：写盘时保存原始模板文案，UI 渲染时插值
}
```

### 2.4 `GameState`（`src/types/index.ts:235-298`）
新增顶班状态位（仅在 `GameState` 顶层，**不**进 `StoreState`）：
```ts
ownerCoverToday: boolean;   // 当天是否有老板顶班（行动点或兜底盘触发），每日重置
```
**重置时机**：`src/core/actionSystem.ts` 的 `resetDailyActionState()`（被 `gameStore.ts:134` 的 `beginDay` 调用）→ 在其中置 `ownerCoverToday = false`。保证每个新 day 从「未顶班」起步。

### 2.5 常量（`src/data/staffConstants.ts`）
新增两个常量（落地在 T01）：
```ts
export const WARN_GRACE_DAYS = 6;        // 进入 warning 后需连续出勤满此天数才可能离职
export const OWNER_CAPACITY_BONUS = 70; // 老板顶班承载加成（= 1 个员工位，BASE_CAPACITY_PER_STAFF）
```
> 保留现有 `RESIGN_MORALE_THRESHOLD=15`、`LOW_MORALE_THRESHOLD=20`、`BASE_CAPACITY_PER_STAFF=70`、`STRIKE_MORALE_THRESHOLD=20`。原 `RESIGN_MORALE_THRESHOLD` 不再驱动即时离职（改由 warning 计数接管），但常量可保留作为潜在兜底阈值，不删除。

---

## 3. 核心逻辑变更点（文件 + 函数 + 伪代码/签名，不写完整实现）

### 3.1 块 A · 离职过渡状态机

**① 入职初始化**（`core/staffSystem.ts` · `generateEmployee`）
```ts
// 在返回对象中新增两行：
return {
  ...,
  status: 'stable',        // 新增
  warningWorkDays: 0,       // 新增
};
```

**② 进入 / 退出 warning**（`core/staffSystem.ts` · `applyMoraleDecay`，当前 `:200-208` 的 morale_warning 分支处）
```ts
// 现有：newMorale <= 20 && emp.morale > 20 → push morale_warning
// 改造：同一判定把该员工 status 置 'warning'、warningWorkDays 清零（仅 stable→warning 一次）
if (newMorale <= 20 && emp.morale > 20) {
  // push 原 morale_warning StaffEvent（保留）
  status = 'warning';
  warningWorkDays = 0;
}
// 新增：退出 warning（士气回升越过 20）
if (emp.status === 'warning' && newMorale > 20) {
  status = 'stable';
  warningWorkDays = 0;
}
// 返回对象带上 status / warningWorkDays
```

**③ 每日计数 + 离职判定**（新增 `core/staffSystem.ts` · `advanceWarningAndResign`；在 `gameStore.endDay` 员工循环内、`applyMoraleDecay` 之后、`checkResignOrStrike` 之前调用）
```ts
/**
 * 对已处于 warning 的员工推进"连续排班出勤"计数；
 * 满 WARN_GRACE_DAYS 且士气仍 ≤ LOW_MORALE_THRESHOLD → 必然离职。
 * 中途未排班（跳过排班/休息/请假）→ 计数清零（连续中断）。
 */
export function advanceWarningAndResign(
  employees: Employee[],
): { employees: Employee[]; resigning: Employee[] } {
  const resigning: Employee[] = [];
  const updated = employees.map((emp) => {
    if (emp.status !== 'warning') return emp;            // 仅 warning 参与
    // 连续出勤计数：当日排班 +1，否则清零
    const nextCount = emp.isScheduledToday
      ? emp.warningWorkDays + 1
      : 0;
    // 离职称职条件：计数达标 且 此刻士气仍低
    if (nextCount >= WARN_GRACE_DAYS && emp.morale <= LOW_MORALE_THRESHOLD) {
      resigning.push(emp);
      return null; // 标记移除
    }
    return { ...emp, warningWorkDays: nextCount };
  }).filter(Boolean) as Employee[];
  return { employees: updated, resigning };
}
```

**④ `checkResignOrStrike` 改造**（`core/staffSystem.ts` · `:234-271`）
```ts
// 移除原 "for emp: if emp.morale < RESIGN_MORALE_THRESHOLD → resigning.push" 分支
// （即时离职由 ③ 的 6 天规则接管）
// 仅保留罢工检测：troublemaker && morale < STRIKE_MORALE_THRESHOLD → 全体罢工（不卡 6 天）
// 返回 type: 'none' | 'strike'
```
> `gameStore.endDay`（`:547`）原调用 `checkResignOrStrike` 拿 `resigning` 过滤员工；改为先调 `advanceWarningAndResign` 拿 `resigning` 过滤，再调 `checkResignOrStrike` 处理罢工（罢工仍走原 `isScheduledToday=false` 逻辑）。

**⑤ 恢复路径（休息/加薪）复位**
- `applyAllRest`（`staffSystem.ts:421-428`）：已对所有员工 `isScheduledToday:false` 且加士气——在其内补 `status:'stable', warningWorkDays:0`。
- `applySalaryRaise`（`staffSystem.ts:431-442`）：加薪后若 `morale > 20`，补 `status:'stable', warningWorkDays:0`。
- `setEmployeeSchedule`（`staffSystem.ts:290-325`）：若把员工从"未排班"改为"排班"（休息结束返岗），不安插复位——复位只在士气真正 > 20 时由 ② 处理，避免误清计数。

### 3.2 块 B · 老板顶班修正

**① 修 `capacity` 误导映射**（`data/actionScale.ts:58-96` · `VISIBLE_KEY_TO_MOD`）
```ts
// 现状：capacity: 'ordersPct'（owner_shift 的 capacity 被译成订单 +3%，错误）
// 改造：owner_shift 的顶班效果改由 actionSystem 直接置 ownerCoverToday，
//        故把 capacity 键从本行动移除；为防后人误读，将映射置 null：
capacity: null,   // 原 owner_shift 误用，现由 ownerCoverToday 接管，不再映射 ordersPct
```
> 同时建议把 `actions.v0.2.json` 中 `owner_shift.visibleEffects.capacity:"+small_today"` 整键删除（数据层），避免语义误导（属 T03 数据改动）。

**② 主动行动置位**（`core/actionSystem.ts` · `takeAction`，当前 `:87` 起、`applyEffects` 之后）
```ts
export function takeAction(state, actionId, rng) {
  let s = clone(state);
  const res = applyEffects(s, ...);  // 原逻辑：BOSS_STRAIN+12、STAFF+2 等保留
  s = res.state;
  if (actionId === 'owner_shift') {
    s.ownerCoverToday = true;   // 新增：主动顶班置位（保留原疲劳/事件权重效果）
  }
  // ... 原有 bossStrain 同步、AP 扣减等不变
  return { state: s, ... };
}
```

**③ 兜底置位**（`store/gameStore.ts:566-575` 与 `core/gameLoop.ts:116-123`）
```ts
// 现有：无人排班 → ownerFatigue += 15
// 改造：在加疲劳的同时置 ownerCoverToday = true
if (!hasScheduled && mainStore) {
  s.softHidden.ownerFatigue = clamp(s.softHidden.ownerFatigue + 15, 0, 100);
  s.ownerCoverToday = true;   // 新增：被迫顶班也置位
}
```
> `gameStore.endDay` 与 `gameLoop.ts` 两处兜底逻辑一致，需同步修改（T03 一起改）。

**④ 结算承载加成**（`core/settlement.ts` · `resolveSettlement`，当前 `:63`）
```ts
// 现状：let effectiveCap = computeCapacity(store.employees);
// 改造：接收 ownerCoverToday 入参，叠加老板顶班加成
let effectiveCap = computeCapacity(store.employees)
  + (ownerCoverToday ? OWNER_CAPACITY_BONUS : 0);
```
> `resolveSettlement` 需新增参数 `ownerCoverToday: boolean`（或在 `settleAllStores` 内把 `state.ownerCoverToday` 透传）。**多店处理**：老板顶班逻辑上只作用于主店，建议在 `settleAllStores`（`:155-202`）仅对 `index === 0` 的门店传入 `ownerCoverToday`，其余门店传 `false`，避免多店误加成。

**⑤ 死代码处理**（`core/staffSystem.ts:462-464` · `computeOwnerCapacity`）
```ts
// 现状：return 90; 全代码未被调用。
// 建议：标注 @deprecated 保留（不调用），或删除。本次不接它，顶班统一用 OWNER_CAPACITY_BONUS 常量。
```

**⑥ 每日重置**（`core/actionSystem.ts` · `resetDailyActionState`）
```ts
// 在返回/写入 state 时确保：
s.ownerCoverToday = false;   // 每个新 day 起步清零
```

### 3.3 块 C · story 挂载 + 占位符渲染

**① 插值工具**（新增 `src/utils/interpolateStory.ts`）
```ts
/**
 * 把 story 模板中的占位符替换为运行时真实值。
 * @param tpl   模板字符串（含 {name} / {店名}）
 * @param ctx   { name?: string; storeName: string }
 * @returns     替换后的字符串；无关联占位符做兜底，绝不残留花括号。
 */
export function interpolateStory(
  tpl: string,
  ctx: { name?: string | null; storeName: string },
): string {
  let out = tpl;
  // {name}：仅员工类事件有；缺失 → 兜底「店员」
  out = out.replaceAll('{name}', ctx.name?.trim() || '店员');
  // {店名}：统一取当前店名
  out = out.replaceAll('{店名}', ctx.storeName || '小店');
  return out;
}
```
> 全部渲染点统一调用此函数，避免散落 `replaceAll`。

**② 文案数据录入**（`data/events.v0.1.json`）
- 全 195 个选项对象下补 `story` 字段，文案逐条取自 `event-story-rich-design.md` §三（含 `{name}`/`{店名}` 占位符，**不改 `visibleEffect`**）。
- 统计：员工类事件 E021–E028 共 23 选项用 `{name}`；房东/商圈/竞品/危机/部分天气与推广共 66 处用 `{店名}`；88 条含占位符，其余 107 条纯静态（无占位符）。

**③ 写盘时保存 story**（`store/gameStore.ts`）
- `chooseEventOption`（`:288-291`）与 `beginDay` 自动事件（`:150-153`）写 `eventHistory` 时，新增 `story: opt.story`。
- `resolvedEvent` 已携带完整 `option`（含 `story`），UI 直接读 `option.story`。

**④ 渲染优先级 + 注入**（`components/EventCard.tsx`、`components/modals/EventModal.tsx`、经营日志）
```tsx
// EventCard.tsx（当前 :14-16）
const text = option.story ?? option.visibleEffect;        // 优先 story
const shown = interpolateStory(text, { name: relatedName, storeName: store.name });
// 渲染 shown 替代原 option.visibleEffect

// EventModal.tsx（当前 :32-34）每个选项同理：
const text = o.story ?? o.visibleEffect;
const shown = interpolateStory(text, { name: relatedName, storeName: store.name });

// 经营日志（EventLogEntry.story）：展示时 interpolateStory(entry.story ?? entry.visibleEffect, ...)
```
> **`{name}` 来源**：仅员工类事件（E021–E028）需要。事件触发时若由员工系统产生，须在 `eventModal`/`resolvedEvent` 对象上附带 `relatedEmployeeId`（或 `relatedEmployeeName`）。渲染前用 `store.employees.find(e => e.id === relatedEmployeeId)?.name` 取出注入；拿不到时兜底「店员」（见 ⑧）。非员工类事件文案**不含 `{name}`**，无需注入。

---

## 4. 文件清单（相对路径，标注 新增 / 修改）

| 路径 | 状态 | 所属块 |
|---|---|---|
| `src/types/employee.ts` | 修改 | A |
| `src/types/events.ts` | 修改 | C |
| `src/types/index.ts` | 修改 | A、B、C（GameState.ownerCoverToday / EventLogEntry.story / 迁移默认值） |
| `src/data/staffConstants.ts` | 修改 | A、B（WARN_GRACE_DAYS / OWNER_CAPACITY_BONUS） |
| `src/core/staffSystem.ts` | 修改 | A（generateEmployee / applyMoraleDecay / advanceWarningAndResign 新 / checkResignOrStrike / applyAllRest / applySalaryRaise / computeOwnerCapacity 标注） |
| `src/store/gameStore.ts` | 修改 | A、B、C（endDay 计数与兜底置位 / eventHistory 存 story / resolvedEvent 带 relatedEmployeeId） |
| `src/core/gameLoop.ts` | 修改 | B（兜底置 ownerCoverToday） |
| `src/core/settlement.ts` | 修改 | B（effectiveCap 加 ownerCoverToday 加成） |
| `src/core/actionSystem.ts` | 修改 | B（takeAction 置 ownerCoverToday / resetDailyActionState 清零） |
| `src/data/actionScale.ts` | 修改 | B（capacity 映射置 null） |
| `src/data/actions.v0.2.json` | 修改 | B（删除 owner_shift 的 capacity 键） |
| `src/core/migration.ts` | 修改 | A（migrateStore 补 Employee.status/warningWorkDays） |
| `src/utils/interpolateStory.ts` | **新增** | C |
| `src/data/events.v0.1.json` | 修改 | C（195 选项补 story） |
| `src/components/EventCard.tsx` | 修改 | C |
| `src/components/modals/EventModal.tsx` | 修改 | C |
| `src/components/BusinessLog.tsx`（经营日志） | 修改 | C（可选，渲染 EventLogEntry.story） |

> 注：`src/store/gameStore.ts` 内的 `story: {text,tone}`（`StoryCard` 借款/危机叙事）**与本方案 `EventOption.story` 是两回事**，互不冲突，勿混淆。

---

## 5. 任务分解（T01–T05，有序、含依赖、可独立验证）

> 遵循「底层数据 → 块逻辑 → 数据/渲染 → 集成」顺序。每个 T 列出子任务、涉及文件、验收点。

### T01 · 数据模型与常量底座
- **依赖**：无 ｜ **优先级**：P0
- **子任务**：
  1. `types/employee.ts`：`Employee` 增加 `status`、`warningWorkDays`。
  2. `types/events.ts`：`EventOption` 增加 `story?`。
  3. `types/index.ts`：`GameState` 增加 `ownerCoverToday: boolean`；`EventLogEntry` 增加 `story?`。
  4. `data/staffConstants.ts`：增加 `WARN_GRACE_DAYS=6`、`OWNER_CAPACITY_BONUS=70`。
  5. `core/migration.ts`：`migrateStore` 为旧档 `Employee` 补 `status:'stable'`、`warningWorkDays:0`；为旧 `GameState` 补 `ownerCoverToday:false`。
- **验收**：`tsc --noEmit` 通过；新存档 `createNewGame` 产出的员工含 `status:'stable',warningWorkDays:0`，`GameState` 含 `ownerCoverToday:false`；旧档 `migrateGameState` 加载不报缺字段。

### T02 · 离职过渡状态机（块 A）
- **依赖**：T01 ｜ **优先级**：P0
- **子任务**：
  1. `staffSystem.ts` · `generateEmployee`：返回对象补 `status:'stable',warningWorkDays:0`。
  2. `staffSystem.ts` · `applyMoraleDecay`：morale 跨过 ≤20 时置 `status:'warning'`、`warningWorkDays=0`；morale 回升 >20（且原 warning）时复位 `status:'stable',warningWorkDays=0`。
  3. `staffSystem.ts` · 新增 `advanceWarningAndResign(employees)`：warning 员工 `isScheduledToday`→`warningWorkDays+1`，否则清零；`warningWorkDays>=WARN_GRACE_DAYS && morale<=LOW_MORALE_THRESHOLD` → 进 `resigning`。
  4. `staffSystem.ts` · `checkResignOrStrike`：移除 `morale<RESIGN_MORALE_THRESHOLD` 即时离职分支；仅保留 troublemaker 罢工。
  5. `gameStore.ts` · `endDay`（`:531-556`）：在 `applyMoraleDecay` 后调 `advanceWarningAndResign` 拿 `resigning` 过滤；罢工仍走 `checkResignOrStrike`。
  6. `staffSystem.ts` · `applyAllRest` / `applySalaryRaise`：加薪/全员休息后若 `morale>20` 复位 `status/warningWorkDays`。
- **验收**：单测覆盖——① 进 warning 后连续排班 6 天且士气 ≤20 → 第 6 天必离职；② 中途任一天不排班 → 计数清零、不会在第 6 天离职；③ 第 3 天加薪使 morale >20 → 退出 warning 且不清零后再次计数；④ 罢工（troublemaker morale<20）不卡 6 天立即罢工；⑤ 原 `morale<15` 即时离职分支已移除。

### T03 · 老板顶班修正（块 B）
- **依赖**：T01 ｜ **优先级**：P0
- **子任务**：
  1. `actionSystem.ts` · `takeAction`：`actionId==='owner_shift'` 时置 `s.ownerCoverToday=true`（保留原 BOSS_STRAIN/STAFF 效果）。
  2. `actionSystem.ts` · `resetDailyActionState`：确保 `ownerCoverToday=false`。
  3. `settlement.ts` · `resolveSettlement`：新增 `ownerCoverToday` 入参，`effectiveCap += ownerCoverToday?OWNER_CAPACITY_BONUS:0`；`settleAllStores` 仅对主店（index 0）透传。
  4. `gameStore.ts:566` 与 `gameLoop.ts:116`：无人排班兜底分支置 `s.ownerCoverToday=true`（保留 `ownerFatigue+15`）。
  5. `actionScale.ts`：`VISIBLE_KEY_TO_MOD.capacity` 改 `null`；`actions.v0.2.json` 删除 `owner_shift.visibleEffects.capacity` 键。
  6. `staffSystem.ts` · `computeOwnerCapacity` 标注 `@deprecated`（不调用）。
- **验收**：单测——① 有 1 员工 + 顶班 → effectiveCap=140；② **0 员工 + 顶班 → effectiveCap=70 → 产生基础流水（revenue>0）**；③ 0 员工无顶班 → effectiveCap=0 → revenue=0（行为不变）；④ 主动 `owner_shift` 后 `ownerCoverToday=true` 且次日 `beginDay` 后重置为 `false`；⑤ `owner_shift` 不再给 `ordersPct+3%`。

### T04 · story 字段 + 插值工具 + 195 条文案
- **依赖**：T01 ｜ **优先级**：P1
- **子任务**：
  1. 新增 `utils/interpolateStory.ts`：`interpolateStory(tpl, {name?, storeName})`，`{name}`→name||'店员'、`{店名}`→storeName，无残留花括号。
  2. `data/events.v0.1.json`：全 195 选项补 `story`（文案取自 `event-story-rich-design.md` §三），员工类 E021–E028 用 `{name}`，通用场景用 `{店名}`，纯静态文案保持原样。
  3. `gameStore.ts`：`chooseEventOption` / `beginDay` 自动事件写 `eventHistory` 时带 `story: opt.story`；`resolvedEvent` 已含完整 `option`（含 story）。
- **验收**：单测 `interpolateStory`——`'{name} 今天' + {name:'阿强',storeName:'老王煎饼'}` → `'阿强 今天'`；缺 name → `'店员'`；`'{店名} 客满'` → `'老王煎饼 客满'`；无占位符模板原样返回。JSON 校验：195 选项均含 `story` 且为字符串；员工类 23 选项 story 含 `{name}`；随机 grep 抽查文案与定稿一致。

### T05 · story 渲染挂载 + 集成测试
- **依赖**：T02、T03、T04 ｜ **优先级**：P1
- **子任务**：
  1. `components/EventCard.tsx`：显示 `interpolateStory(option.story ?? option.visibleEffect, {name:relatedName, storeName})`；员工类事件从 `resolvedEvent` 关联的 `relatedEmployeeId` 取 name。
  2. `components/modals/EventModal.tsx`：每个选项同 ① 逻辑。
  3. `components/BusinessLog.tsx`（经营日志）：展示 `eventHistory[i].story` 经插值后的文本（若无 story 则 fallback visibleEffect）。
  4. `gameStore.ts`：确保员工类事件（E021–E028）在推给 UI 的 `eventModal`/`resolvedEvent` 上附 `relatedEmployeeId`/`relatedEmployeeName`（供 `{name}` 注入；无则兜底「店员」）。
  5. 集成测试：端到端跑一天 → 触发随机事件 → `EventCard` 显示 story 而非 visibleEffect；触发员工类事件 → 显示 `{name}` 已替换为真实员工名；触发顶班（0 员工）→ 当日 revenue>0 且 `ownerCoverToday` 当日为 true、次日 false；连续 6 天排班低士气员工 → 第 6 天从 `employees` 移除并出现在 `staffNotifications`。
  6. 构建验证：`tsc --noEmit` + `vite build`（带 BUILD_ID）通过。
- **验收**：手动/自动化走查三块功能均生效；无 TypeScript 报错；构建产物含新 BUILD_ID。

**依赖图**：
```
T01 ──┬──> T02 (离职状态机)
       ├──> T03 (老板顶班)
       └──> T04 (story 数据+工具)
T02 / T03 / T04 ──> T05 (渲染+集成)
```

---

## 6. 依赖包

**无新增依赖。** 本次改动仅改现有逻辑 + 新增一个纯函数工具 `interpolateStory.ts`（仅用原生 `String.replaceAll`）+ 在 `events.v0.1.json` 补数据文案，不引入任何第三方库。如确认无则写明「无新增依赖」。

---

## 7. 共享约定

1. **占位符注入函数唯一出口**：所有渲染点（EventCard / EventModal / 经营日志）统一调用 `src/utils/interpolateStory.ts` 的 `interpolateStory(tpl, { name?, storeName })`，禁止在组件内散落 `replaceAll`。
2. **`{店名}` 来源**：统一 `state.stores[0].name`（或当前店 `store.name`）。
3. **`{name}` 来源**：仅员工类事件需要。渲染前从 `resolvedEvent`/`eventModal` 附带的 `relatedEmployeeId` 经 `store.employees.find(...).name` 取出；非员工类事件文案不含 `{name}`，无需注入。
4. **兜底策略**：
   - `{name}` 拿不到关联员工 → 兜底「店员」，绝不显示原始 `{name}` 花括号。
   - `{店名}` 空 → 兜底「小店」。
   - 选项只有 `visibleEffect` 没有 `story` → 显示 `visibleEffect`（fallback 保持）。
5. **写盘 vs 渲染**：`story` 模板（含占位符）原样写入 `eventHistory`/`resolvedEvent`；**插值只在渲染时发生**（因需运行时员工名/店名上下文），不在写盘时替换。
6. **`visibleEffect` 不动**：数值结算、日志、弹窗说明继续用 `visibleEffect`，`story` 仅作叙事叠加层。

---

## 8. 待明确事项（需用户/工程师拍板的技术点）

1. **D1–D5 员工预警故事是否纳入本次范围**：许清楚 `story-and-attrition-design.md` 里 D1–D5（濒临离职预警故事）走的是 `staffNotifications` → `StoryModalData[]` 升级路径，**与本次块 C 的 `EventOption.story` 是两套机制**（warning 不是"事件选项"）。本方案块 C 严格按 team-lead 指示只覆盖 `EventOption.story`（63 事件 / 195 选项）。若要把 D1–D5 预警也做成故事弹窗，需另增 `StoryModalData` 结构与 `StaffEventModal` 升级，建议作为**后续独立任务**，不在本次 T 清单内。
2. **员工类事件的 `relatedEmployeeId` 是否已在事件对象上**：E021–E028 的 story 含 `{name}`，需渲染时取到真实员工名。需确认事件引擎在触发员工类事件时，是否已在 `eventModal`/`resolvedEvent` 上携带 `employeeId`/`employeeName`（参考 `staffSystem.ts` 的 `StaffEvent` 已带 `employeeId/employeeName`）。若未携带，需在事件触发/推 UI 处补挂（T05 子任务 ④ 已列出），否则 `{name}` 只能兜底「店员」。
3. **多店场景下 `ownerCoverToday` 的作用范围**：当前游戏以单主店为主。本方案建议顶班加成**仅作用于主店（index 0）**（与 `gameStore`/`gameLoop` 兜底只看 `mainStore` 一致）。若未来多店各自有老板，需改为按店记录——请确认保持"仅主店"。
4. **`computeOwnerCapacity`（死代码，返回 90）处理**：建议标注 `@deprecated` 保留不调用（本次统一用 `OWNER_CAPACITY_BONUS=70`）。是否直接删除由工程师定。
5. **`owner_shift` 的 `capacity:"+small_today"` 字段去留**：本方案建议从 `actions.v0.2.json` 删除该键，并将 `actionScale.ts` 的 `capacity` 映射置 `null`，避免后人误读为"订单 +3%"。若产品希望保留该键作展示文案，则仅改映射逻辑、保留键——请确认采用哪种。
6. **计数起点（进 warning 当天是否算第 1 天）**：本方案定义"进入 warning 当天若排班即计为第 1 天"，满 6 个连续排班日出勤日即离职。如需"进 warning 次日才开始计数"，需在 `advanceWarningAndResign` 入口排除"当日刚进入 warning"的员工（用 prior status 判断）。默认采用前者，请确认。
