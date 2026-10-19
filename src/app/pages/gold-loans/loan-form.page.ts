import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AppStore } from '../../core/app.store';
import {
  JEWELRY_TYPES,
  paiseToInputText,
  parseDecimal,
  parseRupees,
  parseWhole,
  UNASSIGNED_LABEL,
  validateGoldLoan,
  type GoldLoan,
  type InterestMethod,
  type JewelryItem,
} from '../../domain';
import { EmptyStateComponent, PageHeaderComponent } from '../../shared/ui';

interface JewelryRow {
  key: number;
  type: string;
  quantity: string;
  description: string;
}

/** Add or edit one gold loan. Route `/gold-loans/new` has no id; `/gold-loans/:id/edit` has one. */
@Component({
  selector: 'app-loan-form-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageHeaderComponent, EmptyStateComponent],
  template: `
    @if (!store.loaded()) {
      <p class="muted" role="status">Loading your records…</p>
    } @else if (id() && !existing()) {
      <app-page-header title="Loan not found" />
      <app-empty-state title="This loan no longer exists" message="It may have been deleted.">
        <a class="btn btn--secondary" routerLink="/gold-loans">Back to gold loans</a>
      </app-empty-state>
    } @else {
      <app-page-header [title]="id() ? 'Edit gold loan' : 'Add gold loan'" lead="Leave a box blank if you don't know the value yet." />

      @if (errors().length > 0) {
        <div class="notice notice--danger error-summary" role="alert" tabindex="-1">
          <div>
            <strong>Fix these before saving:</strong>
            <ul>@for (e of errors(); track e) { <li>{{ e }}</li> }</ul>
          </div>
        </div>
      }

      <form (submit)="save($event)" novalidate>
        <section class="form-section" aria-labelledby="f-who">
          <h2 id="f-who">Who and where</h2>
          <div class="form-grid">
            <div class="field">
              <label class="field__label" for="f-owner">Owner</label>
              <select id="f-owner" class="select" (change)="memberId.set($any($event.target).value)">
                <option value="" [selected]="memberId() === ''">{{ unassigned }}</option>
                @for (m of store.data().members; track m.id) {
                  <option [value]="m.id" [selected]="memberId() === m.id">{{ m.fullName }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label class="field__label" for="f-lender">Lender</label>
              <input id="f-lender" class="input" [value]="lender()" (input)="lender.set($any($event.target).value)" />
            </div>
            <div class="field">
              <label class="field__label" for="f-ref">Loan reference, last 4 digits</label>
              <input id="f-ref" class="input" inputmode="numeric" maxlength="12" placeholder="••••2724" [value]="accountRef()" (input)="accountRef.set($any($event.target).value)" [attr.aria-invalid]="fieldErrors()['ref'] ? 'true' : null" aria-describedby="f-ref-hint" />
              <p class="field__hint" id="f-ref-hint">Never enter a full account number.</p>
              @if (fieldErrors()['ref']; as e) { <p class="field__error">{{ e }}</p> }
            </div>
          </div>
        </section>

        <section class="form-section" aria-labelledby="f-jewel">
          <h2 id="f-jewel">Jewellery pledged</h2>
          @for (row of jewelry(); track row.key; let i = $index) {
            <div class="form-grid">
              <div class="field">
                <label class="field__label" [for]="'j-type-' + row.key">Item {{ i + 1 }} type</label>
                <select [id]="'j-type-' + row.key" class="select" (change)="updateRow(row.key, 'type', $any($event.target).value)">
                  @for (t of jewelryTypes; track t) { <option [value]="t" [selected]="row.type === t">{{ t }}</option> }
                </select>
              </div>
              <div class="field">
                <label class="field__label" [for]="'j-qty-' + row.key">Quantity</label>
                <input [id]="'j-qty-' + row.key" class="input" inputmode="numeric" [value]="row.quantity" (input)="updateRow(row.key, 'quantity', $any($event.target).value)" />
              </div>
              <div class="field">
                <label class="field__label" [for]="'j-desc-' + row.key">Details (optional)</label>
                <input [id]="'j-desc-' + row.key" class="input" [value]="row.description" (input)="updateRow(row.key, 'description', $any($event.target).value)" />
              </div>
              <div class="field">
                <span class="field__label">&nbsp;</span>
                <button type="button" class="btn btn--ghost" (click)="removeRow(row.key)" [disabled]="jewelry().length === 1">Remove item {{ i + 1 }}</button>
              </div>
            </div>
          }
          <button type="button" class="btn btn--secondary" (click)="addRow()">Add another item</button>
        </section>

        <section class="form-section" aria-labelledby="f-money">
          <h2 id="f-money">Amounts and interest</h2>
          <div class="form-grid">
            <div class="field">
              <label class="field__label" for="f-amount">Loan amount in the register (₹)</label>
              <input id="f-amount" class="input" inputmode="decimal" [value]="recorded()" (input)="recorded.set($any($event.target).value)" [attr.aria-invalid]="fieldErrors()['recorded'] ? 'true' : null" />
              @if (fieldErrors()['recorded']; as e) { <p class="field__error">{{ e }}</p> }
            </div>
            <div class="field">
              <label class="field__label" for="f-out">Confirmed outstanding (₹)</label>
              <input id="f-out" class="input" inputmode="decimal" [value]="outstanding()" (input)="outstanding.set($any($event.target).value)" aria-describedby="f-out-hint" [attr.aria-invalid]="fieldErrors()['outstanding'] ? 'true' : null" />
              <p class="field__hint" id="f-out-hint">Blank until you confirm it with the lender. Totals use the register amount meanwhile.</p>
              @if (fieldErrors()['outstanding']; as e) { <p class="field__error">{{ e }}</p> }
            </div>
            <div class="field">
              <label class="field__label" for="f-rate">Interest rate (% per year)</label>
              <input id="f-rate" class="input" inputmode="decimal" [value]="rate()" (input)="rate.set($any($event.target).value)" [attr.aria-invalid]="fieldErrors()['rate'] ? 'true' : null" />
              @if (fieldErrors()['rate']; as e) { <p class="field__error">{{ e }}</p> }
            </div>
            <div class="field">
              <label class="field__label" for="f-method">Interest method</label>
              <select id="f-method" class="select" (change)="method.set($any($event.target).value)">
                <option value="" [selected]="method() === ''">Not known</option>
                <option value="simple" [selected]="method() === 'simple'">Simple</option>
                <option value="compound" [selected]="method() === 'compound'">Compound</option>
                <option value="reducing" [selected]="method() === 'reducing'">Reducing balance</option>
              </select>
            </div>
          </div>
        </section>

        <section class="form-section" aria-labelledby="f-dates">
          <h2 id="f-dates">Dates</h2>
          <div class="form-grid">
            <div class="field">
              <label class="field__label" for="f-renewal">Renewal due date</label>
              <input id="f-renewal" class="input" type="date" [value]="renewalDate()" (input)="renewalDate.set($any($event.target).value)" />
            </div>
            <div class="field">
              <label class="field__label" for="f-pledge">Pledge date (optional)</label>
              <input id="f-pledge" class="input" type="date" [value]="pledgeDate()" (input)="pledgeDate.set($any($event.target).value)" />
            </div>
            <div class="field">
              <label class="field__label" for="f-interval">Renewal every (months)</label>
              <input id="f-interval" class="input" inputmode="numeric" [value]="interval()" (input)="interval.set($any($event.target).value)" aria-describedby="f-int-hint" [attr.aria-invalid]="fieldErrors()['interval'] ? 'true' : null" />
              <p class="field__hint" id="f-int-hint">Only if you know it. It lets "Record renewal" suggest the next date.</p>
              @if (fieldErrors()['interval']; as e) { <p class="field__error">{{ e }}</p> }
            </div>
          </div>
        </section>

        <section class="form-section" aria-labelledby="f-more">
          <h2 id="f-more">Checks and notes</h2>
          <div class="form-grid">
            <div class="field">
              <label class="field__label" for="f-verify">Verification</label>
              <select id="f-verify" class="select" (change)="verified.set($any($event.target).value === 'verified')">
                <option value="needs-verification" [selected]="!verified()">Needs verification</option>
                <option value="verified" [selected]="verified()">Verified against lender records</option>
              </select>
            </div>
            <div class="field">
              <label class="field__label" for="f-notes">Notes</label>
              <textarea id="f-notes" class="textarea" [value]="notes()" (input)="notes.set($any($event.target).value)"></textarea>
            </div>
          </div>
        </section>

        <div class="form-actions">
          <button type="submit" class="btn btn--primary" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Save loan' }}</button>
          <a class="btn btn--secondary" [routerLink]="id() ? ['/gold-loans', id()] : ['/gold-loans']">Cancel</a>
        </div>
      </form>
    }
  `,
})
export class LoanFormPage {
  protected readonly store = inject(AppStore);
  private readonly router = inject(Router);

