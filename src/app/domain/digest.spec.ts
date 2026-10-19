import { buildDigest } from './digest';
import { createSeedData } from './seed';

const data = () => createSeedData('2026-10-17T10:00:00.000Z');

describe('buildDigest', () => {
  it('lists what needs action on the reference date, nearest first, with a subject', () => {
    const digest = buildDigest(data(), '2026-10-17')!;
    expect(digest.items.map((i) => i.loanId)).toEqual(['gl-008', 'gl-009', 'gl-012']);
    expect(digest.subject).toBe('Gold loan renewals: 3 due soon');
    expect(digest.text).toContain('29 Oct 2026 (12 days left) - Member C');
    expect(digest.text).toContain('Unassigned — confirm owner');
    expect(digest.text).toContain('Total: ₹');
  });

  it('returns null when nothing needs action', () => {
    expect(buildDigest(data(), '2026-01-01')).toBeNull();
  });

  it('counts overdue and urgent in the subject', () => {
    const d = buildDigest(data(), '2026-11-05')!;
    expect(d.subject).toMatch(/urgent|overdue/);
  });

  it('still includes alerts dismissed in the app', () => {
    const d = data();
    d.settings.dismissedAlertKeys = ['gl-008|2026-10-29|due-soon'];
    expect(buildDigest(d, '2026-10-17')!.items.map((i) => i.loanId)).toContain('gl-008');
  });

  it('escapes HTML in names so a pasted name cannot inject markup', () => {
    const d = data();
    d.members[0]!.fullName = '<img src=x onerror=alert(1)>';
    const loan = d.goldLoans.find((l) => l.id === 'gl-008')!;
    loan.memberId = d.members[0]!.id;
    const html = buildDigest(d, '2026-10-17')!.html;
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('adds the app link only when given', () => {
    expect(buildDigest(data(), '2026-10-17')!.text).not.toContain('Open the app');
    expect(buildDigest(data(), '2026-10-17', 'https://example.com/')!.html).toContain('href="https://example.com/"');
  });
});
