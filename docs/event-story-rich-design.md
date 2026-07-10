# 「开店说」主页"故事"文案方案（story 字段设计）

> 文档定位：纯文案方案设计，**不改动任何 .ts/.tsx/.json 源码，不碰 git**。
> 目标：为现有事件池（约 70 条事件、全部选项）新增 `story` 字段文案，让主页"今天发生了什么"从干巴巴的汇报（`visibleEffect`）变成一段有画面、有情绪、能逗乐的小叙事。
> 阶段：本阶段只出方案 + 文案；`types/EventCard/events.json` 的代码挂载留待工程师阶段。
> 本版修订：文风升级为"更搞笑夸张、段子感更强"；引入 `{name}`/`{店名}` 占位符（详见 2.2）。

---

## 一、现有事件盘点

### 1.1 总体规模
- **事件总数**：63 条（`E001`–`E060` 共 60 条 + `F001`–`F003` 强制危机 3 条）。
- **选项总数**：195 个（全量覆盖，含 F001 的 8 选项、F002/F003 各 4 选项）。
- **字段现状**：`src/types/events.ts:55` 的 `EventOption` 目前只有 `visibleEffect?: string`（结果汇报版）。本次新增并列的 `story?: string`（画面叙事版），两者共存、`story` 优先显示。

### 1.2 9 大类分组统计
> 说明：源码里实际有 11 个 `category`（weather/district/landlord/staff/supplier/promotion/platform/competitor/equipment/compliance/forced）。为对齐你拍板的 9 大类口径，映射如下：
> - `platform`（外卖平台 6 条）并入 **推广流量**
> - `equipment`（故障 3 条）+ `forced`（强制危机 3 条）并入 **故障危机**
> - `compliance`（合规 2 条）归入 **其他**

| 大类 | 映射源码 category | 事件条数 | 选项数 |
|---|---|---|---|
| 天气 | weather | 6 | 16 |
| 商圈 | district | 8 | 25 |
| 房东 | landlord | 6 | 17 |
| 员工 | staff | 8 | 23 |
| 供应商 | supplier | 8 | 24 |
| 推广流量 | promotion(8) + platform(6) | 14 | 43 |
| 竞品 | competitor | 5 | 16 |
| 故障危机 | equipment(3) + forced(3) | 6 | 25 |
| 其他 | compliance | 2 | 6 |
| **合计** | — | **63** | **195** |

### 1.3 逐事件明细（事件id · title · category · 各选项 id + 现有 visibleEffect）

**天气（weather）**
- E001 小雨（weather）：auto「堂食客流略降，外卖曝光略升。」
- E002 暴雨（weather）：normal「堂食大降，外卖小升，员工压力增加。」/ delivery「外卖订单明显增加，但平台依赖和差评风险上升。」/ close_early「当天流水减少，但员工压力下降。」
- E003 高温天（weather）：cold_drink「饮品销量上升，但出餐压力增加。」/ normal「自然受益，小幅增长。」/ raise_price「客单价上升，但价格争议增加。」
- E004 寒潮（weather）：hot_combo「热食销量上涨。」/ discount「订单增加但毛利下降。」/ none「影响较小。」
- E005 连续阴雨（weather）：better_package「成本上升，评分更稳。」/ dine_discount「堂食成交回升，毛利下降。」/ endure「不花钱，但差评风险上升。」
- E006 台风预警（weather）：close「当天无流水，员工压力下降。」/ half_day「收入减半，风险较低。」/ normal「仍有收入，但设备和卫生风险上升。」

**商圈（district）**
- E007 写字楼加班潮（district）：extend「晚间流水上涨，员工压力增加。」/ dinner_combo「客单价上升，顾客信任小升。」/ none「错过机会。」
- E008 附近大公司搬走（district）：delivery「部分恢复曝光，但平台依赖上升。」/ community「短期流水下降，长期复购改善。」/ cheap_lunch「成交率上升，毛利下降。」/ none「未来午餐客流明显下降。」
- E009 学校放假（district）：less_stock「流水下降但损耗减少。」/ delivery「曝光回升，平台依赖上升。」/ holiday_combo「成交率小幅回升。」
- E010 商场活动（district）：extra_staff「能接住人流，但人工成本上升。」/ combo「订单增加，毛利下降。」/ natural「流水上升，员工压力增加。」
- E011 道路施工（district）：delivery「堂食减少，外卖依赖上升。」/ private「复购和信任上升。」/ endure「未来7天进店率下降。」
- E012 地铁口开通（district）：promote「曝光大涨，房东关注也上涨。」/ quality「稳健承接新增客流。」/ raise_price「客单价上涨，价格争议增加。」
- E013 新楼盘入住（district）：membership「复购率和顾客信任上升。」/ flyer「曝光增加，需要推广成本。」/ none「自然客流小幅上升。」
- E014 夜市爆火（district）：extend「夜间流水上涨，员工压力增加。」/ night_product「客单价小升，供应链更复杂。」/ none「错过短期热度。」

**房东（landlord）**
- E015 房东路过（landlord）：auto「房东关注上升。」
- E016 房东涨租（landlord）：accept「固定成本上升，房东关注下降。」/ negotiate「可能压价，也可能激怒房东。」/ move_prepare「现金压力上升，解锁搬店路线。」/ pretend_poor「本月不变，但房东耐心下降。」
- E017 提前续约（landlord）：lock_rent「现金减少，未来60天涨租冷却。」/ reject「暂不花钱，房东关注上升。」/ short_term「降低承诺，但有谈判风险。」
- E018 房东免租半个月（landlord）：save「现金压力缓解。」/ promote「曝光上升，虚火略升。」/ pay_supplier「供应链隐患下降。」
- E019 物业统一装修（landlord）：full「花钱提高形象。」/ simple「少花钱，但隐患增加。」/ delay「短期不花钱，房东关注上升。」
- E020 房东卖铺（landlord）：wait「暂不花钱，但未来不确定性提高。」/ long_contract「现金减少，稳定性提高。」/ move_prepare「解锁新选址观察。」

**员工（staff）**
- E021 员工临时请假（staff）：owner「省人工，但老板透支上升。」/ temp「成本上升，服务稳定。」/ limit_order「流水下降，评分稳定。」
- E022 核心员工离职（staff）：raise「人工成本上升，员工压力下降。」/ hire「短期效率下降。」/ owner「老板透支，服务风险上升。」
- E023 员工要求涨薪（staff）：raise「人工成本上升，员工压力下降。」/ promise「短期不花钱，未来更危险。」/ hire_new「短期混乱，长期分担压力。」
- E024 服务被顾客夸（staff）：praise「顾客信任上升，员工压力下降。」/ bonus「花小钱稳团队。」/ ignore「无明显变化。」
- E025 新人培训见效（staff）：auto「出餐效率提升，员工压力下降。」
- E026 员工集体不满（staff）：rest「当天无流水，员工压力大降。」/ bonus「现金减少，团队稳定。」/ force「短期营业，未来更危险。」/ short_hours「流水下降，压力缓解。」
- E027 老板顶班过劳（staff）：rest「流水下降，老板恢复。」/ continue「继续开，但服务风险上升。」/ temp「花钱换恢复。」
- E028 招到熟手（staff）：hire「人工成本上升，效率提升。」/ reject「无变化。」/ trial「低成本试用，有不确定性。」

