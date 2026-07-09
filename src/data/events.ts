// 事件数据（原样 import 交接包 JSON，并建立 id→EventDef 索引）
import raw from './events.v0.1.json';
import type { EventDef } from '../types/events';

// 原文件直接 import，不改内容
export const EVENTS = raw as unknown as EventDef[];

/** id → EventDef 索引（供事件引擎/解析器快速查找）。 */
export const EVENT_INDEX: Record<string, EventDef> = EVENTS.reduce(
  (acc, e) => {
    acc[e.id] = e;
    return acc;
  },
  {} as Record<string, EventDef>,
);

export function getEvent(id: string): EventDef | undefined {
  return EVENT_INDEX[id];
}
