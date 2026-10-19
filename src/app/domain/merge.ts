import type { AppSettings, FamilyFinanceData } from './models';

/** JSON with sorted keys, so two records compare equal even after a round trip through Postgres jsonb (which reorders keys). */
export function stableStringify(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

export const sameValue = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);

interface Keyed {
  id: string;
  updatedAt: string;
}

/**
 * Three-way merge of one list. `base` is what this device last synced.
 *   - changed on one side only: that change wins
 *   - changed on both: the newer `updatedAt` wins (this device wins a tie)
 *   - deleted on one side, untouched on the other: stays deleted
 *   - deleted on one side, EDITED on the other: the edit wins - losing work is worse than keeping a stale row
 */
export function mergeList<T extends Keyed>(base: readonly T[], local: readonly T[], remote: readonly T[]): T[] {
  const byId = (items: readonly T[]) => new Map(items.map((item) => [item.id, item]));
  const b = byId(base);
  const l = byId(local);
  const r = byId(remote);
  const ids = new Set([...b.keys(), ...l.keys(), ...r.keys()]);
  const merged: T[] = [];

  for (const id of ids) {
    const baseItem = b.get(id);
    const localItem = l.get(id);
    const remoteItem = r.get(id);
    const localChanged = !sameValue(localItem, baseItem);
    const remoteChanged = !sameValue(remoteItem, baseItem);

    let winner: T | undefined;
    if (!localChanged && !remoteChanged) winner = localItem;
    else if (localChanged && !remoteChanged) winner = localItem; // includes "deleted here"
    else if (!localChanged && remoteChanged) winner = remoteItem; // includes "deleted there"
    else if (localItem && remoteItem) winner = localItem.updatedAt >= remoteItem.updatedAt ? localItem : remoteItem;
    else winner = localItem ?? remoteItem; // one side deleted, the other edited: keep the edit

    if (winner) merged.push(winner);
  }
  return merged;
}

function mergeSettings(base: AppSettings, local: AppSettings, remote: AppSettings): AppSettings {
  const out: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
  const b = base as unknown as Record<string, unknown>;
  const l = local as unknown as Record<string, unknown>;
  const r = remote as unknown as Record<string, unknown>;
  for (const key of keys) {
    const localChanged = !sameValue(l[key], b[key]);
    const remoteChanged = !sameValue(r[key], b[key]);
    out[key] = localChanged ? l[key] : remoteChanged ? r[key] : l[key];
  }
  // Two lists/stamps that should combine, not compete.
  const dismissed = new Set([...local.dismissedAlertKeys, ...remote.dismissedAlertKeys]);
  out['dismissedAlertKeys'] = [...dismissed].sort();
  const stamps = [local.lastBackupAt, remote.lastBackupAt].filter((s): s is string => !!s).sort();
  out['lastBackupAt'] = stamps.at(-1) ?? null;
  return out as unknown as AppSettings;
}

export function emptyBase(): FamilyFinanceData {
  return {
    schemaVersion: 1,
    members: [],
    goldLoans: [],
    carLoan: null,
    assets: [],
    liabilities: [],
    activity: [],
    settings: {
      renewalThresholds: { dueSoonDays: 30, urgentDays: 7, renewedBadgeDays: 30 },
      monthlyIncome: null,
      monthlyExpenses: null,
      savingsGoal: null,
      lastBackupAt: null,
      dismissedAlertKeys: [],
    },
  };
}

/**
 * Combines this device's data with the shared copy. `base` is the last merged result both sides agreed on
 * (null on a first sync: then everything either side has is treated as added).
 */
export function mergeData(base: FamilyFinanceData | null, local: FamilyFinanceData, remote: FamilyFinanceData): FamilyFinanceData {
  const b = base ?? emptyBase();

  const members = mergeList(b.members, local.members, remote.members);
  const memberIds = new Set(members.map((m) => m.id));
  // A loan whose owner was removed elsewhere becomes Unassigned instead of pointing at nobody.
  const goldLoans = mergeList(b.goldLoans, local.goldLoans, remote.goldLoans).map((loan) =>
    loan.memberId && !memberIds.has(loan.memberId) ? { ...loan, memberId: null } : loan,
  );

  const carCandidates = (car: FamilyFinanceData['carLoan']) => (car ? [car] : []);
  const car = mergeList(carCandidates(b.carLoan), carCandidates(local.carLoan), carCandidates(remote.carLoan))[0] ?? null;

  const activity = new Map([...remote.activity, ...local.activity].map((entry) => [entry.id, entry]));

  return {
    schemaVersion: 1,
    members,
    goldLoans,
    carLoan: car,
    assets: mergeList(b.assets, local.assets, remote.assets),
    liabilities: mergeList(b.liabilities, local.liabilities, remote.liabilities),
    activity: [...activity.values()].sort((x, y) => (x.at < y.at ? -1 : x.at > y.at ? 1 : 0)),
    settings: mergeSettings(b.settings, local.settings, remote.settings),
  };
}