**供应商（supplier）**
- E029 原料小涨价（supplier）：absorb「毛利下降，顾客无感。」/ raise_price「客单小升，价格争议上升。」/ cheap「毛利稳定，但供应和信任受损。」
- E030 供应商坐地起价（supplier）：accept「毛利下降，供应较稳。」/ switch「成本下降，质量波动上升。」/ credit_terms「可能缓解现金流，也可能谈崩。」
- E031 供应商给账期（supplier）：accept「短期现金改善，未来应付账款增加。」/ cash_pay「信用稳定。」/ stock_more「断货风险下降，损耗风险上升。」
- E032 核心原料断货（supplier）：pause_signature「流水下降，顾客信任下降。」/ substitute「继续卖，但评分和信任受损。」/ buy_expensive「现金减少，品质稳定。」
- E033 临期低价货（supplier）：use「毛利提高，卫生和信任风险上升。」/ reject「无变化。」/ small_test「小幅提升毛利，略增风险。」
- E034 高端原料到货（supplier）：new_product「客单价上升，毛利略降，信任上升。」/ limited「传播性上升，供应复杂度上升。」/ skip「无变化。」
- E035 物流延迟（supplier）：local_buy「毛利下降，供应稳定。」/ missing_menu「流水和信任下降。」/ late_open「流水下降。」
- E036 稳定供应商合作（supplier）：contract「毛利略降，供应风险大降。」/ normal「稳定。」/ bargain「毛利上升，关系变差。」

**推广流量（promotion + platform）**
- E037 短视频小火（promotion）：receive「曝光上升，员工压力增加。」/ limited「流水上升，口碑较稳。」/ boost「曝光大涨，虚火和压力上升。」
- E038 短视频爆火（promotion）：extra_staff「花钱接住流量。」/ limited「流水上涨较稳，信任提升。」/ more_promo「短期收入大涨，暴雷风险上升。」/ stop_promo「降温处理。」
- E039 评论区价格争议（promotion）：discount_explain「成交回升，毛利下降。」/ quality「信任上升，但争议仍在。」/ ignore「成交下降，争议加剧。」
- E040 投放失效（promotion）：stop_review「推广成本下降，虚火下降。」/ change_material「花钱尝试优化。」/ pay_more「继续烧钱，结果不稳定。」
- E041 探店邀约（promotion）：free「不花钱，结果不可控。」/ paid「曝光提高，虚火上升。」/ reject「无风险，错过曝光。」
- E042 打卡客变多（promotion）：photo_flow「进店率上升，复购略降。」/ efficiency「花钱降低压力。」/ ignore「店里更乱，信任下降。」
- E043 团购爆单（promotion）：full「订单暴涨，利润变薄，压力上升。」/ limited「稳健增长。」/ threshold「订单小增，利润较稳。」
- E044 期待落差（promotion）：improve「花钱修复信任。」/ lower_promo「虚火和争议下降。」/ continue_packaging「短期曝光上升，长期风险更大。」
- E045 平台流量扶持（platform）：receive「外卖订单上升，员工压力增加。」/ control「增长较稳，评分更稳。」/ discount「订单大增，毛利下降。」
- E046 满减活动邀请（platform）：join「订单增加，利润变薄。」/ small「温和增长。」/ reject「平台曝光小降。」
- E047 骑手不足（platform）：extend_eta「订单略降，评分稳定。」/ keep「订单稳定，评分下降。」/ pause_delivery「流水下降，平台依赖下降。」
- E048 差评影响排名（platform）：compensate「花钱修复评分。」/ package「成本上升，评分回稳。」/ ignore「外卖曝光下降。」
- E049 平台规则调整（platform）：continue「订单稳定，平台成本上升。」/ private「短期花钱，长期降低依赖。」/ reduce「流水下降，毛利改善。」
- E050 包装成本上涨（platform）：absorb「毛利下降。」/ cheap_packaging「评分和卫生风险受影响。」/ raise_delivery_price「成交略降，价格争议上升。」

**竞品（competitor）**
- E051 隔壁新店开业（competitor）：promo「花钱稳成交。」/ loyalty「复购和信任上升。」/ observe「短期进店下降。」
- E052 竞品9.9促销（competitor）：match「订单上升，毛利下降。」/ ignore「短期成交下降，品质信任小升。」/ combo「温和应对。」
- E053 竞品食安翻车（competitor）：hygiene「信任和进店上升。」/ no_hype「稳健处理。」/ secret_promo「曝光上升，但有反噬风险。」
- E054 竞品倒闭（competitor）：take_customers「进店率和信任上升。」/ hire_staff「现金减少，效率提升。」/ none「自然客流小幅上升。」
- E055 连锁品牌进场（competitor）：differentiate「短期流水略降，长期信任上升。」/ discount「订单增加，利润大降。」/ old_customers「新客少些，复购更稳。」/ move_prepare「花钱观察新选址。」

**故障危机（equipment + forced）**
- E056 冰箱故障（equipment）：repair「花钱消除隐患。」/ temporary「少花钱，风险增加。」/ pause_items「流水下降，顾客信任略降。」
- E057 收银系统故障（equipment）：manual「流水略降，账目误差风险上升。」/ repair_close「流水下降，花钱修复。」/ cash_only「成交下降，信任略降。」
- E058 后厨漏水（equipment）：close_repair「当天无流水，风险下降。」/ simple「少花钱，但隐患仍在。」/ continue「继续卖，但卫生和评分风险大增。」
- F001 现金流危机（forced）：bank_loan「现金增加，债务和月还款上升。」/ family「立刻续命，但人情压力增加。」/ micro_loan「到账快，利息高。」/ delay_rent「短期活命，房东风险大增。」/ delay_supplier「短期活命，供应链风险大增。」/ layoff「成本下降，效率和员工状态受损。」/ sell_equipment「现金增加，经营上限下降。」/ close_shop「进入止损结局。」
- F002 月底房租不足（forced）：loan「用债务补账单。」/ negotiate_landlord「可能缓租，也可能惹怒房东。」/ default_rent「房东风险大幅上升。」/ close_shop「进入止损结局。」
- F003 债务压力爆表（forced）：stop_loss「体面撤退。」/ cut_cost「成本下降，隐患上升。」/ more_loan「短期续命，长期更重。」/ gamble_promo「高风险高波动。」

**其他（compliance）**
- E059 卫生检查（compliance）：rectify「花钱降低卫生风险。」/ temporary「便宜但风险很高。」/ self_check「当天无流水，风险大幅下降。」
- E060 食安投诉（compliance）：compensate「花钱止损，评分仍下降。」/ deny「短期省钱，长期危险。」/ close_check「当天无流水，信任和风险修复。」

---

## 二、story 写法规范（供用户 review 定文风）

### 2.1 核心规则
1. **视角**：第二人称"你"。强化代入感，让玩家觉得"这是我的店今天发生的事"。
2. **长度**：1~2 句；**单句以 ≤40 字为常态**，搞笑版允许偶尔抖一个长句（像脱口秀的包袱铺陈），但绝不写小作文、不堆数值。
3. **内容**：有画面感 + 抖机灵 + 一点戏剧张力/吐槽/小荒诞。不说教、不写"财报"、不堆数值。要让读者"看见"那个场景（谁、在哪儿、发生了什么、情绪如何），同时能"被逗一下"。
4. **口吻**：**更搞笑夸张、段子感更强**——像脱口秀演员在讲自己开店翻车日常：可以自嘲、可以吐槽、可以有点小荒诞，但**不低俗、不冒犯、不阴阳具体真实的人**。保留画面感，要在"出戏逗乐"和"还能当经营日记看"之间找平衡。
5. **与 visibleEffect 的关系**：`visibleEffect` 是"结果汇报版"（给数值/日志/弹窗用），`story` 是"画面叙事版"（给主页故事用）。**两者描述同一结果，但 story 不重复 visibleEffect 的干话**，要补上"人味"和"笑点"。与数值含义不矛盾（花钱的仍体现花了钱、危机的仍体现危险）。

