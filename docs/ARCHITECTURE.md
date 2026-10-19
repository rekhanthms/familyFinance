# Architecture decisions

## ADR-1  Pure domain core
`src/app/domain` has no Angular imports. All financial and renewal rules live there and are unit-tested. Components only call it. The same code can later run in the daily reminder job, so the app and the emails never disagree about what is overdue.

## ADR-2  Money as integer paise
Floats drift (`1.1 * 3`). Every amount is an integer number of paise; display uses `en-IN` grouping.

## ADR-3  Dates as `YYYY-MM-DD`, "today" from a Clock
Day arithmetic is done in UTC, so device time zone and DST cannot shift a renewal by a day. `SystemClock` reads the date in IST. `FixedClock` is used by tests and the demo.

## ADR-4  Status is derived, not stored
`computeRenewalStatus(loan, today, thresholds)` is called every time. Editing a date therefore re-sorts the dashboard immediately, with no stale flag to forget to update.

| Days remaining | Status |
|---|---|
| below 0 | Overdue |
| 0 | Due today |
| 1 to 7 | Urgent |
| 8 to 30 | Due soon |
| more than 30 | Upcoming |
| recorded renewal within the badge window and more than 7 days to the new date | Renewed (shows next date) |

Thresholds (30 / 7 / badge 30) are settings. The renewed-badge window is my default - the brief did not specify how long "Renewed" should show; change it in Settings.

## ADR-5  One source of truth for liabilities
Gold loans and the car loan are not stored in the manual liabilities list. Net worth reads them from their own records, so they can never be counted twice.

## ADR-6  Honest data
Unknown values are `null`, never guessed. A balance that falls back to the register amount is labelled `recorded`. EMI and schedules return `null` unless rate and tenure are both entered.

## ADR-7  Replaceable persistence and notifications
`EntityRepository<T>` and `NotificationPort` (in `ports.ts`) are the swap points. Phase 2 = IndexedDB. Phase 7 = Supabase. Every record has `id` and `updatedAt` so sync can be last-write-wins. The UI never claims a message was sent unless `delivered: true`.

## ADR-8  Dismissing an alert never renews a loan
Alert keys are `loanId|renewalDate|status`. Dismissal hides one warning only; it returns if the status escalates or the date changes.

## ADR-9  Storage: IndexedDB through Dexie, behind one contract
`AppRepositories` has two implementations (IndexedDB, in-memory). A single contract test suite runs against both, so a future Supabase implementation must pass the same tests. Restore and seeding use `replaceAll`, one IndexedDB transaction: a bad record rolls everything back (tested). Schema changes need a new Dexie `version()` with an upgrade step - never edit a released version.

Limits: data is per browser profile (no cross-device sync until phase 7), and "Clear site data" deletes it. The app asks the browser for persistent storage and shows the answer, but the answer can be "no", so JSON backup matters.

## ADR-10  AppStore saves first, then updates the screen
Every action writes to storage and only then updates state, so the screen can never show something that was not saved. A failed save leaves state untouched and sets a visible error. First-run seeding is guarded by an "initialised" flag, so deleting all loans never brings the demo data back. The cached "today" is refreshed when the app returns to the foreground, so statuses follow the real date.

Deleting a family member keeps their loans and moves them to "Unassigned" - no loan is ever lost by removing a person.

## ADR-11  Design system: the ledger
Tokens live in `src/styles/_tokens.scss` as CSS custom properties; contrast is checked by script and by tests. Manrope is self-hosted (latin + latin-ext, because plain latin has no rupee sign). Signature component is the ledger: ruled rows, date first, amount right-aligned in tabular numerals. Small radii, no decorative icons. Status is always a written label plus tint, never colour alone. The shell shows the top renewal alert on every page, moves focus to the content after navigation, has a skip link, and keeps four primary phone tabs with the rest under "More".

