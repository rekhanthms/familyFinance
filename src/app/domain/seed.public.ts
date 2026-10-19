import type { ISODate, ISODateTime } from './dates';
import { DEFAULT_RENEWAL_THRESHOLDS } from './renewal-status';
import type { Paise } from './money';
import type { AppSettings, FamilyFinanceData } from './models';

/**
 * The version of seed.ts used for the public web build (see the "pages" configuration in angular.json).
 * It carries NO personal data: the hosted app starts empty and you import your own backup into it.
 * Keep the exported names identical to seed.ts.
 */
export const SEED_REFERENCE_DATE: ISODate = '2026-10-17';
export const REGISTER_WRITTEN_TOTAL: Paise | null = null;

export function createSeedData(_nowIso: ISODateTime): FamilyFinanceData {
  return createEmptyData();
}

export function createDefaultSettings(): AppSettings {
  return {
    renewalThresholds: { ...DEFAULT_RENEWAL_THRESHOLDS },
    monthlyIncome: null,
    monthlyExpenses: null,
    savingsGoal: null,
    lastBackupAt: null,
    dismissedAlertKeys: [],
  };
}

/** Fills in anything missing from stored settings, so adding a setting later never breaks old data. */
export function normalizeSettings(stored: Partial<AppSettings> | null | undefined): AppSettings {
  const defaults = createDefaultSettings();
  return {
    ...defaults,
    ...stored,
    renewalThresholds: { ...defaults.renewalThresholds, ...stored?.renewalThresholds },
  };
}

/** A blank slate: no members, no loans, default settings. */
export function createEmptyData(): FamilyFinanceData {
  return {
    schemaVersion: 1,
    members: [],
    goldLoans: [],
    carLoan: null,
    assets: [],
    liabilities: [],
    activity: [],
    settings: createDefaultSettings(),
  };
}