### 2.2 变量 / 占位符策略（v2 修订：本期引入 `{name}` / `{店名}`）

> **相对上一版的变化**：上一版为"零改造成本"定为纯静态、不引入占位符。本版按用户反馈引入两个占位符，让故事更专属有人情，且仍能低成本落地。

#### 占位符清单与真实数据来源
| 占位符 | 含义 | 真实字段来源（已 Grep 确认） | 谁在何时注入 |
|---|---|---|---|
| `{name}` | 涉事员工姓名 | `Employee.name`（`src/types/employee.ts:18`）；姓名由 `generateEmployeeName()` 在 `src/data/employeeNames.ts` 随机生成 | **仅在渲染 story 时注入**；注入"该员工类事件关联的具体员工"的姓名 |
| `{店名}` | 当前店名 | `StoreState.name`（`src/types/index.ts:59`）；开店时由 `cfg.storeName`（`src/core/createNewGame.ts:88`）写入，运行时取 `state.store.name` | **渲染 story 时统一注入**当前店名 |

#### 使用原则（重要，避免硬塞）
- **员工类事件（E021–E028，共 23 选项）一律用 `{name}`**：这些事件本质都围绕某个具体员工（请假者、离职者、被夸者、被招者等）。渲染时工程师取"本次事件关联的员工"姓名填入 `{name}`。非员工类事件**不注入** `{name}`（文档里也不会出现）。
- **通用场景按需用 `{店名}`**：当句子天然以"这家店"为主语/场景（如房东晃到店门口、骑手在店门口排队、竞品抢走本店客流）时，用 `{店名}` 让故事更专属。强行无关的**不硬加**（如纯心理活动、纯天气白描可不带店名）。
- **互不冲突**：`{name}` 与 `{店名}` 可在同一条 story 共存（如 E022-hire「你放 `{name}` 走了……像 `{店名}` 重开张」）。
- 仍保留一定数量的**纯静态文案**（约 107 条）：无明确专属主语、强行加变量反而别扭，则保持原样。

#### 为什么在渲染时注入、而非落库时写死
1. 员工姓名是**运行时随机生成**的（`generateEmployeeName`），并不是事件数据里固定的字段；同一事件在不同存档/不同周目关联的员工不同。
2. 店名同理由玩家开店时自定义（`cfg.storeName`），无法写死在 `events.v0.1.json`。
3. 因此 `events.v0.1.json` 里只存**带占位符的模板字符串**，渲染组件负责把 `{name}`/`{店名}` 替换成真实值。详见第四节接线说明。

### 2.3 范例句（v2 新基调：更抖机灵，覆盖 好/坏/中性/危机，供定搞笑基调）
> 以下四条即用户反馈要求的"新文风样例句"，已写入第三节对应选项：

- **好 / 暖搞笑**（E024-bonus）：「你给 `{name}` 塞了个红包，他乐得差点把托盘举过头顶，今晚出餐带 BGM。」
- **坏 / 花钱**（E016-accept）：「你咬牙签字，房租又涨一截，房东拍拍你肩——那巴掌拍掉的，是你这个月的利润。」
- **中性**（E007-none）：「人潮从门口过了，你伸个懒腰——错过一班，下趟再说。」
- **危机**（F001-micro_loan）：「钱秒到账，你刚想欢呼，利息已拎着水桶从你兜里往外舀。」

### 2.4 文风基调建议（统一全局）
- 主线高感知类（**天气 / 员工 / 危机 / 房东 / 竞品**）写得最生动、最有戏，画面强、情绪足、包袱密。
- 供应商 / 推广流量类保持"合格生动 + 抖机灵"，重画面不啰嗦。
- 合规类（卫生检查、食安投诉）可带一点紧张感但不宜过度惊悚，契合"小本经营"的轻喜剧底色；吐槽点到为止，不渲染恐慌。

---

## 三、全量 story 文案对照（63 事件 / 195 选项）★ 含 `{name}`/`{店名}` 占位符

> 标注说明：标题后带 【name】= 该事件用 `{name}`；行内出现 `{店名}` 即占位符已注入。未标注且行内无占位符者为纯静态文案。

### 天气（weather）★高感知，重点生动

#### E001 · 小雨（weather）
- 选项 auto（原 visibleEffect：「堂食客流略降，外卖曝光略升。」）→ story：「雨一落，堂食客瞬间蒸发，骑手在 `{店名}` 门口排成贪吃蛇。」

#### E002 · 暴雨（weather）
- 选项 normal（原 visibleEffect：「堂食大降，外卖小升，员工压力增加。」）→ story：「店堂空得能打羽毛球，外卖单炸成烟花，后厨的人喘口气都算工伤。」
- 选项 delivery（原 visibleEffect：「外卖订单明显增加，但平台依赖和差评风险上升。」）→ story：「你把招牌翻成'外卖专用'，单子来了，差评的小箭头也举着手报名。」
- 选项 close_early（原 visibleEffect：「当天流水减少，但员工压力下降。」）→ story：「你拉下卷帘门，全员长舒一口气——今天少赚，但人都在，算赢。」

#### E003 · 高温天（weather）
- 选项 cold_drink（原 visibleEffect：「饮品销量上升，但出餐压力增加。」）→ story：「冰杯摞成小山，出餐口热成桑拿房，每杯冰饮都在替你数钱。」
- 选项 normal（原 visibleEffect：「自然受益，小幅增长。」）→ story：「天热人懒，顺路进来一口凉的，账本上悄悄多了个小零头。」
- 选项 raise_price（原 visibleEffect：「客单价上升，但价格争议增加。」）→ story：「你暗搓搓抬价，有人皱眉，也有人嘴上骂着'抢钱'手却扫码了。」

#### E004 · 寒潮（weather）
- 选项 hot_combo（原 visibleEffect：「热食销量上涨。」）→ story：「冷风里捧碗热汤的客，袖子缩着，钱包倒敞得挺大方。」
- 选项 discount（原 visibleEffect：「订单增加但毛利下降。」）→ story：「满减一挂，单子密了，你盯毛利率，它当场表演原地瘦身。」
- 选项 none（原 visibleEffect：「影响较小。」）→ story：「你啥也没动，店照旧打烊，平凡到连天气都懒得记住你。」

#### E005 · 连续阴雨（weather）
- 选项 better_package（原 visibleEffect：「成本上升，评分更稳。」）→ story：「你给餐盒加层棉袄，`{店名}` 顾客拆开直呼'还是走心'，你暗爽。」
- 选项 dine_discount（原 visibleEffect：「堂食成交回升，毛利下降。」）→ story：「堂食一打折，空位坐满，每单利润薄得像纸——风一吹就飘走。」
- 选项 endure（原 visibleEffect：「不花钱，但差评风险上升。」）→ story：「你硬扛没动，包装在雨里泡成了粥，差评也快泡出味儿了。」

#### E006 · 台风预警（weather）
- 选项 close（原 visibleEffect：「当天无流水，员工压力下降。」）→ story：「你挂出'今日休息'，员工睡了整觉，门外树被风刮得对你比中指。」
- 选项 half_day（原 visibleEffect：「收入减半，风险较低。」）→ story：「你只开半天，风把招牌晃成拨浪鼓，好在没闹出大新闻。」
- 选项 normal（原 visibleEffect：「仍有收入，但设备和卫生风险上升。」）→ story：「你硬开着门，雨往里灌，`{店名}` 地面积水照出一张张生无可恋的脸。」

### 商圈（district）