## ADR-12  Forms, renewals and sharing (phase 4)
Forms read text boxes through `form-parse.ts`: a blank box means "unknown" (null), never zero, and junk shows an error under the field plus a summary at the top that takes focus. The loan form refuses anything that looks like a full account number (more than 4 digits) and stores only `••••1234`. "Record renewal" is the only path to the Renewed status; it uses the domain `recordRenewal`, which rejects a stale form, a future completion date and a new date that is not after it. The suggested next date appears only when the loan has a recorded interval. Sharing is a `wa.me` link with the message pre-filled: the person taps Send in WhatsApp, and the app never claims anything was sent. Routes use component input binding, so `:id` arrives as an input.

## ADR-13  Dashboard without a chart library
Charts are plain HTML bars with the value printed beside each, so they work for screen readers, print, and add no bundle weight. Every figure follows the family selector. The "register total doesn't match" notice shows only for the whole family and only while some loan is still unverified, so it stops nagging once the register has been checked.

## ADR-14  Estimates are shown, never counted
The car-loan EMI estimate is a live calculation from the typed rate and tenure. It feeds monthly commitments only after the person presses "Use as EMI" and saves, so a guess can't leak into totals. The planner names missing inputs ("Enter income and expenses", "an EMI is not entered") and says "or less" when an unknown EMI means the real surplus is lower. Gold-loan renewals are shown as balances falling due, because the interest or part-payment a lender asks for is not recorded. Restore validates the whole file first and replaces data in one transaction, behind a confirm dialog.

## ADR-15  Sync: local-first, three-way merge, one guarded snapshot
Each device keeps working from its own IndexedDB copy; sync never blocks the app and a failure changes nothing locally. The shared copy is one JSON snapshot with a version number in Supabase. A write is a database function that succeeds only if the version still matches (compare-and-set), so two devices can never silently overwrite each other; on a conflict the device pulls, merges and retries.

Merging is three-way, using the data both sides agreed on last time (stored in a separate IndexedDB database, so sync cannot disturb the register): a change on one side wins; the newer `updatedAt` wins if both changed; a delete wins over an untouched row but loses to an edit, because losing work is worse than keeping a stale row; loans whose owner was removed elsewhere become Unassigned; activity logs and dismissed alerts are unioned. Deleting needs no tombstones because the base shows what existed. Keys are compared order-insensitively, since Postgres jsonb reorders them.

A device that already holds data never auto-merges into an existing shared copy on first sync; it asks (use the shared copy, or combine). Login is an emailed 6-digit code; row-level security shows data only to emails in `allowed_emails`. The Supabase library is loaded only when sync is configured. Not verified: the real Supabase calls (my build environment cannot reach it); the adapter is thin and everything around it is tested against a fake that enforces the same version rule.

## ADR-16  Reminders: one digest, two channels, no pretending
`buildDigest` (pure, tested) turns the data and today's date into one summary, used by the WhatsApp share button and the daily email. It returns nothing on a quiet day, so no empty "all clear" mail. Dismissed in-app alerts are still included in the email, which exists to catch a warning that was hidden and forgotten.

WhatsApp is a `wa.me` link the person sends themselves; fully automatic WhatsApp requires a paid business account and approved templates, so it is deliberately out of the free design. The daily email runs as a Supabase Edge Function on a pg_cron schedule, reading the synced snapshot with the service-role key (which never reaches the browser). The function is a plain tested module bundled by esbuild together with the app's own renewal rules, so the email and the screen cannot disagree about what is due. It authenticates the scheduler with a shared secret, reports provider failures as errors, and uses India's date regardless of server timezone. Not verified here: live Supabase scheduling and Resend delivery (no network access from the build environment); the bundle was smoke-tested under a Deno-like stub.

## Planned stack
Angular 21 (standalone, signals, zoneless) - NgRx SignalStore per feature (pin the version matching Angular 21) - Dexie (IndexedDB) - Chart.js via ng2-charts - Angular PWA - Supabase (Postgres, auth, scheduled function) - Vitest + Playwright.
