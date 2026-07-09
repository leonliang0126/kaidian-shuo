// QA 独立验证：事件明线冲击（架构 §5.2）
// 硬砸事件当天腰斩指定明线并施加 cashDelta/ratingDelta；forced 事件零冲击；
// category+level 映射正确；events.v0.1.json 与 endings.json 字节内容未改（引用完整性）。
import { describe, it, expect } from 'vitest';
import { computeEventShock, applyEventShock } from '../src/core/eventVisibleShock';
import { createNewGame } from '../src/core/createNewGame';
import { createRng } from '../src/core/rng';
import { getEnding } from '../src/data/endings';
import type { EventDef } from '../src/types';
import eventShock from '../src/data/eventShock.json';
import eventsV01 from '../src/data/events.v0.1.json';
import endings from '../src/data/endings.json';

function ev(id: string, category: EventDef['category'], level: EventDef['level']): EventDef {
  return { id, title: id, category, level, trigger: '', cooldownDays: 0, options: [], wind: '' };
}

function base() {
  return createNewGame(
    { storeType: '奶茶饮品', locationType: '学校门口', decorationLevel: 'clean', storeName: 'QA', seed: 1 },
    createRng(1),
  );
}

describe('硬砸事件：当天腰斩明线 + 即时现金/口碑', () => {
  it('E032 核心原料断货 → exposure 腰斩（−50%），无现金/口碑冲击', () => {
    const s = base();
    const r = applyEventShock(s, ev('E032', 'supplier', 'large'));
    expect(r.dayModifiers.exposurePct).toBe(-50);
    expect(r.cash).toBe(s.cash); // cashDelta=0
    expect(r.stores[0].rating).toBe(s.stores[0].rating);
  });
  // 注：事件冲击为"叠加层"（架构 §5.2）——分类默认冲击 与 HARD_HIT 硬砸 累加。
  // 故硬砸事件的净明线 = 分类默认(按 category 极性/档位) + HARD_HIT(×0.5 幅度)。
  // 下列断言验证 HARD_HIT 硬砸幅度确实被应用（否则数值会只等于分类默认单项）。
  it('E058 后厨漏水 → orders 硬砸 −50% 叠加 equipment 分类默认 −35% = −85%，且现金 −3000', () => {
    const s = base();
    const r = applyEventShock(s, ev('E058', 'equipment', 'large'));
    expect(r.dayModifiers.ordersPct).toBe(-85); // 分类默认(equipment→orders −35) + 硬砸(orders −50)
    expect(r.cash).toBe(s.cash - 3000);
  });
  it('E020 房东卖铺 → 现金 −30000（HARD_HIT cash），exposure 受 landlord 分类默认 −35% 影响', () => {
    const s = base();
    const r = applyEventShock(s, ev('E020', 'landlord', 'large'));
    expect(r.cash).toBe(s.cash - 30000);
    expect(r.dayModifiers.exposurePct).toBe(-35); // landlord 分类默认(曝光 −35)
  });
  it('E059 卫生检查 → 口碑(分类 −35 + 硬砸 −40 = −75) 且现金 −5000', () => {
    const s = base();
    const r = applyEventShock(s, ev('E059', 'compliance', 'large'));
    expect(r.stores[0].rating).toBe(s.stores[0].rating - 75); // 分类默认(compliance→rating −35) + 硬砸(rating −40)
    expect(r.cash).toBe(s.cash - 5000);
  });
  it('E060 食安投诉 → 口碑(分类 −35 + 硬砸 −40 = −75) 且现金 −8000', () => {
    const s = base();
    const r = applyEventShock(s, ev('E060', 'compliance', 'large'));
    expect(r.stores[0].rating).toBe(s.stores[0].rating - 75);
    expect(r.cash).toBe(s.cash - 8000);
  });
  it('E008/E055 客流蒸发/被抢 → exposure 叠加后分别为 −35% / −85%', () => {
    const s = base();
    // E008: district 分类默认利好(+15) + 硬砸(−50) = −35；E055: competitor 分类默认利空(−35) + 硬砸(−50) = −85
    const a = applyEventShock(s, ev('E008', 'district', 'large'));
    const b = applyEventShock(s, ev('E055', 'competitor', 'large'));
    expect(a.dayModifiers.exposurePct).toBe(-35);
    expect(b.dayModifiers.exposurePct).toBe(-85);
  });
  it('E006 台风预警 → 现金 −20000', () => {
    const s = base();
    const r = applyEventShock(s, ev('E006', 'weather', 'large'));
    expect(r.cash).toBe(s.cash - 20000);
  });
});

