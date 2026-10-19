import Dexie, { type DexieOptions, type Table } from 'dexie';
import type {
  ActivityLogEntry,
  AppRepositories,
  AppSettings,
  Asset,
  CarLoan,
  EntityRepository,
  FamilyFinanceData,
  FamilyMember,
  GoldLoan,
  ManualLiability,
  SingletonRepository,
} from '../../domain';
import { normalizeSettings } from '../../domain';

interface SingletonRow {
  key: string;
  value: unknown;
}

/**
 * IndexedDB schema. Bump the version and add a `.upgrade()` step for any future change -
 * never edit a released version, or existing users' data breaks.
 */
export class FamilyFinanceDb extends Dexie {
  members!: Table<FamilyMember, string>;
  goldLoans!: Table<GoldLoan, string>;
  assets!: Table<Asset, string>;
  liabilities!: Table<ManualLiability, string>;
  activity!: Table<ActivityLogEntry, string>;
  singletons!: Table<SingletonRow, string>;

  constructor(name = 'family-finance', options?: DexieOptions) {
    super(name, options);
    this.version(1).stores({
      members: 'id',
      goldLoans: 'id, memberId, renewalDate',
      assets: 'id',
      liabilities: 'id',
      activity: 'id, at',
      singletons: 'key',
    });
  }
}

class DexieEntityRepository<T extends { id: string }> implements EntityRepository<T> {
  constructor(private readonly table: Table<T, string>) {}

  list(): Promise<T[]> {
    return this.table.toArray();
  }

  get(id: string): Promise<T | undefined> {
    return this.table.get(id);
  }

  async save(entity: T): Promise<void> {
    await this.table.put(entity);
  }

  async remove(id: string): Promise<void> {
    await this.table.delete(id);
  }
}

class DexieSingleton<T> implements SingletonRepository<T> {
  constructor(
    private readonly table: Table<SingletonRow, string>,
    private readonly key: string,
  ) {}

  async get(): Promise<T | null> {
    const row = await this.table.get(this.key);
    return row ? (row.value as T) : null;
  }

  async save(value: T): Promise<void> {
    await this.table.put({ key: this.key, value });
  }

  async clear(): Promise<void> {
    await this.table.delete(this.key);
  }
}

const INITIALISED_KEY = 'initialised';

export class DexieRepositories implements AppRepositories {
  readonly backend = 'indexeddb' as const;

  readonly members: EntityRepository<FamilyMember>;
  readonly goldLoans: EntityRepository<GoldLoan>;
  readonly assets: EntityRepository<Asset>;
  readonly liabilities: EntityRepository<ManualLiability>;
  readonly activity: EntityRepository<ActivityLogEntry>;
  readonly carLoan: SingletonRepository<CarLoan>;
  readonly settings: SingletonRepository<AppSettings>;

  private readonly db: FamilyFinanceDb;

  constructor(name = 'family-finance', options?: DexieOptions) {
    this.db = new FamilyFinanceDb(name, options);
    this.members = new DexieEntityRepository(this.db.members);
    this.goldLoans = new DexieEntityRepository(this.db.goldLoans);
    this.assets = new DexieEntityRepository(this.db.assets);
    this.liabilities = new DexieEntityRepository(this.db.liabilities);
    this.activity = new DexieEntityRepository(this.db.activity);
    this.carLoan = new DexieSingleton<CarLoan>(this.db.singletons, 'carLoan');
    this.settings = new DexieSingleton<AppSettings>(this.db.singletons, 'settings');
  }

  async isInitialised(): Promise<boolean> {
    return (await this.db.singletons.get(INITIALISED_KEY))?.value === true;
  }

  async loadAll(): Promise<FamilyFinanceData> {
    const db = this.db;
    return db.transaction('r', [db.members, db.goldLoans, db.assets, db.liabilities, db.activity, db.singletons], async () => ({
      schemaVersion: 1 as const,
      members: await db.members.toArray(),
      goldLoans: await db.goldLoans.toArray(),
      carLoan: await this.carLoan.get(),
      assets: await db.assets.toArray(),
      liabilities: await db.liabilities.toArray(),
      activity: await db.activity.toArray(),
      settings: normalizeSettings(await this.settings.get()),
    }));
  }

  /** One IndexedDB transaction: if anything fails, nothing changes. */
  async replaceAll(data: FamilyFinanceData): Promise<void> {
    const db = this.db;
    await db.transaction('rw', [db.members, db.goldLoans, db.assets, db.liabilities, db.activity, db.singletons], async () => {
      await db.members.clear();
      await db.goldLoans.clear();
      await db.assets.clear();
      await db.liabilities.clear();
      await db.activity.clear();
      await db.singletons.clear();

      await db.members.bulkPut(data.members);
      await db.goldLoans.bulkPut(data.goldLoans);
      await db.assets.bulkPut(data.assets);
      await db.liabilities.bulkPut(data.liabilities);
      await db.activity.bulkPut(data.activity);
      await db.singletons.put({ key: 'settings', value: data.settings });
      if (data.carLoan) await db.singletons.put({ key: 'carLoan', value: data.carLoan });
      await db.singletons.put({ key: INITIALISED_KEY, value: true });
    });
  }

  async clearAll(): Promise<void> {
    const db = this.db;
    await db.transaction('rw', [db.members, db.goldLoans, db.assets, db.liabilities, db.activity, db.singletons], async () => {
      await Promise.all([
        db.members.clear(),
        db.goldLoans.clear(),
        db.assets.clear(),
        db.liabilities.clear(),
        db.activity.clear(),
        db.singletons.clear(),
      ]);
    });
  }
}
