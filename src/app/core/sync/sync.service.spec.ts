import { TestBed } from '@angular/core/testing';
import { AppStore } from '../app.store';
import { InMemoryRepositories } from '../storage/in-memory-repositories';
import { CLOCK, REPOSITORIES } from '../tokens';
import { FixedClock, sameValue, type FamilyFinanceData } from '../../domain';
import { InMemorySyncStateStore } from './sync-state.store';
import type { AuthPort, PushResult, RemoteSnapshot, RemoteStore } from './sync.ports';
import { SyncService } from './sync.service';
import { SYNC_BACKEND_LOADER, SYNC_STATE_STORE } from './sync.tokens';

/** Behaves like the database function: refuses a write unless the version matches. */
class FakeRemote implements RemoteStore {
  snapshot: RemoteSnapshot | null = null;
  failNext: string | null = null;
  pushes = 0;
  async pull() {
    if (this.failNext) {
      const m = this.failNext;
      this.failNext = null;
      throw new Error(m);
    }
    return this.snapshot ? { data: JSON.parse(JSON.stringify(this.snapshot.data)), version: this.snapshot.version } : null;
  }
  async push(data: FamilyFinanceData, expected: number): Promise<PushResult> {
    this.pushes++;
    const current = this.snapshot?.version ?? 0;
    if (expected !== current) return { ok: false, reason: 'conflict' };
    this.snapshot = { data: JSON.parse(JSON.stringify(data)), version: current + 1 };
    return { ok: true, version: current + 1 };
  }
}

class FakeAuth implements AuthPort {
  email: string | null = null;
  sentTo: string | null = null;
  async currentEmail() { return this.email; }
  async sendCode(email: string) { this.sentTo = email; }
  async verifyCode(email: string, code: string) {
    if (code !== '123456') throw new Error('Token has expired or is invalid');
    this.email = email;
  }
  async signOut() { this.email = null; }
}

async function device(remote: FakeRemote, auth = new FakeAuth(), state = new InMemorySyncStateStore()) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: REPOSITORIES, useValue: new InMemoryRepositories() },
      { provide: CLOCK, useValue: new FixedClock('2026-10-17') },
      { provide: SYNC_BACKEND_LOADER, useValue: async () => ({ remote, auth }) },
      { provide: SYNC_STATE_STORE, useValue: state },
    ],
  });
  const store = TestBed.inject(AppStore);
  await store.load();
  return { store, sync: TestBed.inject(SyncService), auth, state };
}

