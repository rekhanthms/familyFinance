import { describe, expect, it } from 'vitest';
import { rupeesToPaise } from './money';
import { buildRenewalViews, computeRenewalStatus } from './renewal-status';
import { recordRenewal, suggestNextRenewalDate, type RenewalInput } from './renewal-workflow';
import { createSeedData, SEED_REFERENCE_DATE } from './seed';

const TODAY = SEED_REFERENCE_DATE;
const NOW = '2026-10-17T10:00:00+05:30';
const seed = createSeedData(NOW);
const hemalatha = seed.goldLoans.find((l) => l.id === 'gl-008')!; // due 29 Oct 2026

let counter = 0;
const context = { today: TODAY, nowIso: NOW, newId: () => `id-${++counter}` };

const validInput: RenewalInput = {
  loanId: 'gl-008',
  previousRenewalDate: '2026-10-29',
  completedOn: '2026-10-17',
  newRenewalDate: '2027-10-29',
};

describe('recordRenewal', () => {
  it('records the renewal, keeps the previous date, and moves the due date', () => {
    const result = recordRenewal(hemalatha, validInput, context);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { loan, record, activity } = result.value;
    expect(loan.renewalDate).toBe('2027-10-29');
    expect(loan.renewals).toHaveLength(1);
    expect(record.previousRenewalDate).toBe('2026-10-29');
    expect(record.completedOn).toBe('2026-10-17');
    expect(record.newRenewalDate).toBe('2027-10-29');
    expect(activity.kind).toBe('renewal-recorded');
    expect(activity.loanId).toBe('gl-008');
    expect(activity.message).toContain('2026-10-29');
    expect(activity.message).toContain('2027-10-29');
  });

  it('does not mutate the original loan', () => {
    recordRenewal(hemalatha, validInput, context);
    expect(hemalatha.renewalDate).toBe('2026-10-29');
    expect(hemalatha.renewals).toHaveLength(0);
  });

  it('status and dashboard position recalculate from the new date', () => {
    const result = recordRenewal(hemalatha, validInput, context);
    if (!result.ok) throw new Error('expected success');

    expect(computeRenewalStatus(result.value.loan, TODAY).status).toBe('renewed');
    expect(computeRenewalStatus(result.value.loan, TODAY).nextRenewalDate).toBe('2027-10-29');

    const loans = seed.goldLoans.map((l) => (l.id === 'gl-008' ? result.value.loan : l));
    const views = buildRenewalViews(loans, TODAY);
    expect(views[0]!.loanId).not.toBe('gl-008');
    expect(views.findIndex((v) => v.loanId === 'gl-008')).toBeGreaterThan(5);
  });

  it('applies an updated outstanding amount and interest rate only when given', () => {
    const withUpdates = recordRenewal(
      hemalatha,
      { ...validInput, updatedOutstanding: rupeesToPaise(1_75_000), updatedInterestRatePercent: 9.5 },
      context,
    );
    if (!withUpdates.ok) throw new Error('expected success');
    expect(withUpdates.value.loan.outstandingAmount).toBe(rupeesToPaise(1_75_000));
    expect(withUpdates.value.loan.interestRatePercent).toBe(9.5);

    const without = recordRenewal(hemalatha, validInput, context);
    if (!without.ok) throw new Error('expected success');
    expect(without.value.loan.outstandingAmount).toBeNull();
    expect(without.value.loan.interestRatePercent).toBeNull();
  });

  it('rejects a stale form (previous date no longer matches)', () => {
    const result = recordRenewal(hemalatha, { ...validInput, previousRenewalDate: '2026-10-28' }, context);
    expect(result.ok).toBe(false);
  });

  it('rejects a future completion date and a new date that is not after it', () => {
    const future = recordRenewal(hemalatha, { ...validInput, completedOn: '2026-10-18' }, context);
    expect(future.ok).toBe(false);
    const notAfter = recordRenewal(hemalatha, { ...validInput, newRenewalDate: '2026-10-17' }, context);
    expect(notAfter.ok).toBe(false);
  });

  it('rejects invalid dates, a negative outstanding amount and a negative rate', () => {
    expect(recordRenewal(hemalatha, { ...validInput, newRenewalDate: '2027-02-31' }, context).ok).toBe(false);
    expect(recordRenewal(hemalatha, { ...validInput, updatedOutstanding: -1 }, context).ok).toBe(false);
    expect(recordRenewal(hemalatha, { ...validInput, updatedInterestRatePercent: -2 }, context).ok).toBe(false);
  });

  it('can renew a loan that is already overdue', () => {
    const overdue = { ...hemalatha, renewalDate: '2026-10-10' };
    const result = recordRenewal(overdue, { ...validInput, previousRenewalDate: '2026-10-10' }, context);
    expect(result.ok).toBe(true);
  });
});

describe('suggestNextRenewalDate', () => {
  it('never assumes a yearly renewal when the interval is unknown', () => {
    expect(suggestNextRenewalDate(hemalatha)).toBeNull();
  });

  it('uses the interval the user entered', () => {
    expect(suggestNextRenewalDate({ renewalDate: '2026-10-29', renewalIntervalMonths: 12 })).toBe('2027-10-29');
    expect(suggestNextRenewalDate({ renewalDate: '2026-10-29', renewalIntervalMonths: 6 })).toBe('2027-04-29');
  });
});