#### E007 · 写字楼加班潮（district）
- 选项 extend（原 visibleEffect：「晚间流水上涨，员工压力增加。」）→ story：「深夜灯还亮，加班白领涌进来，店员揉着快废的手继续搬砖。」
- 选项 dinner_combo（原 visibleEffect：「客单价上升，顾客信任小升。」）→ story：「你上晚餐套餐，加班族吃口热的，眼神里写满'幸好有 `{店名}`'。」
- 选项 none（原 visibleEffect：「错过机会。」）→ story：「人潮从门口过了，你伸个懒腰——错过一班，下趟再说。」

#### E008 · 附近大公司搬走（district）
- 选项 delivery（原 visibleEffect：「部分恢复曝光，但平台依赖上升。」）→ story：「堂食空了，你把命押给骑手，手机一响你脖子比狗还灵。」
- 选项 community（原 visibleEffect：「短期流水下降，长期复购改善。」）→ story：「你跟隔壁大爷大妈混脸熟，头几天冷清得能听见钱包叹气。」
- 选项 cheap_lunch（原 visibleEffect：「成交率上升，毛利下降。」）→ story：「你砍利润做便宜午餐，人来了，可赚的还不够你跑一趟腿。」
- 选项 none（原 visibleEffect：「未来午餐客流明显下降。」）→ story：「你啥也没干，店里一天比一天安静，安静得能听见倒闭的脚步。」

#### E009 · 学校放假（district）
- 选项 less_stock（原 visibleEffect：「流水下降但损耗减少。」）→ story：「你少进货，货架空了点，后厨剩菜终于不心疼地进垃圾桶了。」
- 选项 delivery（原 visibleEffect：「曝光回升，平台依赖上升。」）→ story：「学生走了，你转身讨好手机里的人，外卖单把空白勉强糊上。」
- 选项 holiday_combo（原 visibleEffect：「成交率小幅回升。」）→ story：「你上假期套餐，零星家长带娃来，`{店名}` 喘了口不算粗的气。」

#### E010 · 商场活动（district）
- 选项 extra_staff（原 visibleEffect：「能接住人流，但人工成本上升。」）→ story：「你临时叫帮手，人潮涌进来没人慌，工资条却悄悄胖了一圈。」
- 选项 combo（原 visibleEffect：「订单增加，毛利下降。」）→ story：「套餐一推单子密，你数单偷笑，转头看利润薄了又想叹气。」
- 选项 natural（原 visibleEffect：「流水上升，员工压力增加。」）→ story：「人流自己涌进来，店员脚不沾地，喝口水都成了年度奢侈。」

#### E011 · 道路施工（district）
- 选项 delivery（原 visibleEffect：「堂食减少，外卖依赖上升。」）→ story：「路挖开了，门口人绝迹，你只能盼骑手还认得 `{店名}` 这门。」
- 选项 private（原 visibleEffect：「复购和信任上升。」）→ story：「你拉个老客群，群里一声'今天吃点啥'，比烧钱广告灵十倍。」
- 选项 endure（原 visibleEffect：「未来7天进店率下降。」）→ story：「你硬忍没动，尘土一扬，路人绕着你走了一整周，像躲瘟神。」

#### E012 · 地铁口开通（district）
- 选项 promote（原 visibleEffect：「曝光大涨，房东关注也上涨。」）→ story：「人潮顺着地铁涌来，你刚乐开花，房东的影子就飘到 `{店名}` 门口。」
- 选项 quality（原 visibleEffect：「稳健承接新增客流。」）→ story：「新客来了你没飘，每碗面都稳住，回头的人慢慢把 `{店名}` 当食堂。」
- 选项 raise_price（原 visibleEffect：「客单价上涨，价格争议增加。」）→ story：「你盘算涨价，有人照付，也有人嘟囔'`{店名}` 怕不是飘了'。」

#### E013 · 新楼盘入住（district）
- 选项 membership（原 visibleEffect：「复购率和顾客信任上升。」）→ story：「新住户办了卡，像在附近认了门亲，隔三差五回 `{店名}` 蹭饭。」
- 选项 flyer（原 visibleEffect：「曝光增加，需要推广成本。」）→ story：「你印一摞传单，有人接有人扔，钱换回几张新面孔，血赚。」
- 选项 none（原 visibleEffect：「自然客流小幅上升。」）→ story：「你啥没做，新搬来的自己溜达进门，顺手把 `{店名}` 成全了。」

#### E014 · 夜市爆火（district）
- 选项 extend（原 visibleEffect：「夜间流水上涨，员工压力增加。」）→ story：「夜市火了你熬通宵，店员黑眼圈数钱，钱是烫的手是凉的。」
- 选项 night_product（原 visibleEffect：「客单价小升，供应链更复杂。」）→ story：「你加了夜宵，后厨多一摊事，账单里多了几笔零碎破账。」
- 选项 none（原 visibleEffect：「错过短期热度。」）→ story：「隔壁热闹到凌晨，你准时拉门，错过烟火气，也错过腰疼。」

### 房东（landlord）★高感知，重点生动

#### E015 · 房东路过（landlord）
- 选项 auto（原 visibleEffect：「房东关注上升。」）→ story：「房东又'顺路'晃到 `{店名}`，眼神扫收银台比顾客还敬业。」

#### E016 · 房东涨租（landlord）
- 选项 accept（原 visibleEffect：「固定成本上升，房东关注下降。」）→ story：「你咬牙签字，房租又涨一截，房东拍拍你肩——那巴掌拍掉的，是你这个月的利润。」
- 选项 negotiate（原 visibleEffect：「可能压价，也可能激怒房东。」）→ story：「你跟他掰扯半天，要么少涨点，要么看他脸黑得能炒菜。」
- 选项 move_prepare（原 visibleEffect：「现金压力上升，解锁搬店路线。」）→ story：「你悄悄看新址，押金像割肉，但'逃离 `{店名}`'的念头第一次冒头。」
- 选项 pretend_poor（原 visibleEffect：「本月不变，但房东耐心下降。」）→ story：「你装穷卖惨，房东半信半疑走了，下月看他脸色像看债主。」

#### E017 · 提前续约（landlord）
- 选项 lock_rent（原 visibleEffect：「现金减少，未来60天涨租冷却。」）→ story：「你交笔押金，像买了张免涨租保险，心里踏实了整整六十天。」
- 选项 reject（原 visibleEffect：「暂不花钱，房东关注上升。」）→ story：「你摆手说再想想，房东笑笑不说话，眼里算盘拨得噼啪响。」
- 选项 short_term（原 visibleEffect：「降低承诺，但有谈判风险。」）→ story：「你想签短点少绑自己，谈成省心，谈崩房东把你盯成重点户。」

#### E018 · 房东免租半个月（landlord）
- 选项 save（原 visibleEffect：「现金压力缓解。」）→ story：「房东免你半月租，你松口气，`{店名}` 这半月的现金流终于能喘。」
- 选项 promote（原 visibleEffect：「曝光上升，虚火略升。」）→ story：「你把省下的租砸进推广，`{店名}` 热闹了，水花里掺了点虚胖。」
- 选项 pay_supplier（原 visibleEffect：「供应链隐患下降。」）→ story：「你拿免租的钱还供货款，供应商的脸色终于从冰窖里暖了回来。」

#### E019 · 物业统一装修（landlord）
- 选项 full（原 visibleEffect：「花钱提高形象。」）→ story：「你按要求折腾一遍，`{店名}` 门面亮了，钱包也跟着瘪了一圈。」
- 选项 simple（原 visibleEffect：「少花钱，但隐患增加。」）→ story：「你糊弄一下，钱省了，墙角那隐患像颗定时小雷，随时蹦。」
- 选项 delay（原 visibleEffect：「短期不花钱，房东关注上升。」）→ story：「你拖着不装，物业皱眉，房东对 `{店名}` 的关注度又升了一格。」

