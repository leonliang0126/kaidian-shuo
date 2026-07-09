import { describe, it, expect, vi, afterEach } from 'vitest';
import { fmtInt, fmtMoney, fmtSignedMoney } from '../src/utils/format';

// 回归测试：锁定"手机白屏"修复
// 根因：旧实现用 Number.prototype.toLocaleString('zh-CN')，在缺 ICU 的
// 内嵌 webview（微信/QQ）抛 RangeError 且无 ErrorBoundary → 整页白屏。
// 修复后 fmt* 必须 ICU 无关、绝不调用 toLocaleString。

afterEach(() => {
  vi.restoreAllMocks();
});

describe('format helpers are ICU-independent (white-screen regression)', () => {
  it('fmtInt 正确千分位且不调用 toLocaleString', () => {
    const spy = vi.spyOn(Number.prototype, 'toLocaleString');
    expect(fmtInt(1234567)).toBe('1,234,567');
    expect(fmtInt(0)).toBe('0');
    expect(fmtInt(-9800)).toBe('-9,800');
    expect(fmtInt(999)).toBe('999');
    expect(spy).not.toHaveBeenCalled();
  });

  it('fmtMoney 兼容负数/零且不依赖 Intl', () => {
    const spy = vi.spyOn(Number.prototype, 'toLocaleString');
    expect(fmtMoney(1234567)).toBe('¥1,234,567');
    expect(fmtMoney(0)).toBe('¥0');
    expect(fmtSignedMoney(-500)).toBe('¥-500');
    expect(fmtSignedMoney(500)).toBe('+¥500');
    expect(spy).not.toHaveBeenCalled();
  });

  it('在 ICU 缺失（toLocaleString 抛 RangeError）环境下 fmt* 仍安全返回', () => {
    // 模拟微信 webview：任何 toLocaleString('zh-CN') 抛 RangeError
    const orig = Number.prototype.toLocaleString;
    // 测试注入：模拟微信 webview 缺 ICU 时 toLocaleString('zh-CN') 抛错
    Number.prototype.toLocaleString = function (loc: unknown) {
      const l = Array.isArray(loc) ? loc[0] : loc;
      if (l && String(l).toLowerCase().includes('zh')) {
        throw new RangeError('Incorrect locale information provided: ' + String(l));
      }
      return orig.call(this, loc as string);
    };
    try {
      expect(fmtMoney(1234567)).toBe('¥1,234,567');
      expect(fmtInt(1000000)).toBe('1,000,000');
    } finally {
      Number.prototype.toLocaleString = orig;
    }
  });
});