  /** Bound from the route (`:id`). Absent when adding. */
  readonly id = input<string | undefined>(undefined);

  protected readonly unassigned = UNASSIGNED_LABEL;
  protected readonly jewelryTypes = JEWELRY_TYPES;
  protected readonly existing = computed(() => this.store.data().goldLoans.find((l) => l.id === this.id()) ?? null);

  protected readonly memberId = signal('');
  protected readonly lender = signal('');
  protected readonly accountRef = signal('');
  protected readonly recorded = signal('');
  protected readonly outstanding = signal('');
  protected readonly rate = signal('');
  protected readonly method = signal<InterestMethod | ''>('');
  protected readonly renewalDate = signal('');
  protected readonly pledgeDate = signal('');
  protected readonly interval = signal('');
  protected readonly verified = signal(false);
  protected readonly notes = signal('');
  protected readonly jewelry = signal<JewelryRow[]>([{ key: 1, type: JEWELRY_TYPES[0], quantity: '1', description: '' }]);

  protected readonly errors = signal<string[]>([]);
  protected readonly fieldErrors = signal<Record<string, string>>({});
  protected readonly saving = signal(false);
  private nextKey = 2;
  private loadedFor: string | null = null;

  constructor() {
    // Fill the form once, when the stored loan is available. Later store changes must not overwrite typing.
    effect(() => {
      const loan = this.existing();
      if (!loan || this.loadedFor === loan.id) return;
      this.loadedFor = loan.id;
      this.memberId.set(loan.memberId ?? '');
      this.lender.set(loan.lender ?? '');
      this.accountRef.set(loan.accountRef ?? '');
      this.recorded.set(paiseToInputText(loan.recordedAmount));
      this.outstanding.set(paiseToInputText(loan.outstandingAmount));
      this.rate.set(loan.interestRatePercent == null ? '' : String(loan.interestRatePercent));
      this.method.set(loan.interestMethod ?? '');
      this.renewalDate.set(loan.renewalDate);
      this.pledgeDate.set(loan.pledgeDate ?? '');
      this.interval.set(loan.renewalIntervalMonths == null ? '' : String(loan.renewalIntervalMonths));
      this.verified.set(loan.verification === 'verified');
      this.notes.set(loan.notes ?? '');
      this.jewelry.set(
        loan.jewelry.map((item) => ({ key: this.nextKey++, type: item.type, quantity: String(item.quantity), description: item.description ?? '' })),
      );
    });
  }

