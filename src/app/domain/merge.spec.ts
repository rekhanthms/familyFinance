import type { FamilyFinanceData, GoldLoan } from './models';
import { mergeData, mergeList, stableStringify } from './merge';
import { createSeedData } from './seed';

const T0 = '2026-10-17T10:00:00.000Z';
const T1 = '2026-10-17T11:00:00.000Z';
const T2 = '2026-10-17T12:00:00.000Z';

const seed = () => createSeedData(T0);
const clone = (d: FamilyFinanceData): FamilyFinanceData => JSON.parse(JSON.stringify(d));
const edit = (d: FamilyFinanceData, id: string, changes: Partial<GoldLoan>, at: string) => {
  const loan = d.goldLoans.find((l) => l.id === id)!;
  Object.assign(loan, changes, { updatedAt: at });
};

describe('stableStringify', () => {
  it('ignores key order, as after a Postgres jsonb round trip', () => {
    expect(stableStringify({ a: 1, b: { c: 2, d: 3 } })).toBe(stableStringify({ b: { d: 3, c: 2 }, a: 1 }));
  });
  it('treats undefined and a missing key the same', () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe(stableStringify({ a: 1 }));
  });
});

describe('mergeData', () => {
  it('keeps both devices\' edits when they touch different loans', () => {
    const base = seed();
    const local = clone(base);
    const remote = clone(base);
    edit(local, 'gl-001', { notes: 'phone edit' }, T1);
    edit(remote, 'gl-002', { notes: 'pc edit' }, T1);
    const merged = mergeData(base, local, remote);
    expect(merged.goldLoans.find((l) => l.id === 'gl-001')!.notes).toBe('phone edit');
    expect(merged.goldLoans.find((l) => l.id === 'gl-002')!.notes).toBe('pc edit');
    expect(merged.goldLoans).toHaveLength(12);
  });

  it('newer edit wins when both devices changed the same loan', () => {
    const base = seed();
    const local = clone(base);
    const remote = clone(base);
    edit(local, 'gl-001', { notes: 'older' }, T1);
    edit(remote, 'gl-001', { notes: 'newer' }, T2);
    expect(mergeData(base, local, remote).goldLoans.find((l) => l.id === 'gl-001')!.notes).toBe('newer');
  });

  it('a renewal recorded on one device reaches the other', () => {
    const base = seed();
    const local = clone(base);
    const remote = clone(base);
    edit(remote, 'gl-008', { renewalDate: '2027-10-29' }, T1);
    expect(mergeData(base, local, remote).goldLoans.find((l) => l.id === 'gl-008')!.renewalDate).toBe('2027-10-29');
  });

  it('a delete on one device propagates when the other did not touch it', () => {
    const base = seed();
    const local = clone(base);
    local.goldLoans = local.goldLoans.filter((l) => l.id !== 'gl-003');
    const merged = mergeData(base, local, clone(base));
    expect(merged.goldLoans.map((l) => l.id)).not.toContain('gl-003');
    const reverse = mergeData(base, clone(base), local);
    expect(reverse.goldLoans.map((l) => l.id)).not.toContain('gl-003');
  });

  it('an edit beats a delete, so work is never lost', () => {
    const base = seed();
    const local = clone(base);
    const remote = clone(base);
    local.goldLoans = local.goldLoans.filter((l) => l.id !== 'gl-003');
    edit(remote, 'gl-003', { notes: 'still needed' }, T1);
    expect(mergeData(base, local, remote).goldLoans.find((l) => l.id === 'gl-003')!.notes).toBe('still needed');
  });

  it('keeps loans added on both devices', () => {
    const base = seed();
    const local = clone(base);
    const remote = clone(base);
    local.goldLoans.push({ ...local.goldLoans[0]!, id: 'gl-new-a', updatedAt: T1 });
    remote.goldLoans.push({ ...remote.goldLoans[0]!, id: 'gl-new-b', updatedAt: T1 });
    expect(mergeData(base, local, remote).goldLoans).toHaveLength(14);
  });

  it('moves a loan to Unassigned if its owner was removed on the other device', () => {
    const base = seed();
    const local = clone(base);
    const remote = clone(base);
    remote.members = remote.members.filter((m) => m.id !== 'm-pillai');
    edit(local, 'gl-001', { notes: 'x' }, T1);
    const loansOfPillai = base.goldLoans.filter((l) => l.memberId === 'm-pillai').map((l) => l.id);
    const merged = mergeData(base, local, remote);
    expect(merged.members.map((m) => m.id)).not.toContain('m-pillai');
    for (const id of loansOfPillai) expect(merged.goldLoans.find((l) => l.id === id)!.memberId).toBeNull();
  });

  it('first sync (no base) combines both sides without losing anything', () => {
    const local = seed();
    const remote = clone(local);
    local.goldLoans.push({ ...local.goldLoans[0]!, id: 'only-local', updatedAt: T1 });
    remote.goldLoans.push({ ...remote.goldLoans[0]!, id: 'only-remote', updatedAt: T1 });
    const merged = mergeData(null, local, remote);
    expect(merged.goldLoans.map((l) => l.id)).toEqual(expect.arrayContaining(['only-local', 'only-remote']));
    expect(merged.goldLoans).toHaveLength(14);
  });

  it('settings: dismissed alerts combine, the later backup time wins, one-sided changes apply', () => {
    const base = seed();
    const local = clone(base);
    const remote = clone(base);
    local.settings.dismissedAlertKeys = ['a|1|x'];
    remote.settings.dismissedAlertKeys = ['b|2|y'];
    local.settings.lastBackupAt = T1;
    remote.settings.lastBackupAt = T2;
    remote.settings.monthlyIncome = 10_000_000;
    const merged = mergeData(base, local, remote);
    expect(merged.settings.dismissedAlertKeys).toEqual(['a|1|x', 'b|2|y']);
    expect(merged.settings.lastBackupAt).toBe(T2);
    expect(merged.settings.monthlyIncome).toBe(10_000_000);
  });

  it('activity entries from both sides are kept once, in time order', () => {
    const base = seed();
    const local = clone(base);
    const remote = clone(base);
    local.activity.push({ id: 'a2', at: T2, kind: 'loan-updated', message: 'later' });
    remote.activity.push({ id: 'a1', at: T1, kind: 'loan-updated', message: 'earlier' });
    local.activity.push({ id: 'a1', at: T1, kind: 'loan-updated', message: 'earlier' });
    expect(mergeData(base, local, remote).activity.map((a) => a.id)).toEqual(['a1', 'a2']);
  });

  it('merging identical data changes nothing', () => {
    const base = seed();
    expect(stableStringify(mergeData(base, clone(base), clone(base)))).toBe(stableStringify(base));
  });

  it('is symmetric when changes do not overlap', () => {
    const base = seed();
    const a = clone(base);
    const b = clone(base);
    edit(a, 'gl-001', { notes: 'a' }, T1);
    edit(b, 'gl-002', { notes: 'b' }, T1);
    expect(stableStringify(mergeData(base, a, b))).toBe(stableStringify(mergeData(base, b, a)));
  });
});

describe('mergeList', () => {
  it('car loan appearing on one side is kept', () => {
    const base = seed();
    const local = clone(base);
    local.carLoan = null;
    const merged = mergeData(base, local, clone(base));
    expect(merged.carLoan).toBeNull(); // deleted locally, untouched remotely
  });
  it('same-timestamp conflict is decided in favour of this device', () => {
    const item = { id: 'x', updatedAt: T1 };
    const merged = mergeList([{ id: 'x', updatedAt: T0 }], [{ ...item, v: 'local' }], [{ ...item, v: 'remote' }] as never);
    expect((merged[0] as { v?: string }).v).toBe('local');
  });
});
