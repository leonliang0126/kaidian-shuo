// localStorage 存档层（架构 §9.3）
import type { GameState } from '../types';
import { SAVE_KEY, TUTORIAL_KEY, BUILD_KEY } from '../utils/constants';
import { BUILD_ID } from '../utils/buildId';
import { migrateGameState, SAVE_VERSION } from './migration';

/** 存档整个 GameState。 */
export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    localStorage.setItem(BUILD_KEY, BUILD_ID);
  } catch (e) {
    // 隐私模式/容量超限时静默失败，不影响游戏
    console.warn('[kaidian-shuo] 存档失败', e);
  }
}

/** 读取存档；读不到或解析失败返回 null。旧版（v2）存档会自动迁移到 v3。 */
export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.day !== 'number') {
      // 结构不符合 → 视为损坏，清档兜底（不卡死）
      clearSave();
      return null;
    }
    // 版本迁移：旧版（v2）存档缺失 __version 或 < SAVE_VERSION 时，补齐所有 v3 字段。
    const version = typeof parsed.__version === 'number' ? parsed.__version : undefined;
    if (version === undefined || version < SAVE_VERSION) {
      try {
        return migrateGameState(parsed);
      } catch (e) {
        // 迁移失败（极端损坏）→ 清档回退到新游戏，避免循环崩溃
        console.warn('[kaidian-shuo] 存档迁移失败，已重置存档', e);
        clearSave();
        return null;
      }
    }
    return parsed as GameState;
  } catch {
    return null;
  }
}

/**
 * 读取存档，但仅当存档来自同一构建版本（BUILD_ID 一致）时才恢复；
 * 否则视为旧部署，清档并返回 null，让游戏从开局/教程页重新开始。
 * 这保证了「新部署的链接 = 全新进度」，同时同一版本内刷新仍正常恢复。
 */
export function loadGameRespectingBuild(): GameState | null {
  try {
    if (localStorage.getItem(BUILD_KEY) !== BUILD_ID) {
      // 新部署 / 构建版本变化 → 旧档失效，清掉并重新开始
      clearSave();
      localStorage.removeItem(BUILD_KEY);
      return null;
    }
  } catch {
    /* ignore */
  }
  return loadGame();
}

/** 清除存档。 */
export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

/** 是否看过玩法说明（key: tutorialSeen） */
export function isTutorialSeen(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === 'true';
  } catch {
    return false;
  }
}

/** 写入是否看过玩法说明。 */
export function setTutorialSeen(v: boolean): void {
  try {
    localStorage.setItem(TUTORIAL_KEY, v ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}

/** 清除教程标记（设置里可重看）。 */
export function clearTutorialSeen(): void {
  try {
    localStorage.removeItem(TUTORIAL_KEY);
  } catch {
    /* ignore */
  }
}
