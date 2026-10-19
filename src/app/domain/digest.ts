import type { ISODate } from './dates';
import { formatIndianDate } from './dates';
import { formatINR, type Paise } from './money';
import { goldLoanBalance } from './insights';
import { describeDaysRemaining, jewelrySummary } from './reminders';
import type { FamilyFinanceData } from './models';
import { UNASSIGNED_LABEL } from './models';
import { buildRenewalViews, needsAttention, sortByNearestRenewal, STATUS_LABELS, type RenewalStatus } from './renewal-status';

export interface DigestItem {
  loanId: string;
  status: RenewalStatus;
  renewalDate: ISODate;
  daysRemaining: number;
  ownerName: string;
  accountRef: string | null;
  jewelry: string;
  amount: Paise;
}

export interface Digest {
  items: DigestItem[];
  subject: string;
  text: string;
  html: string;
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * One summary of everything that needs action today, for email or WhatsApp. Pure and shared with the
 * scheduled email job. Returns null when nothing needs action, so no empty "all clear" message is sent.
 * Dismissed in-app alerts are still included: this is the safety net for a warning that was hidden and forgotten.
 */
export function buildDigest(data: FamilyFinanceData, today: ISODate, appUrl?: string): Digest | null {
  const views = buildRenewalViews(data.goldLoans, today, data.settings.renewalThresholds).filter((v) => needsAttention(v.status));
  if (views.length === 0) return null;

  const items: DigestItem[] = sortByNearestRenewal(views.map((v) => ({ ...v, id: v.loanId }))).map((v) => ({
    loanId: v.loanId,
    status: v.status,
    renewalDate: v.renewalDate,
    daysRemaining: v.daysRemaining,
    ownerName: data.members.find((m) => m.id === v.loan.memberId)?.fullName ?? UNASSIGNED_LABEL,
    accountRef: v.loan.accountRef,
    jewelry: jewelrySummary(v.loan.jewelry),
    amount: goldLoanBalance(v.loan).amount,
  }));

  const count = (status: RenewalStatus) => items.filter((i) => i.status === status).length;
  const parts = (['overdue', 'due-today', 'urgent', 'due-soon'] as const)
    .filter((s) => count(s) > 0)
    .map((s) => `${count(s)} ${STATUS_LABELS[s].toLowerCase()}`);
  const subject = `Gold loan renewals: ${parts.join(', ')}`;

  const line = (i: DigestItem) =>
    `${formatIndianDate(i.renewalDate)} (${describeDaysRemaining(i.daysRemaining)}) - ${i.ownerName}${i.accountRef ? ' ' + i.accountRef : ''}\n  ${i.jewelry}, ${formatINR(i.amount)} [${STATUS_LABELS[i.status]}]`;
  const total = items.reduce((sum, i) => sum + i.amount, 0);
  const text = [
    `Gold loan renewals needing action (${formatIndianDate(today)})`,
    '',
    ...items.map(line),
    '',
    `Total: ${formatINR(total)}`,
    ...(appUrl ? ['', `Open the app: ${appUrl}`] : []),
  ].join('\n');

  const rows = items
    .map(
      (i) =>
        `<tr><td>${escapeHtml(formatIndianDate(i.renewalDate))}<br><small>${escapeHtml(describeDaysRemaining(i.daysRemaining))}</small></td>` +
        `<td><strong>${escapeHtml(STATUS_LABELS[i.status])}</strong></td>` +
        `<td>${escapeHtml(i.ownerName)}${i.accountRef ? ' ' + escapeHtml(i.accountRef) : ''}<br><small>${escapeHtml(i.jewelry)}</small></td>` +
        `<td style="text-align:right">${escapeHtml(formatINR(i.amount))}</td></tr>`,
    )
    .join('');
  const html =
    `<div style="font-family:Arial,sans-serif;max-width:36rem"><h2 style="margin:0 0 8px">Gold loan renewals needing action</h2>` +
    `<p style="margin:0 0 12px;color:#565d54">${escapeHtml(formatIndianDate(today))}</p>` +
    `<table style="border-collapse:collapse;width:100%" cellpadding="8">${rows}</table>` +
    `<p><strong>Total: ${escapeHtml(formatINR(total))}</strong></p>` +
    (appUrl ? `<p><a href="${escapeHtml(appUrl)}">Open the app</a></p>` : '') +
    `</div>`;

  return { items, subject, text, html };
}
