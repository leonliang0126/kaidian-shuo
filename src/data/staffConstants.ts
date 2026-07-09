// 员工系统常量配置（《开店说》员工系统重构 v3）
// 所有可调数值集中在此文件中

/** 基准承载系数：每人每天可承载订单数 */
export const BASE_CAPACITY_PER_STAFF = 70;

/** 裁人补偿天数 */
export const LAYOFF_COMPENSATION_DAYS = 10;

/** 属性暴露天数（入职多少天后暴露真实属性） */
export const ATTRIBUTE_EXPOSE_DAYS = 7;

/** 每周最大正常排班天数 */
export const MAX_WORK_DAYS_PER_WEEK = 5;

/** 加班工资倍率 */
export const OVERTIME_SALARY_MULTIPLIER = 1.5;

/** 临时员工工资倍率 */
export const TEMP_STAFF_SALARY_MULTIPLIER = 1.5;

/** 士气衰减基数（超时一天） */
export const MORALE_DECAY_OVERTIME = -10;

/** 士气恢复基数（休息一天不排班） */
export const MORALE_RECOVERY_REST = 5;

/** 士气衰减基数（连续工作超过 7 天） */
export const MORALE_DECAY_CONTINUOUS = -5;

/** 主动离职士气阈值（低于此值次日主动离职） */
export const RESIGN_MORALE_THRESHOLD = 15;

/** 罢工士气阈值（刺头员工士气低于此值触发全体罢工） */
export const STRIKE_MORALE_THRESHOLD = 20;

/** 基准月薪 */
export const BASE_MONTHLY_SALARY = 5000;

/** 月薪浮动范围 ±（比例） */
export const SALARY_VARIANCE = 0.2;

/** 招聘候选人数量最小值 */
export const CANDIDATE_COUNT_MIN = 2;

/** 招聘候选人数量最大值 */
export const CANDIDATE_COUNT_MAX = 3;

/** 刷新候选人 AP 消耗（0 = 首次免费） */
export const REFRESH_CANDIDATES_AP_COST = 1;

/** 每周天数 */
export const DAYS_PER_WEEK = 7;

/** 全员放假士气恢复值 */
export const ALL_REST_MORALE_BONUS = 10;

/** 涨工资士气恢复：每 500 元涨幅恢复的士气值 */
export const SALARY_RAISE_MORALE_PER_500 = 5;

/** 低士气阈值（≤ 此值触发警告） */
export const LOW_MORALE_THRESHOLD = 20;
