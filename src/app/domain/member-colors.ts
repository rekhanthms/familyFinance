/**
 * Colours offered to family members. Each stays readable as text on both paper (#FAF8F3) and white,
 * and none is red, green or gold, which the interface reserves for status, brand and loans.
 */
export const MEMBER_PALETTE = ['#2B5C9E', '#8C4A2F', '#8E3F73', '#5F6B22', '#5B4B8A', '#3D6A78'] as const;

/** The first palette colour nobody is using; once all are taken, colours are reused in order. */
export function nextMemberColor(usedColors: readonly string[]): string {
  const used = new Set(usedColors.map((color) => color.toLowerCase()));
  return MEMBER_PALETTE.find((color) => !used.has(color.toLowerCase())) ?? MEMBER_PALETTE[usedColors.length % MEMBER_PALETTE.length]!;
}
