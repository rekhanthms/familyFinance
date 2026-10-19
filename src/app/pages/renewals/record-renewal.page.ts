import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AppStore } from '../../core/app.store';
import { formatIndianDate, jewelrySummary, parseDecimal, parseRupees, suggestNextRenewalDate } from '../../domain';
import { EmptyStateComponent, PageHeaderComponent } from '../../shared/ui';
import { ownerOf } from '../owner';

/** "Record renewal": the only way a loan becomes Renewed. Dismissing an alert never does this. */
@Component({
  selector: 'app-record-renewal-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageHeaderComponent, EmptyStateComponent],
  template: `
    @if (!store.loaded()) {
      <p class="muted" role="status">Loading your records…</p>
    } @else if (loan(); as l) {
      <app-page-header title="Record renewal" [lead]="summary()" />

      @if (errors().length > 0) {
        <div class="notice notice--danger error-summary" role="alert" tabindex="-1">
          <div>
            <strong>Fix these before saving:</strong>
            <ul>@for (e of errors(); track e) { <li>{{ e }}</li> }</ul>
          </div>
        </div>
      }

      <form (submit)="save($event)" novalidate>
        <div class="form-grid">
          <div class="field">
            <label class="field__label" for="r-done">Renewed on</label>
            <input id="r-done" class="input" type="date" [value]="completedOn()" [attr.max]="store.today()" (input)="completedOn.set($any($event.target).value)" />
          </div>
          <div class="field">
            <label class="field__label" for="r-next">New renewal date</label>
            <input id="r-next" class="input" type="date" [value]="newDate()" (input)="newDate.set($any($event.target).value)" aria-describedby="r-next-hint" />
            <p class="field__hint" id="r-next-hint">
              {{ suggestion() ? 'Filled in from the ' + l.renewalIntervalMonths + '-month interval you recorded. Change it if the lender gave a different date.' : 'Enter the date the lender gave you. No interval is recorded for this loan.' }}
            </p>
          </div>
          <div class="field">
            <label class="field__label" for="r-out">New outstanding (₹, optional)</label>
            <input id="r-out" class="input" inputmode="decimal" [value]="outstanding()" (input)="outstanding.set($any($event.target).value)" />
          </div>
          <div class="field">
            <label class="field__label" for="r-rate">New interest rate (% per year, optional)</label>
            <input id="r-rate" class="input" inputmode="decimal" [value]="rate()" (input)="rate.set($any($event.target).value)" />
          </div>
          <div class="field">
            <label class="field__label" for="r-ref">Lender receipt or reference (optional)</label>
            <input id="r-ref" class="input" [value]="reference()" (input)="reference.set($any($event.target).value)" />
          </div>
          <div class="field">
            <label class="field__label" for="r-notes">Notes (optional)</label>
            <textarea id="r-notes" class="textarea" [value]="notes()" (input)="notes.set($any($event.target).value)"></textarea>
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn--primary" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Save renewal' }}</button>
          <a class="btn btn--secondary" [routerLink]="['/gold-loans', l.id]">Cancel</a>
        </div>
      </form>
    } @else {
      <app-page-header title="Record renewal" />
      <app-empty-state title="This loan no longer exists" message="It may have been deleted.">
        <a class="btn btn--secondary" routerLink="/renewals">Back to renewals</a>
      </app-empty-state>
    }
  `,
})
export class RecordRenewalPage {
  protected readonly store = inject(AppStore);
  private readonly router = inject(Router);

  readonly id = input.required<string>();
  protected readonly loan = computed(() => this.store.data().goldLoans.find((l) => l.id === this.id()) ?? null);

  protected readonly completedOn = signal('');
  protected readonly newDate = signal('');
  protected readonly outstanding = signal('');
  protected readonly rate = signal('');
  protected readonly reference = signal('');
  protected readonly notes = signal('');
  protected readonly errors = signal<string[]>([]);
  protected readonly saving = signal(false);

  protected readonly suggestion = computed(() => {
    const loan = this.loan();
    return loan ? suggestNextRenewalDate(loan) : null;
  });

  protected readonly summary = computed(() => {
    const loan = this.loan();
    if (!loan) return '';
    const owner = ownerOf(this.store.membersById(), loan.memberId).name;
    return `${owner}: ${jewelrySummary(loan.jewelry)}. Currently due ${formatIndianDate(loan.renewalDate)}.`;
  });

  private initialised = false;

  constructor() {
    effect(() => {
      if (this.initialised || !this.loan()) return;
      this.initialised = true;
      this.completedOn.set(this.store.today());
      this.newDate.set(this.suggestion() ?? '');
    });
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    const loan = this.loan();
    if (!loan || this.saving()) return;

    const problems: string[] = [];
    const out = parseRupees(this.outstanding());
    const rate = parseDecimal(this.rate());
    if (!out.ok) problems.push(`New outstanding: ${out.error}`);
    if (!rate.ok) problems.push(`New interest rate: ${rate.error}`);
    if (problems.length > 0) return this.fail(problems);

    this.saving.set(true);
    const result = await this.store.recordRenewal({
      loanId: loan.id,
      previousRenewalDate: loan.renewalDate,
      completedOn: this.completedOn(),
      newRenewalDate: this.newDate(),
      updatedOutstanding: out.ok ? out.value : null,
      updatedInterestRatePercent: rate.ok ? rate.value : null,
      lenderReference: this.reference().trim() || undefined,
      notes: this.notes().trim() || undefined,
    });
    this.saving.set(false);
    if (!result.ok) return this.fail(result.errors);
    await this.router.navigate(['/gold-loans', loan.id]);
  }

  private fail(errors: string[]): void {
    this.errors.set(errors);
    queueMicrotask(() => document.querySelector<HTMLElement>('.error-summary')?.focus());
  }
}
