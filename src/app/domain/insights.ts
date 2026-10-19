import { monthKey } from './dates';
import { sumPaise, type Paise } from './money';
import {
  UNASSIGNED_COLOR,
  UNASSIGNED_LABEL,
  type Asset,
  type CarLoan,
  type FamilyMember,
  type GoldLoan,
  type ManualLiability,
} from './models';
import { needsAttention, type RenewalView } from './renewal-status';

/**
 * Every figure here comes straight from user-entered data. Nothing is estimated or invented,
 * and a figure that rests only on the register amount is labelled "recorded".
 */
export interface BalanceFigure {
  amount: Paise;
  /** "confirmed" = user entered the current outstanding; "recorded" = falling back to the register amount. */
  basis: 'confirmed' | 'recorded';
}

export function goldLoanBalance(loan: Pick<GoldLoan, 'recordedAmount' | 'outstandingAmount'>): BalanceFigure {
  return loan.outstandingAmount != null
    ? { amount: loan.outstandingAmount, basis: 'confirmed' }
    : { amount: loan.recordedAmount, basis: 'recorded' };
}

export interface GoldTotal {
  total: Paise;
  confirmedCount: number;
  recordedCount: number;
}

export function totalGoldLoans(loans: readonly GoldLoan[]): GoldTotal {
  let confirmedCount = 0;
  let recordedCount = 0;
  const amounts = loans.map((loan) => {
    const figure = goldLoanBalance(loan);
    if (figure.basis === 'confirmed') confirmedCount += 1;
    else recordedCount += 1;
    return figure.amount;
  });
  return { total: sumPaise(amounts), confirmedCount, recordedCount };
}

export interface MemberTotal {
  memberId: string | null;
  name: string;
  color: string;
  count: number;
  total: Paise;
}

/** Gold loans grouped by owner, largest first, with unassigned loans last. */
export function goldLoansByMember(loans: readonly GoldLoan[], members: readonly FamilyMember[]): MemberTotal[] {
  const groups = new Map<string | null, MemberTotal>();
  for (const loan of loans) {
    const member = loan.memberId ? members.find((m) => m.id === loan.memberId) : undefined;
    const key = member ? member.id : null;
    const group =
      groups.get(key) ??
      ({
        memberId: key,
        name: member ? member.fullName : UNASSIGNED_LABEL,
        color: member ? member.color : UNASSIGNED_COLOR,
        count: 0,
        total: 0,
      } satisfies MemberTotal);
    group.count += 1;
    group.total += goldLoanBalance(loan).amount;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => {
    if (a.memberId === null) return 1;
    if (b.memberId === null) return -1;
    return b.total - a.total;
  });
}

export interface MonthConcentration {
  month: string;
  count: number;
  amount: Paise;
}

/** How much falls due in each month, soonest month first. */
export function renewalConcentrationByMonth(loans: readonly GoldLoan[]): MonthConcentration[] {
  const months = new Map<string, MonthConcentration>();
  for (const loan of loans) {
    const key = monthKey(loan.renewalDate);
    const entry = months.get(key) ?? { month: key, count: 0, amount: 0 };
    entry.count += 1;
    entry.amount += goldLoanBalance(loan).amount;
    months.set(key, entry);
  }
  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/** Total of loans needing action (overdue, due today, urgent, due soon). */
export function upcomingRenewalAmount(views: readonly RenewalView[]): { count: number; amount: Paise } {
  const due = views.filter((view) => needsAttention(view.status));
  return { count: due.length, amount: sumPaise(due.map((view) => goldLoanBalance(view.loan).amount)) };
}

export function carLoanBalance(car: Pick<CarLoan, 'principal' | 'outstandingPrincipal'>): BalanceFigure {
  return car.outstandingPrincipal != null
    ? { amount: car.outstandingPrincipal, basis: 'confirmed' }
    : { amount: car.principal, basis: 'recorded' };
}

export interface NetWorthSummary {
  totalAssets: Paise;
  goldLoans: Paise;
  carLoan: Paise;
  otherLiabilities: Paise;
  totalLiabilities: Paise;
  netWorth: Paise;
}

/**
 * Gold loans and the car loan are counted once, from their own records. The manual liabilities
 * list cannot contain them (see ManualLiabilityKind), so nothing is double-counted.
 */
export function summarizeNetWorth(input: {
  assets: readonly Asset[];
  goldLoans: readonly GoldLoan[];
  carLoan: CarLoan | null;
  otherLiabilities: readonly ManualLiability[];
}): NetWorthSummary {
  const totalAssets = sumPaise(input.assets.map((asset) => asset.estimatedValue));
  const goldLoans = totalGoldLoans(input.goldLoans).total;
  const carLoan = input.carLoan ? carLoanBalance(input.carLoan).amount : 0;
  const otherLiabilities = sumPaise(input.otherLiabilities.map((liability) => liability.outstanding));
  const totalLiabilities = goldLoans + carLoan + otherLiabilities;
  return { totalAssets, goldLoans, carLoan, otherLiabilities, totalLiabilities, netWorth: totalAssets - totalLiabilities };
}

/** Known monthly commitments. `hasUnknownEmi` is true when a loan exists but its EMI isn't entered yet. */
export function monthlyObligations(
  carLoan: CarLoan | null,
  otherLiabilities: readonly ManualLiability[],
): { total: Paise; hasUnknownEmi: boolean } {
  const carEmi = carLoan?.emi ?? 0;
  const others = sumPaise(otherLiabilities.map((liability) => liability.monthlyPayment ?? 0));
  const unknownCar = carLoan != null && carLoan.emi == null;
  const unknownOther = otherLiabilities.some((liability) => liability.monthlyPayment == null);
  return { total: carEmi + others, hasUnknownEmi: unknownCar || unknownOther };
}

export interface Reconciliation {
  computed: Paise;
  written: Paise;
  /** computed - written. Positive means the loans add up to more than the written total. */
  difference: Paise;
  matches: boolean;
}

/** Compares the sum of recorded loan amounts with a total written by hand (e.g. at the foot of the register). */
export function reconcileTotal(loans: readonly GoldLoan[], writtenTotal: Paise): Reconciliation {
  const computed = sumPaise(loans.map((loan) => loan.recordedAmount));
  return { computed, written: writtenTotal, difference: computed - writtenTotal, matches: computed === writtenTotal };
}
