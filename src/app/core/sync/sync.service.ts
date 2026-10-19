import { effect, inject, Injectable, signal } from '@angular/core';
import { sameValue, mergeData, type FamilyFinanceData } from '../../domain';
import { AppStore } from '../app.store';
import { CLOCK } from '../tokens';
import type { SyncBackend } from './sync.tokens';
import { SYNC_BACKEND_LOADER, SYNC_STATE_STORE } from './sync.tokens';

export type SyncStatus = 'not-configured' | 'signed-out' | 'idle' | 'syncing' | 'choose' | 'error';

const MAX_ATTEMPTS = 4;
const AUTO_SYNC_DELAY_MS = 4000;

/**
 * Keeps this device and the shared copy in step. Local data is always the working copy: sync never
 * blocks the app, and a failure leaves local data exactly as it was.
 */
@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly store = inject(AppStore);
  private readonly loader = inject(SYNC_BACKEND_LOADER);
  private readonly stateStore = inject(SYNC_STATE_STORE);
  private readonly clock = inject(CLOCK);

  readonly status = signal<SyncStatus>(this.loader ? 'signed-out' : 'not-configured');
  readonly email = signal<string | null>(null);
  readonly lastSyncedAt = signal<string | null>(null);
  readonly error = signal('');
  readonly codeSentTo = signal<string | null>(null);

  private backendPromise: Promise<SyncBackend> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastBase: FamilyFinanceData | null = null;
  private running = false;

  constructor() {
    // Any local change schedules a quiet sync a few seconds later.
    effect(() => {
      const data = this.store.data();
      if (!this.store.loaded() || this.status() !== 'idle' || this.running) return;
      if (this.lastBase && sameValue(data, this.lastBase)) return;
      this.schedule();
    });
  }

  private backend(): Promise<SyncBackend> {
    if (!this.loader) throw new Error('Sync is not set up.');
    return (this.backendPromise ??= this.loader());
  }

  /** Call once after the local data has loaded. */
  async init(): Promise<void> {
    if (!this.loader) return;
    try {
      const { auth } = await this.backend();
      const email = await auth.currentEmail();
      this.email.set(email);
      const saved = await this.stateStore.load();
      this.lastBase = saved?.base ?? null;
      this.lastSyncedAt.set(saved?.syncedAt ?? null);
      if (!email) return this.status.set('signed-out');
      this.status.set('idle');
      await this.syncNow();
    } catch (e) {
      this.fail(e);
    }
  }

  async sendCode(email: string): Promise<void> {
    this.error.set('');
    try {
      await (await this.backend()).auth.sendCode(email.trim());
      this.codeSentTo.set(email.trim());
    } catch (e) {
      this.fail(e, 'signed-out');
    }
  }

  async verifyCode(code: string): Promise<void> {
    const email = this.codeSentTo();
    if (!email) return;
    this.error.set('');
    try {
      await (await this.backend()).auth.verifyCode(email, code);
      this.email.set(email);
      this.codeSentTo.set(null);
      this.status.set('idle');
      await this.syncNow();
    } catch (e) {
      this.fail(e, 'signed-out');
    }
  }

  async signOut(): Promise<void> {
    this.cancelTimer();
    try {
      await (await this.backend()).auth.signOut();
    } finally {
      await this.stateStore.clear();
      this.lastBase = null;
      this.email.set(null);
      this.lastSyncedAt.set(null);
      this.codeSentTo.set(null);
      this.error.set('');
      this.status.set('signed-out');
    }
  }

  /**
   * Pull, merge, push. On a first sync from a device that already holds data, and the shared copy
   * has data too, it stops and asks which to trust instead of guessing.
   */
  async syncNow(options: { combineFirst?: boolean } = {}): Promise<void> {
    if (this.running || !this.loader || !this.email()) return;
    this.running = true;
    this.cancelTimer();
    this.status.set('syncing');
    this.error.set('');
    try {
      const { remote } = await this.backend();
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const local = this.store.data();
        const snapshot = await remote.pull();
        const saved = await this.stateStore.load();

        if (!snapshot) {
          const pushed = await remote.push(local, 0);
          if (!pushed.ok) {
            if (pushed.reason === 'conflict') continue;
            throw new Error(pushed.message);
          }
          await this.remember(local, pushed.version);
          return this.finish();
        }

        if (snapshot.data.schemaVersion !== 1) throw new Error('The shared copy was made by a newer version of the app. Update the app first.');
        if (!saved && !options.combineFirst) {
          this.status.set('choose');
          return;
        }

        const merged = mergeData(saved?.base ?? null, local, snapshot.data);
        let version = snapshot.version;
        if (!sameValue(merged, snapshot.data)) {
          const pushed = await remote.push(merged, snapshot.version);
          if (!pushed.ok) {
            if (pushed.reason === 'conflict') continue;
            throw new Error(pushed.message);
          }
          version = pushed.version;
        }
        if (this.store.data() !== local) continue; // edited while we were syncing: merge again
        if (!sameValue(merged, local)) {
          const applied = await this.store.applySyncedData(merged);
          if (!applied.ok) throw new Error(applied.errors.join(' '));
        }
        await this.remember(merged, version);
        return this.finish();
      }
      throw new Error('Another device kept changing the data. Try again in a moment.');
    } catch (e) {
      this.fail(e);
    } finally {
      this.running = false;
    }
  }

  /** Called when the app returns to the foreground or the network comes back. */
  async onForeground(): Promise<void> {
    if (this.email() && (this.status() === 'idle' || this.status() === 'error')) await this.syncNow();
  }

  /** First sync on a new device: take the shared copy as is. */
  async useSharedCopy(): Promise<void> {
    if (this.running || !this.loader) return;
    this.running = true;
    this.status.set('syncing');
    try {
      const { remote } = await this.backend();
      const snapshot = await remote.pull();
      if (!snapshot) throw new Error('There is no shared copy yet.');
      const applied = await this.store.applySyncedData(snapshot.data);
      if (!applied.ok) throw new Error(applied.errors.join(' '));
      await this.remember(snapshot.data, snapshot.version);
      this.finish();
    } catch (e) {
      this.fail(e);
    } finally {
      this.running = false;
    }
  }

  async combineWithSharedCopy(): Promise<void> {
    await this.syncNow({ combineFirst: true });
  }

  private async remember(base: FamilyFinanceData, version: number): Promise<void> {
    const syncedAt = this.clock.nowIso();
    await this.stateStore.save({ base, version, syncedAt });
    this.lastBase = base;
    this.lastSyncedAt.set(syncedAt);
  }

  private finish(): void {
    this.status.set('idle');
  }

  private fail(e: unknown, status: SyncStatus = 'error'): void {
    this.error.set(friendly(e));
    this.status.set(status === 'error' && !this.email() ? 'signed-out' : status);
  }

  private schedule(): void {
    this.cancelTimer();
    this.timer = setTimeout(() => void this.syncNow(), AUTO_SYNC_DELAY_MS);
  }

  private cancelTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}

function friendly(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return "Couldn't reach the shared copy. You may be offline. Your data on this device is safe and will sync later.";
  }
  return message;
}
