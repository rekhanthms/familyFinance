import { describe, expect, it } from 'vitest';
import { buildSchedule, calcEmi, scheduleBalanceAfter } from './emi';
import { rupeesToPaise } from './money';

const principal = rupeesToPaise(3_00_000);

describe('calcEmi', () => {
  it('returns null unless both rate and tenure are known', () => {
    expect(calcEmi(principal, null, 36)).toBeNull();
    expect(calcEmi(principal, 9, null)).toBeNull();
    expect(calcEmi(principal, null, null)).toBeNull();
  });

  it('returns null for unusable inputs', () => {
    expect(calcEmi(0, 9, 36)).toBeNull();
    expect(calcEmi(principal, -1, 36)).toBeNull();
    expect(calcEmi(principal, 9, 0)).toBeNull();
    expect(calcEmi(principal, 9, 12.5)).toBeNull();
  });

  it('matches the standard reducing-balance EMI (3,00,000 at 9% for 36 months is about 9,540)', () => {
    const emi = calcEmi(principal, 9, 36)!;
    expect(emi).toBeGreaterThan(rupeesToPaise(9_530));
    expect(emi).toBeLessThan(rupeesToPaise(9_550));
  });

  it('handles a zero interest rate', () => {
    expect(calcEmi(rupeesToPaise(1_20_000), 0, 12)).toBe(rupeesToPaise(10_000));
  });
});

describe('buildSchedule', () => {
  const terms = { principal: rupeesToPaise(1_20_000), annualRatePercent: 12, tenureMonths: 12 };

  it('returns null when terms are missing', () => {
    expect(buildSchedule({ principal, annualRatePercent: null, tenureMonths: 36 })).toBeNull();
    expect(buildSchedule({ principal, annualRatePercent: 9, tenureMonths: null })).toBeNull();
  });

  it('amortises to exactly zero, with principal parts summing to the loan', () => {
    const rows = buildSchedule(terms)!;
    expect(rows).toHaveLength(12);
    expect(rows[11]!.balance).toBe(0);
    expect(rows.reduce((sum, r) => sum + r.principal, 0)).toBe(terms.principal);
    expect(rows.every((r) => r.emi === r.principal + r.interest)).toBe(true);
  });

  it('first month interest is one twelfth of the annual rate on the full balance', () => {
    const rows = buildSchedule(terms)!;
    expect(rows[0]!.interest).toBe(rupeesToPaise(1_200));
  });

  it('interest falls and principal rises over time', () => {
    const rows = buildSchedule(terms)!;
    expect(rows[11]!.interest).toBeLessThan(rows[0]!.interest);
    expect(rows[10]!.principal).toBeGreaterThan(rows[0]!.principal);
  });

  it('adds due dates from the first EMI date', () => {
    const rows = buildSchedule({ ...terms, firstEmiDate: '2026-11-05' })!;
    expect(rows[0]!.dueDate).toBe('2026-11-05');
    expect(rows[2]!.dueDate).toBe('2027-01-05');
    expect(buildSchedule(terms)![0]!.dueDate).toBeNull();
  });

  it('rejects an EMI that does not even cover the interest', () => {
    expect(buildSchedule({ ...terms, emi: rupeesToPaise(500) })).toBeNull();
  });

  it('reports the projected balance after N instalments', () => {
    const rows = buildSchedule(terms)!;
    expect(scheduleBalanceAfter(rows, 0)).toBe(terms.principal);
    expect(scheduleBalanceAfter(rows, 3)).toBe(rows[2]!.balance);
    expect(scheduleBalanceAfter(rows, 99)).toBe(0);
    expect(scheduleBalanceAfter([], 3)).toBeNull();
  });
});
