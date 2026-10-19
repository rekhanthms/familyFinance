import { isISODate } from './dates';
import { isValidPaise } from './money';
import type { GoldLoan } from './models';

/** Form-level checks for a gold loan. Returns human-readable problems; empty means valid. */
export function validateGoldLoan(
  loan: Pick<
    GoldLoan,
    'recordedAmount' | 'outstandingAmount' | 'interestRatePercent' | 'pledgeDate' | 'renewalDate' | 'renewalIntervalMonths' | 'jewelry'
  >,
): string[] {
  const errors: string[] = [];

  if (!isISODate(loan.renewalDate)) errors.push('Renewal date is required and must be a valid date.');
  if (!isValidPaise(loan.recordedAmount) || loan.recordedAmount <= 0) errors.push('Loan amount must be greater than zero.');
  if (loan.outstandingAmount != null && (!isValidPaise(loan.outstandingAmount) || loan.outstandingAmount < 0)) {
    errors.push('Outstanding amount cannot be negative.');
  }
  if (loan.interestRatePercent != null && (!Number.isFinite(loan.interestRatePercent) || loan.interestRatePercent < 0)) {
    errors.push('Interest rate cannot be negative.');
  }
  if (loan.pledgeDate != null) {
    if (!isISODate(loan.pledgeDate)) errors.push('Pledge date must be a valid date.');
    else if (isISODate(loan.renewalDate) && loan.pledgeDate > loan.renewalDate) {
      errors.push('Pledge date cannot be after the renewal date.');
    }
  }
  if (loan.renewalIntervalMonths != null && (!Number.isInteger(loan.renewalIntervalMonths) || loan.renewalIntervalMonths < 1)) {
    errors.push('Renewal interval must be a whole number of months, 1 or more.');
  }
  if (loan.jewelry.length === 0) errors.push('Add at least one jewelry item.');
  loan.jewelry.forEach((item, index) => {
    if (!item.type.trim()) errors.push(`Jewelry item ${index + 1} needs a type.`);
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      errors.push(`Jewelry item ${index + 1} needs a quantity of 1 or more.`);
    }
  });

  return errors;
}
