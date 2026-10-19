import { describe, expect, it } from 'vitest';
import { formatINR, formatINRCompact, isValidPaise, paiseToRupees, rupeesToPaise, sumPaise } from './money';

describe('money', () => {
  it('converts rupees to integer paise without float drift', () => {
    expect(rupeesToPaise(2000.5)).toBe(200050);
    expect(rupeesToPaise(1.1 * 3)).toBe(330);
    expect(paiseToRupees(200050)).toBe(2000.5);
  });

  it('only accepts safe integers as paise', () => {
    expect(isValidPaise(100)).toBe(true);
    expect(isValidPaise(100.5)).toBe(false);
    expect(isValidPaise('100')).toBe(false);
    expect(isValidPaise(Number.NaN)).toBe(false);
  });

  it('sums paise', () => {
    expect(sumPaise([100, 250, 50])).toBe(400);
    expect(sumPaise([])).toBe(0);
  });

  it('formats with Indian digit grouping', () => {
    expect(formatINR(rupeesToPaise(200000))).toBe('₹2,00,000');
    expect(formatINR(rupeesToPaise(1882000))).toBe('₹18,82,000');
    expect(formatINR(rupeesToPaise(95000))).toBe('₹95,000');
    expect(formatINR(150050)).toBe('₹1,500.50');
  });

  it('formats compact lakh and crore', () => {
    expect(formatINRCompact(rupeesToPaise(1882000))).toBe('₹18.82 L');
    expect(formatINRCompact(rupeesToPaise(200000))).toBe('₹2 L');
    expect(formatINRCompact(rupeesToPaise(12000000))).toBe('₹1.2 Cr');
    expect(formatINRCompact(rupeesToPaise(95000))).toBe('₹95,000');
  });
});