  protected addRow(): void {
    this.jewelry.update((rows) => [...rows, { key: this.nextKey++, type: JEWELRY_TYPES[0], quantity: '1', description: '' }]);
  }

  protected removeRow(key: number): void {
    this.jewelry.update((rows) => (rows.length > 1 ? rows.filter((r) => r.key !== key) : rows));
  }

  protected updateRow(key: number, field: 'type' | 'quantity' | 'description', value: string): void {
    this.jewelry.update((rows) => rows.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    if (this.saving()) return;

    const fieldErrors: Record<string, string> = {};
    const messages: string[] = [];
    const take = <T>(name: string, label: string, parsed: ReturnType<typeof parseRupees> | ReturnType<typeof parseDecimal>): T | null => {
      if (parsed.ok) return parsed.value as T | null;
      fieldErrors[name] = parsed.error;
      messages.push(`${label}: ${parsed.error}`);
      return null;
    };

    const recorded = take<number>('recorded', 'Loan amount', parseRupees(this.recorded()));
    const outstanding = take<number>('outstanding', 'Outstanding', parseRupees(this.outstanding()));
    const rate = take<number>('rate', 'Interest rate', parseDecimal(this.rate()));
    const intervalParsed = parseWhole(this.interval());
    const interval = intervalParsed.ok ? intervalParsed.value : null;
    if (!intervalParsed.ok) {
      fieldErrors['interval'] = intervalParsed.error;
      messages.push(`Renewal interval: ${intervalParsed.error}`);
    }
    if (this.recorded().trim() === '' && !fieldErrors['recorded']) {
      fieldErrors['recorded'] = 'Enter the amount written in the register.';
      messages.push('Loan amount: enter the amount written in the register.');
    }

    // A pasted full account number must never be stored.
    const ref = this.accountRef().trim();
    if (ref.replace(/\D/g, '').length > 4 && !ref.includes('•')) {
      fieldErrors['ref'] = 'Enter only the last 4 digits.';
      messages.push('Loan reference: enter only the last 4 digits, never the full number.');
    }

    const jewelry: JewelryItem[] = this.jewelry().map((row) => ({
      type: row.type,
      quantity: Number(row.quantity),
      ...(row.description.trim() ? { description: row.description.trim() } : {}),
    }));

    const base = this.existing();
    const loan: GoldLoan = {
      id: base?.id ?? this.store.newId(),
      updatedAt: base?.updatedAt ?? '',
      memberId: this.memberId() || null,
      lender: this.lender().trim() || null,
      accountRef: ref ? (/^\d{1,4}$/.test(ref) ? `••••${ref}` : ref) : null,
      jewelry,
      recordedAmount: recorded ?? 0,
      outstandingAmount: outstanding,
      interestRatePercent: rate,
      interestMethod: this.method() || null,
      pledgeDate: this.pledgeDate() || null,
      renewalDate: this.renewalDate(),
      renewalIntervalMonths: interval,
      repayments: base?.repayments ?? [],
      renewals: base?.renewals ?? [],
      verification: this.verified() ? 'verified' : 'needs-verification',
      ...(this.notes().trim() ? { notes: this.notes().trim() } : {}),
    };

    // Don't repeat a parse problem the domain check would also report for the same field.
    const domainProblems = validateGoldLoan(loan).filter(
      (p) => !(fieldErrors['recorded'] && p.startsWith('Loan amount')) && !(fieldErrors['interval'] && p.startsWith('Renewal interval')),
    );
    const all = [...messages, ...domainProblems];
    this.fieldErrors.set(fieldErrors);
    this.errors.set(all);
    if (all.length > 0) {
      queueMicrotask(() => document.querySelector<HTMLElement>('.error-summary')?.focus());
      return;
    }

    this.saving.set(true);
    const result = await this.store.saveGoldLoan(loan);
    this.saving.set(false);
    if (!result.ok) {
      this.errors.set(result.errors);
      return;
    }
    await this.router.navigate(['/gold-loans', result.value.id]);
  }
}
