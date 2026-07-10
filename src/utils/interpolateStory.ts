// story 占位符插值（统一出口，禁止在组件内散落 replaceAll）。
// 把事件选项 story 模板中的 {name} / {店名} 替换为运行时真实值。

export interface StoryContext {
  /** 关联员工姓名（员工类事件才有；缺失 → 兜底「店员」） */
  name?: string | null;
  /** 当前店名（统一取 state.store.name）；空 → 兜底「小店」 */
  storeName: string;
}

/**
 * 渲染 story 模板：注入 {name} / {店名}，无关联时兜底，绝不残留花括号。
 * @param tpl 模板字符串（含 {name} / {店名}）
 * @param ctx 运行时上下文
 * @returns 替换后的字符串
 */
export function interpolateStory(tpl: string, ctx: StoryContext): string {
  if (!tpl) return tpl;
  let out = tpl;
  // {name}：仅员工类事件有；缺失 → 兜底「店员」
  // 用 split/join 代替 String.replaceAll（兼容 ES2020 lib，避免 tsc 报错）
  out = out.split('{name}').join((ctx.name ?? '').toString().trim() || '店员');
  // {店名}：统一取当前店名；空 → 兜底「小店」
  out = out.split('{店名}').join(ctx.storeName || '小店');
  return out;
}
