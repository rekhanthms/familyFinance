import type { ISODate, ISODateTime } from './dates';
import { rupeesToPaise } from './money';
import { DEFAULT_RENEWAL_THRESHOLDS } from './renewal-status';
import type { AppSettings, CarLoan, FamilyFinanceData, FamilyMember, GoldLoan, JewelryItem } from './models';

/** The demo is built around this date. The running app always uses the real date from the Clock. */
export const SEED_REFERENCE_DATE: ISODate = '2026-10-17';

/** The foot-of-page total written by hand in the register (it adds up to ₹18,82,000, not this). */
export const REGISTER_WRITTEN_TOTAL = rupeesToPaise(17_82_000);

const IMPORT_NOTE =
  'Imported from the handwritten register. The amount is the recorded value - confirm whether it is the current outstanding balance.';

const jewel = (type: string, quantity: number, description?: string): JewelryItem => ({
  type,
  quantity,
  ...(description ? { description } : {}),
});

/** Demo data built from the register. Nothing here is verified; every loan is flagged accordingly. */
export function createSeedData(nowIso: ISODateTime): FamilyFinanceData {
  const member = (id: string, fullName: string, color: string, notes?: string): FamilyMember => ({
    id,
    fullName,
    color,
    updatedAt: nowIso,
    ...(notes ? { notes } : {}),
  });

  const members: FamilyMember[] = [
    member('m-rekhanth', 'M.S. Rekhanth', '#2B5C9E', 'Name spelling to confirm.'),
    member('m-pillai', 'G. Somashekhara Pillai', '#8C4A2F'),
    member('m-hemalatha', 'K.P. Hemalatha', '#8E3F73'),
    member('m-chandan', 'Chandan Kumar', '#5F6B22'),
  ];

  const loan = (
    n: number,
    memberId: string | null,
    accountRef: string | null,
    jewelry: JewelryItem[],
    amountRupees: number,
    renewalDate: ISODate,
    extraNote?: string,
  ): GoldLoan => ({
    id: `gl-${String(n).padStart(3, '0')}`,
    updatedAt: nowIso,
    memberId,
    lender: null,
    accountRef,
    jewelry,
    recordedAmount: rupeesToPaise(amountRupees),
    outstandingAmount: null,
    interestRatePercent: null,
    interestMethod: null,
    pledgeDate: null,
    renewalDate,
    renewalIntervalMonths: null,
    repayments: [],
    renewals: [],
    verification: 'needs-verification',
    notes: extraNote ? `${IMPORT_NOTE} ${extraNote}` : IMPORT_NOTE,
  });

  const goldLoans: GoldLoan[] = [
    // M.S. Rekhanth
    loan(1, 'm-rekhanth', '••••2724', [jewel('Bangles', 2)], 2_00_000, '2027-10-16'),
    loan(2, 'm-rekhanth', '••••8731', [jewel('Chain', 1), jewel('Ring', 1)], 1_10_000, '2026-12-23'),
    loan(3, 'm-rekhanth', '••••0970', [jewel('Necklace', 1)], 2_00_000, '2027-08-24'),
    // G. Somashekhara Pillai
    loan(4, 'm-pillai', '••••6975', [jewel('Chain', 1), jewel('Kammal / Jhumki', 4, 'Kammal')], 1_00_000, '2027-09-21'),
    loan(5, 'm-pillai', '••••7080', [jewel('Bangles', 2), jewel('Stone ring', 2)], 2_20_000, '2027-01-12'),
    loan(6, 'm-pillai', '••••5029', [jewel('Ring', 3), jewel('Chain', 1)], 1_45_000, '2026-12-09'),
    loan(
      7,
      'm-pillai',
      '••••3518',
      [
        jewel('Bracelet', 1),
        jewel('Ring', 3),
        jewel('Kammal / Jhumki', 2, 'Kammal'),
        jewel('Other', 1, 'Unclear on the register - please confirm'),
      ],
      2_00_000,
      '2027-09-01',
      'Handwriting after "Kammal 2" is unclear (a crossed-out "stone ring" and what looks like "Babe Ring 5"). Edit the jewelry list once confirmed.',
    ),
    // K.P. Hemalatha
    loan(8, 'm-hemalatha', '••••1789', [jewel('Chain', 1, 'Two-row chain')], 1_82_000, '2026-10-29'),
    loan(
      9,
      'm-hemalatha',
      '••••8402',
      [
        jewel('Kammal / Jhumki', 2),
        jewel('Chain', 1, 'BB chain with dollar'),
        jewel('Stone ring', 1),
        jewel('Ring', 1),
      ],
      1_80_000,
      '2026-11-11',
    ),
    // Chandan Kumar
    loan(10, 'm-chandan', '••••5728', [jewel('Chain', 1)], 95_000, '2027-09-04'),
    // Owner not visible on the register - deliberately left unassigned
    loan(11, null, null, [jewel('Chain', 1, 'With stone dollar')], 1_02_000, '2027-07-02', 'Owner heading not visible - confirm who this belongs to.'),
    loan(
      12,
      null,
      null,
      [jewel('Kammal / Jhumki', 4), jewel('Kammal / Jhumki', 2, 'Stone kammal'), jewel('Chain', 1)],
      1_48_000,
      '2026-11-11',
      'Owner heading not visible - confirm who this belongs to.',
    ),
  ];

  // Only the amount is known. Lender, rate, tenure, EMI and dates are left blank, never guessed.
  const carLoan: CarLoan = {
    id: 'car-001',
    updatedAt: nowIso,
    lender: null,
    principal: rupeesToPaise(3_00_000),
    startDate: null,
    interestRatePercent: null,
    tenureMonths: null,
    emi: null,
    installmentsPaid: 0,
    outstandingPrincipal: null,
    nextEmiDate: null,
    repayments: [],
  };

  return {
    schemaVersion: 1,
    members,
    goldLoans,
    carLoan,
    assets: [],
    liabilities: [],
    activity: [],
    settings: createDefaultSettings(),
  };
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
