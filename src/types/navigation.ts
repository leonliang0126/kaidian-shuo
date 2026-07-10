// 导航与布局共享类型/常量（分页重构 · T01/T03）。
// 单一事实来源：TabKey / StatusBarVariant / TAB_LIST / 布局常量。

/** 底部 4 个 tab 的键。 */
export type TabKey = 'home' | 'staff' | 'action' | 'business';

/** StatusBar 双形态：home=首页大卡，mini=精简条。 */
export type StatusBarVariant = 'home' | 'mini';

/** 底部导航项定义（TabBar 与测试共用）。 */
export const TAB_LIST: ReadonlyArray<{
  key: TabKey;
  label: string;
  icon: string;
}> = [
  { key: 'home', label: '首页', icon: '🏠' },
  { key: 'staff', label: '员工', icon: '👥' },
  { key: 'action', label: '行动', icon: '⚡' },
  { key: 'business', label: '经营', icon: '📊' },
];

/** 底部 TabBar 高度（px）。 */
export const TAB_BAR_HEIGHT = 56;

/** 「结束今天」按钮区高度（px，按钮+padding），用于贴底避让计算。 */
export const ENDDAY_HEIGHT = 80;
