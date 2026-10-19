import { InjectionToken } from '@angular/core';
import { SystemClock, type AppRepositories, type Clock } from '../domain';
import { createRepositories } from './storage/create-repositories';

/** Tests and demos replace these with fixed/in-memory versions. */
export const CLOCK = new InjectionToken<Clock>('CLOCK', {
  providedIn: 'root',
  factory: () => new SystemClock(),
});

export const REPOSITORIES = new InjectionToken<AppRepositories>('REPOSITORIES', {
  providedIn: 'root',
  factory: () => createRepositories(),
});

export const ID_GENERATOR = new InjectionToken<() => string>('ID_GENERATOR', {
  providedIn: 'root',
  factory: () => () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
});