#### E020 · 房东卖铺（landlord）
- 选项 wait（原 visibleEffect：「暂不花钱，但未来不确定性提高。」）→ story：「你按兵不动，`{店名}` 还是你的，只是头顶多了片说不清的乌云。」
- 选项 long_contract（原 visibleEffect：「现金减少，稳定性提高。」）→ story：「你掏押金锁长期约，钱出去了，悬在 `{店名}` 头上的石头落地了。」
- 选项 move_prepare（原 visibleEffect：「解锁新选址观察。」）→ story：「你四处看铺，脚比脑子先动，'逃离 `{店名}`'计划悄悄启动。」

### 员工（staff）★高感知，重点生动【name】★ 全部 23 选项用 `{name}`

#### E021 · 员工临时请假（staff）【name】
- 选项 owner（原 visibleEffect：「省人工，但老板透支上升。」）→ story：「你系围裙替 `{name}` 顶岗，省了工钱，腰却酸得直不起来。」
- 选项 temp（原 visibleEffect：「成本上升，服务稳定。」）→ story：「你叫临时工替 `{name}`，工资多开一笔，好歹没人手缺口的慌。」
- 选项 limit_order（原 visibleEffect：「流水下降，评分稳定。」）→ story：「你压接单量给 `{name}` 减负，生意淡点，出餐稳了评分没掉。」

#### E022 · 核心员工离职（staff）【name】
- 选项 raise（原 visibleEffect：「人工成本上升，员工压力下降。」）→ story：「你给 `{name}` 涨薪，他留下来了，工资单厚了，团队弦松了点。」
- 选项 hire（原 visibleEffect：「短期效率下降。」）→ story：「你放 `{name}` 走了，空位招新人，前几周乱得像 `{店名}` 重开张。」
- 选项 owner（原 visibleEffect：「老板透支，服务风险上升。」）→ story：「你替 `{name}` 亲自顶上，累够呛，手一抖差评风险也跟着来。」

#### E023 · 员工要求涨薪（staff）【name】
- 选项 raise（原 visibleEffect：「人工成本上升，员工压力下降。」）→ story：「你点头给 `{name}` 加薪，他眼睛亮了，绷着的劲儿松了下来。」
- 选项 promise（原 visibleEffect：「短期不花钱，未来更危险。」）→ story：「你给 `{name}` 画饼，他笑着应了，可那笑里藏着计时器在走。」
- 选项 hire_new（原 visibleEffect：「短期混乱，长期分担压力。」）→ story：「你招新人给 `{name}` 搭把手，头几天乱，久了才喘过气。」

#### E024 · 服务被顾客夸（staff）【name】
- 选项 praise（原 visibleEffect：「顾客信任上升，员工压力下降。」）→ story：「你当众夸 `{name}`，他耳根红了，接下来干活都带 BGM。」
- 选项 bonus（原 visibleEffect：「花小钱稳团队。」）→ story：「你给 `{name}` 塞了个红包，他乐得差点把托盘举过头顶，今晚出餐带 BGM。」
- 选项 ignore（原 visibleEffect：「无明显变化。」）→ story：「夸奖飘过去你没接，`{name}` 耸耸肩，日子照旧过。」

#### E025 · 新人培训见效（staff）【name】
- 选项 auto（原 visibleEffect：「出餐效率提升，员工压力下降。」）→ story：「`{name}` 终于不卡壳了，出餐口顺畅了，连空气都松快了点。」

#### E026 · 员工集体不满（staff）【name】
- 选项 rest（原 visibleEffect：「当天无流水，员工压力大降。」）→ story：「你给 `{name}` 拉闸休一天，店空荡荡，他睡醒眼神都清亮了。」
- 选项 bonus（原 visibleEffect：「现金减少，团队稳定。」）→ story：「你给 `{name}` 发笔奖金，钱出去了，怨气跟着散了大半。」
- 选项 force（原 visibleEffect：「短期营业，未来更危险。」）→ story：「你压 `{name}` 火气硬开，表面平静，雷管又悄悄多了一根。」
- 选项 short_hours（原 visibleEffect：「流水下降，压力缓解。」）→ story：「你砍时长给 `{name}` 减负，钱少赚，可他脸不再那么黑。」

#### E027 · 老板顶班过劳（staff）【name】
- 选项 rest（原 visibleEffect：「流水下降，老板恢复。」）→ story：「你给 `{name}` 放半天，账上少笔，脑子终于不转那么快了。」
- 选项 continue（原 visibleEffect：「继续开，但服务风险上升。」）→ story：「你让 `{name}` 接着硬扛，手比脑慢半拍，出错苗头悄悄冒头。」
- 选项 temp（原 visibleEffect：「花钱换恢复。」）→ story：「你请临时工替 `{name}`，花点钱，总算能喘口气直直腰。」

#### E028 · 招到熟手（staff）【name】
- 选项 hire（原 visibleEffect：「人工成本上升，效率提升。」）→ story：「你签下 `{name}` 这员熟手，工钱高了，他一上手节奏明显顺了。」
- 选项 reject（原 visibleEffect：「无变化。」）→ story：「你嫌 `{name}` 贵摆手拒绝，店里还是那几个脚不沾地的人。」
- 选项 trial（原 visibleEffect：「低成本试用，有不确定性。」）→ story：「你让 `{name}` 试三天，钱花得少，成不成看这七十二小时。」

### 供应商（supplier）

#### E029 · 原料小涨价（supplier）
- 选项 absorb（原 visibleEffect：「毛利下降，顾客无感。」）→ story：「你默默吞涨价，顾客毫无察觉，只有毛利率偷偷瘦了一圈。」
- 选项 raise_price（原 visibleEffect：「客单小升，价格争议上升。」）→ story：「你轻抬价，有人嘟囔'又贵了'，手却边骂边扫码付款。」
- 选项 cheap（原 visibleEffect：「毛利稳定，但供应和信任受损。」）→ story：「你换便宜料，账面平了，老客的舌头却先起了疑心。」

#### E030 · 供应商坐地起价（supplier）
- 选项 accept（原 visibleEffect：「毛利下降，供应较稳。」）→ story：「你认了这波涨价，利润薄了，供货的线总算没断。」
- 选项 switch（原 visibleEffect：「成本下降，质量波动上升。」）→ story：「你换家供货，价下来了，品质却开始坐过山车。」
- 选项 credit_terms（原 visibleEffect：「可能缓解现金流，也可能谈崩。」）→ story：「你跟供家谈账期，谈成喘口气，谈崩他脸色比价还难看。」

#### E031 · 供应商给账期（supplier）
- 选项 accept（原 visibleEffect：「短期现金改善，未来应付账款增加。」）→ story：「你接账期，眼下现金松了，可应付账款在后头排长队。」
- 选项 cash_pay（原 visibleEffect：「信用稳定。」）→ story：「你坚持现结，钱照出，跟供家的信任稳得像老相识。」
- 选项 stock_more（原 visibleEffect：「断货风险下降，损耗风险上升。」）→ story：「你多囤货，不怕断档了，临期损耗却开始咬你的肉。」

