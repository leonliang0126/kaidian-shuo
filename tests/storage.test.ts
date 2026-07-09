// B.10 存档层：save/load 往返一致；损坏/缺失返回 null；tutorialSeen 读写。
import { describe, it, expect, beforeAll } from 'vitest';

// 内存版 localStorage（node 环境无原生实现）
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null {
    return this.m.has(k) ? (this.m.get(k) as string) : null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, String(v));
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
  clear(): void {
    this.m.clear();
  }
}

beforeAll(() => {
  (globalThis as any).localStorage = new MemStorage();
});

import { createRng } from '../src/core/rng';
import { createNewGame } from '../src/core/createNewGame';
import { saveGame, loadGame, clearSave, isTutorialSeen, setTutorialSeen } from '../src/core/storage';

describe('B.10 存档往返与容错', () => {
  it('saveGame → loadGame 往返一致（关键标量）', () => {
    const rng = createRng(42);
    const state = createNewGame(
      {
        initialCashTier: 300000,
        storeType: '奶茶饮品',
        locationType: '学校门口',
        decorationLevel: 'clean',
        storeName: '存档店',
        seed: 42,
      },
      rng,
    );
    saveGame(state);
    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.day).toBe(state.day);
    expect(loaded!.cash).toBe(state.cash);
    expect(loaded!.storeCount).toBe(state.storeCount);
    expect(loaded!.stores.length).toBe(state.stores.length);
    expect(loaded!.hiddenLines.customerTrust).toBe(state.hiddenLines.customerTrust);
  });

  it('存档损坏 → loadGame 返回 null 且不影响初始化', () => {
    (localStorage as any).setItem('kaidian-shuo:save:v1', '{ this is not json');
    expect(loadGame()).toBeNull();
    // 仍可创建新游戏
    const rng = createRng(1);
    const s = createNewGame(
      {
        initialCashTier: 300000,
        storeType: '奶茶饮品',
        locationType: '学校门口',
        decorationLevel: 'clean',
        storeName: '新店',
        seed: 1,
      },
      rng,
    );
    expect(s.day).toBe(1);
  });

  it('存档缺失 → loadGame 返回 null', () => {
    clearSave();
    expect(loadGame()).toBeNull();
  });

  it('tutorialSeen 读写正确', () => {
    setTutorialSeen(true);
    expect(isTutorialSeen()).toBe(true);
    setTutorialSeen(false);
    expect(isTutorialSeen()).toBe(false);
  });
});
