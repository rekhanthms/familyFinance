import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import type { GoldLoan, RenewalRecord } from './models';
import {
  buildRenewalViews,
  computeRenewalStatus,
  countByStatus,
  DEFAULT_RENEWAL_THRESHOLDS,
  lastConfirmedRenewalDate,
  sortByNearestRenewal,
  urgentRenewals,
  validateThresholds,
  type RenewalStatus,
} from './renewal-status';
import { createSeedData, SEED_REFERENCE_DATE } from './seed';

const TODAY = SEED_REFERENCE_DATE; // 2026-10-17
const seed = createSeedData('2026-10-17T10:00:00+05:30');

const loanDueIn = (days: number, renewals: RenewalRecord[] = []): GoldLoan => ({
  ...seed.goldLoans[0]!,
  renewalDate: addDays(TODAY, days),
  renewals,
});

const renewalDoneOn = (completedOn: string): RenewalRecord => ({
  id: 'r1',
  loanId: 'gl-001',
  previousRenewalDate: '2026-09-01',
  completedOn,
  newRenewalDate: '2027-09-01',
  updatedOutstanding: null,
  updatedInterestRatePercent: null,
  recordedAt: `${completedOn}T09:00:00+05:30`,
});

describe('renewal status rules (defaults 30 / 7)', () => {
  const cases: Array<[number, RenewalStatus]> = [
    [-30, 'overdue'],
    [-1, 'overdue'],
    [0, 'due-today'],
    [1, 'urgent'],
    [7, 'urgent'],
    [8, 'due-soon'],
    [30, 'due-soon'],
    [31, 'upcoming'],
    [400, 'upcoming'],
  ];

  it.each(cases)('%i days remaining -> %s', (days, expected) => {
    const result = computeRenewalStatus(loanDueIn(days), TODAY);
    expect(result.status).toBe(expected);
    expect(result.daysRemaining).toBe(days);
  });

  it('never treats a passed date as renewed', () => {
    expect(computeRenewalStatus(loanDueIn(-5), TODAY).status).toBe('overdue');
  });

  it('thresholds are configurable', () => {
    const custom = { dueSoonDays: 45, urgentDays: 10, renewedBadgeDays: 30 };
    expect(computeRenewalStatus(loanDueIn(40), TODAY, custom).status).toBe('due-soon');
    expect(computeRenewalStatus(loanDueIn(10), TODAY, custom).status).toBe('urgent');
    expect(computeRenewalStatus(loanDueIn(11), TODAY, custom).status).toBe('due-soon');
    expect(computeRenewalStatus(loanDueIn(46), TODAY, custom).status).toBe('upcoming');
  });

  it('validates thresholds', () => {
    expect(validateThresholds(DEFAULT_RENEWAL_THRESHOLDS)).toEqual([]);
    expect(validateThresholds({ dueSoonDays: 5, urgentDays: 7, renewedBadgeDays: 30 })).toHaveLength(1);
    expect(validateThresholds({ dueSoonDays: 30, urgentDays: 0, renewedBadgeDays: -1 })).toHaveLength(2);
    expect(validateThresholds({ dueSoonDays: 30.5, urgentDays: 7, renewedBadgeDays: 30 })).toHaveLength(1);
  });
});

