# Family Finance

Family gold-loan, renewal, car-loan and net-worth tracker. Angular 21, standalone components, strict TypeScript, local-first (no backend required).

## Status

| Phase | What | State |
|---|---|---|
| 1 | Domain layer + unit tests | Done |
| 2 | Local-first persistence (IndexedDB) + AppStore | Done |
| 3 | App shell + design system (sidebar, phone bottom nav, alert banner, shared UI) | Done |
| 4 | Gold loans list/form/detail, Record renewal, Renewals calendar, Family | Done (192 tests total) |
| 5 | Dashboard: totals, needs action, by member, by month, register check | Done (196 tests total) |
| 6 | Car loan, assets and liabilities, planner, settings (backup/restore) | Done (209 tests total) |
| 7 | Sync between devices (Supabase free tier, email-code login), merge engine | Built and tested against a fake server (235 tests total); needs your Supabase project, see docs/SYNC_SETUP.md |
| 8 | Reminders: WhatsApp one-tap summary, daily email job | Built and tested with fakes (251 tests total); email needs your Resend + Supabase setup, see docs/REMINDERS_SETUP.md |
| 3 | App shell + design system | Planned |
| 4 | Gold Loans + Renewal Tracker screens | Planned |
| 5 | Dashboard | Planned |
| 6 | Car loan, assets, planner, settings | Planned |
| 7 | Supabase sync + login | Planned |
| 8 | Daily email + WhatsApp reminders | Planned |

## Run it

Needs Node 22.22.2 or newer (or 24.x).

```bash
npm install
npm test            # watch mode
npm run test:ci     # run once
npm run typecheck   # strict type-check including specs
npm start           # dev server: shows a temporary check page (real screens arrive in phase 3)
```

### Checking persistence on your PC
1. `npm start`, open the page. It should say "saved in this browser (IndexedDB)" and list 3 loans needing action.
2. Reload: the same data comes back from the browser (nothing is re-seeded).
3. Data lives per browser profile. Clearing site data deletes it, so use JSON backup (a screen for it arrives in a later phase).

## Rules the code follows

- Money is integer **paise**, never floats. Format with `formatINR` (Indian grouping).
- Dates are plain `YYYY-MM-DD` strings. "Today" comes only from a `Clock`, so tests and the demo can fix it (demo date: 17 Oct 2026).
- Renewal status is **derived**, never stored. Only a recorded renewal can make a loan "Renewed"; a passed date is "Overdue".
- Gold loans and the car loan are the single source of truth for liabilities, so nothing is double-counted.
- Nothing is invented: lender, rate, tenure, EMI, pledge date and confirmed balances stay empty until the user enters them.
- Account references are stored masked (last 4 digits only).

## Layout

```
src/app/domain/        pure TypeScript, no Angular imports
  models.ts            typed records
  renewal-status.ts    status engine, sorting, dashboard helpers
  renewal-workflow.ts  "Record renewal" (pure, never mutates)
  alerts.ts            in-app warnings and dismissal
  emi.ts               EMI and amortisation schedule
  insights.ts          totals, net worth, reconciliation
  seed.ts              demo data from the handwritten register
  backup.ts csv.ts     JSON backup/restore, CSV export
  reminders.ts         reminder text + one-tap WhatsApp link
  ports.ts             repository + notification interfaces (swap-in points)
src/app/core/
  tokens.ts            DI tokens: CLOCK, REPOSITORIES, ID_GENERATOR
  app.store.ts         NgRx SignalStore: state, dashboard figures, saved actions
  storage/
    dexie-repositories.ts      IndexedDB (browser) implementation
    in-memory-repositories.ts  test / fallback implementation
    repositories.contract.spec.ts  one test suite both must pass
```

## Seed data - please verify

All 12 loans are flagged "Needs verification". Amounts are the **recorded** register values, not confirmed balances.
Account references were read from handwriting - check the last 4 digits.
The register's hand-written total (₹17,82,000) is ₹1,00,000 less than the sum of its lines (₹18,82,000); the app shows this as a reconciliation check.


## Design system (phase 3)
Open `/design` in the running app to see every shared piece. `npm run check:contrast` verifies all colour pairs meet WCAG AA (26 pairs).

`npm run build:function` regenerates the single-file email job in `supabase/functions/daily-reminders/`.


## Publishing on GitHub Pages

See `docs/GITHUB_PAGES.md`. The public build starts empty; your loan data never goes into the repository.
