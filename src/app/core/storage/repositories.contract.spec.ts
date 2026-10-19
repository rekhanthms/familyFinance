import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import {
  createEmptyData,
  createSeedData,
  type AppRepositories,
  type FamilyFinanceData,
  type GoldLoan,
} from '../../domain';
import { DexieRepositories } from './dexie-repositories';
import { InMemoryRepositories } from './in-memory-repositories';

const NOW = '2026-10-17T10:00:00+05:30';
let dbCounter = 0;

/** The same tests run against every implementation, so a future Supabase one must pass them too. */
const implementations: Array<[string, () => AppRepositories]> = [
  ['in-memory', () => new InMemoryRepositories()],
  [
    'IndexedDB (Dexie)',
    () =>
      new DexieRepositories(`contract-${++dbCounter}`, {
        indexedDB: new IDBFactory() as unknown as IDBFactory,
        IDBKeyRange: IDBKeyRange as unknown as typeof globalThis.IDBKeyRange,
      }),
  ],
];

const byId = <T extends { id: string }>(items: T[]): T[] => [...items].sort((a, b) => a.id.localeCompare(b.id));

const normalise = (data: FamilyFinanceData): FamilyFinanceData => ({
  ...data,
  members: byId(data.members),
  goldLoans: byId(data.goldLoans),
  assets: byId(data.assets),
  liabilities: byId(data.liabilities),
  activity: byId(data.activity),
});

describe.each(implementations)('%s repositories', (_name, make) => {
  it('starts empty and uninitialised, with default settings', async () => {
    const repos = make();
    expect(await repos.isInitialised()).toBe(false);
    expect(await repos.loadAll()).toEqual(createEmptyData());
  });

  it('saves, reads, updates, lists and removes entities', async () => {
    const repos = make();
    const [first, second] = createSeedData(NOW).goldLoans as [GoldLoan, GoldLoan];

    await repos.goldLoans.save(first);
    await repos.goldLoans.save(second);
    expect(await repos.goldLoans.get(first.id)).toEqual(first);
    expect(byId(await repos.goldLoans.list()).map((l) => l.id)).toEqual([first.id, second.id]);

    await repos.goldLoans.save({ ...first, renewalDate: '2026-12-01' });
    expect((await repos.goldLoans.get(first.id))!.renewalDate).toBe('2026-12-01');
    expect(await repos.goldLoans.list()).toHaveLength(2);

    await repos.goldLoans.remove(first.id);
    expect(await repos.goldLoans.get(first.id)).toBeUndefined();
    expect(await repos.goldLoans.list()).toHaveLength(1);
  });

  it('removing something that is not there is harmless', async () => {
    const repos = make();
    await expect(repos.goldLoans.remove('nope')).resolves.toBeUndefined();
  });

  it('hands out copies, so editing a result cannot change what is stored', async () => {
    const repos = make();
    const loan = createSeedData(NOW).goldLoans[0]!;
    await repos.goldLoans.save(loan);

    const fetched = (await repos.goldLoans.get(loan.id))!;
    fetched.renewalDate = '1999-01-01';
    fetched.jewelry.push({ type: 'Ring', quantity: 9 });

    expect(await repos.goldLoans.get(loan.id)).toEqual(loan);
  });

  it('stores singletons and clears them', async () => {
    const repos = make();
    const car = createSeedData(NOW).carLoan!;
    expect(await repos.carLoan.get()).toBeNull();
    await repos.carLoan.save(car);
    expect(await repos.carLoan.get()).toEqual(car);
    await repos.carLoan.clear();
    expect(await repos.carLoan.get()).toBeNull();
  });

  it('replaceAll writes everything, marks initialised, and loadAll returns it unchanged', async () => {
    const repos = make();
    const seed = createSeedData(NOW);
    await repos.replaceAll(seed);

    expect(await repos.isInitialised()).toBe(true);
    expect(normalise(await repos.loadAll())).toEqual(normalise(seed));
  });

  it('replaceAll replaces rather than merges', async () => {
    const repos = make();
    await repos.replaceAll(createSeedData(NOW));
    await repos.replaceAll({ ...createEmptyData(), members: createSeedData(NOW).members.slice(0, 1) });

    const loaded = await repos.loadAll();
    expect(loaded.goldLoans).toEqual([]);
    expect(loaded.carLoan).toBeNull();
    expect(loaded.members).toHaveLength(1);
  });

  it('replaceAll is all-or-nothing: a bad record leaves the old data untouched', async () => {
    const repos = make();
    const seed = createSeedData(NOW);
    await repos.replaceAll(seed);

    const poisoned: FamilyFinanceData = {
      ...createEmptyData(),
      members: seed.members.slice(0, 1),
      // A function cannot be stored, so this write must fail part-way through.
      goldLoans: [{ ...seed.goldLoans[0]!, notes: (() => 'x') as unknown as string }],
    };
    await expect(repos.replaceAll(poisoned)).rejects.toThrow();

    expect(normalise(await repos.loadAll())).toEqual(normalise(seed));
    expect(await repos.isInitialised()).toBe(true);
  });

  it('clearAll wipes data and the initialised flag', async () => {
    const repos = make();
    await repos.replaceAll(createSeedData(NOW));
    await repos.clearAll();

    expect(await repos.isInitialised()).toBe(false);
    expect(await repos.loadAll()).toEqual(createEmptyData());
  });

  it('fills in settings added after the data was saved', async () => {
    const repos = make();
    await repos.settings.save({ monthlyIncome: 5_000_000 } as never);
    const settings = (await repos.loadAll()).settings;
    expect(settings.monthlyIncome).toBe(5_000_000);
    expect(settings.renewalThresholds).toEqual({ dueSoonDays: 30, urgentDays: 7, renewedBadgeDays: 30 });
    expect(settings.dismissedAlertKeys).toEqual([]);
  });
});

describe('backend labels', () => {
  it('say where data lives', () => {
    expect(new InMemoryRepositories().backend).toBe('memory');
    expect(implementations[1]![1]().backend).toBe('indexeddb');
  });
});
