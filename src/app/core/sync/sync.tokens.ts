import { InjectionToken } from '@angular/core';
import { createSupabaseClient, SupabaseAuth, SupabaseRemoteStore } from './supabase.adapter';
import { isSyncConfigured, SYNC_CONFIG } from './sync-config';
import { DexieSyncStateStore, InMemorySyncStateStore } from './sync-state.store';
import type { AuthPort, RemoteStore, SyncStateStore } from './sync.ports';

export interface SyncBackend {
  remote: RemoteStore;
  auth: AuthPort;
}

/** Null when sync isn't set up: the app then works exactly as before. Tests supply a fake. */
export const SYNC_BACKEND_LOADER = new InjectionToken<(() => Promise<SyncBackend>) | null>('SYNC_BACKEND_LOADER', {
  providedIn: 'root',
  factory: () =>
    isSyncConfigured()
      ? async () => {
          const client = await createSupabaseClient(SYNC_CONFIG.url, SYNC_CONFIG.anonKey);
          return { remote: new SupabaseRemoteStore(client), auth: new SupabaseAuth(client) };
        }
      : null,
});

export const SYNC_STATE_STORE = new InjectionToken<SyncStateStore>('SYNC_STATE_STORE', {
  providedIn: 'root',
  factory: () => (typeof indexedDB === 'undefined' ? new InMemorySyncStateStore() : new DexieSyncStateStore()),
});