#### E032 · 核心原料断货（supplier）
- 选项 pause_signature（原 visibleEffect：「流水下降，顾客信任下降。」）→ story：「你摘下招牌菜，老客扑空，眼神里那点信任淡了些。」
- 选项 substitute（原 visibleEffect：「继续卖，但评分和信任受损。」）→ story：「你换替代料硬撑，味道差口气，评分口碑悄悄往下溜。」
- 选项 buy_expensive（原 visibleEffect：「现金减少，品质稳定。」）→ story：「你咬牙高价抢货，钱包瘪了，招牌味总算保住了。」

#### E033 · 临期低价货（supplier）
- 选项 use（原 visibleEffect：「毛利提高，卫生和信任风险上升。」）→ story：「你用临期货，利润厚了，卫生的雷和顾客疑心也跟着来了。」
- 选项 reject（原 visibleEffect：「无变化。」）→ story：「你摆手退回，钱没多赚，但睡得踏实，货架干干净净。」
- 选项 small_test（原 visibleEffect：「小幅提升毛利，略增风险。」）→ story：「你先试一批，赚不多风险也浅，像伸脚探了探水温。」

#### E034 · 高端原料到货（supplier）
- 选项 new_product（原 visibleEffect：「客单价上升，毛利略降，信任上升。」）→ story：「你拿好料上新，客单高了，老客尝了直点头，赚得薄了点。」
- 选项 limited（原 visibleEffect：「传播性上升，供应复杂度上升。」）→ story：「你做限量款，朋友圈开始晒，后厨活儿跟着乱了套。」
- 选项 skip（原 visibleEffect：「无变化。」）→ story：「你没接这波好料，货架照旧，错过一次往上走的机会。」

#### E035 · 物流延迟（supplier）
- 选项 local_buy（原 visibleEffect：「毛利下降，供应稳定。」）→ story：「你转头找本地货，价高点，好歹锅没停，客人没白等。」
- 选项 missing_menu（原 visibleEffect：「流水和信任下降。」）→ story：「你划掉几道菜，来的客扑空摇头，下次未必还回 `{店名}`。」
- 选项 late_open（原 visibleEffect：「流水下降。」）→ story：「你晚开门，早起客去了别家，`{店名}` 上午生意凉了半截。」

#### E036 · 稳定供应商合作（supplier）
- 选项 contract（原 visibleEffect：「毛利略降，供应风险大降。」）→ story：「你签长约，价让点，断供的噩梦总算不做。」
- 选项 normal（原 visibleEffect：「稳定。」）→ story：「你没动，供货照旧稳当，像老收音机不出杂音。」
- 选项 bargain（原 visibleEffect：「毛利上升，关系变差。」）→ story：「你砍砍价，利润厚了，供家电话那头的笑也淡了。」

### 推广流量（promotion + platform）

#### E037 · 短视频小火（promotion）
- 选项 receive（原 visibleEffect：「曝光上升，员工压力增加。」）→ story：「视频带人来你接住了，店员脚不沾地，笑里带着累。」
- 选项 limited（原 visibleEffect：「流水上升，口碑较稳。」）→ story：「你限量卖，反吊胃口，来的人满意走，口碑没翻车。」
- 选项 boost（原 visibleEffect：「曝光大涨，虚火和压力上升。」）→ story：「你接着猛投，数据漂亮了，可 `{店名}` 虚火和人都快撑不住。」

#### E038 · 短视频爆火（promotion）
- 选项 extra_staff（原 visibleEffect：「花钱接住流量。」）→ story：「你砸钱加人，爆单接住了，工资单厚了，热度没白来。」
- 选项 limited（原 visibleEffect：「流水上涨较稳，信任提升。」）→ story：「你限量护口碑，人来了满意走，对 `{店名}` 的好感在攒。」
- 选项 more_promo（原 visibleEffect：「短期收入大涨，暴雷风险上升。」）→ story：「你乘胜猛推，钱哗哗进，可脚下的泡沫，一戳就破。」
- 选项 stop_promo（原 visibleEffect：「降温处理。」）→ story：「你主动降温，热度退点，`{店名}` 终于不像在走钢丝。」

#### E039 · 评论区价格争议（promotion）
- 选项 discount_explain（原 visibleEffect：「成交回升，毛利下降。」）→ story：「你降价又解释，单子回来利润薄了，争议总算消停。」
- 选项 quality（原 visibleEffect：「信任上升，但争议仍在。」）→ story：「你晒品质，信的人多了，嫌贵的还在评论区较劲。」
- 选项 ignore（原 visibleEffect：「成交下降，争议加剧。」）→ story：「你装没看见，争议越吵越凶，路人被劝退几步。」

#### E040 · 投放失效（promotion）
- 选项 stop_review（原 visibleEffect：「推广成本下降，虚火下降。」）→ story：「你停投放复盘，钱省了，那层虚热闹也散了。」
- 选项 change_material（原 visibleEffect：「花钱尝试优化。」）→ story：「你换素材，钱花出去，成不成像往池子再扔一石子。」
- 选项 pay_more（原 visibleEffect：「继续烧钱，结果不稳定。」）→ story：「你加码硬投，钱烧得狠，回报像赌大小，时灵时不灵。」

#### E041 · 探店邀约（promotion）
- 选项 free（原 visibleEffect：「不花钱，结果不可控。」）→ story：「你答应免费探店，不花钱，可他镜头往哪转你完全猜不到。」
- 选项 paid（原 visibleEffect：「曝光提高，虚火上升。」）→ story：「你付合作费，曝光上去了，`{店名}` 水花里掺了点虚胖。」
- 选项 reject（原 visibleEffect：「无风险，错过曝光。」）→ story：「你婉拒了，省钱没惹事，那波流量擦肩而过。」

#### E042 · 打卡客变多（promotion）
- 选项 photo_flow（原 visibleEffect：「进店率上升，复购略降。」）→ story：「你弄拍照动线，人来更勤，真来吃的反倒没那么黏 `{店名}`。」
- 选项 efficiency（原 visibleEffect：「花钱降低压力。」）→ story：「你花钱理顺出餐，店员不堵了，焦躁的火也小了。」
- 选项 ignore（原 visibleEffect：「店里更乱，信任下降。」）→ story：「你没管，拍照的堵了道，排烦的客摇头走，`{店名}` 信任掉了点。」

#### E043 · 团购爆单（promotion）
- 选项 full（原 visibleEffect：「订单暴涨，利润变薄，压力上升。」）→ story：「你接满团购，单子像雪片，利润薄如纸，后厨快冒烟。」
- 选项 limited（原 visibleEffect：「稳健增长。」）→ story：「你限量，单子稳涨，不慌不忙，口碑没翻车。」
- 选项 threshold（原 visibleEffect：「订单小增，利润较稳。」）→ story：「你抬高门槛，单子少些，利润保住了，像加了过滤网。」

#### E044 · 期待落差（promotion）
- 选项 improve（原 visibleEffect：「花钱修复信任。」）→ story：「你花钱把产品做扎实，来的人尝了，落差慢慢被填平。」
- 选项 lower_promo（原 visibleEffect：「虚火和争议下降。」）→ story：「你收宣传势头，吹得没那么狠，争议跟着消了音。」
- 选项 continue_packaging（原 visibleEffect：「短期曝光上升，长期风险更大。）→ story：「你继续猛包装，眼前热闹，泡沫越大将来摔得越响。」

#### E045 · 平台流量扶持（platform）
- 选项 receive（原 visibleEffect：「外卖订单上升，员工压力增加。」）→ story：「平台推你一波，外卖单涌进，`{店名}` 后厨手速被迫拉满。」
- 选项 control（原 visibleEffect：「增长较稳，评分更稳。」）→ story：「你控接单量，涨得稳评分也稳，没被单子拖垮。」
- 选项 discount（原 visibleEffect：「订单大增，毛利下降。」）→ story：「你挂满减，单子炸了，利润却像被平台分走一勺。」

