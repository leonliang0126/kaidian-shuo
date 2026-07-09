// QA 独立回归测试（Edward／软件 QA）：不依赖工程师的 saveMigration.test.ts，
// 自己构造「真实 v2 旧存档」（只含 v2 字段，刻意缺失 __version / eventWeightMods /
// loans / heat / actionPointsCurrent 等 v3 增量字段），独立验证：
//   1) loadGame + migrateGameState 能把旧档补齐为完整 v3 状态；
//   2) 根因崩溃点 eventWeightMods 不再是 undefined → Object.entries 不再抛错；
//   3) drawEvent / runDailyLoop 在补字段后的状态上跑通（等价 beginDay/endDay 路径）；
//   4) 结构损坏存档 → loadGame 返回 null 且清档兜底、不卡死。
import { describe, it, expect, beforeAll } from 'vitest';

// node 环境没有原生 localStorage，提供内存实现（与工程师测试独立、不共享副作用）。
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
  (globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage();
});

import { createRng } from '../src/core/rng';
import { loadGame, clearSave, saveGame } from '../src/core/storage';
import { migrateGameState, SAVE_VERSION } from '../src/core/migration';
import { drawEvent, selectPool } from '../src/core/eventEngine';
import { runDailyLoop } from '../src/core/gameLoop';
import { SAVE_KEY } from '../src/utils/constants';

/**
 * 构造一个「真实 v2 旧存档」JSON：只保留 v2 时代就存在的字段，
 * 刻意不写任何 v3 增量字段与 __version。门店也只含 v2 字段。
 * 这是手机端 localStorage 里实际会存在的脏旧档形状。
 */
function buildRealV2Save() {
  return {
    day: 5,
    month: 1,
    cash: 62300,
    debt: 0,
    monthlyRepayment: 0,
    credit: 70,
    netWorth: 62300,
    storeCount: 1,
    brandRating: 78,
    stores: [
      {
        id: 'store_001',
        name: '街角奶茶',
        storeType: '奶茶饮品',
        locationType: '学校门口',
        rent: 4800,
        deposit: 9600,
        decorationLevel: 'clean',
        decorationEntryBonus: 0,
        decorationAovBonus: 0,
        supplierTier: 'local',
        priceStrategy: 'normal',
        promotionTier: 'light',
        staffTier: 'standard',
        rating: 80,
        repurchaseRate: 0.31,
        efficiency: 100,
        capacity: 10,
        deliveryRatio: 0.3,
        platformRate: 0.18,
        isInCrisis: false,
        crisisDays: 0,
        cashflowStatus: '健康',
        monthlyRevenue: 72000,
        monthlyGrossProfit: 34000,
        monthlyNetProfit: 14000,
        monthlyPromoCost: 1500,
        monthlyDeliveryRevenue: 21000,
        monthlyStaffCost: 7000,
        lastMonthNetProfit: 14000,
        monthlyNetProfitPositiveStreak: 1,
        repurchaseRateStartOfMonth: 0.3,
        ratingStartOfMonth: 79,
      },
    ],
    hiddenLines: { customerTrust: 58, supplyRisk: 4 },
    softHidden: { ownerFatigue: 10, stability: 92 },
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
    lastLargeEventDay: 3,
    seed: 12345,
    tutorialSeen: true,
    gameOver: false,
    decisions: {
      supplierTier: 'local',
      priceStrategy: 'normal',
      decorationLevel: 'clean',
      promotionTier: 'light',
      staffTier: 'standard',
    },
    // 注意：没有 __version / loans / actionPointsMax / actionPointsCurrent /
    // selectedDailyFocus / selectedActionsToday / actionCooldowns /
    // bossStrain / cashNegativeStreak / hiddenHealthyStreak /
    // peakNetWorth / cumulativeNetProfit / eventWeightMods
    // 门店也没有 heat / currentBatchQuality / batchRenewDay / supplierStability
  };
}

