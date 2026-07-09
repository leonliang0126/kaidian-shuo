// 存档迁移测试：构造"v2 旧存档"（只含 v2 字段，去掉 v3 增量字段如 eventWeightMods/
// loans/heat 等），调用 loadGame() 的迁移逻辑，断言补齐后所有 v3 字段存在且不为
// undefined/null；并模拟 eventEngine.drawEvent / selectPool 不崩溃。
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
import { loadGame, clearSave, saveGame } from '../src/core/storage';
import { migrateGameState, SAVE_VERSION } from '../src/core/migration';
import { drawEvent, selectPool } from '../src/core/eventEngine';
import { SAVE_KEY } from '../src/utils/constants';

/** 构造一个"v2 旧存档"：只含 v2 字段，刻意缺失所有 v3 增量字段与 __version。 */
function buildV2Save() {
  return {
    day: 12,
    month: 1,
    cash: 85320,
    debt: 0,
    monthlyRepayment: 0,
    credit: 70,
    netWorth: 85320,
    storeCount: 1,
    brandRating: 80,
    // 门店只含 v2 字段，缺失 heat / currentBatchQuality / batchRenewDay / supplierStability
    stores: [
      {
        id: 'store_001',
        name: '老店',
        storeType: '奶茶饮品',
        locationType: '学校门口',
        rent: 5000,
        deposit: 10000,
        decorationLevel: 'clean',
        decorationEntryBonus: 0,
        decorationAovBonus: 0,
        supplierTier: 'local',
        priceStrategy: 'normal',
        promotionTier: 'light',
        staffTier: 'standard',
        rating: 84,
        repurchaseRate: 0.34,
        efficiency: 100,
        capacity: 11,
        deliveryRatio: 0.3,
        platformRate: 0.18,
        isInCrisis: false,
        crisisDays: 0,
        cashflowStatus: '健康',
        monthlyRevenue: 90000,
        monthlyGrossProfit: 42000,
        monthlyNetProfit: 18000,
        monthlyPromoCost: 2000,
        monthlyDeliveryRevenue: 27000,
        monthlyStaffCost: 9000,
        lastMonthNetProfit: 18000,
        monthlyNetProfitPositiveStreak: 1,
        repurchaseRateStartOfMonth: 0.32,
        ratingStartOfMonth: 82,
      },
    ],
    // 只给部分暗线键，验证默认值补齐其余键
    hiddenLines: { customerTrust: 64 },
    softHidden: { ownerFatigue: 12, stability: 95 },
    eventHistory: [],
    businessLog: [],
    windMessages: [],
    pendingEffects: [],
    tempModifiers: [],
    dayModifiers: {},
    activeCooldowns: {},
    unlockedRoutes: [],
    endingsUnlocked: [],
    accountsPayable: 0,
    reserve: 0,
    lastLargeEventDay: 9,
    seed: 7,
    tutorialSeen: true,
    gameOver: false,
    decisions: {
      supplierTier: 'local',
      priceStrategy: 'normal',
      decorationLevel: 'clean',
      promotionTier: 'light',
      staffTier: 'standard',
    },
    // 注意：刻意不写 loans / actionPointsMax / actionPointsCurrent /
    // selectedDailyFocus / selectedActionsToday / actionCooldowns / bossStrain /
    // cashNegativeStreak / hiddenHealthyStreak / peakNetWorth / cumulativeNetProfit /
    // eventWeightMods，也不写 __version
  };
}

