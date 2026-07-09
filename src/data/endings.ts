// 结局数据（原样 import 交接包 JSON）
import raw from './endings.json';
import type { EndingDef } from '../types/events';

// 原文件直接 import，不改内容
export const ENDINGS = raw as unknown as EndingDef[];

export function getEnding(id: string): EndingDef | undefined {
  return ENDINGS.find((e) => e.id === id);
}
