import { describe, expect, it } from 'vitest';
import {
  carLoanBalance,
  goldLoanBalance,
  goldLoansByMember,
  monthlyObligations,
  reconcileTotal,
  renewalConcentrationByMonth,
  summarizeNetWorth,
  totalGoldLoans,
  upcomingRenewalAmount,
} from './insights';
import { rupeesToPaise } from './money';
import type { Asset, ManualLiability } from './models';
import { buildRenewalViews } from './renewal-status';
import { createSeedData, REGISTER_WRITTEN_TOTAL, SEED_REFERENCE_DATE } from './seed';

const NOW = '2026-10-17T10:00:00+05:30';
const seed = createSeedData(NOW);
const R = rupeesToPaise;

describe('gold loan totals', () => {
  it('sums the register to ₹18,82,000, all of it on a "recorded" basis', () => {
    const total = totalGoldLoans(seed.goldLoans);
    expect(total.total).toBe(R(18_82_000));
    expect(total.recordedCount).toBe(12);
    expect(total.confirmedCount).toBe(0);
  });

  it('uses the confirmed outstanding balance once the user enters it', () => {
    const loan = { ...seed.goldLoans[0]!, outstandingAmount: R(1_50_000) };
    expect(goldLoanBalance(loan)).toEqual({ amount: R(1_50_000), basis: 'confirmed' });
    const total = totalGoldLoans([loan, seed.goldLoans[1]!]);
    expect(total.total).toBe(R(1_50_000) + R(1_10_000));
    expect(total.confirmedCount).toBe(1);
    expect(total.recordedCount).toBe(1);
  });

  it('flags that the hand-written total is ₹1,00,000 short of the real sum', () => {
    const check = reconcileTotal(seed.goldLoans, REGISTER_WRITTEN_TOTAL);
    expect(check.computed).toBe(R(18_82_000));
    expect(check.written).toBe(R(17_82_000));
    expect(check.difference).toBe(R(1_00_000));
    expect(check.matches).toBe(false);
    expect(reconcileTotal(seed.goldLoans, R(18_82_000)).matches).toBe(true);
  });
});

describe('grouping', () => {
  it('groups by owner, largest first, unassigned last', () => {
    const groups = goldLoansByMember(seed.goldLoans, seed.members);
    expect(groups.map((g) => [g.name, g.count, g.total])).toEqual([
      ['G. Somashekhara Pillai', 4, R(6_65_000)],
      ['M.S. Rekhanth', 3, R(5_10_000)],
      ['K.P. Hemalatha', 2, R(3_62_000)],
      ['Chandan Kumar', 1, R(95_000)],
      ['Unassigned — confirm owner', 2, R(2_50_000)],
    ]);
    expect(groups.at(-1)!.memberId).toBeNull();
  });

  it('shows renewal concentration by month, soonest first', () => {
    const months = renewalConcentrationByMonth(seed.goldLoans);
    expect(months.slice(0, 3)).toEqual([
      { month: '2026-10', count: 1, amount: R(1_82_000) },
      { month: '2026-11', count: 2, amount: R(3_28_000) },
      { month: '2026-12', count: 2, amount: R(2_55_000) },
    ]);
    expect(months.reduce((n, m) => n + m.count, 0)).toBe(12);
  });

  it('totals the amount that needs action soon', () => {
    const views = buildRenewalViews(seed.goldLoans, SEED_REFERENCE_DATE);
    expect(upcomingRenewalAmount(views)).toEqual({ count: 3, amount: R(1_82_000 + 1_80_000 + 1_48_000) });
  });
});

describe('net worth and obligations', () => {
  const asset = (value: number): Asset => ({
    id: `a-${value}`,
    updatedAt: NOW,
    kind: 'savings',
    name: 'Savings',
    ownerMemberId: null,
    estimatedValue: R(value),
    valuationDate: null,
  });
  const homeLoan: ManualLiability = {
    id: 'l-1',
    updatedAt: NOW,
    kind: 'home-loan',
    name: 'Home loan',
    ownerMemberId: null,
    outstanding: R(10_00_000),
    monthlyPayment: R(12_000),
  };

  it('counts gold loans and the car loan once, from their own records', () => {
    const summary = summarizeNetWorth({
      assets: [asset(30_00_000)],
      goldLoans: seed.goldLoans,
      carLoan: seed.carLoan,
      otherLiabilities: [homeLoan],
    });
    expect(summary.goldLoans).toBe(R(18_82_000));
    expect(summary.carLoan).toBe(R(3_00_000));
    expect(summary.otherLiabilities).toBe(R(10_00_000));
    expect(summary.totalLiabilities).toBe(R(31_82_000));
    expect(summary.netWorth).toBe(R(30_00_000) - R(31_82_000));
  });

  it('works with no car loan and no other liabilities', () => {
    const summary = summarizeNetWorth({ assets: [], goldLoans: seed.goldLoans, carLoan: null, otherLiabilities: [] });
    expect(summary.totalLiabilities).toBe(R(18_82_000));
    expect(summary.netWorth).toBe(-R(18_82_000));
  });

  it('car loan balance falls back to the original amount until confirmed', () => {
    expect(carLoanBalance(seed.carLoan!)).toEqual({ amount: R(3_00_000), basis: 'recorded' });
    expect(carLoanBalance({ principal: R(3_00_000), outstandingPrincipal: R(2_40_000) })).toEqual({
      amount: R(2_40_000),
      basis: 'confirmed',
    });
  });

  it('does not invent an EMI: flags it as unknown instead', () => {
    expect(monthlyObligations(seed.carLoan, [])).toEqual({ total: 0, hasUnknownEmi: true });
    const known = { ...seed.carLoan!, emi: R(9_500) };
    expect(monthlyObligations(known, [homeLoan])).toEqual({ total: R(21_500), hasUnknownEmi: false });
  });
});
