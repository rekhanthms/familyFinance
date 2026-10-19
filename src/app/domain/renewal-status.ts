import { daysBetween, type ISODate } from './dates';
import type { GoldLoan, RenewalRecord, RenewalThresholds } from './models';

export type RenewalStatus = 'overdue' | 'due-today' | 'urgent' | 'due-soon' | 'renewed' | 'upcoming';

export const DEFAULT_RENEWAL_THRESHOLDS: RenewalThresholds = {
  dueSoonDays: 30,
  urgentDays: 7,
  renewedBadgeDays: 30,
};

export const STATUS_LABELS: Record<RenewalStatus, string> = {
  overdue: 'Overdue',
  'due-today': 'Due today',
  urgent: 'Urgent',
  'due-soon': 'Due soon',
  renewed: 'Renewed',
  upcoming: 'Upcoming',
};

/** Lower number = needs attention sooner. */
export const STATUS_PRIORITY: Record<RenewalStatus, number> = {
  overdue: 0,
  'due-today': 1,
  urgent: 2,
  'due-soon': 3,
  renewed: 4,
  upcoming: 5,
};

const ATTENTION_STATUSES: readonly RenewalStatus[] = ['overdue', 'due-today', 'urgent', 'due-soon'];

export function needsAttention(status: RenewalStatus): boolean {
  return ATTENTION_STATUSES.includes(status);
}

/** Returns a list of problems; empty means the thresholds are usable. */
export function validateThresholds(t: RenewalThresholds): string[] {
  const errors: string[] = [];
  const isWholeNumber = (n: number) => Number.isInteger(n);
  if (!isWholeNumber(t.urgentDays) || t.urgentDays < 1) errors.push('Urgent days must be a whole number of at least 1.');
  if (!isWholeNumber(t.dueSoonDays) || t.dueSoonDays <= t.urgentDays) {
    errors.push('Due-soon days must be a whole number greater than the urgent days.');
  }
  if (!isWholeNumber(t.renewedBadgeDays) || t.renewedBadgeDays < 0) {
    errors.push('Renewed badge days must be a whole number, 0 or more.');
  }
  return errors;
}

/** The most recently completed renewal, or null if none has been recorded. */
export function latestRenewal(loan: Pick<GoldLoan, 'renewals'>): RenewalRecord | null {
  let latest: RenewalRecord | null = null;
  for (const record of loan.renewals) {
    if (
      !latest ||
      record.completedOn > latest.completedOn ||
      (record.completedOn === latest.completedOn && record.recordedAt > latest.recordedAt)
    ) {
      latest = record;
    }
  }
  return latest;
}

/** Derived, never stored: the date of the last renewal the user actually recorded. */
export function lastConfirmedRenewalDate(loan: Pick<GoldLoan, 'renewals'>): ISODate | null {
  return latestRenewal(loan)?.completedOn ?? null;
}

export interface RenewalResult {
  status: RenewalStatus;
  /** Negative when overdue. */
  daysRemaining: number;
  renewalDate: ISODate;
  /** Only set when status is "renewed": the next due date to show beside the badge. */
  nextRenewalDate: ISODate | null;
}

/**
 * Status is always computed from the current renewal date and "today" - never stored.
 * A passed date is never treated as renewed; only a recorded renewal can produce "renewed".
 */
export function computeRenewalStatus(
  loan: Pick<GoldLoan, 'renewalDate' | 'renewals'>,
  today: ISODate,
  thresholds: RenewalThresholds = DEFAULT_RENEWAL_THRESHOLDS,
): RenewalResult {
  const daysRemaining = daysBetween(today, loan.renewalDate);
  const result = (status: RenewalStatus, nextRenewalDate: ISODate | null = null): RenewalResult => ({
    status,
    daysRemaining,
    renewalDate: loan.renewalDate,
    nextRenewalDate,
  });

  if (daysRemaining < 0) return result('overdue');
  if (daysRemaining === 0) return result('due-today');
  if (daysRemaining <= thresholds.urgentDays) return result('urgent');

  const latest = latestRenewal(loan);
  if (latest) {
    const daysSinceRenewal = daysBetween(latest.completedOn, today);
    if (daysSinceRenewal >= 0 && daysSinceRenewal <= thresholds.renewedBadgeDays) {
      return result('renewed', loan.renewalDate);
    }
  }

  if (daysRemaining <= thresholds.dueSoonDays) return result('due-soon');
  return result('upcoming');
}

export interface RenewalView extends RenewalResult {
  loanId: string;
  loan: GoldLoan;
}

/** Stable sort: nearest (or most overdue) date first; ties broken by loan id. */
export function sortByNearestRenewal<T extends { renewalDate: ISODate; id: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) =>
    a.renewalDate === b.renewalDate ? a.id.localeCompare(b.id) : a.renewalDate < b.renewalDate ? -1 : 1,
  );
}

export function buildRenewalViews(
  loans: readonly GoldLoan[],
  today: ISODate,
  thresholds: RenewalThresholds = DEFAULT_RENEWAL_THRESHOLDS,
): RenewalView[] {
  return sortByNearestRenewal(loans).map((loan) => ({
    ...computeRenewalStatus(loan, today, thresholds),
    loanId: loan.id,
    loan,
  }));
}

export function countByStatus(views: readonly RenewalView[]): Record<RenewalStatus, number> {
  const counts: Record<RenewalStatus, number> = {
    overdue: 0,
    'due-today': 0,
    urgent: 0,
    'due-soon': 0,
    renewed: 0,
    upcoming: 0,
  };
  for (const view of views) counts[view.status] += 1;
  return counts;
}

/** What the dashboard shows first, above any chart: items needing action, nearest first. */
export function urgentRenewals(views: readonly RenewalView[]): RenewalView[] {
  return views.filter((view) => needsAttention(view.status));
}
