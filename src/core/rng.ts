// 可注入种子的确定性随机（mulberry32）。
// 生产可无 seed（用时间），单测注入固定 seed 使结算/事件可复现。

export type RNG = () => number; // 返回 [0,1)

/** 创建一个确定性随机数发生器。 */
export function createRng(seed?: number): RNG {
  let a = (seed ?? Date.now()) >>> 0;
  return function rng(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 在 [min, max) 之间取一个整数（含 min，不含 max）。 */
export function randInt(rng: RNG, min: number, max: number): number {
  return Math.floor(rng() * (max - min)) + min;
}

/** 从数组中等概率取一个元素。 */
export function pick<T>(rng: RNG, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
