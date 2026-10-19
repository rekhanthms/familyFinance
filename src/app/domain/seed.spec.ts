import { describe, expect, it } from 'vitest';
import { isISODate } from './dates';
import { rupeesToPaise } from './money';
import { UNASSIGNED_LABEL } from './models';
import { createSeedData } from './seed';
import { validateGoldLoan } from './validation';

const seed = createSeedData('2026-10-17T10:00:00+05:30');

describe('seed data from the register', () => {
  it('has 12 loans: 10 assigned and 2 unassigned', () => {
    expect(seed.goldLoans).toHaveLength(12);
    expect(seed.goldLoans.filter((l) => l.memberId === null)).toHaveLength(2);
    expect(seed.members.map((m) => m.fullName)).toEqual([
      'M.S. Rekhanth',
      'G. Somashekhara Pillai',
      'K.P. Hemalatha',
      'Chandan Kumar',
    ]);
    expect(UNASSIGNED_LABEL).toContain('confirm owner');
  });

  it('preserves the dates and amounts exactly as supplied', () => {
    const byId = (id: string) => seed.goldLoans.find((l) => l.id === id)!;
    expect([byId('gl-001').renewalDate, byId('gl-001').recordedAmount]).toEqual(['2027-10-16', rupeesToPaise(2_00_000)]);
    expect([byId('gl-006').renewalDate, byId('gl-006').recordedAmount]).toEqual(['2026-12-09', rupeesToPaise(1_45_000)]);
    expect([byId('gl-008').renewalDate, byId('gl-008').recordedAmount]).toEqual(['2026-10-29', rupeesToPaise(1_82_000)]);
    expect([byId('gl-011').renewalDate, byId('gl-011').recordedAmount]).toEqual(['2027-07-02', rupeesToPaise(1_02_000)]);
    expect([byId('gl-012').renewalDate, byId('gl-012').recordedAmount]).toEqual(['2026-11-11', rupeesToPaise(1_48_000)]);
  });

  it('flags every imported loan as needing verification', () => {
    expect(seed.goldLoans.every((l) => l.verification === 'needs-verification')).toBe(true);
  });

  it('never invents lender, rate, method, pledge date, interval or confirmed balance', () => {
    for (const loan of seed.goldLoans) {
      expect(loan.lender).toBeNull();
      expect(loan.interestRatePercent).toBeNull();
      expect(loan.interestMethod).toBeNull();
      expect(loan.pledgeDate).toBeNull();
      expect(loan.renewalIntervalMonths).toBeNull();
      expect(loan.outstandingAmount).toBeNull();
    }
  });

  it('stores only masked account references', () => {
    for (const loan of seed.goldLoans) {
      if (loan.accountRef !== null) expect(loan.accountRef).toMatch(/^••••\d{4}$/);
    }
    expect(seed.goldLoans.filter((l) => l.memberId === null).every((l) => l.accountRef === null)).toBe(true);
  });

  it('uses unique ids and valid dates; every owner reference exists', () => {
    const ids = new Set(seed.goldLoans.map((l) => l.id));
    expect(ids.size).toBe(12);
    const memberIds = new Set(seed.members.map((m) => m.id));
    for (const loan of seed.goldLoans) {
      expect(isISODate(loan.renewalDate)).toBe(true);
      if (loan.memberId) expect(memberIds.has(loan.memberId)).toBe(true);
    }
  });

  it('gives each member a different colour', () => {
    expect(new Set(seed.members.map((m) => m.color)).size).toBe(seed.members.length);
  });

  it('keeps the uncertain jewelry list editable and explained', () => {
    const uncertain = seed.goldLoans.find((l) => l.id === 'gl-007')!;
    expect(uncertain.notes).toContain('unclear');
    expect(uncertain.jewelry.some((j) => j.type === 'Other')).toBe(true);
  });

  it('car loan has only the known amount', () => {
    expect(seed.carLoan).toMatchObject({
      principal: rupeesToPaise(3_00_000),
      lender: null,
      interestRatePercent: null,
      tenureMonths: null,
      emi: null,
      outstandingPrincipal: null,
    });
  });

  it('every seeded loan passes validation', () => {
    for (const loan of seed.goldLoans) expect(validateGoldLoan(loan)).toEqual([]);
  });
});
