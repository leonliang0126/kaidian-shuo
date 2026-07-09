// 经营重点数据（只读拷贝自 v0.2 交接包，不改内容），提供索引助手。
import raw from './business-focus.v0.2.json';
import type { FocusDef } from '../types/actions';

export const FOCUSES = raw as unknown as FocusDef[];

const INDEX: Record<string, FocusDef> = FOCUSES.reduce(
  (acc, f) => {
    acc[f.id] = f;
    return acc;
  },
  {} as Record<string, FocusDef>,
);

export function getFocus(id: string | null): FocusDef | undefined {
  if (!id) return undefined;
  return INDEX[id];
}

export function listFocuses(): FocusDef[] {
  return FOCUSES;
}
