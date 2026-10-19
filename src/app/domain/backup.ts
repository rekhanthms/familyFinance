import { daysBetween, isISODate, type ISODate, type ISODateTime } from './dates';
import { isValidPaise } from './money';
import type { FamilyFinanceData } from './models';
import { fail, ok, type Result } from './result';

export const BACKUP_SCHEMA_VERSION = 1;

export const BACKUP_STALE_AFTER_DAYS = 30;

export type BackupStatus = { state: 'never' } | { state: 'ok' | 'stale'; daysAgo: number };

/**
 * Drives the reminder to back up. Data lives only in this browser until sync exists,
 * so "never backed up" and "a month or more ago" both get a visible nudge.
 */
export function backupStatus(
  lastBackupAt: ISODateTime | null,
  today: ISODate,
  staleAfterDays: number = BACKUP_STALE_AFTER_DAYS,
): BackupStatus {
  if (!lastBackupAt) return { state: 'never' };
  const daysAgo = Math.max(0, daysBetween(lastBackupAt.slice(0, 10), today));
  return { state: daysAgo >= staleAfterDays ? 'stale' : 'ok', daysAgo };
}

interface BackupFile {
  app: 'family-finance';
  exportedAt: ISODateTime;
  data: FamilyFinanceData;
}

export function serializeBackup(data: FamilyFinanceData, exportedAt: ISODateTime): string {
  const file: BackupFile = { app: 'family-finance', exportedAt, data };
  return JSON.stringify(file, null, 2);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Validates a backup before it is allowed to replace anything. Restore must be all-or-nothing:
 * any problem means nothing is imported.
 */
export function parseBackup(json: string): Result<FamilyFinanceData> {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return fail(['This file is not valid JSON.']);
  }
  if (!isRecord(raw) || raw['app'] !== 'family-finance' || !isRecord(raw['data'])) {
    return fail(['This does not look like a Family Finance backup file.']);
  }

  const data = raw['data'];
  const errors: string[] = [];

  if (data['schemaVersion'] !== BACKUP_SCHEMA_VERSION) {
    errors.push(`Unsupported backup version (expected ${BACKUP_SCHEMA_VERSION}).`);
  }
  for (const key of ['members', 'goldLoans', 'assets', 'liabilities', 'activity']) {
    if (!Array.isArray(data[key])) errors.push(`The backup is missing the "${key}" list.`);
  }
  if (!isRecord(data['settings'])) errors.push('The backup is missing settings.');
  if (errors.length > 0) return fail(errors);

  const members = data['members'] as Array<Record<string, unknown>>;
  const loans = data['goldLoans'] as Array<Record<string, unknown>>;

  const memberIds = new Set<unknown>();
  for (const member of members) {
    if (typeof member['id'] !== 'string' || memberIds.has(member['id'])) errors.push('Family members have missing or duplicate ids.');
    memberIds.add(member['id']);
  }

  const loanIds = new Set<unknown>();
  for (const loan of loans) {
    const label = typeof loan['id'] === 'string' ? loan['id'] : 'a loan';
    if (typeof loan['id'] !== 'string' || loanIds.has(loan['id'])) errors.push('Gold loans have missing or duplicate ids.');
    loanIds.add(loan['id']);
    if (!isISODate(loan['renewalDate'])) errors.push(`Loan ${label} has an invalid renewal date.`);
    if (!isValidPaise(loan['recordedAmount'])) errors.push(`Loan ${label} has an invalid amount.`);
    if (loan['memberId'] != null && !memberIds.has(loan['memberId'])) {
      errors.push(`Loan ${label} points to a family member that is not in the backup.`);
    }
  }
  if (errors.length > 0) return fail([...new Set(errors)]);

  return ok(data as unknown as FamilyFinanceData);
}
