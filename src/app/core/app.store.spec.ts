import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import {
  FixedClock,
  rupeesToPaise,
  type AppRepositories,
  type GoldLoan,
  type RenewalInput,
} from '../domain';
import { AppStore } from './app.store';
import { InMemoryRepositories } from './storage/in-memory-repositories';
import { CLOCK, ID_GENERATOR, REPOSITORIES } from './tokens';

class MutableClock extends FixedClock {
  setDate(date: string): void {
    this.date = date;
  }
}

function setup(options: { repos?: AppRepositories; clock?: MutableClock } = {}) {
  const repos = options.repos ?? new InMemoryRepositories();
  const clock = options.clock ?? new MutableClock('2026-10-17');
  let counter = 0;
  TestBed.configureTestingModule({
    providers: [
      { provide: REPOSITORIES, useValue: repos },
      { provide: CLOCK, useValue: clock },
      { provide: ID_GENERATOR, useValue: () => `id-${++counter}` },
    ],
  });
  return { store: TestBed.inject(AppStore), repos, clock };
}

async function loaded(options: Parameters<typeof setup>[0] = {}) {
  const ctx = setup(options);
  await ctx.store.load();
  return ctx;
}

const loanOf = (store: { data: () => { goldLoans: GoldLoan[] } }, id: string): GoldLoan =>
  store.data().goldLoans.find((l) => l.id === id)!;

const renewalInput = (overrides: Partial<RenewalInput> = {}): RenewalInput => ({
  loanId: 'gl-008',
  previousRenewalDate: '2026-10-29',
  completedOn: '2026-10-17',
  newRenewalDate: '2027-10-29',
  ...overrides,
});

describe('AppStore: first run', () => {
  it('seeds the register once, saves it, and computes the dashboard figures', async () => {
    const { store, repos } = setup();
    expect(store.loaded()).toBe(false);
    expect(store.data().goldLoans).toHaveLength(0);

    await store.load();

    expect(store.loaded()).toBe(true);
    expect(store.backend()).toBe('memory');
    expect(store.data().goldLoans).toHaveLength(12);
    expect((await repos.loadAll()).goldLoans).toHaveLength(12);

    expect(store.statusCounts()).toMatchObject({ overdue: 0, urgent: 0, 'due-soon': 3, upcoming: 9 });
    expect(store.urgentRenewals().map((v) => v.loanId)).toEqual(['gl-008', 'gl-009', 'gl-012']);
    expect(store.alerts()).toHaveLength(3);
    expect(store.goldTotal().total).toBe(rupeesToPaise(18_82_000));
    expect(store.hasUnassignedLoans()).toBe(true);
    expect(store.registerCheck()!.difference).toBe(rupeesToPaise(1_00_000));
    expect(store.netWorth().totalLiabilities).toBe(rupeesToPaise(18_82_000 + 3_00_000));
  });

  it('does not bring the demo data back after the user deletes everything', async () => {
    const first = await loaded();
    for (const loan of [...first.store.data().goldLoans]) await first.store.deleteGoldLoan(loan.id);
    expect(first.store.data().goldLoans).toHaveLength(0);

    TestBed.resetTestingModule();
    const second = setup({ repos: first.repos });
    await second.store.load();

    expect(second.store.data().goldLoans).toHaveLength(0);
    expect(second.store.data().members).toHaveLength(4);
  });

  it('reports a storage failure on open instead of crashing', async () => {
    const repos = new InMemoryRepositories();
    vi.spyOn(repos, 'isInitialised').mockRejectedValue(new Error('blocked'));
    const { store } = setup({ repos });
    await store.load();
    expect(store.loaded()).toBe(false);
    expect(store.loading()).toBe(false);
    expect(store.error()).toContain('blocked');
  });
});

