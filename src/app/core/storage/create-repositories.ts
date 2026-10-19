import type { AppRepositories } from '../../domain';
import { DexieRepositories } from './dexie-repositories';
import { InMemoryRepositories } from './in-memory-repositories';

/** IndexedDB when the browser has it; otherwise in-memory (the app warns that data won't be kept). */
export function createRepositories(): AppRepositories {
  return typeof indexedDB === 'undefined' ? new InMemoryRepositories() : new DexieRepositories();
}

/**
 * Asks the browser not to evict our data when the device runs low on space.
 * Returns true/false for granted/refused, or null when the browser can't say.
 */
export async function requestPersistentStorage(): Promise<boolean | null> {
  try {
    const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
    if (!storage?.persist) return null;
    if (await storage.persisted?.()) return true;
    return await storage.persist();
  } catch {
    return null;
  }
}