#### E046 · 满减活动邀请（platform）
- 选项 join（原 visibleEffect：「订单增加，利润变薄。」）→ story：「你点参加，单子密了，每单赚的薄得像被风吹过的纸。」
- 选项 small（原 visibleEffect：「温和增长。」）→ story：「你小力度蹭下，订单温温涨，利润没怎么伤着。」
- 选项 reject（原 visibleEffect：「平台曝光小降。」）→ story：「你摆手拒了，平台流量少一截，像被轻轻挪开聚光。」

#### E047 · 骑手不足（platform）
- 选项 extend_eta（原 visibleEffect：「订单略降，评分稳定。」）→ story：「你拉长出餐预估，单子少点好评却稳了，没人因迟到骂 `{店名}`。」
- 选项 keep（原 visibleEffect：「订单稳定，评分下降。」）→ story：「你硬接单，骑手迟迟不来，差评像约好了一样排队到 `{店名}`。」
- 选项 pause_delivery（原 visibleEffect：「流水下降，平台依赖下降。」）→ story：「你关外卖，生意淡了，被平台牵着的绳却松了些。」

#### E048 · 差评影响排名（platform）
- 选项 compensate（原 visibleEffect：「花钱修复评分。」）→ story：「你赔钱道歉，掉下去的星慢慢爬回半颗，`{店名}` 评分回点血。」
- 选项 package（原 visibleEffect：「成本上升，评分回稳。」）→ story：「你换稳妥包装，钱花了差评少了，`{店名}` 排名回点血。」
- 选项 ignore（原 visibleEffect：「外卖曝光下降。」）→ story：「你没管差评，排名往下溜，`{店名}` 外卖单子也变稀。」

#### E049 · 平台规则调整（platform）
- 选项 continue（原 visibleEffect：「订单稳定，平台成本上升。」）→ story：「你照用不误，单子稳，平台抽的那笔又悄悄涨了些。」
- 选项 private（原 visibleEffect：「短期花钱，长期降低依赖。」）→ story：「你拉老客群，眼下花钱，往后对平台腰杆能直一点。」
- 选项 reduce（原 visibleEffect：「流水下降，毛利改善。」）→ story：「你压外卖比例，总账少了，每单赚的反而厚实了。」

#### E050 · 包装成本上涨（platform）
- 选项 absorb（原 visibleEffect：「毛利下降。」）→ story：「包装涨价你自个扛了，利润薄一层，顾客毫无察觉。」
- 选项 cheap_packaging（原 visibleEffect：「评分和卫生风险受影响。」）→ story：「你换便宜盒子，价低了到手皱巴巴，`{店名}` 评分也跟着抖。」
- 选项 raise_delivery_price（原 visibleEffect：「成交略降，价格争议上升。」）→ story：「你抬外卖价，单子少两笔，吐槽'`{店名}` 又贵了'的人多了。」

### 竞品（competitor）★高感知，重点生动

#### E051 · 隔壁新店开业（competitor）
- 选项 promo（原 visibleEffect：「花钱稳成交。」）→ story：「隔壁锣鼓一响，`{店名}` 赶紧做活动，钱花出去客人没全跑。」
- 选项 loyalty（原 visibleEffect：「复购和信任上升。」）→ story：「你回头哄老客，常来的那几位更黏了，像认了门亲。」
- 选项 observe（原 visibleEffect：「短期进店下降。」）→ story：「你先观望，客人被隔壁勾走些，门口冷清了那么几天。」

#### E052 · 竞品9.9促销（competitor）
- 选项 match（原 visibleEffect：「订单上升，毛利下降。」）→ story：「你跟着砍到9.9，`{店名}` 单子回来了，利润薄得能透光。」
- 选项 ignore（原 visibleEffect：「短期成交下降，品质信任小升。」）→ story：「你没降价，单子少了，留下的客信的是 `{店名}` 东西本身。」
- 选项 combo（原 visibleEffect：「温和应对。」）→ story：「你没硬拼价，搞套餐，`{店名}` 单子温温涨姿态也好看。」

#### E053 · 竞品食安翻车（competitor）
- 选项 hygiene（原 visibleEffect：「信任和进店上升。」）→ story：「你亮干净后厨，怕出事的人转身进了 `{店名}` 的门。」
- 选项 no_hype（原 visibleEffect：「稳健处理。」）→ story：「你没踩同行，默默做好卫生，稳稳接住犹豫的客。」
- 选项 secret_promo（原 visibleEffect：「曝光上升，但有反噬风险。」）→ story：「你偷偷投流蹭热度，人来了，可万一被扒 `{店名}` 反噬够呛。」

#### E054 · 竞品倒闭（competitor）
- 选项 take_customers（原 visibleEffect：「进店率和信任上升。」）→ story：「对面卷帘门落下，散的客有些试探着走进 `{店名}`。」
- 选项 hire_staff（原 visibleEffect：「现金减少，效率提升。」）→ story：「你挖对面的人，花了钱，他一上手 `{店名}` 节奏利索不少。」
- 选项 none（原 visibleEffect：「自然客流小幅上升。」）→ story：「你没动作，对门客自己溜达过来，顺手成全了 `{店名}`。」

#### E055 · 连锁品牌进场（competitor）
- 选项 differentiate（原 visibleEffect：「短期流水略降，长期信任上升。」）→ story：「你避开正面刚，做 `{店名}` 自己的味道，眼前淡点回头客更铁。」
- 选项 discount（原 visibleEffect：「订单增加，利润大降。」）→ story：「你硬跟连锁拼促销，`{店名}` 单子来了，利润被压得只剩骨头。」
- 选项 old_customers（原 visibleEffect：「新客少些，复购更稳。」）→ story：「你抱紧老客，新面孔少了，`{店名}` 复购稳得像压舱石。」
- 选项 move_prepare（原 visibleEffect：「花钱观察新选址。」）→ story：「你开始看别处铺面，钱花在探路，'逃离巨头'念头动了。」

### 故障危机（equipment + forced）★高感知，重点生动

#### E056 · 冰箱故障（equipment）
- 选项 repair（原 visibleEffect：「花钱消除隐患。」）→ story：「你连夜修好冰箱，钱花了，`{店名}` 那柜货总算保住。」
- 选项 temporary（原 visibleEffect：「少花钱，风险增加。」）→ story：「你拿冰块凑合顶着，省了钱，隐患却像冰一样慢慢化。」
- 选项 pause_items（原 visibleEffect：「流水下降，顾客信任略降。」）→ story：「你下架冷柜品，想吃的客扑空撇嘴，去了别家。」

#### E057 · 收银系统故障（equipment）
- 选项 manual（原 visibleEffect：「流水略降，账目误差风险上升。」）→ story：「你拿纸笔手动记账，慢了点，月底对账怕要挠破头。」
- 选项 repair_close（原 visibleEffect：「流水下降，花钱修复。」）→ story：「你拉闸修机器，一天没开张，修好时钱包心情都瘪了。」
- 选项 cash_only（原 visibleEffect：「成交下降，信任略降。」）→ story：「你只收现金，掏手机付不了的人转身去了隔壁。」

#### E058 · 后厨漏水（equipment）
- 选项 close_repair（原 visibleEffect：「当天无流水，风险下降。」）→ story：「你停业修漏水，一天没进账，`{店名}` 积水隐患总算清了。」
- 选项 simple（原 visibleEffect：「少花钱，但隐患仍在。」）→ story：「你拿桶接水，省了钱，那摊水还在 `{店名}` 墙角盯着你。」
- 选项 continue（原 visibleEffect：「继续卖，但卫生和评分风险大增。」）→ story：「你踩着水接着在 `{店名}` 卖，客没少，卫生分评分悄悄往下掉。」

