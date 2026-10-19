import { describe, expect, it } from 'vitest';
import { contrastRatio, hexToRgb, relativeLuminance } from './contrast';
import { MEMBER_PALETTE, nextMemberColor } from './member-colors';
import { UNASSIGNED_COLOR } from './models';
import { createSeedData } from './seed';

const PAPER = '#FAF8F3';
const WHITE = '#FFFFFF';

describe('contrast helpers', () => {
  it('parses hex colours and rejects anything else', () => {
    expect(hexToRgb('#1F4D3A')).toEqual([31, 77, 58]);
    expect(() => hexToRgb('red')).toThrow();
    expect(() => hexToRgb('#fff')).toThrow();
  });

  it('matches the WCAG reference values', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5);
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#336699', '#336699')).toBe(1);
    expect(contrastRatio('#767676', '#FFFFFF')).toBeGreaterThanOrEqual(4.5); // the classic AA boundary grey
    expect(contrastRatio('#777777', '#FFFFFF')).toBeLessThan(4.5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#1F4D3A', PAPER)).toBeCloseTo(contrastRatio(PAPER, '#1F4D3A'), 10);
  });
});

describe('member colours', () => {
  it('every palette colour is readable text on paper and on white', () => {
    for (const color of MEMBER_PALETTE) {
      expect(contrastRatio(color, PAPER), `${color} on paper`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(color, WHITE), `${color} on white`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('the seeded members and the unassigned grey are readable too', () => {
    const colors = [...createSeedData('2026-10-17T10:00:00+05:30').members.map((m) => m.color), UNASSIGNED_COLOR];
    for (const color of colors) {
      expect(contrastRatio(color, PAPER), `${color} on paper`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(color, WHITE), `${color} on white`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('palette colours are all different, and the seeded members use palette colours', () => {
    expect(new Set(MEMBER_PALETTE).size).toBe(MEMBER_PALETTE.length);
    const seeded = createSeedData('2026-10-17T10:00:00+05:30').members.map((m) => m.color);
    for (const color of seeded) expect(MEMBER_PALETTE).toContain(color);
  });

  it('offers the first colour nobody has, ignoring letter case', () => {
    expect(nextMemberColor([])).toBe(MEMBER_PALETTE[0]);
    expect(nextMemberColor([MEMBER_PALETTE[0].toLowerCase()])).toBe(MEMBER_PALETTE[1]);
    expect(nextMemberColor([MEMBER_PALETTE[0], MEMBER_PALETTE[2]])).toBe(MEMBER_PALETTE[1]);
  });

  it('reuses colours in order once every one is taken', () => {
    expect(nextMemberColor([...MEMBER_PALETTE])).toBe(MEMBER_PALETTE[0]);
    expect(nextMemberColor([...MEMBER_PALETTE, '#000000'])).toBe(MEMBER_PALETTE[1]);
  });
});
