# 增量 PRD：员工平衡调整 + 玩法说明重写

> 代行产出说明：本 PRD 由主理人（齐活林）在 software 系列专家 spawn 机制故障的降级情况下直接撰写，规格已与用户澄清确认。

## 变更总览
1. **离职/濒临离职阈值后移**：由“士气 ≤ 20 即进 warning”改为“连续两周满勤（每周 7 天班、连续 2 周）才进 warning”，避免在员工连续上班早期就误触发离职。
2. **连续上班士气惩罚阈值后移**：由“连续 > 7 天扣 −5”改为“连续 ≥ 14 天扣 −5”，中间（8~13 天）不扣。
3. **士气数值调整**：休息一天恢复 5 → **40**；涨工资动作固定 **+20** 士气（取代原按涨幅比例）。
4. **玩法说明重写**：融入行动点（每天 3 个）与员工/经营机制，写成新手向。

## 现状盘点（改动基准）
| 位置 | 当前值 / 逻辑 |
|---|---|
| `staffConstants.MORALE_RECOVERY_REST` | `5`（休息恢复） |
| `staffConstants.MORALE_DECAY_CONTINUOUS` | `-5`，触发 `consecutiveWorkDays > DAYS_PER_WEEK(7)` |
| `staffConstants.SALARY_RAISE_MORALE_PER_500` | `5`（每 500 元涨幅恢复 5） |
| `staffConstants.WARN_GRACE_DAYS` | `6`；`LOW_MORALE_THRESHOLD` = `20` |
| `staffSystem.applyMoraleDecay` | 第 196 行连续惩罚；第 205–223 行“士气 ≤ 20 进 warning + 越过阈值退出” |
| `staffSystem.resetWeeklyWorkDays` | 周日清零 `daysWorkedThisWeek`，不动 `consecutiveWorkDays` |
| `staffSystem.applySalaryRaise(e, amount, per500)` | `moraleGain = floor(amount/500)*per500` |
| `gameStore.adjustSalary` | `applySalaryRaise(emp, amount, SALARY_RAISE_MORALE_PER_500)` + `cash -= amount` |
| `gameStore.endDay` | 周日调 `resetWeeklyWorkDays` |
| `employee.ts` | 无 `consecutiveFullWeeks` 字段 |
| `ACTION_POINTS_BASE` | `3`（每天 3 行动点） |
| Tutorial | `tutorial-modal.json` 的 `body`，未含行动点 / 员工机制 |

## 需求规格

### 块A 离职阈值（连续两周满勤才 warning）
- 新增 `Employee.consecutiveFullWeeks?: number`（缺省 0）。
- 常量 `FULL_WEEKS_TO_WARN = 2`。
- `resetWeeklyWorkDays` 内：本周 `daysWorkedThisWeek >= DAYS_PER_WEEK(7)` 记为满勤周 → `consecutiveFullWeeks +1`，否则清零。
- 新增 `applyFullWeekWarning(employees)`（周日 `resetWeeklyWorkDays` 之后调用）：
  - `consecutiveFullWeeks >= FULL_WEEKS_TO_WARN` 且未 warning → 进 warning + 广播事件。
  - `consecutiveFullWeeks < FULL_WEEKS_TO_WARN` 且处于 warning → 退出（休息一周即撤回辞呈）。
- 移除 `applyMoraleDecay` 内“士气 ≤ 20 自动进 warning”分支（warning 不再因士气低误触发）。
- `advanceWarningAndResign` **保持不变**（warning 后连续出勤满 `WARN_GRACE_DAYS` 且士气 ≤ 阈值 → 离职），作为二次离职阀。

### 块B 士气
- `MORALE_RECOVERY_REST`: `5` → `40`。
- 连续惩罚阈值：`consecutiveWorkDays > DAYS_PER_WEEK(7)` → `>= CONTINUOUS_WORK_PENALTY_THRESHOLD(14)`；惩罚值保留 `−5`。
- 涨工资：`SALARY_RAISE_MORALE_FLAT = 20`；`applySalaryRaise(employee, amount)` 固定 +20（移除按涨幅比例、去掉 `moralePerAmount` 参数）；`gameStore.adjustSalary` 调用同步去第三参。

### 块C 玩法说明（Tutorial）
- 重写 `tutorial-modal.json` 的 `body`，融入：
  - **行动点**：每天 3 个，用于调价 / 供应商 / 推广 / 顶班等经营决策；部分行动有冷却、危机态限制。
  - **员工**：招聘、排班（上班 / 休息）、休息恢复士气、连续两周全勤会濒临离职（需休息或涨薪）、本周满 5 天第 6 天起加班 ×1.5。
  - **经营**：每日随机事件、风向提示隐藏风险、月度结算、现金为负可续命（贷款 / 拖欠 / 关店）。
  - **目标**：现金流为正、避免倒闭、达成隐藏结局。

## 设计决策（代行 PM 备注，供 review）
- 采用“只后移 warning 触发，保留 `advanceWarningAndResign` 二次离职阀”的最小方案，最贴合用户“连续两周满勤才濒临离职”字面。若后续要“满勤即直接离职”可再调。
- 连续惩罚保留 `−5`（“少量渐进”），仅阈值后移。
- 涨薪固定 +20，与涨幅脱钩（用户原话“涨工资加 20 点士气”）。

## 测试影响（代行 QA 预判）
- `qa-v3-staff-system.test.ts` 中“士气 ≤ 20 进 warning”断言需改写（改为 `consecutiveFullWeeks >= 2` 触发）。
- “连续 > 7 天惩罚”断言需改阈值 7 → 14。
- `applySalaryRaise` 按比例断言需改固定 +20。
