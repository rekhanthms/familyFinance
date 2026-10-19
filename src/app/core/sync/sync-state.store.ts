import Dexie, { type Table } from 'dexie';
import type { SyncState, SyncStateStore } from './sync.ports';

/** Separate database from the app's data, so adding sync can never disturb a stored register. */
class SyncDb extends Dexie {
  state!: Table<SyncState & { key: string }, string>;
  constructor() {
    super('family-finance-sync');
    this.version(1).stores({ state: 'key' });
  }
}

export class DexieSyncStateStore implements SyncStateStore {
  private readonly db = new SyncDb();
  async load(): Promise<SyncState | null> {
    const row = await this.db.state.get('main');
    return row ? { base: row.base, version: row.version, syncedAt: row.syncedAt } : null;
  }
  async save(state: SyncState): Promise<void> {
    await this.db.state.put({ key: 'main', ...state });
  }
  async clear(): Promise<void> {
    await this.db.state.clear();
  }
}

export class InMemorySyncStateStore implements SyncStateStore {
  private state: SyncState | null = null;
  async load(): Promise<SyncState | null> {
    return this.state;
  }
  async save(state: SyncState): Promise<void> {
    this.state = state;
  }
  async clear(): Promise<void> {
    this.state = null;
  }
}