describe('AppStore: gold loans', () => {
  it('changing a renewal date immediately changes status and dashboard position, and is saved', async () => {
    const { store, repos } = await loaded();
    expect(store.renewalViews().findIndex((v) => v.loanId === 'gl-010')).toBe(9);

    const result = await store.saveGoldLoan({ ...loanOf(store, 'gl-010'), renewalDate: '2026-10-20' });

    expect(result.ok).toBe(true);
    expect(store.renewalViews()[0]!.loanId).toBe('gl-010');
    expect(store.renewalViews()[0]!.status).toBe('urgent');
    expect(store.urgentRenewals()[0]!.loanId).toBe('gl-010');
    expect((await repos.goldLoans.get('gl-010'))!.renewalDate).toBe('2026-10-20');
    expect(store.data().activity.at(-1)!.kind).toBe('loan-updated');
  });

  it('rejects an invalid loan and changes nothing', async () => {
    const { store, repos } = await loaded();
    const before = store.data();

    const result = await store.saveGoldLoan({ ...loanOf(store, 'gl-010'), renewalDate: '' });

    expect(result.ok).toBe(false);
    expect(store.data()).toBe(before);
    expect((await repos.goldLoans.get('gl-010'))!.renewalDate).toBe('2027-09-04');
  });

  it('adds a new loan', async () => {
    const { store } = await loaded();
    const template = loanOf(store, 'gl-001');
    const result = await store.saveGoldLoan({ ...template, id: store.newId(), memberId: 'm-d' });

    expect(result.ok).toBe(true);
    expect(store.data().goldLoans).toHaveLength(13);
    expect(store.data().activity.at(-1)!.kind).toBe('loan-created');
  });

  it('deletes a loan and forgets its dismissed alerts', async () => {
    const { store, repos } = await loaded();
    const key = store.alerts()[0]!.key;
    await store.dismissAlert(key);
    expect(store.data().settings.dismissedAlertKeys).toContain(key);

    await store.deleteGoldLoan('gl-008');

    expect(store.data().goldLoans.some((l) => l.id === 'gl-008')).toBe(false);
    expect(await repos.goldLoans.get('gl-008')).toBeUndefined();
    expect(store.data().settings.dismissedAlertKeys).not.toContain(key);
    expect(store.data().activity.at(-1)!.kind).toBe('loan-deleted');
  });

  it('keeps the screen unchanged when saving to storage fails', async () => {
    const repos = new InMemoryRepositories();
    const { store } = await loaded({ repos });
    vi.spyOn(repos.goldLoans, 'save').mockRejectedValue(new Error('disk full'));
    const before = store.data();

    const result = await store.saveGoldLoan({ ...loanOf(store, 'gl-010'), renewalDate: '2026-10-20' });

    expect(result.ok).toBe(false);
    expect(store.data()).toBe(before);
    expect(store.error()).toContain('disk full');
  });
});

describe('AppStore: renewals and alerts', () => {
  it('records a renewal: new date, history, activity, status and position all update, and it is saved', async () => {
    const { store, repos } = await loaded();

    const result = await store.recordRenewal(renewalInput());

    expect(result.ok).toBe(true);
    const loan = loanOf(store, 'gl-008');
    expect(loan.renewalDate).toBe('2027-10-29');
    expect(loan.renewals).toHaveLength(1);
    expect(store.renewalViews().find((v) => v.loanId === 'gl-008')!.status).toBe('renewed');
    expect(store.renewalViews()[0]!.loanId).not.toBe('gl-008');
    expect(store.statusCounts().renewed).toBe(1);
    expect(store.data().activity.at(-1)!.kind).toBe('renewal-recorded');

    const saved = (await repos.goldLoans.get('gl-008'))!;
    expect(saved.renewalDate).toBe('2027-10-29');
    expect(saved.renewals[0]!.previousRenewalDate).toBe('2026-10-29');
  });

  it('refuses an invalid renewal and changes nothing', async () => {
    const { store } = await loaded();
    const before = store.data();
    const result = await store.recordRenewal(renewalInput({ previousRenewalDate: '2026-10-28' }));
    expect(result.ok).toBe(false);
    expect(store.data()).toBe(before);
  });

  it('dismissing an alert hides the warning but never renews the loan, and is saved', async () => {
    const { store, repos } = await loaded();
    const key = store.alerts().find((a) => a.loanId === 'gl-008')!.key;

    await store.dismissAlert(key);
    await store.dismissAlert(key); // twice is harmless

    expect(store.alerts().map((a) => a.loanId)).toEqual(['gl-009', 'gl-012']);
    expect(loanOf(store, 'gl-008').renewals).toHaveLength(0);
    expect(store.renewalViews().find((v) => v.loanId === 'gl-008')!.status).toBe('due-soon');
    expect((await repos.loadAll()).settings.dismissedAlertKeys).toEqual([key]);
  });

  it('a dismissed warning returns when the loan becomes urgent', async () => {
    const { store, clock } = await loaded();
    await store.dismissAlert(store.alerts().find((a) => a.loanId === 'gl-008')!.key);
    expect(store.alerts().some((a) => a.loanId === 'gl-008')).toBe(false);

    clock.setDate('2026-10-23'); // 29 Oct is now 6 days away
    store.refreshToday();

    const again = store.alerts().find((a) => a.loanId === 'gl-008')!;
    expect(again.status).toBe('urgent');
  });

  it('statuses follow the real date when the day changes, and passed dates are overdue, not renewed', async () => {
    const { store, clock } = await loaded();
    clock.setDate('2026-11-20');
    store.refreshToday();

    expect(store.statusCounts().overdue).toBe(3); // 29 Oct and both 11 Nov loans
    expect(store.statusCounts().renewed).toBe(0);
    expect(store.renewalViews()[0]!.daysRemaining).toBe(-22);
    expect(store.renewalViews()[0]!.status).toBe('overdue');
  });
});

