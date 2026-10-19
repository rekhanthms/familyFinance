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

const clone = <T>(value: T): T => structuredClone(value);

class MemoryEntityRepository<T extends { id: string }> implements EntityRepository<T> {
  private items = new Map<string, T>();

  async list(): Promise<T[]> {
    return [...this.items.values()].map(clone);
  }

  async get(id: string): Promise<T | undefined> {
    const found = this.items.get(id);
    return found ? clone(found) : undefined;
  }

  async save(entity: T): Promise<void> {
    this.items.set(entity.id, clone(entity));
  }

  async remove(id: string): Promise<void> {
    this.items.delete(id);
  }

  swap(next: Map<string, T>): void {
    this.items = next;
  }

  static from<U extends { id: string }>(items: readonly U[]): Map<string, U> {
    // Cloning first means a bad record throws before anything is replaced (all-or-nothing).
    return new Map(items.map((item) => [item.id, clone(item)]));
  }
}

class MemorySingleton<T> implements SingletonRepository<T> {
  value: T | null = null;

  async get(): Promise<T | null> {
    return this.value === null ? null : clone(this.value);
  }

  async save(value: T): Promise<void> {
    this.value = clone(value);
  }

  async clear(): Promise<void> {
    this.value = null;
  }
}

/** Used in tests, and as the fallback when the browser offers no IndexedDB (data is lost on reload). */
export class InMemoryRepositories implements AppRepositories {
  readonly backend = 'memory' as const;

  readonly members = new MemoryEntityRepository<FamilyMember>();
  readonly goldLoans = new MemoryEntityRepository<GoldLoan>();
  readonly assets = new MemoryEntityRepository<Asset>();
  readonly liabilities = new MemoryEntityRepository<ManualLiability>();
  readonly activity = new MemoryEntityRepository<ActivityLogEntry>();
  readonly carLoan = new MemorySingleton<CarLoan>();
  readonly settings = new MemorySingleton<AppSettings>();
  private initialised = false;

  async isInitialised(): Promise<boolean> {
    return this.initialised;
  }

  async loadAll(): Promise<FamilyFinanceData> {
    return {
      schemaVersion: 1,
      members: await this.members.list(),
      goldLoans: await this.goldLoans.list(),
      carLoan: await this.carLoan.get(),
      assets: await this.assets.list(),
      liabilities: await this.liabilities.list(),
      activity: await this.activity.list(),
      settings: normalizeSettings(await this.settings.get()),
    };
  }

  async replaceAll(data: FamilyFinanceData): Promise<void> {
    const members = MemoryEntityRepository.from(data.members);
    const goldLoans = MemoryEntityRepository.from(data.goldLoans);
    const assets = MemoryEntityRepository.from(data.assets);
    const liabilities = MemoryEntityRepository.from(data.liabilities);
    const activity = MemoryEntityRepository.from(data.activity);
    const settings = clone(data.settings);
    const carLoan = data.carLoan ? clone(data.carLoan) : null;

    this.members.swap(members);
    this.goldLoans.swap(goldLoans);
    this.assets.swap(assets);
    this.liabilities.swap(liabilities);
    this.activity.swap(activity);
    this.settings.value = settings;
    this.carLoan.value = carLoan;
    this.initialised = true;
  }

  async clearAll(): Promise<void> {
    this.members.swap(new Map());
    this.goldLoans.swap(new Map());
    this.assets.swap(new Map());
    this.liabilities.swap(new Map());
    this.activity.swap(new Map());
    this.settings.value = null;
    this.carLoan.value = null;
    this.initialised = false;
  }
}
