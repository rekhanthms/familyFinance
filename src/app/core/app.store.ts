import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import {
  backupStatus,
  buildRenewalViews,
  countByStatus,
  createEmptyData,
  createSeedData,
  deriveAlerts,
  fail,
  goldLoansByMember,
  monthlyObligations,
  ok,
  parseBackup,
  reconcileTotal,
  recordRenewal,
  renewalConcentrationByMonth,
  REGISTER_WRITTEN_TOTAL,
  serializeBackup,
  summarizeNetWorth,
  totalGoldLoans,
  upcomingRenewalAmount,
  urgentRenewals,
  validateGoldLoan,
  validateThresholds,
  type ActivityLogEntry,
  type AppSettings,
  type Asset,
  type CarLoan,
  type FamilyFinanceData,
  type FamilyMember,
  type GoldLoan,
  type ISODate,
  type ManualLiability,
  type RenewalInput,
  type Result,
} from '../domain';
import { CLOCK, ID_GENERATOR, REPOSITORIES } from './tokens';

interface AppState {
  loaded: boolean;
  loading: boolean;
  /** Last problem the user should see (e.g. storage failed). Cleared by the next successful action. */
  error: string | null;
  data: FamilyFinanceData;
  /** Cached "today"; refreshed on load and by refreshToday() when the app is reopened. */
  today: ISODate;
  backend: 'indexeddb' | 'memory' | null;
  persistent: boolean | null;
  /** The family selector in the header: "all", "unassigned", or a member id. */
  memberFilter: string;
}

const upsert = <T extends { id: string }>(list: readonly T[], item: T): T[] =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];

const without = <T extends { id: string }>(list: readonly T[], id: string): T[] => list.filter((x) => x.id !== id);

/**
 * The one place the UI reads from and writes to. Every action saves to storage FIRST and only
 * then updates what's on screen, so the screen can never show something that wasn't saved.
 * All rules (status, renewal, totals) come from the pure domain layer.
 */
