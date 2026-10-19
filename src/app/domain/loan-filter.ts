import type { FamilyMember } from './models';
import type { RenewalView } from './renewal-status';
import { STATUS_LABELS, type RenewalStatus } from './renewal-status';
import { jewelrySummary } from './reminders';

export interface LoanFilter {
  query: string;
  status: RenewalStatus | 'all';
}

/** Search matches owner, lender, masked reference, jewellery and notes. Case-insensitive. */
export function filterLoanViews(
  views: readonly RenewalView[],
  members: readonly FamilyMember[],
  filter: LoanFilter,
): RenewalView[] {
  const query = filter.query.trim().toLowerCase();
  return views.filter((view) => {
    if (filter.status !== 'all' && view.status !== filter.status) return false;
    if (!query) return true;
    const loan = view.loan;
    const owner = members.find((m) => m.id === loan.memberId)?.fullName ?? 'unassigned';
    const haystack = [owner, loan.lender, loan.accountRef, jewelrySummary(loan.jewelry), loan.notes, STATUS_LABELS[view.status]]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
}
