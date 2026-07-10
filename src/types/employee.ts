// 员工系统类型定义（《开店说》员工系统重构 v3）
// 单一事实来源：EmployeeAttribute 枚举、Employee 接口、StaffEvent 接口

/** 8 种员工属性 */
export type EmployeeAttribute =
  | 'super_worker'      // 超级卷王：效率 1.5-2.0，无副作用
  | 'old_smooth'        // 老油条：效率 0.9-1.0，稳定
  | 'slacker'           // 摸鱼王：效率 0.3-0.9，波动大
  | 'rookie'            // 新手上路：效率 0.5→1.0 成长（入职后每日 +0.02）
  | 'all_rounder'       // 全能选手：效率 1.0-1.2，可顶任何缺岗
  | 'troublemaker'      // 刺头：效率 0.8-1.1，超时排班会带罢工
  | 'social_butterfly'  // 社交蝴蝶：效率 0.7-0.9，转化率 +5~10%
  | 'guanxi_hire';      // 关系户：效率 0.5-1.2 随机波动，辞退有惩罚

/** 员工实体 */
export interface Employee {
  id: string;
  name: string;
  joinDay: number;                      // 入职 day
  attribute: EmployeeAttribute;         // 真实属性（入职时确定）
  isExposed: boolean;                   // 是否已暴露（入职 >= 7天 → true）
  morale: number;                       // 士气 0-100
  monthlySalary: number;                // 月薪
  daysWorkedThisWeek: number;           // 本周已上班天数
  isScheduledToday: boolean;            // 今日是否排班
  weeklyWorkDays: number[];             // 本周每天排班记录 [day1, day2, ...]
  consecutiveWorkDays: number;
  consecutiveFullWeeks?: number;           // 连续满勤周数（每周 7 天班记 1 周；用于濒临离职判定，缺省按 0）          // 连续工作天数（用于长期不放假检测）
  isTempStaff: boolean;                 // 是否为事件临时员工
  efficiencyCache: number;              // 今日效率系数（由属性+士气+特殊机制计算后缓存）
  /**
   * 离职过渡状态：'stable' 稳定；'warning' 濒临离职（士气 ≤ LOW_MORALE_THRESHOLD 进入）。
   * 运行时由 generateEmployee / migration / createNewGame 始终置位，缺省按 'stable' 处理（旧档/测试夹具兜底）。
   */
  status?: 'stable' | 'warning';
  /**
   * 进入 warning 后"连续排班出勤日"计数器；满 WARN_GRACE_DAYS 且士气仍 ≤ LOW_MORALE_THRESHOLD → 必然离职；中途未排班清零。
   * 缺省按 0 处理。
   */
  warningWorkDays?: number;
}

/** 招聘候选人 */
export interface Candidate {
  id: string;
  name: string;
  attribute: EmployeeAttribute;         // 真实属性（对玩家隐藏）
  hint: string;                         // 隐晦自我介绍（几十到上百字）
  monthlySalary: number;                // 期望月薪
  generatedDay: number;                 // 生成时的 day
}

/** 员工系统返回的事件类型（供 gameStore 处理，转换为 UI 通知或 GameState 变更） */
export interface StaffEvent {
  type: 'resign' | 'strike' | 'morale_warning' | 'attribute_exposed' | 'overtime_warning';
  employeeId?: string;
  employeeName?: string;
  description: string;
}

/** 属性暴露结果映射（员工名前显示的中性标签） */
export const ATTRIBUTE_LABELS: Record<EmployeeAttribute, string> = {
  super_worker: '超级卷王',
  old_smooth: '老手',
  slacker: '自由派',
  rookie: '新人',
  all_rounder: '全能选手',
  troublemaker: '刺头',
  social_butterfly: '社交蝴蝶',
  guanxi_hire: '关系户',
};

/** 属性 emoji 图标 */
export const ATTRIBUTE_EMOJI: Record<EmployeeAttribute, string> = {
  super_worker: '🤩',
  old_smooth: '😎',
  slacker: '🐟',
  rookie: '🐣',
  all_rounder: '🦸',
  troublemaker: '💥',
  social_butterfly: '🦋',
  guanxi_hire: '🤝',
};

/** 属性特性说明（展示在员工详情弹窗） */
export const ATTRIBUTE_DESCRIPTIONS: Record<EmployeeAttribute, string> = {
  super_worker: '效率极高且稳定，没有副作用。',
  old_smooth: '效率稳定，不惹事不折腾，兢兢业业。',
  slacker: '效率波动较大，状态好时还不错，状态差时摸鱼严重。',
  rookie: '新人成长型，效率随时间进步，最多可到正常水平。',
  all_rounder: '什么岗位都能干，别人缺岗时自动补上。',
  troublemaker: '效率尚可但喜欢带节奏，士气低时可能煽动罢工。',
  social_butterfly: '干活一般但社交能力强，自带转化率加成。',
  guanxi_hire: '关系户引进，效率随缘波动，辞退会带来额外麻烦。',
};

/** 装修档 ↔ 最大员工数映射 */
export const DECORATION_MAX_EMPLOYEES: Record<string, number> = {
  bare: 4,
  clean: 8,
  memorable: 12,
  viral: 16,
  designer: 20,
};