describe('存档版本迁移（B.11 旧档兼容）', () => {
  it('v2 旧存档经 loadGame 后 __version 提升到 1，且所有 v3 字段补齐', () => {
    clearSave();
    const v2 = buildV2Save();
    (localStorage as any).setItem(SAVE_KEY, JSON.stringify(v2));

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    const s = loaded as any;

    // 版本标记
    expect(s.__version).toBe(SAVE_VERSION);

    // —— v3 增量字段全部存在且非 undefined/null ——
    expect(s.loans).toEqual([]);
    expect(s.actionPointsMax).toBe(3);
    expect(s.actionPointsCurrent).toBe(3);
    expect(s.selectedDailyFocus).toBeNull();
    expect(s.selectedActionsToday).toEqual([]);
    expect(s.actionCooldowns).toEqual({});
    expect(s.bossStrain).toBe(0);
    expect(s.cashNegativeStreak).toBe(0);
    expect(s.hiddenHealthyStreak).toBe(0);
    expect(typeof s.peakNetWorth).toBe('number');
    expect(Number.isFinite(s.peakNetWorth)).toBe(true);
    expect(typeof s.peakNetWorth).not.toBe('undefined');
    expect(s.peakNetWorth).not.toBeNull();
    expect(s.cumulativeNetProfit).toBe(0);
    expect(s.eventWeightMods).toBeDefined();
    expect(s.eventWeightMods).not.toBeNull();
    expect(typeof s.eventWeightMods).toBe('object');
    // 旧值保留
    expect(s.storeCount).toBe(1);
    expect(s.brandRating).toBe(80);

    // —— 门店 v3 增量字段补齐 ——
    const store = s.stores[0];
    expect(typeof store.heat).toBe('number');
    expect(typeof store.currentBatchQuality).toBe('number');
    expect(typeof store.batchRenewDay).toBe('number');
    expect(store.batchRenewDay).toBeGreaterThanOrEqual(s.day);
    expect(typeof store.supplierStability).toBe('number');

    // —— 暗线/软暗线默认值补齐（提供部分键）——
    for (const k of [
      'landlordAttention',
      'employeePressure',
      'customerTrust',
      'priceControversy',
      'promoHype',
      'supplyRisk',
      'platformDependence',
      'hygieneRisk',
    ]) {
      expect(s.hiddenLines[k]).toBeDefined();
    }
    for (const k of [
      'ownerFatigue',
      'wasteRisk',
      'qualityVariance',
      'landlordPatience',
      'accountingErrorRisk',
      'stability',
    ]) {
      expect(s.softHidden[k]).toBeDefined();
    }
    // 提供过的键被保留
    expect(s.hiddenLines.customerTrust).toBe(64);
    expect(s.softHidden.ownerFatigue).toBe(12);

    // dayModifiers 兜底为完整对象
    expect(s.dayModifiers).toBeDefined();
    expect(typeof s.dayModifiers.exposurePct).toBe('number');

    // 关键：eventWeightMods 不是 undefined（这是根因崩溃点）
    expect(() => Object.entries(s.eventWeightMods)).not.toThrow();
  });

  it('迁移后 drawEvent / selectPool 不崩溃（复现原报错路径）', () => {
    clearSave();
    const v2 = buildV2Save();
    (localStorage as any).setItem(SAVE_KEY, JSON.stringify(v2));

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    const state = loaded as any;

    // 这正是之前抛 "Object.entries requires that input parameter not be null or undefined" 的路径
    expect(() => {
      const pool = selectPool(state, createRng(1));
      expect(pool).toBeDefined();
      const ev = drawEvent(state, createRng(2));
      expect(ev === null || typeof ev === 'object').toBe(true);
    }).not.toThrow();
  });

  it('缺陷路径直接验证：eventWeightMods 为 undefined 时 eventEngine 也不崩', () => {
    const rng = createRng(5);
    const state = createNewGame(
      {
        initialCashTier: 300000,
        storeType: '奶茶饮品',
        locationType: '学校门口',
        decorationLevel: 'clean',
        storeName: '防护店',
        seed: 5,
      },
      rng,
    );
    // 人为破坏：模拟旧档缺失字段
    (state as any).eventWeightMods = undefined as any;
    (state as any).hiddenLines = undefined as any;
    (state as any).actionCooldowns = undefined as any;
    (state as any).stores = state.stores.map((st: any) => {
      const { heat, currentBatchQuality, batchRenewDay, supplierStability, ...rest } = st;
      return rest;
    });

    // 即使字段缺失，迁移可补齐，eventEngine 也不崩
    const migrated = migrateGameState(state);
    expect(() => {
      selectPool(migrated, createRng(9));
      drawEvent(migrated, createRng(11));
    }).not.toThrow();
  });

  it('v3 新存档（含 __version=1）往返一致，不触发迁移覆盖', () => {
    clearSave();
    const rng = createRng(99);
    const fresh = createNewGame(
      {
        initialCashTier: 300000,
        storeType: '奶茶饮品',
        locationType: '学校门口',
        decorationLevel: 'clean',
        storeName: '新店',
        seed: 99,
      },
      rng,
    );
    expect(fresh.__version).toBe(SAVE_VERSION);
    saveGame(fresh);
    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.__version).toBe(SAVE_VERSION);
    expect(loaded!.stores[0].heat).toBe(fresh.stores[0].heat);
    expect(loaded!.eventWeightMods).toEqual(fresh.eventWeightMods);
  });

  it('损坏存档（无法迁移）迁移失败 → 清档返回 null，不卡死', () => {
    clearSave();
    // 结构不符（无 day）→ 清档兜底
    (localStorage as any).setItem(SAVE_KEY, JSON.stringify({ foo: 'bar' }));
    expect(loadGame()).toBeNull();
    // 清档后再次读取为 null 且不再循环
    expect(loadGame()).toBeNull();
  });
});
