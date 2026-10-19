import { describe, expect, it } from 'vitest';
import { csvCell, goldLoansToCsv, GOLD_LOAN_CSV_HEADER } from './csv';
import { rupeesToPaise } from './money';
import { buildRenewalReminderText, buildWhatsAppLink, jewelrySummary } from './reminders';
import { createSeedData, SEED_REFERENCE_DATE } from './seed';

const seed = createSeedData('2026-10-17T10:00:00+05:30');

describe('CSV export', () => {
  it('escapes commas, quotes and newlines', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(42)).toBe('42');
  });

  it('defuses spreadsheet formulas', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('@cmd')).toBe("'@cmd");
    expect(csvCell(-5)).toBe('-5'); // real negative numbers stay numbers
  });

  it('exports a header and one row per loan, nearest renewal first, with unassigned labelled', () => {
    const lines = goldLoansToCsv(seed.goldLoans, seed.members, SEED_REFERENCE_DATE).split('\r\n');
    expect(lines[0]).toBe(GOLD_LOAN_CSV_HEADER.join(','));
    expect(lines).toHaveLength(13);
    expect(lines[1]).toContain('gl-008');
    expect(lines[1]).toContain('K.P. Hemalatha');
    expect(lines[1]).toContain('182000');
    expect(lines[1]).toContain('Due soon');
    expect(lines[1]).toContain('Needs verification');
    expect(lines.some((line) => line.includes('Unassigned — confirm owner'))).toBe(true);
  });
});

describe('reminders', () => {
  it('summarises jewelry', () => {
    expect(jewelrySummary([{ type: 'Chain', quantity: 1 }, { type: 'Ring', quantity: 1 }])).toBe('Chain ×1, Ring ×1');
    expect(jewelrySummary([{ type: 'Chain', quantity: 1, description: 'Two-row chain' }])).toBe('Chain (Two-row chain) ×1');
  });

  it('writes a plain reminder from entered data', () => {
    const text = buildRenewalReminderText({
      ownerName: 'K.P. Hemalatha',
      accountRef: '••••1789',
      jewelry: [{ type: 'Chain', quantity: 1, description: 'Two-row chain' }],
      amount: rupeesToPaise(1_82_000),
      renewalDate: '2026-10-29',
      daysRemaining: 12,
      status: 'due-soon',
    });
    expect(text).toContain('K.P. Hemalatha');
    expect(text).toContain('Amount: ₹1,82,000');
    expect(text).toContain('29 Oct 2026 (12 days left)');
  });

  it('words overdue, today and singular days correctly', () => {
    const base = {
      ownerName: 'A',
      accountRef: null,
      jewelry: [],
      amount: 100,
      renewalDate: '2026-10-17',
    } as const;
    expect(buildRenewalReminderText({ ...base, daysRemaining: -3, status: 'overdue' })).toContain('overdue by 3 days');
    expect(buildRenewalReminderText({ ...base, daysRemaining: 0, status: 'due-today' })).toContain('due today');
    expect(buildRenewalReminderText({ ...base, daysRemaining: 1, status: 'urgent' })).toContain('1 day left');
  });

  it('builds a WhatsApp link, with or without a phone number', () => {
    expect(buildWhatsAppLink('Hi there', '+91 98765 43210')).toBe('https://wa.me/919876543210?text=Hi%20there');
    expect(buildWhatsAppLink('Hi')).toBe('https://wa.me/?text=Hi');
    expect(buildWhatsAppLink('Hi', '123')).toBe('https://wa.me/?text=Hi');
  });
});
