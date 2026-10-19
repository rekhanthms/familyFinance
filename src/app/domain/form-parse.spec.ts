import { paiseToInputText, parseDecimal, parseRupees, parseWhole } from './form-parse';

describe('form parsing', () => {
  it('reads rupee amounts with Indian commas and the rupee sign', () => {
    expect(parseRupees('1,82,000')).toEqual({ ok: true, value: 18_200_000 });
    expect(parseRupees('₹ 2,00,000.50')).toEqual({ ok: true, value: 20_000_050 });
  });
  it('treats blank as unknown, not zero', () => {
    expect(parseRupees('  ')).toEqual({ ok: true, value: null });
    expect(parseDecimal('')).toEqual({ ok: true, value: null });
    expect(parseWhole('')).toEqual({ ok: true, value: null });
  });
  it('rejects junk, negatives and extra decimals', () => {
    for (const bad of ['abc', '-5', '1.234', '1e5', '12 lakh']) expect(parseRupees(bad).ok).toBe(false);
    expect(parseDecimal('-1').ok).toBe(false);
    expect(parseWhole('0').ok).toBe(false);
    expect(parseWhole('1.5').ok).toBe(false);
  });
  it('round-trips amounts into a text box', () => {
    expect(paiseToInputText(18_200_000)).toBe('1,82,000');
    expect(paiseToInputText(null)).toBe('');
    expect(parseRupees(paiseToInputText(20_000_050))).toEqual({ ok: true, value: 20_000_050 });
  });
});
