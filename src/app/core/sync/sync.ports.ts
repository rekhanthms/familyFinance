import type { FamilyFinanceData } from '../../domain';

/** The shared copy of the family's data. One snapshot, guarded by a version number. */
export interface RemoteSnapshot {
  data: FamilyFinanceData;
  version: number;
}

export type PushResult = { ok: true; version: number } | { ok: false; reason: 'conflict' } | { ok: false; reason: 'error'; message: string };

export interface RemoteStore {
  /** null when nothing has been stored there yet. */
  pull(): Promise<RemoteSnapshot | null>;
  /** Succeeds only if the shared copy is still at `expectedVersion` (0 = nothing stored yet). */
  push(data: FamilyFinanceData, expectedVersion: number): Promise<PushResult>;
}

export interface AuthPort {
  /** Email of the signed-in person, or null. */
  currentEmail(): Promise<string | null>;
  sendCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<void>;
  signOut(): Promise<void>;
}

/** What this device remembers about the last successful sync. */
export interface SyncState {
  /** The merged data both sides agreed on - the "base" for the next three-way merge. */
  base: FamilyFinanceData;
  version: number;
  syncedAt: string;
}

export interface SyncStateStore {
  load(): Promise<SyncState | null>;
  save(state: SyncState): Promise<void>;
  clear(): Promise<void>;
}