describe('AppStore: members', () => {
  it('adds a member and rejects a blank name', async () => {
    const { store } = await loaded();
    expect((await store.saveMember({ id: store.newId(), fullName: '  ', color: '#000000', updatedAt: '' })).ok).toBe(false);
    const added = await store.saveMember({ id: store.newId(), fullName: ' New Person ', color: '#123456', updatedAt: '' });
    expect(added.ok).toBe(true);
    expect(store.data().members.at(-1)!.fullName).toBe('New Person');
  });

  it('removing a member keeps their loans as unassigned', async () => {
    const { store, repos } = await loaded();

    const result = await store.removeMember('m-b');

    expect(result).toEqual({ ok: true, value: { reassignedLoans: 4 } });
    expect(store.data().members.some((m) => m.id === 'm-b')).toBe(false);
    expect(store.data().goldLoans).toHaveLength(12);
    expect(store.data().goldLoans.filter((l) => l.memberId === null)).toHaveLength(6);
    expect((await repos.goldLoans.get('gl-004'))!.memberId).toBeNull();
    expect(await repos.members.get('m-b')).toBeUndefined();
  });
});

describe('AppStore: settings, assets and car loan', () => {
  it('changes thresholds and recalculates statuses; rejects nonsense', async () => {
    const { store } = await loaded();
    expect((await store.updateSettings({ renewalThresholds: { dueSoonDays: 5, urgentDays: 7, renewedBadgeDays: 30 } })).ok).toBe(false);
    expect(store.statusCounts()['due-soon']).toBe(3);

    const ok = await store.updateSettings({ renewalThresholds: { dueSoonDays: 60, urgentDays: 7, renewedBadgeDays: 30 } });
    expect(ok.ok).toBe(true);
    expect(store.statusCounts()['due-soon']).toBe(4); // 9 Dec is 53 days away
  });

  it('adds and removes assets and liabilities; net worth follows', async () => {
    const { store } = await loaded();
    const asset = await store.saveAsset({
      id: store.newId(),
      updatedAt: '',
      kind: 'savings',
      name: 'Savings',
      ownerMemberId: null,
      estimatedValue: rupeesToPaise(5_00_000),
      valuationDate: null,
    });
    expect(asset.ok).toBe(true);
    expect(store.netWorth().totalAssets).toBe(rupeesToPaise(5_00_000));

    const liability = await store.saveLiability({
      id: store.newId(),
      updatedAt: '',
      kind: 'personal-loan',
      name: 'Personal loan',
      ownerMemberId: null,
      outstanding: rupeesToPaise(1_00_000),
      monthlyPayment: rupeesToPaise(4_000),
    });
    expect(liability.ok).toBe(true);
    expect(store.netWorth().otherLiabilities).toBe(rupeesToPaise(1_00_000));
    expect(store.obligations().total).toBe(rupeesToPaise(4_000));

    if (asset.ok) await store.deleteAsset(asset.value.id);
    if (liability.ok) await store.deleteLiability(liability.value.id);
    expect(store.netWorth().totalAssets).toBe(0);
    expect(store.netWorth().otherLiabilities).toBe(0);
  });

  it('rejects an asset with no name or a negative value', async () => {
    const { store } = await loaded();
    const base = { id: 'a', updatedAt: '', kind: 'savings', ownerMemberId: null, valuationDate: null } as const;
    expect((await store.saveAsset({ ...base, name: '', estimatedValue: 100 })).ok).toBe(false);
    expect((await store.saveAsset({ ...base, name: 'x', estimatedValue: -1 })).ok).toBe(false);
  });

  it('saves car loan terms and reports the monthly commitment once the EMI is known', async () => {
    const { store } = await loaded();
    expect(store.obligations()).toEqual({ total: 0, hasUnknownEmi: true });

    await store.saveCarLoan({ ...store.data().carLoan!, emi: rupeesToPaise(9_500) });

    expect(store.obligations()).toEqual({ total: rupeesToPaise(9_500), hasUnknownEmi: false });
  });
});

describe('AppStore: backup, restore, reset', () => {
  it('exports a backup, records when, and restores exactly that state later', async () => {
    const { store, repos } = await loaded();
    const exported = await store.exportBackup();
    expect(exported.ok).toBe(true);
    expect(store.data().settings.lastBackupAt).not.toBeNull();
    expect((await repos.loadAll()).settings.lastBackupAt).not.toBeNull();
    if (!exported.ok) return;

    await store.deleteGoldLoan('gl-001');
    await store.deleteGoldLoan('gl-002');
    expect(store.data().goldLoans).toHaveLength(10);

    const restored = await store.restoreBackup(exported.value);

    expect(restored.ok).toBe(true);
    expect(store.data().goldLoans).toHaveLength(12);
    expect((await repos.loadAll()).goldLoans).toHaveLength(12);
    expect(store.data().activity.at(-1)!.kind).toBe('data-restored');
  });

  it('a bad backup file changes nothing', async () => {
    const { store, repos } = await loaded();
    const before = store.data();

    const result = await store.restoreBackup('{"not":"a backup"}');

    expect(result.ok).toBe(false);
    expect(store.data()).toBe(before);
    expect((await repos.loadAll()).goldLoans).toHaveLength(12);
  });

  it('can go back to the demo register or start completely empty', async () => {
    const { store } = await loaded();
    await store.startEmpty();
    expect(store.data().goldLoans).toHaveLength(0);
    expect(store.data().members).toHaveLength(0);

    await store.resetToDemo();
    expect(store.data().goldLoans).toHaveLength(12);
  });
});
