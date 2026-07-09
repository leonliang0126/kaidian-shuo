// V3-2 事件当天明线冲击单元测试（架构 §5.2）：只读 event.category + level + eventShock.json。
import { describe, it, expect } from 'vitest';
import { computeEventShock, applyEventShock } from '../src/core/eventVisibleShock';
import { createRng } from '../src/core/rng';
import { createNewGame } from '../src/core/createNewGame';
import type { EventDef, GameState } from '../src/types';

function ev(
  id: string,
  category: EventDef['category'],
  level: EventDef['level'],
): EventDef {
  return { id, title: id, category, level, trigger: '', cooldownDays: 0, options: [], wind: '' };
}

describe('分类默认冲击（computeEventShock）', () => {
  it('利好天气 small：曝光 +5', () => {
    const r = computeEventShock(ev('E001', 'weather', 'small'));
    expect(r.mods.exposurePct).toBe(5);
    expect(r.cashDelta).toBe(0);
    expect(r.ratingDelta).toBe(0);
    expect(r.hardHit).toBe(false);
  });

  it('竞品 large：曝光 −35', () => {
    const r = computeEventShock(ev('E002', 'competitor', 'large'));
    expect(r.mods.exposurePct).toBe(-35);
  });

  it('员工 medium：转化 −20', () => {
    const r = computeEventShock(ev('E003', 'staff', 'medium'));
    expect(r.mods.conversionRatePct).toBe(-20);
  });

  it('forced 事件：零冲击', () => {
    const r = computeEventShock(ev('E004', 'forced', 'forced'));
    expect(r.mods.exposurePct).toBe(0);
    expect(r.cashDelta).toBe(0);
    expect(r.ratingDelta).toBe(0);
    expect(r.hardHit).toBe(false);
  });
});

describe('硬砸清单（computeEventShock）', () => {
  it('E020（现金类硬砸）：cashDelta −30000、hardHit=true', () => {
    const r = computeEventShock(ev('E020', 'weather', 'small'));
    expect(r.cashDelta).toBe(-30000);
    expect(r.hardHit).toBe(true);
  });

  it('E059（口碑类硬砸）：cash −5000、rating −40、hardHit=true', () => {
    const r = computeEventShock(ev('E059', 'weather', 'small'));
    expect(r.cashDelta).toBe(-5000);
    expect(r.ratingDelta).toBe(-40);
    expect(r.hardHit).toBe(true);
  });

  it('E058（订单类硬砸）：orders −50、cash −3000、hardHit=true', () => {
    const r = computeEventShock(ev('E058', 'weather', 'small'));
    expect(r.mods.ordersPct).toBe(-50);
    expect(r.cashDelta).toBe(-3000);
    expect(r.hardHit).toBe(true);
  });
});

describe('冲击并入状态（applyEventShock）', () => {
  function freshGame(): GameState {
    return createNewGame(
      { storeType: '奶茶饮品', locationType: '学校门口', decorationLevel: 'clean', storeName: '事件店', seed: 11 },
      createRng(11),
    );
  }

  it('口碑硬砸：现金与评分同步下降（评分夹紧 0-100）', () => {
    const s = freshGame();
    const ratingBefore = s.stores[0].rating; // 80
    const cashBefore = s.cash;
    const r = applyEventShock(s, ev('E059', 'weather', 'small'));
    expect(r.cash).toBe(cashBefore - 5000);
    expect(r.stores[0].rating).toBe(Math.max(0, ratingBefore - 40)); // 40
    expect(r.brandRating).toBe(r.stores[0].rating);
  });

  it('forced 事件不改状态', () => {
    const s = freshGame();
    const r = applyEventShock(s, ev('E099', 'forced', 'forced'));
    expect(r).toBe(s); // 直接返回原引用（未克隆）
  });
});
