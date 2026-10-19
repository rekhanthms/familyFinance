import type {
  ActivityLogEntry,
  AppSettings,
  Asset,
  CarLoan,
  FamilyFinanceData,
  FamilyMember,
  GoldLoan,
  ManualLiability,
} from './models';

/**
 * Persistence contract. Phase 2 implements it with IndexedDB; later a Supabase (or .NET API)
 * implementation drops in through dependency injection - no screen or business rule changes.
 * The order of `list()` is unspecified; sort in the caller if order matters.
 */
export interface EntityRepository<T extends { id: string }> {
  list(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  save(entity: T): Promise<void>;
  remove(id: string): Promise<void>;
}

/** A record that exists at most once (the car loan, the settings). */
export interface SingletonRepository<T> {
  get(): Promise<T | null>;
  save(value: T): Promise<void>;
  clear(): Promise<void>;
}

export interface AppRepositories {
  /** Where the data actually lives. "memory" means it will be lost when the page closes. */
  readonly backend: 'indexeddb' | 'memory';

  members: EntityRepository<FamilyMember>;
  goldLoans: EntityRepository<GoldLoan>;
  assets: EntityRepository<Asset>;
  liabilities: EntityRepository<ManualLiability>;
  activity: EntityRepository<ActivityLogEntry>;
  carLoan: SingletonRepository<CarLoan>;
  settings: SingletonRepository<AppSettings>;

  /**
   * True once first-run seeding or a restore has happened. It stops demo data coming back
   * after the user deliberately deletes everything.
   */
  isInitialised(): Promise<boolean>;

  /** Everything stored, with defaults for anything missing. */
  loadAll(): Promise<FamilyFinanceData>;

  /** Atomically replaces ALL data (all-or-nothing) and marks the store initialised. Used by seed and restore. */
  replaceAll(data: FamilyFinanceData): Promise<void>;

  /** Deletes everything, including the initialised flag. */
  clearAll(): Promise<void>;
}

export type NotificationChannel = 'in-app' | 'email' | 'whatsapp';

export interface NotificationMessage {
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  body: string;
}

export type DeliveryResult =
  | { delivered: true; providerMessageId: string }
  | { delivered: false; reason: string };

/**
 * Outgoing notifications. Until a real provider (email service, WhatsApp Cloud API) is wired in,
 * the only implementations are in-app and "prepare a link" - the UI must never claim a message
 * was sent unless `delivered` is true.
 */
export interface NotificationPort {
  send(message: NotificationMessage): Promise<DeliveryResult>;
}
