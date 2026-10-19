import { addMonths, type ISODate } from './dates';
import type { Paise } from './money';

function hasUsableTerms(
  principal: Paise,
  annualRatePercent: number | null,
  tenureMonths: number | null,
): annualRatePercent is number {
  return (
    Number.isSafeInteger(principal) &&
    principal > 0 &&
    annualRatePercent != null &&
    Number.isFinite(annualRatePercent) &&
    annualRatePercent >= 0 &&
    tenureMonths != null &&
    Number.isInteger(tenureMonths) &&
    tenureMonths > 0
  );
}

/**
 * Standard reducing-balance EMI. Returns null unless BOTH the interest rate and the tenure are
 * known - we never invent missing loan terms.
 */
export function calcEmi(principal: Paise, annualRatePercent: number | null, tenureMonths: number | null): Paise | null {
  if (!hasUsableTerms(principal, annualRatePercent, tenureMonths)) return null;
  const n = tenureMonths as number;
  const monthlyRate = annualRatePercent / 12 / 100;
  if (monthlyRate === 0) return Math.round(principal / n);
  const growth = Math.pow(1 + monthlyRate, n);
  return Math.round((principal * monthlyRate * growth) / (growth - 1));
}

export interface ScheduleRow {
  installment: number;
  dueDate: ISODate | null;
  emi: Paise;
  interest: Paise;
  principal: Paise;
  balance: Paise;
}

export interface ScheduleOptions {
  principal: Paise;
  annualRatePercent: number | null;
  tenureMonths: number | null;
  /** Lender-confirmed EMI. If omitted it is calculated. */
  emi?: Paise | null;
  firstEmiDate?: ISODate | null;
}

/**
 * Amortisation schedule (principal, interest, EMI, remaining balance per instalment).
 * Returns null when terms are missing, or when the EMI would not even cover the interest.
 * The final instalment absorbs rounding so the balance always ends at exactly zero.
 */
export function buildSchedule(options: ScheduleOptions): ScheduleRow[] | null {
  const { principal, annualRatePercent, tenureMonths, firstEmiDate = null } = options;
  if (!hasUsableTerms(principal, annualRatePercent, tenureMonths)) return null;
  const n = tenureMonths as number;
  const emi = options.emi ?? calcEmi(principal, annualRatePercent, tenureMonths);
  if (emi == null || emi <= 0) return null;

  const monthlyRate = annualRatePercent / 12 / 100;
  const rows: ScheduleRow[] = [];
  let balance = principal;

  for (let i = 1; i <= n; i++) {
    const interest = Math.round(balance * monthlyRate);
    const principalPart = i === n ? balance : Math.min(balance, emi - interest);
    if (principalPart <= 0) return null;
    balance -= principalPart;
    rows.push({
      installment: i,
      dueDate: firstEmiDate ? addMonths(firstEmiDate, i - 1) : null,
      emi: principalPart + interest,
      interest,
      principal: principalPart,
      balance,
    });
  }
  return rows;
}

/** Balance the schedule predicts after N instalments. A projection, not a bank statement. */
export function scheduleBalanceAfter(schedule: readonly ScheduleRow[], installmentsPaid: number): Paise | null {
  if (schedule.length === 0) return null;
  if (installmentsPaid <= 0) return schedule[0]!.balance + schedule[0]!.principal;
  const row = schedule[Math.min(installmentsPaid, schedule.length) - 1];
  return row ? row.balance : null;
}
