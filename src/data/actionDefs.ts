// 行动卡数据（只读拷贝自 v0.2 交接包，不改内容），提供索引助手。
import raw from './actions.v0.2.json';
import type { ActionDef } from '../types/actions';

export const ACTIONS = raw as unknown as ActionDef[];

const INDEX: Record<string, ActionDef> = ACTIONS.reduce(
  (acc, a) => {
    acc[a.actionId] = a;
    return acc;
  },
  {} as Record<string, ActionDef>,
);

export function getAction(id: string): ActionDef | undefined {
  return INDEX[id];
}

/** 返回某分类下的全部行动（用于 UI 分组展示）。 */
export function listActionsByCategory(category: ActionDef['category']): ActionDef[] {
  return ACTIONS.filter((a) => a.category === category);
}
