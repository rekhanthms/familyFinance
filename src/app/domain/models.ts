import type { ISODate, ISODateTime } from './dates';
import type { Paise } from './money';

/** Every stored record has an id and a last-modified stamp (needed later for sync, last-write-wins). */
export interface Entity {
  id: string;
  updatedAt: ISODateTime;
}

export interface FamilyMember extends Entity {
  fullName: string;
  relationship?: string;
  /** Digits with country code (e.g. 919876543210). Only used to address WhatsApp messages. */
  phone?: string;
  /** Hex colour, used consistently for this person's name and loans. */
  color: string;
  notes?: string;
}

export type VerificationStatus = 'needs-verification' | 'verified';

export interface JewelryItem {
  type: string;
  quantity: number;
  description?: string;
}

export const JEWELRY_TYPES = [
  'Chain',
  'Bangles',
  'Ring',
  'Stone ring',
  'Necklace',
  'Kammal / Jhumki',
  'Bracelet',
  'Other',
] as const;

export type InterestMethod = 'simple' | 'compound' | 'reducing';

export interface Repayment {
  id: string;
  date: ISODate;
  amount: Paise;
  notes?: string;
}

export interface RenewalRecord {
  id: string;
  loanId: string;
  previousRenewalDate: ISODate;
  completedOn: ISODate;
  newRenewalDate: ISODate;
  updatedOutstanding: Paise | null;
  updatedInterestRatePercent: number | null;
  lenderReference?: string;
  notes?: string;
  recordedAt: ISODateTime;
}

export interface GoldLoan extends Entity {
  /** null = "Unassigned - confirm owner". */
  memberId: string | null;
  lender: string | null;
  /** Masked reference only (e.g. "••••2724"). Never store full account numbers. */
  accountRef: string | null;
  jewelry: JewelryItem[];
  /** The amount written in the register / original loan amount. */
  recordedAmount: Paise;
  /** Confirmed current outstanding balance. null until the user confirms it. */
  outstandingAmount: Paise | null;
  interestRatePercent: number | null;
  interestMethod: InterestMethod | null;
  pledgeDate: ISODate | null;
  /** The current due date for renewal. */
  renewalDate: ISODate;
  /** Only set when the user knows the lender's interval. Never assumed to be 12. */
  renewalIntervalMonths: number | null;
  repayments: Repayment[];
  renewals: RenewalRecord[];
  verification: VerificationStatus;
  notes?: string;
}

export interface CarLoan extends Entity {
  lender: string | null;
  principal: Paise;
  startDate: ISODate | null;
  interestRatePercent: number | null;
  tenureMonths: number | null;
  emi: Paise | null;
  installmentsPaid: number;
  outstandingPrincipal: Paise | null;
  nextEmiDate: ISODate | null;
  repayments: Repayment[];
}

export type AssetKind =
  | 'property'
  | 'savings'
  | 'fixed-deposit'
  | 'investment'
  | 'gold-jewelry'
  | 'vehicle'
  | 'other';

export interface Asset extends Entity {
  kind: AssetKind;
  name: string;
  ownerMemberId: string | null;
  estimatedValue: Paise;
  valuationDate: ISODate | null;
  notes?: string;
}

/**
 * Gold loans and the car loan are NOT stored here - they come from their own records.
 * That is what prevents double-counting on the dashboard.
 */
export type ManualLiabilityKind = 'home-loan' | 'personal-loan' | 'credit-card' | 'other';

export interface ManualLiability extends Entity {
  kind: ManualLiabilityKind;
  name: string;
  ownerMemberId: string | null;
  outstanding: Paise;
  monthlyPayment: Paise | null;
  notes?: string;
}

export interface ActivityLogEntry {
  id: string;
  at: ISODateTime;
  kind: 'renewal-recorded' | 'loan-created' | 'loan-updated' | 'loan-deleted' | 'data-restored';
  loanId?: string;
  message: string;
}

export interface RenewalThresholds {
  /** Up to this many days remaining = "Due soon" (default 30). */
  dueSoonDays: number;
  /** Up to this many days remaining = "Urgent" (default 7). */
  urgentDays: number;
  /** How long a loan keeps the "Renewed" badge after a recorded renewal (default 30). */
  renewedBadgeDays: number;
}

export interface AppSettings {
  renewalThresholds: RenewalThresholds;
  monthlyIncome: Paise | null;
  monthlyExpenses: Paise | null;
  savingsGoal: Paise | null;
  lastBackupAt: ISODateTime | null;
  /** Alert keys the user has dismissed (see alerts.ts). Dismissing never renews a loan. */
  dismissedAlertKeys: string[];
}

export interface FamilyFinanceData {
  schemaVersion: 1;
  members: FamilyMember[];
  goldLoans: GoldLoan[];
  carLoan: CarLoan | null;
  assets: Asset[];
  liabilities: ManualLiability[];
  activity: ActivityLogEntry[];
  settings: AppSettings;
}

export const UNASSIGNED_LABEL = 'Unassigned — confirm owner';
export const UNASSIGNED_COLOR = '#6B6B63'; // contrast 5:1 on paper; the lighter grey it replaced was only 4:1