describe('QA 独立：v2 旧档迁移到 v3（根因修复验证）', () => {
  it('纯函数 migrateGameState：eventWeightMods 补齐为 {} 而非 undefined，且所有 v3 增量字段到位', () => {
    const v2 = buildRealV2Save();
    const migrated = migrateGameState(v2);

    // —— 根因点：eventWeightMods 必须是 {} 而不是 undefined/null ——
    expect(migrated.eventWeightMods).toBeDefined();
    expect(migrated.eventWeightMods).not.toBeNull();
    expect(typeof migrated.eventWeightMods).toBe('object');
    expect(Object.keys(migrated.eventWeightMods)).toHaveLength(0);

    // —— 版本标记 ——
    expect(migrated.__version).toBe(SAVE_VERSION);

    // —— 其余 v3 增量字段全部补齐且非 undefined ——
    expect(migrated.loans).toEqual([]);
    expect(migrated.actionPointsMax).toBe(3);
    expect(migrated.actionPointsCurrent).toBe(3);
    expect(migrated.selectedDailyFocus).toBeNull();
    expect(migrated.selectedActionsToday).toEqual([]);
    expect(migrated.actionCooldowns).toEqual({});
    expect(migrated.bossStrain).toBe(0);
    expect(migrated.cashNegativeStreak).toBe(0);
    expect(migrated.hiddenHealthyStreak).toBe(0);
    expect(Number.isFinite(migrated.peakNetWorth)).toBe(true);
    expect(migrated.peakNetWorth).not.toBeNull();
    expect(migrated.cumulativeNetProfit).toBe(0);

    // —— 门店 v3 增量字段补齐 ——
    const store = migrated.stores[0];
    expect(typeof store.heat).toBe('number');
    expect(typeof store.currentBatchQuality).toBe('number');
    expect(typeof store.batchRenewDay).toBe('number');
    expect(store.batchRenewDay).toBeGreaterThanOrEqual(migrated.day);
    expect(typeof store.supplierStability).toBe('number');

    // —— 暗线/软暗线默认值补齐，旧值保留 ——
    expect(migrated.hiddenLines.customerTrust).toBe(58);
    expect(migrated.hiddenLines.landlordAttention).toBe(0);
    expect(migrated.softHidden.ownerFatigue).toBe(10);
    expect(migrated.softHidden.stability).toBe(92);

    // 关键：原崩溃调用不抛错
    expect(() => Object.entries(migrated.eventWeightMods)).not.toThrow();
  });

  it('loadGame 走迁移：v2 旧档写入 localStorage 后能读回完整 v3 状态且不崩', () => {
    clearSave();
    const v2 = buildRealV2Save();
    (localStorage as unknown as { setItem(k: string, v: string): void }).setItem(
      SAVE_KEY,
      JSON.stringify(v2),
    );

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    const s = loaded as unknown as Record<string, unknown>;

    expect(s.__version).toBe(SAVE_VERSION);
    expect(s.eventWeightMods).toBeDefined();
    expect(s.eventWeightMods).not.toBeNull();
    expect(typeof s.eventWeightMods).toBe('object');
    // 旧值保留
    expect(s.storeCount).toBe(1);
    expect(s.brandRating).toBe(78);

    // 关键断言：eventWeightMods 不是 undefined
    expect(() => Object.entries(s.eventWeightMods as object)).not.toThrow();
  });

  it('复现原报错路径：drawEvent + selectPool 在补字段后的状态上不再抛 Object.entries 错误', () => {
    const v2 = buildRealV2Save();
    const migrated = migrateGameState(v2);

    // 这正是之前抛 "Object.entries requires that input parameter not be null or undefined" 的代码路径
    expect(() => {
      for (let i = 0; i < 30; i++) {
        const rng = createRng(i + 1);
        const pool = selectPool(migrated, rng);
        expect(pool).toBeDefined();
        const ev = drawEvent(migrated, rng);
        expect(ev === null || typeof ev === 'object').toBe(true);
      }
    }).not.toThrow();
  });

  it('等价 beginDay/endDay 路径：runDailyLoop 在迁移后状态上跑多天不崩（覆盖 gameLoop hiddenLines 兜底）', () => {
    const v2 = buildRealV2Save();
    let state = migrateGameState(v2);

    // 连续推进 15 天，覆盖 selectPool / settlement / hiddenLines Object.values 兜底等全路径
    expect(() => {
      for (let d = 0; d < 15; d++) {
        const res = runDailyLoop(state, createRng(d * 7 + 3));
        state = res.state;
      }
    }).not.toThrow();

    // 跑完状态依然完整
    expect(state.eventWeightMods).toBeDefined();
    expect(Number.isFinite(state.netWorth)).toBe(true);
  });

  it('损坏存档（day 为字符串）迁移失败 → 清档返回 null，不卡死', () => {
    clearSave();
    // 结构不符合：day 是字符串而非 number → storage 判定损坏并清档
    (localStorage as unknown as { setItem(k: string, v: string): void }).setItem(
      SAVE_KEY,
      JSON.stringify({ day: 'xx', cash: 100 }),
    );
    expect(loadGame()).toBeNull();
    // 清档后再次读取仍是 null，不会循环崩溃
    expect(loadGame()).toBeNull();
  });

  it('极端损坏存档（无法 JSON.parse）不会让 loadGame 抛异常', () => {
    clearSave();
    (localStorage as unknown as { setItem(k: string, v: string): void }).setItem(
      SAVE_KEY,
      '{ this is not json',
    );
    expect(() => loadGame()).not.toThrow();
    expect(loadGame()).toBeNull();
  });

  it('v3 新存档含 __version=1 且 loadGame 不触发迁移覆盖（往返一致）', () => {
    clearSave();
    const v2 = buildRealV2Save();
    const migrated = migrateGameState(v2); // 视作一个已迁移的 v3 存档
    saveGame(migrated);
    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.__version).toBe(SAVE_VERSION);
    // 不会再次迁移覆盖（eventWeightMods 保持为 {}，而非被重复处理）
    expect(loaded!.eventWeightMods).toEqual({});
    expect(loaded!.stores[0].heat).toBe(migrated.stores[0].heat);
  });
});