#### F001 · 现金流危机（forced）
- 选项 bank_loan（原 visibleEffect：「现金增加，债务和月还款上升。」）→ story：「银行打笔钱进来，你喘过气，每月的债却跟着扎了根。」
- 选项 family（原 visibleEffect：「立刻续命，但人情压力增加。」）→ story：「亲戚救了急，钱到账了，那声'以后还'像细线勒着心。」
- 选项 micro_loan（原 visibleEffect：「到账快，利息高。」）→ story：「钱秒到账，你刚想欢呼，利息已拎着水桶从你兜里往外舀。」
- 选项 delay_rent（原 visibleEffect：「短期活命，房东风险大增。」）→ story：「你先欠着房租，`{店名}` 还能开，房东看你的眼神已不对了。」
- 选项 delay_supplier（原 visibleEffect：「短期活命，供应链风险大增。」）→ story：「你压供货款，货还在，供家那边的关系开始发凉。」
- 选项 layoff（原 visibleEffect：「成本下降，效率和员工状态受损。」）→ story：「你裁人省开销，账面轻了，留下伙计的眼神也凉了。」
- 选项 sell_equipment（原 visibleEffect：「现金增加，经营上限下降。」）→ story：「你卖设备换钱，口袋鼓了，`{店名}` 的顶峰也卖掉半截。」
- 选项 close_shop（原 visibleEffect：「进入止损结局。」）→ story：「你拔插头，`{店名}` 卷帘门落下，这场梦你选得体面地醒。」

#### F002 · 月底房租不足（forced）
- 选项 loan（原 visibleEffect：「用债务补账单。」）→ story：「你借钱填房租，账单平了，债像雪球滚进下月。」
- 选项 negotiate_landlord（原 visibleEffect：「可能缓租，也可能惹怒房东。」）→ story：「你跟房东好说歹说，成了缓口气，崩了脸比账单还难看。」
- 选项 default_rent（原 visibleEffect：「房东风险大幅上升。」）→ story：「你硬欠房租，房东耐心见底，收 `{店名}` 的阴影逼近。」
- 选项 close_shop（原 visibleEffect：「进入止损结局。」）→ story：「你拉卷帘门，`{店名}` 房租焦虑到此为止，经营画了句点。」

#### F003 · 债务压力爆表（forced）
- 选项 stop_loss（原 visibleEffect：「体面撤退。」）→ story：「你按停止键，债还着走，至少人从 `{店名}` 正门走出去。」
- 选项 cut_cost（原 visibleEffect：「成本下降，隐患上升。」）→ story：「你砍了又砍，开销瘦了，人和货的隐患悄悄胖回来。」
- 选项 more_loan（原 visibleEffect：「短期续命，长期更重。」）→ story：「你又借一笔填旧坑，眼前活了，背上的石头更沉了。」
- 选项 gamble_promo（原 visibleEffect：「高风险高波动。」）→ story：「你押最后的钱进推广，成了翻盘，崩了是 `{店名}` 最后一搏。」

### 其他（compliance）

#### E059 · 卫生检查（compliance）
- 选项 rectify（原 visibleEffect：「花钱降低卫生风险。」）→ story：「你连夜整改，钱花了，`{店名}` 卫生风险单终于变绿。」
- 选项 temporary（原 visibleEffect：「便宜但风险很高。」）→ story：「你糊弄应付，省钱了，检查员一较真 `{店名}` 全盘皆输。」
- 选项 self_check（原 visibleEffect：「当天无流水，风险大幅下降。」）→ story：「你关门自查，一天没进账，`{店名}` 卫生的底终于托住。」

#### E060 · 食安投诉（compliance）
- 选项 compensate（原 visibleEffect：「花钱止损，评分仍下降。」）→ story：「你赔钱整改，钱出去了，`{店名}` 掉下去的星还没爬全。」
- 选项 deny（原 visibleEffect：「短期省钱，长期危险。」）→ story：「你矢口否认，省眼前钱，可 `{店名}` 信任裂缝悄悄蔓延。」
- 选项 close_check（原 visibleEffect：「当天无流水，信任和风险修复。」）→ story：「你关门彻查，一天没赚，`{店名}` 信任和卫生都重新立住。」

---

## 四、占位符接线说明（工程师阶段；本期仅说明，不改动）

### 4.1 数据层：把 `story` 写成带占位符的模板
- 在 `src/types/events.ts` 的 `EventOption`（`:52`，现有 `visibleEffect?: string` 在 `:55`）加 `story?: string`，与 `visibleEffect` 并列，**不动后者**。
- 在 `src/data/events.v0.1.json` 的**每个选项**对象下补 `story` 字段，文案即上文第三节——员工类（E021–E028）写 `{name}`，通用处写 `{店名}`，其余纯静态。

### 4.2 渲染层：注入真实值（关键新增步骤）
> 这是相对"纯静态方案"唯一多出来的工作量：在**渲染 story 字符串之前**做变量替换。

- **`{店名}`**：统一从 `state.store.name`（`StoreState.name`，`src/types/index.ts:59`）取，渲染时做一次 `str.replaceAll('{店名}', storeName)` 即可。
- **`{name}`**：仅员工类事件需要。渲染该事件 story 时，工程师需先确定"本次事件关联的员工"是谁，再注入其 `Employee.name`：
  - 关联员工来源：员工类事件在运行时由员工系统产生上下文（如 `src/store/gameStore.ts` 中 `staffEvents` / `tryExposeAttributes`、`strikeResult`、`resignResult` 等都会带 `employeeId`/`employeeName`）。
  - 接线建议：在把事件推给 UI（EventCard / 经营日志 / EventModal）的对象上，附上 `relatedEmployeeId?`（或 `relatedEmployeeName?`）；渲染 `story` 前用 `store.employees.find(e => e.id === relatedEmployeeId)?.name` 取出，再 `replaceAll('{name}', name)`。
  - 若上下文确实拿不到关联员工（极端兜底），`{name}` 回退为"店员"等通用词，避免显示原始花括号。

### 4.3 显示优先级（沿用上期）
- `EventCard.tsx` / 经营日志 / `EventModal.tsx` 显示改为：**有 `story` 用 `story`，否则 fallback 到 `visibleEffect`**（`visibleEffect` 继续给数值结算与弹窗说明用）。

### 4.4 待落地的文件清单（仅列"大致要改"，本期不做）
- `src/types/events.ts` —— 加 `story?: string`。
- `src/data/events.v0.1.json` —— 每个选项补 `story`（模板，含占位符）。
- `src/store/gameStore.ts` —— 推送员工事件时带上 `relatedEmployeeId`/`relatedEmployeeName`。
- `src/components/EventCard.tsx`（及经营日志 / `EventModal.tsx`）—— 渲染前做 `{店名}`/`{name}` 替换，并显示 `story`。

### 4.5 本方案覆盖统计
- 195 个选项**全量覆盖**，无遗漏。
- **`{name}` 使用：23 条**——全部集中在员工类事件 E021–E028（即员工事件的全部选项），逻辑自洽。
- **`{店名}` 使用：66 条**——集中在房东/商圈/竞品/危机/部分天气与推广等"以店为主语"的场景。
- **含占位符合计 88 条**（含 E022-hire 同时用 `{name}`+`{店名}` 一条重叠），其余 107 条为纯静态文案，遵循"无关联不硬塞"原则。
- 全文零源码改动、零 git 操作。