export const AppStore = signalStore(
  { providedIn: 'root' },
  withState<AppState>(() => ({
    loaded: false,
    loading: false,
    error: null,
    data: createEmptyData(),
    today: inject(CLOCK).today(),
    backend: null,
    persistent: null,
    memberFilter: 'all',
  })),

  withComputed((store) => {
    const thresholds = computed(() => store.data().settings.renewalThresholds);
    const renewalViews = computed(() => buildRenewalViews(store.data().goldLoans, store.today(), thresholds()));

    /** A filter pointing at a removed member quietly falls back to the whole family. */
    const effectiveMemberFilter = computed(() => {
      const filter = store.memberFilter();
      if (filter === 'all' || filter === 'unassigned') return filter;
      return store.data().members.some((member) => member.id === filter) ? filter : 'all';
    });
    const matchesFilter = (memberId: string | null): boolean => {
      const filter = effectiveMemberFilter();
      return filter === 'all' || (filter === 'unassigned' ? memberId === null : memberId === filter);
    };
    const filteredRenewalViews = computed(() => renewalViews().filter((view) => matchesFilter(view.loan.memberId)));

    return {
      renewalViews,
      effectiveMemberFilter,
      /** Renewal views for the person chosen in the header selector. Pages use this; the alert banner does not. */
      filteredRenewalViews,
      filteredUrgentRenewals: computed(() => urgentRenewals(filteredRenewalViews())),
      membersById: computed(() => new Map(store.data().members.map((member) => [member.id, member]))),
      backupStatus: computed(() => backupStatus(store.data().settings.lastBackupAt, store.today())),
      statusCounts: computed(() => countByStatus(renewalViews())),
      /** Dashboard strip: loans needing action, nearest first. */
      urgentRenewals: computed(() => urgentRenewals(renewalViews())),
      upcomingRenewalAmount: computed(() => upcomingRenewalAmount(renewalViews())),
      alerts: computed(() => deriveAlerts(renewalViews(), new Set(store.data().settings.dismissedAlertKeys))),
      goldTotal: computed(() => totalGoldLoans(store.data().goldLoans)),
      goldByMember: computed(() => goldLoansByMember(store.data().goldLoans, store.data().members)),
      renewalsByMonth: computed(() => renewalConcentrationByMonth(store.data().goldLoans)),
      netWorth: computed(() => {
        const d = store.data();
        return summarizeNetWorth({
          assets: d.assets,
          goldLoans: d.goldLoans,
          carLoan: d.carLoan,
          otherLiabilities: d.liabilities,
        });
      }),
      obligations: computed(() => monthlyObligations(store.data().carLoan, store.data().liabilities)),
      /** Compares the loans with the total hand-written at the foot of the register. */
      registerCheck: computed(() => (REGISTER_WRITTEN_TOTAL === null ? null : reconcileTotal(store.data().goldLoans, REGISTER_WRITTEN_TOTAL))),
      hasUnassignedLoans: computed(() => store.data().goldLoans.some((loan) => loan.memberId === null)),
    };
  }),

  withMethods((store) => {
    const repos = inject(REPOSITORIES);
    const clock = inject(CLOCK);
    const newId = inject(ID_GENERATOR);

    const setData = (data: FamilyFinanceData) => patchState(store, { data, error: null });

    /** Runs a save; on failure leaves the screen untouched and reports why. */
    const persist = async <T>(work: () => Promise<T>): Promise<Result<T>> => {
      try {
        return ok(await work());
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown storage error';
        patchState(store, { error: `Could not save: ${message}` });
        return fail([`Could not save: ${message}`]);
      }
    };

    const logActivity = (
      kind: ActivityLogEntry['kind'],
      message: string,
      loanId?: string,
    ): ActivityLogEntry => ({
      id: newId(),
      at: clock.nowIso(),
      kind,
      message,
      ...(loanId ? { loanId } : {}),
    });

    const describe = (loan: GoldLoan) => loan.accountRef ?? loan.id;

    return {
      newId,

      /** First run seeds the demo register once; after that it only reads what is stored. */
      async load(): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          if (!(await repos.isInitialised())) await repos.replaceAll(createSeedData(clock.nowIso()));
          patchState(store, {
            data: await repos.loadAll(),
            today: clock.today(),
            backend: repos.backend,
            loaded: true,
            loading: false,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown storage error';
          patchState(store, { loading: false, error: `Could not open saved data: ${message}` });
        }
      },

      /** Call when the app is reopened or comes back to the foreground, so statuses follow the real date. */
      refreshToday(): void {
        const today = clock.today();
        if (today !== store.today()) patchState(store, { today });
      },

      setPersistent(persistent: boolean | null): void {
        patchState(store, { persistent });
      },

      /** Header selector: "all", "unassigned", or a member id. */
      setMemberFilter(memberFilter: string): void {
        patchState(store, { memberFilter });
      },

      // ---- family members ----
      async saveMember(member: FamilyMember): Promise<Result<FamilyMember>> {
        if (!member.fullName.trim()) return fail(['Enter the member\'s name.']);
        const saved = { ...member, fullName: member.fullName.trim(), updatedAt: clock.nowIso() };
        const result = await persist(() => repos.members.save(saved));
        if (!result.ok) return fail(result.errors);
        setData({ ...store.data(), members: upsert(store.data().members, saved) });
        return ok(saved);
      },

      /** Removing a member keeps their loans - they move to "Unassigned" so no record is lost. */
      async removeMember(id: string): Promise<Result<{ reassignedLoans: number }>> {
        const data = store.data();
        const affected = data.goldLoans.filter((loan) => loan.memberId === id);
        const now = clock.nowIso();
        const reassigned = affected.map((loan) => ({ ...loan, memberId: null, updatedAt: now }));
        const result = await persist(async () => {
          for (const loan of reassigned) await repos.goldLoans.save(loan);
          await repos.members.remove(id);
        });
        if (!result.ok) return fail(result.errors);
        setData({
          ...data,
          members: without(data.members, id),
          goldLoans: data.goldLoans.map((loan) => reassigned.find((r) => r.id === loan.id) ?? loan),
        });
        return ok({ reassignedLoans: reassigned.length });
      },

      // ---- gold loans ----
      async saveGoldLoan(loan: GoldLoan): Promise<Result<GoldLoan>> {
        const problems = validateGoldLoan(loan);
        if (problems.length > 0) return fail(problems);

        const data = store.data();
        const existing = data.goldLoans.some((l) => l.id === loan.id);
        const saved = { ...loan, updatedAt: clock.nowIso() };
        const entry = logActivity(
          existing ? 'loan-updated' : 'loan-created',
          `Loan ${describe(saved)} ${existing ? 'updated' : 'added'}.`,
          saved.id,
        );
        const result = await persist(async () => {
          await repos.goldLoans.save(saved);
          await repos.activity.save(entry);
        });
        if (!result.ok) return fail(result.errors);
        setData({ ...data, goldLoans: upsert(data.goldLoans, saved), activity: [...data.activity, entry] });
        return ok(saved);
      },

      async deleteGoldLoan(id: string): Promise<Result<void>> {
        const data = store.data();
        const loan = data.goldLoans.find((l) => l.id === id);
        if (!loan) return fail(['That loan no longer exists.']);
        const entry = logActivity('loan-deleted', `Loan ${describe(loan)} deleted.`, id);
        const settings: AppSettings = {
          ...data.settings,
          dismissedAlertKeys: data.settings.dismissedAlertKeys.filter((key) => !key.startsWith(`${id}|`)),
        };
        const result = await persist(async () => {
          await repos.goldLoans.remove(id);
          await repos.activity.save(entry);
          await repos.settings.save(settings);
        });
        if (!result.ok) return fail(result.errors);
        setData({ ...data, goldLoans: without(data.goldLoans, id), activity: [...data.activity, entry], settings });
        return ok(undefined);
      },

      /** "Record renewal": history, new due date, activity entry, and everything recalculates. */
      async recordRenewal(input: RenewalInput): Promise<Result<GoldLoan>> {
        const data = store.data();
        const loan = data.goldLoans.find((l) => l.id === input.loanId);
        if (!loan) return fail(['That loan no longer exists.']);

        const outcome = recordRenewal(loan, input, { today: clock.today(), nowIso: clock.nowIso(), newId });
        if (!outcome.ok) return fail(outcome.errors);

        const { loan: updated, activity } = outcome.value;
        const result = await persist(async () => {
          await repos.goldLoans.save(updated);
          await repos.activity.save(activity);
        });
        if (!result.ok) return fail(result.errors);
        setData({ ...data, goldLoans: upsert(data.goldLoans, updated), activity: [...data.activity, activity] });
        return ok(updated);
      },

      // ---- alerts ----
      /** Hides one warning. The loan itself is untouched - it is NOT marked renewed. */
      async dismissAlert(key: string): Promise<Result<void>> {
        const data = store.data();
        if (data.settings.dismissedAlertKeys.includes(key)) return ok(undefined);
        const settings = { ...data.settings, dismissedAlertKeys: [...data.settings.dismissedAlertKeys, key] };
        const result = await persist(() => repos.settings.save(settings));
        if (!result.ok) return fail(result.errors);
        setData({ ...data, settings });
        return ok(undefined);
      },

      // ---- car loan, assets, liabilities ----
      async saveCarLoan(car: CarLoan): Promise<Result<CarLoan>> {
        const saved = { ...car, updatedAt: clock.nowIso() };
        const result = await persist(() => repos.carLoan.save(saved));
        if (!result.ok) return fail(result.errors);
        setData({ ...store.data(), carLoan: saved });
        return ok(saved);
      },

      async saveAsset(asset: Asset): Promise<Result<Asset>> {
        if (!asset.name.trim() || !Number.isSafeInteger(asset.estimatedValue) || asset.estimatedValue < 0) {
          return fail(['Enter a name and a value of zero or more.']);
        }
        const saved = { ...asset, updatedAt: clock.nowIso() };
        const result = await persist(() => repos.assets.save(saved));
        if (!result.ok) return fail(result.errors);
        setData({ ...store.data(), assets: upsert(store.data().assets, saved) });
        return ok(saved);
      },

      async deleteAsset(id: string): Promise<Result<void>> {
        const result = await persist(() => repos.assets.remove(id));
        if (!result.ok) return fail(result.errors);
        setData({ ...store.data(), assets: without(store.data().assets, id) });
        return ok(undefined);
      },

      async saveLiability(liability: ManualLiability): Promise<Result<ManualLiability>> {
        if (!liability.name.trim() || !Number.isSafeInteger(liability.outstanding) || liability.outstanding < 0) {
          return fail(['Enter a name and an amount of zero or more.']);
        }
        const saved = { ...liability, updatedAt: clock.nowIso() };
        const result = await persist(() => repos.liabilities.save(saved));
        if (!result.ok) return fail(result.errors);
        setData({ ...store.data(), liabilities: upsert(store.data().liabilities, saved) });
        return ok(saved);
      },

      async deleteLiability(id: string): Promise<Result<void>> {
        const result = await persist(() => repos.liabilities.remove(id));
        if (!result.ok) return fail(result.errors);
        setData({ ...store.data(), liabilities: without(store.data().liabilities, id) });
        return ok(undefined);
      },

      // ---- settings ----
      async updateSettings(changes: Partial<AppSettings>): Promise<Result<AppSettings>> {
        const settings = { ...store.data().settings, ...changes };
        const problems = validateThresholds(settings.renewalThresholds);
        if (problems.length > 0) return fail(problems);
        const result = await persist(() => repos.settings.save(settings));
        if (!result.ok) return fail(result.errors);
        setData({ ...store.data(), settings });
        return ok(settings);
      },

      // ---- backup, restore, reset ----
      /** Returns the JSON text to download and records when the backup was made. */
      async exportBackup(): Promise<Result<string>> {
        const now = clock.nowIso();
        const settings = { ...store.data().settings, lastBackupAt: now };
        const result = await persist(() => repos.settings.save(settings));
        if (!result.ok) return fail(result.errors);
        setData({ ...store.data(), settings });
        return ok(serializeBackup(store.data(), now));
      },

      /** All-or-nothing: a bad file changes nothing. */
      async restoreBackup(json: string): Promise<Result<void>> {
        const parsed = parseBackup(json);
        if (!parsed.ok) return fail(parsed.errors);
        const entry = logActivity('data-restored', 'Data restored from a backup file.');
        const restored: FamilyFinanceData = { ...parsed.value, activity: [...parsed.value.activity, entry] };
        const result = await persist(() => repos.replaceAll(restored));
        if (!result.ok) return fail(result.errors);
        setData(await repos.loadAll());
        return ok(undefined);
      },

      /** Sync only: replaces local data with an already-merged copy. Not logged as a restore. */
      async applySyncedData(data: FamilyFinanceData): Promise<Result<void>> {
        const result = await persist(() => repos.replaceAll(data));
        if (!result.ok) return fail(result.errors);
        setData(await repos.loadAll());
        return ok(undefined);
      },

      /** Back to the demo register (asks the user first, in the UI). */
      async resetToDemo(): Promise<Result<void>> {
        const result = await persist(() => repos.replaceAll(createSeedData(clock.nowIso())));
        if (!result.ok) return fail(result.errors);
        setData(await repos.loadAll());
        return ok(undefined);
      },

      /** Start with nothing at all. */
      async startEmpty(): Promise<Result<void>> {
        const result = await persist(() => repos.replaceAll(createEmptyData()));
        if (!result.ok) return fail(result.errors);
        setData(await repos.loadAll());
        return ok(undefined);
      },
    };
  }),
);
