// Checks WCAG contrast for the colour pairs the UI actually uses.
// Reads src/styles/_tokens.scss so the tokens stay the single source of truth.
// Run: npm run check:contrast
import { readFileSync } from 'node:fs';

const scss = readFileSync(new URL('../src/styles/_tokens.scss', import.meta.url), 'utf8');
const tokens = Object.fromEntries([...scss.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]));

const channel = (v) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// [foreground, background, minimum ratio, what it is]
const TEXT = 4.5; // WCAG AA, normal text
const UI = 3; // WCAG AA, borders and focus rings
const pairs = [
  ['--c-ink', '--c-paper', TEXT, 'body text on paper'],
  ['--c-ink', '--c-surface', TEXT, 'body text on white'],
  ['--c-ink', '--c-sunken', TEXT, 'body text on sunken'],
  ['--c-ink-muted', '--c-paper', TEXT, 'muted text on paper'],
  ['--c-ink-muted', '--c-surface', TEXT, 'muted text on white'],
  ['--c-ink-muted', '--c-sunken', TEXT, 'muted text on sunken'],
  ['--c-surface', '--c-forest', TEXT, 'primary button text'],
  ['--c-surface', '--c-forest-deep', TEXT, 'primary button text (hover)'],
  ['--c-forest', '--c-paper', TEXT, 'green text on paper'],
  ['--c-forest', '--c-forest-wash', TEXT, 'selected nav item'],
  ['--c-gold-ink', '--c-gold-wash', TEXT, 'gold text on gold wash'],
  ['--c-gold-ink', '--c-paper', TEXT, 'gold text on paper'],
  ['--c-danger', '--c-paper', TEXT, 'error text on paper'],
  ['--c-danger', '--c-danger-wash', TEXT, 'error text on wash'],
  ['--c-surface', '--c-danger', TEXT, 'danger button text'],
  ['--c-surface', '--c-danger-deep', TEXT, 'danger button text (hover)'],
  ['--c-control-border', '--c-paper', UI, 'input border on paper'],
  ['--c-control-border', '--c-surface', UI, 'input border on white'],
  ['--c-focus', '--c-paper', UI, 'focus ring on paper'],
  ['--c-focus', '--c-surface', UI, 'focus ring on white'],
  ...['overdue', 'due-today', 'urgent', 'due-soon', 'renewed', 'upcoming'].map((s) => [
    `--s-${s}-fg`,
    `--s-${s}-bg`,
    TEXT,
    `status badge: ${s}`,
  ]),
];

let failures = 0;
for (const [fg, bg, min, label] of pairs) {
  if (!tokens[fg] || !tokens[bg]) {
    console.log(`MISSING  ${label}: ${fg} / ${bg}`);
    failures++;
    continue;
  }
  const r = ratio(tokens[fg], tokens[bg]);
  const pass = r >= min;
  if (!pass) failures++;
  console.log(`${pass ? 'ok     ' : 'FAIL   '} ${r.toFixed(2).padStart(5)} (need ${min})  ${label}`);
}
console.log(failures === 0 ? `\nAll ${pairs.length} pairs pass.` : `\n${failures} pair(s) fail.`);
process.exit(failures === 0 ? 0 : 1);
