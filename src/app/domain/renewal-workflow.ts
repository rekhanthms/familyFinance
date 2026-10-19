import { addMonths, isISODate, type ISODate, type ISODateTime } from './dates';
import { isValidPaise, type Paise } from './money';
import type { ActivityLogEntry, GoldLoan, RenewalRecord } from './models';
import { fail, ok, type Result } from './result';

export interface RenewalInput {
  loanId: string;
  /** Must match the loan's current renewal date - guards against a stale form. */
  previousRenewalDate: ISODate;
  completedOn: ISODate;
  newRenewalDate: ISODate;
  updatedOutstanding?: Paise | null;
  updatedInterestRatePercent?: number | null;
  lenderReference?: string;
  notes?: string;
}

export interface RenewalContext {
  today: ISODate;
  nowIso: ISODateTime;
  newId: () => string;
}

export interface RenewalOutcome {
  loan: GoldLoan;
  record: RenewalRecord;
  activity: ActivityLogEntry;
}

/**
 * Pure "Record renewal": returns the updated loan, the history record and the activity entry.
 * Never mutates the input loan. Status and dashboard order recompute from the new renewal date.
 */
export function recordRenewal(
  loan: GoldLoan,
  input: RenewalInput,
  context: RenewalContext,
): Result<RenewalOutcome> {
  const errors: string[] = [];

  if (input.loanId !== loan.id) errors.push('This renewal belongs to a different loan.');
  if (!isISODate(input.previousRenewalDate) || input.previousRenewalDate !== loan.renewalDate) {
    errors.push('The previous renewal date no longer matches this loan. Reopen the form and try again.');
  }
  if (!isISODate(input.completedOn)) {
    errors.push('Enter a valid renewal completion date.');
  } else if (input.completedOn > context.today) {
    errors.push('The completion date cannot be in the future.');
  }
  if (!isISODate(input.newRenewalDate)) {
    errors.push('Enter a valid new renewal date.');
  } else if (isISODate(input.completedOn) && input.newRenewalDate <= input.completedOn) {
    errors.push('The new renewal date must be after the completion date.');
  }
  if (input.updatedOutstanding != null && (!isValidPaise(input.updatedOutstanding) || input.updatedOutstanding < 0)) {
    errors.push('Updated outstanding amount must be zero or more.');
  }
  if (
    input.updatedInterestRatePercent != null &&
    (!Number.isFinite(input.updatedInterestRatePercent) || input.updatedInterestRatePercent < 0)
  ) {
    errors.push('Updated interest rate must be zero or more.');
  }
  if (errors.length > 0) return fail(errors);

  const record: RenewalRecord = {
    id: context.newId(),
    loanId: loan.id,
    previousRenewalDate: loan.renewalDate,
    completedOn: input.completedOn,
    newRenewalDate: input.newRenewalDate,
    updatedOutstanding: input.updatedOutstanding ?? null,
    updatedInterestRatePercent: input.updatedInterestRatePercent ?? null,
    ...(input.lenderReference ? { lenderReference: input.lenderReference } : {}),
    ...(input.notes ? { notes: input.notes } : {}),
    recordedAt: context.nowIso,
  };

  const updated: GoldLoan = {
    ...loan,
    renewalDate: input.newRenewalDate,
    outstandingAmount: input.updatedOutstanding ?? loan.outstandingAmount,
    interestRatePercent: input.updatedInterestRatePercent ?? loan.interestRatePercent,
    renewals: [...loan.renewals, record],
    updatedAt: context.nowIso,
  };

  const activity: ActivityLogEntry = {
    id: context.newId(),
    at: context.nowIso,
    kind: 'renewal-recorded',
    loanId: loan.id,
    message: `Renewal recorded${loan.accountRef ? ` for ${loan.accountRef}` : ''}: due ${record.previousRenewalDate} moved to ${record.newRenewalDate}.`,
  };

  return ok({ loan: updated, record, activity });
}

/**
 * A suggestion for the form's "new renewal date" field - only when the user has told us the
 * lender's interval. Returns null otherwise; we never assume a loan renews yearly.
 */
export function suggestNextRenewalDate(loan: Pick<GoldLoan, 'renewalDate' | 'renewalIntervalMonths'>): ISODate | null {
  if (!loan.renewalIntervalMonths || loan.renewalIntervalMonths < 1) return null;
  return addMonths(loan.renewalDate, loan.renewalIntervalMonths);
}
