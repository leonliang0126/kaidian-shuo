// 玩法说明弹窗数据（原样 import 交接包 JSON）
import raw from './tutorial-modal.json';

// 原文件直接 import，不改内容
export const TUTORIAL = raw as unknown as {
  id: string;
  showOnFirstVisit: boolean;
  storageKey: string;
  title: string;
  body: string[];
  primaryButton: string;
  secondaryButton: string;
  helpEntryLabel: string;
};