describe('SyncService', () => {
  it('is quiet and "not configured" when no backend exists', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: SYNC_BACKEND_LOADER, useValue: null }, { provide: REPOSITORIES, useValue: new InMemoryRepositories() }] });
    const sync = TestBed.inject(SyncService);
    await sync.init();
    expect(sync.status()).toBe('not-configured');
  });

  it('signs in with a code, then uploads this device\'s data the first time', async () => {
    const remote = new FakeRemote();
    const { sync, store } = await device(remote);
    await sync.init();
    expect(sync.status()).toBe('signed-out');
    await sync.sendCode('me@example.com');
    expect(sync.codeSentTo()).toBe('me@example.com');
    await sync.verifyCode('123456');
    expect(sync.status()).toBe('idle');
    expect(remote.snapshot!.version).toBe(1);
    expect(remote.snapshot!.data.goldLoans).toHaveLength(12);
    expect(sameValue(remote.snapshot!.data, store.data())).toBe(true);
  });

  it('shows a clear error for a wrong code and stays signed out', async () => {
    const { sync } = await device(new FakeRemote());
    await sync.sendCode('me@example.com');
    await sync.verifyCode('000000');
    expect(sync.status()).toBe('signed-out');
    expect(sync.error()).toContain('invalid');
  });

  it('asks before touching a device that has data when a shared copy exists', async () => {
    const remote = new FakeRemote();
    const a = await device(remote, Object.assign(new FakeAuth(), { email: 'a@x.com' }));
    await a.sync.init();
    const phone = await device(remote, Object.assign(new FakeAuth(), { email: 'a@x.com' }));
    await phone.sync.init();
    expect(phone.sync.status()).toBe('choose');
    expect(remote.snapshot!.version).toBe(1); // nothing was pushed
  });

  it('a new device can adopt the shared copy', async () => {
    const remote = new FakeRemote();
    const pc = await device(remote, Object.assign(new FakeAuth(), { email: 'a@x.com' }));
    await pc.sync.init();
    await pc.store.deleteGoldLoan('gl-003');
    await pc.sync.syncNow();
    const phone = await device(remote, Object.assign(new FakeAuth(), { email: 'a@x.com' }));
    await phone.sync.init();
    await phone.sync.useSharedCopy();
    expect(phone.store.data().goldLoans).toHaveLength(11);
    expect(phone.sync.status()).toBe('idle');
  });

  it('changes made on two devices both survive', async () => {
    const remote = new FakeRemote();
    const email = { email: 'a@x.com' };
    const pc = await device(remote, Object.assign(new FakeAuth(), email));
    await pc.sync.init(); // uploads
    const phone = await device(remote, Object.assign(new FakeAuth(), email));
    await phone.sync.init();
    await phone.sync.useSharedCopy();

    const loanA = phone.store.data().goldLoans.find((l) => l.id === 'gl-001')!;
    await phone.store.saveGoldLoan({ ...loanA, notes: 'from phone' });
    await phone.sync.syncNow();

    // back on the PC, which has its own unsynced edit
    const pc2 = await device(remote, Object.assign(new FakeAuth(), email), new InMemorySyncStateStore());
    await pc2.sync.init();
    await pc2.sync.useSharedCopy();
    const loanB = pc2.store.data().goldLoans.find((l) => l.id === 'gl-002')!;
    await pc2.store.saveGoldLoan({ ...loanB, notes: 'from pc' });
    await pc2.sync.syncNow();

    await phone.sync.syncNow();
    const onPhone = phone.store.data().goldLoans;
    expect(onPhone.find((l) => l.id === 'gl-001')!.notes).toBe('from phone');
    expect(onPhone.find((l) => l.id === 'gl-002')!.notes).toBe('from pc');
  });

  it('retries after a version conflict instead of overwriting the other device', async () => {
    const remote = new FakeRemote();
    const { sync, store } = await device(remote, Object.assign(new FakeAuth(), { email: 'a@x.com' }));
    await sync.init();
    const other = JSON.parse(JSON.stringify(remote.snapshot!.data)) as FamilyFinanceData;
    other.goldLoans.find((l) => l.id === 'gl-005')!.notes = 'other device';
    other.goldLoans.find((l) => l.id === 'gl-005')!.updatedAt = '2099-01-01T00:00:00.000Z';
    // Sneak in a newer remote version just before our push.
    const realPush = remote.push.bind(remote);
    let first = true;
    remote.push = async (d, v) => {
      if (first) {
        first = false;
        remote.snapshot = { data: other, version: remote.snapshot!.version + 1 };
      }
      return realPush(d, v);
    };
    const loan = store.data().goldLoans.find((l) => l.id === 'gl-001')!;
    await store.saveGoldLoan({ ...loan, notes: 'mine' });
    await sync.syncNow();
    expect(sync.status()).toBe('idle');
    expect(store.data().goldLoans.find((l) => l.id === 'gl-005')!.notes).toBe('other device');
    expect(remote.snapshot!.data.goldLoans.find((l) => l.id === 'gl-001')!.notes).toBe('mine');
  });

  it('an offline failure leaves local data untouched and says so', async () => {
    const remote = new FakeRemote();
    const { sync, store } = await device(remote, Object.assign(new FakeAuth(), { email: 'a@x.com' }));
    await sync.init();
    const before = JSON.stringify(store.data());
    remote.failNext = 'Failed to fetch';
    await sync.syncNow();
    expect(sync.status()).toBe('error');
    expect(sync.error()).toContain('offline');
    expect(JSON.stringify(store.data())).toBe(before);
    await sync.syncNow();
    expect(sync.status()).toBe('idle');
  });

  it('sign out forgets the sync state so the next sign-in asks again', async () => {
    const remote = new FakeRemote();
    const { sync, state } = await device(remote, Object.assign(new FakeAuth(), { email: 'a@x.com' }));
    await sync.init();
    expect(await state.load()).not.toBeNull();
    await sync.signOut();
    expect(await state.load()).toBeNull();
    expect(sync.status()).toBe('signed-out');
  });
});
