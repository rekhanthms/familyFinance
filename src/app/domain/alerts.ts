import type { ISODate } from './dates';
import { needsAttention, type RenewalStatus, type RenewalView } from './renewal-status';

export interface RenewalAlert {
  /** Identifies this exact warning. Changes if the date changes or the status escalates. */
  key: string;
  loanId: string;
  status: RenewalStatus;
  renewalDate: ISODate;
  daysRemaining: number;
}

export function alertKey(view: Pick<RenewalView, 'loanId' | 'renewalDate' | 'status'>): string {
  return `${view.loanId}|${view.renewalDate}|${view.status}`;
}

/**
 * In-app warnings for: due within 30 days, within 7 days, due today, overdue.
 * Dismissing hides a warning only - it never touches the loan, so a dismissed loan is never "renewed".
 * Because the key includes the status, a dismissed "due soon" warning reappears when it becomes "urgent".
 */
export function deriveAlerts(views: readonly RenewalView[], dismissedKeys: ReadonlySet<string>): RenewalAlert[] {
  return views
    .filter((view) => needsAttention(view.status))
    .map((view) => ({
      key: alertKey(view),
      loanId: view.loanId,
      status: view.status,
      renewalDate: view.renewalDate,
      daysRemaining: view.daysRemaining,
    }))
    .filter((alert) => !dismissedKeys.has(alert.key));
}