describe('forced 事件：零冲击', () => {
  it('F001/F002/F003 不施加任何明线/现金/口碑冲击', () => {
    const s = base();
    for (const id of ['F001', 'F002', 'F003'] as const) {
      const r = applyEventShock(s, ev(id, 'forced', 'large'));
      expect(r.dayModifiers).toEqual(s.dayModifiers);
      expect(r.cash).toBe(s.cash);
      expect(r.stores[0].rating).toBe(s.stores[0].rating);
    }
  });
});

describe('category+level 映射正确', () => {
  it('landlord(large) → exposure −35%；(small) → −10%', () => {
    expect(computeEventShock(ev('X', 'landlord', 'large')).mods.exposurePct).toBe(-35);
    expect(computeEventShock(ev('X', 'landlord', 'small')).mods.exposurePct).toBe(-10);
  });
  it('weather(good, small) → exposure +5%', () => {
    expect(computeEventShock(ev('X', 'weather', 'small')).mods.exposurePct).toBe(5);
  });
  it('compliance → rating 负数（非明线）', () => {
    const sh = computeEventShock(ev('X', 'compliance', 'large'));
    expect(sh.ratingDelta).toBe(-35);
    expect(sh.mods.exposurePct).toBe(0);
  });
});

describe('events.v0.1.json / endings.json 字节内容未改（引用完整性）', () => {
  const HARD_HIT_IDS = ['E032', 'E058', 'E020', 'E008', 'E055', 'E006', 'E059', 'E060'];
  it('HARD_HIT 引用的事件 id 均存在且类目未被改（避免"偷偷改类"中和冲击）', () => {
    const evById: Record<string, any> = {};
    for (const e of eventsV01 as any[]) evById[e.id] = e;
    for (const id of HARD_HIT_IDS) expect(evById[id], `事件 ${id} 应仍存在`).toBeDefined();
    expect(evById['E020'].category).toBe('landlord');
    expect(evById['E059'].category).toBe('compliance');
    expect(evById['E060'].category).toBe('compliance');
    expect(evById['E058'].category).toBe('equipment');
    expect(evById['E032'].category).toBe('supplier');
  });
  it('eventShock.json 的 HARD_HIT 清单与硬砸幅度未被清空', () => {
    const sh = eventShock as any;
    expect(Object.keys(sh.HARD_HIT).length).toBeGreaterThanOrEqual(8);
    expect(sh.HARD_HIT_MAGNITUDE.exposure).toBe(-50);
    expect(sh.HARD_HIT_MAGNITUDE.orders).toBe(-50);
  });
  it('endings.json 含全部 9 个结局 id，且 chain_empire 文案冻结为原"10 家"表述（未被改为3）', () => {
    const ids = (endings as any[]).map((e: any) => e.id);
    for (const id of [
      'suspended',
      'decent_exit',
      'debt_trap',
      'chain_empire',
      'financial_freedom',
      'landlord_win',
      'viral_failure',
      'menu_without_supply',
      'one_person_shop',
    ]) {
      expect(ids).toContain(id);
    }
    const ce = (endings as any[]).find((e: any) => e.id === 'chain_empire');
    expect(ce.text).toMatch(/10\s*家/); // 冻结文案未被改
    for (const id of ids) expect(getEnding(id)).toBeDefined(); // 读接口未改
  });
});
