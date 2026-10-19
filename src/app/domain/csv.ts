import type { ISODate } from './dates';
import { UNASSIGNED_LABEL, type FamilyMember, type GoldLoan, type RenewalThresholds } from './models';
import { goldLoanBalance } from './insights';
import { buildRenewalViews, DEFAULT_RENEWAL_THRESHOLDS, STATUS_LABELS } from './renewal-status';
import { jewelrySummary } from './reminders';

/**
 * Quotes a CSV cell and defuses spreadsheet formulas: a cell starting with = + - @ would be
 * executed by Excel, so it is prefixed with an apostrophe.
 */
export function csvCell(value: string | number | null | undefined): string {
  let text = value == null ? '' : String(value);
  if (typeof value === 'string' && /^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const GOLD_LOAN_CSV_HEADER = [
  'Loan ID',
  'Owner',
  'Account ref',
  'Jewelry',
  'Recorded amount (INR)',
  'Outstanding amount (INR)',
  'Renewal date',
  'Days remaining',
  'Status',
  'Verification',
  'Notes',
] as const;

export function goldLoansToCsv(
  loans: readonly GoldLoan[],
  members: readonly FamilyMember[],
  today: ISODate,
  thresholds: RenewalThresholds = DEFAULT_RENEWAL_THRESHOLDS,
): string {
  const rows = buildRenewalViews(loans, today, thresholds).map((view) => {
    const loan = view.loan;
    const owner = members.find((m) => m.id === loan.memberId)?.fullName ?? UNASSIGNED_LABEL;
    return [
      loan.id,
      owner,
      loan.accountRef,
      jewelrySummary(loan.jewelry),
      loan.recordedAmount / 100,
      loan.outstandingAmount == null ? '' : goldLoanBalance(loan).amount / 100,
      loan.renewalDate,
      view.daysRemaining,
      STATUS_LABELS[view.status],
      loan.verification === 'verified' ? 'Verified' : 'Needs verification',
      loan.notes ?? '',
    ].map(csvCell);
  });
  return [GOLD_LOAN_CSV_HEADER.map(csvCell), ...rows].map((row) => row.join(',')).join('\r\n');
}
