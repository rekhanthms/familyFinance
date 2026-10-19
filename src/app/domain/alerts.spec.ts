import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { alertKey, deriveAlerts } from './alerts';
import { buildRenewalViews, computeRenewalStatus } from './renewal-status';
import { createSeedData, SEED_REFERENCE_DATE } from './seed';

const TODAY = SEED_REFERENCE_DATE;
const seed = createSeedData('2026-10-17T10:00:00+05:30');

describe('in-app alerts', () => {
  const views = buildRenewalViews(seed.goldLoans, TODAY);

  it('raises an alert for every loan needing attention and none for far-off ones', () => {
    const alerts = deriveAlerts(views, new Set());
    expect(alerts.map((a) => a.loanId)).toEqual(['gl-008', 'gl-009', 'gl-012']);
    expect(alerts.every((a) => a.status === 'due-soon')).toBe(true);
  });

  it('covers overdue, due today and urgent as well', () => {
    const loans = [
      { ...seed.goldLoans[0]!, id: 'x1', renewalDate: addDays(TODAY, -3) },
      { ...seed.goldLoans[0]!, id: 'x2', renewalDate: TODAY },
      { ...seed.goldLoans[0]!, id: 'x3', renewalDate: addDays(TODAY, 4) },
    ];
    const statuses = deriveAlerts(buildRenewalViews(loans, TODAY), new Set()).map((a) => a.status);
    expect(statuses).toEqual(['overdue', 'due-today', 'urgent']);
  });

  it('dismissing hides the alert without changing the loan or marking it renewed', () => {
    const first = deriveAlerts(views, new Set())[0]!;
    const remaining = deriveAlerts(views, new Set([first.key]));
    expect(remaining.map((a) => a.loanId)).not.toContain(first.loanId);

    const loan = seed.goldLoans.find((l) => l.id === first.loanId)!;
    expect(loan.renewals).toHaveLength(0);
    expect(computeRenewalStatus(loan, TODAY).status).toBe('due-soon');
  });

  it('a dismissed alert comes back when the status escalates or the date changes', () => {
    const dismissed = new Set([alertKey(views[0]!)]);

    const laterToday = addDays(TODAY, 6); // 29 Oct is now 6 days away -> urgent
    const escalated = deriveAlerts(buildRenewalViews(seed.goldLoans, laterToday), dismissed);
    expect(escalated.map((a) => a.loanId)).toContain('gl-008');

    const moved = seed.goldLoans.map((l) => (l.id === 'gl-008' ? { ...l, renewalDate: '2026-10-30' } : l));
    expect(deriveAlerts(buildRenewalViews(moved, TODAY), dismissed).map((a) => a.loanId)).toContain('gl-008');
  });
});