describe('renewed status', () => {
  it('shows Renewed (with the next date) for a recorded renewal inside the badge window', () => {
    const loan = loanDueIn(60, [renewalDoneOn(TODAY)]);
    const result = computeRenewalStatus(loan, TODAY);
    expect(result.status).toBe('renewed');
    expect(result.nextRenewalDate).toBe(loan.renewalDate);
  });

  it('renewed badge expires after the configured window, then status derives from the new date', () => {
    const loan = loanDueIn(60, [renewalDoneOn(addDays(TODAY, -31))]);
    expect(computeRenewalStatus(loan, TODAY).status).toBe('upcoming');
    const inWindow = loanDueIn(20, [renewalDoneOn(addDays(TODAY, -30))]);
    expect(computeRenewalStatus(inWindow, TODAY).status).toBe('renewed');
  });

  it('does not hide urgent, due-today or overdue behind the Renewed badge', () => {
    const renewal = renewalDoneOn(TODAY);
    expect(computeRenewalStatus(loanDueIn(5, [renewal]), TODAY).status).toBe('urgent');
    expect(computeRenewalStatus(loanDueIn(0, [renewal]), TODAY).status).toBe('due-today');
    expect(computeRenewalStatus(loanDueIn(-2, [renewal]), TODAY).status).toBe('overdue');
  });

  it('a renewal dated in the future never counts as renewed', () => {
    const loan = loanDueIn(60, [renewalDoneOn(addDays(TODAY, 3))]);
    expect(computeRenewalStatus(loan, TODAY).status).toBe('upcoming');
  });

  it('reports the last confirmed renewal date from history', () => {
    expect(lastConfirmedRenewalDate({ renewals: [] })).toBeNull();
    const older = renewalDoneOn('2025-09-01');
    const newer = { ...renewalDoneOn('2026-09-01'), id: 'r2' };
    expect(lastConfirmedRenewalDate({ renewals: [older, newer] })).toBe('2026-09-01');
  });
});

describe('seed data on the reference date (17 Oct 2026)', () => {
  const views = buildRenewalViews(seed.goldLoans, TODAY, seed.settings.renewalThresholds);

  it('sorts nearest renewal first', () => {
    expect(views.map((v) => v.renewalDate)).toEqual([
      '2026-10-29',
      '2026-11-11',
      '2026-11-11',
      '2026-12-09',
      '2026-12-23',
      '2027-01-12',
      '2027-07-02',
      '2027-08-24',
      '2027-09-01',
      '2027-09-04',
      '2027-09-21',
      '2027-10-16',
    ]);
  });

  it('has nothing overdue; three due soon; nine upcoming', () => {
    expect(countByStatus(views)).toEqual({
      overdue: 0,
      'due-today': 0,
      urgent: 0,
      'due-soon': 3,
      renewed: 0,
      upcoming: 9,
    });
  });

  it('days remaining match the register dates', () => {
    expect(views[0]!.daysRemaining).toBe(12);
    expect(views[1]!.daysRemaining).toBe(25);
    expect(views[3]!.daysRemaining).toBe(53);
  });

  it('dashboard lists only the loans needing attention, nearest first', () => {
    expect(urgentRenewals(views).map((v) => v.loanId)).toEqual(['gl-008', 'gl-009', 'gl-012']);
  });
});

describe('changing a renewal date changes status and dashboard position immediately', () => {
  const chandan = seed.goldLoans.find((l) => l.id === 'gl-010')!; // due 4 Sep 2027

  const withDate = (date: string): GoldLoan[] =>
    seed.goldLoans.map((l) => (l.id === chandan.id ? { ...l, renewalDate: date } : l));

  it('moves from upcoming/last to urgent/first when brought forward to 20 Oct 2026', () => {
    const before = buildRenewalViews(seed.goldLoans, TODAY);
    expect(before.find((v) => v.loanId === 'gl-010')!.status).toBe('upcoming');
    expect(before.findIndex((v) => v.loanId === 'gl-010')).toBe(9);

    const after = buildRenewalViews(withDate('2026-10-20'), TODAY);
    expect(after[0]!.loanId).toBe('gl-010');
    expect(after[0]!.status).toBe('urgent');
    expect(urgentRenewals(after)[0]!.loanId).toBe('gl-010');
  });

  it('becomes overdue (and stays unrenewed) when set to a past date', () => {
    const after = buildRenewalViews(withDate('2026-10-10'), TODAY);
    expect(after[0]!.loanId).toBe('gl-010');
    expect(after[0]!.status).toBe('overdue');
    expect(after[0]!.daysRemaining).toBe(-7);
  });

  it('breaks date ties by id so ordering is stable', () => {
    const sorted = sortByNearestRenewal([
      { id: 'b', renewalDate: '2026-11-11' },
      { id: 'a', renewalDate: '2026-11-11' },
      { id: 'c', renewalDate: '2026-10-01' },
    ]);
    expect(sorted.map((x) => x.id)).toEqual(['c', 'a', 'b']);
  });
});
