import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { AppStore } from '../../core/app.store';
import {
  buildSchedule,
  calcEmi,
  carLoanBalance,
  paiseToInputText,
  parseDecimal,
  parseRupees,
  parseWhole,
  rupeesToPaise,
  scheduleBalanceAfter,
  type CarLoan,
} from '../../domain';
import { EmptyStateComponent, InrPipe, PageHeaderComponent } from '../../shared/ui';

@Component({
  selector: 'app-car-loan-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, EmptyStateComponent, InrPipe],
  template: `
    <app-page-header title="Car loan" lead="Balance, EMI and payoff. Only what you enter is shown as fact." />

    @if (!store.loaded()) {
      <p class="muted" role="status">Loading your records…</p>
    } @else if (!store.data().carLoan && !adding()) {
      <app-empty-state title="No car loan recorded" message="Add it to include it in your liabilities and monthly commitments.">
        <button type="button" class="btn btn--primary" (click)="adding.set(true)">Add car loan</button>
      </app-empty-state>
    } @else {
      @if (errors().length > 0) {
        <div class="notice notice--danger error-summary" role="alert" tabindex="-1">
          <div><strong>Fix these before saving:</strong><ul>@for (e of errors(); track e) { <li>{{ e }}</li> }</ul></div>
        </div>
      }
      @if (saved()) { <div class="notice" role="status">Car loan saved.</div> }

      <dl class="facts">
        <dt>Balance</dt>
        <dd class="num">{{ balance().amount | inr }} <span class="muted">{{ balance().basis === 'confirmed' ? 'confirmed' : 'original amount, balance not entered yet' }}</span></dd>
        <dt>EMI</dt>
        <dd class="num">{{ emiShown() }}</dd>
      </dl>

      <form (submit)="save($event)" novalidate>
        <div class="form-grid">
          <div class="field">
            <label class="field__label" for="c-lender">Lender</label>
            <input id="c-lender" class="input" [value]="lender()" (input)="lender.set($any($event.target).value)" />
          </div>
          <div class="field">
            <label class="field__label" for="c-principal">Loan amount (₹)</label>
            <input id="c-principal" class="input" inputmode="decimal" [value]="principal()" (input)="principal.set($any($event.target).value)" [attr.aria-invalid]="fieldErrors()['principal'] ? 'true' : null" />
            @if (fieldErrors()['principal']; as e) { <p class="field__error">{{ e }}</p> }
          </div>
          <div class="field">
            <label class="field__label" for="c-rate">Interest rate (% per year)</label>
            <input id="c-rate" class="input" inputmode="decimal" [value]="rate()" (input)="rate.set($any($event.target).value)" [attr.aria-invalid]="fieldErrors()['rate'] ? 'true' : null" />
            @if (fieldErrors()['rate']; as e) { <p class="field__error">{{ e }}</p> }
          </div>
          <div class="field">
            <label class="field__label" for="c-tenure">Tenure (months)</label>
            <input id="c-tenure" class="input" inputmode="numeric" [value]="tenure()" (input)="tenure.set($any($event.target).value)" [attr.aria-invalid]="fieldErrors()['tenure'] ? 'true' : null" />
            @if (fieldErrors()['tenure']; as e) { <p class="field__error">{{ e }}</p> }
          </div>
          <div class="field">
            <label class="field__label" for="c-emi">EMI from the lender (₹)</label>
            <input id="c-emi" class="input" inputmode="decimal" [value]="emi()" (input)="emi.set($any($event.target).value)" aria-describedby="c-emi-hint" [attr.aria-invalid]="fieldErrors()['emi'] ? 'true' : null" />
            <p class="field__hint" id="c-emi-hint">Your commitments use this figure only. An estimate is never counted.</p>
            @if (fieldErrors()['emi']; as e) { <p class="field__error">{{ e }}</p> }
          </div>
          <div class="field">
            <label class="field__label" for="c-paid">EMIs paid so far</label>
            <input id="c-paid" class="input" inputmode="numeric" [value]="paid()" (input)="paid.set($any($event.target).value)" [attr.aria-invalid]="fieldErrors()['paid'] ? 'true' : null" />
            @if (fieldErrors()['paid']; as e) { <p class="field__error">{{ e }}</p> }
          </div>
          <div class="field">
            <label class="field__label" for="c-out">Confirmed outstanding (₹)</label>
            <input id="c-out" class="input" inputmode="decimal" [value]="outstanding()" (input)="outstanding.set($any($event.target).value)" [attr.aria-invalid]="fieldErrors()['outstanding'] ? 'true' : null" />
            @if (fieldErrors()['outstanding']; as e) { <p class="field__error">{{ e }}</p> }
          </div>
          <div class="field">
            <label class="field__label" for="c-start">First EMI date</label>
            <input id="c-start" class="input" type="date" [value]="startDate()" (input)="startDate.set($any($event.target).value)" />
          </div>
          <div class="field">
            <label class="field__label" for="c-next">Next EMI date</label>
            <input id="c-next" class="input" type="date" [value]="nextDate()" (input)="nextDate.set($any($event.target).value)" />
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn--primary">Save car loan</button>
        </div>
      </form>

      <section class="form-section" aria-labelledby="c-est">
        <h2 id="c-est">Estimate</h2>
        @if (estimate(); as est) {
          <p>
            At {{ est.rate }}% over {{ est.months }} months the EMI works out to about <strong class="num">{{ est.emi | inr }}</strong>.
            This is a calculation, not your lender's figure.
            <button type="button" class="btn btn--secondary btn--small" (click)="useEstimate(est.emi)">Use as EMI</button>
          </p>
          @if (est.balanceAfterPaid != null && est.paid > 0) {
            <p class="muted">After {{ est.paid }} EMIs the schedule says about {{ est.balanceAfterPaid | inr }} remains. Enter the lender's balance above to replace this.</p>
          }
          <details>
            <summary>Show the repayment schedule</summary>
            <div class="table-wrap">
              <table class="table">
                <caption class="visually-hidden">Estimated repayment schedule</caption>
                <thead><tr><th scope="col">No.</th><th scope="col" class="num-col">EMI</th><th scope="col" class="num-col">Interest</th><th scope="col" class="num-col">Principal</th><th scope="col" class="num-col">Balance</th></tr></thead>
                <tbody>
                  @for (row of est.rows; track row.installment) {
                    <tr>
                      <td class="num">{{ row.installment }}</td>
                      <td class="num num-col">{{ row.emi | inr }}</td>
                      <td class="num num-col">{{ row.interest | inr }}</td>
                      <td class="num num-col">{{ row.principal | inr }}</td>
                      <td class="num num-col">{{ row.balance | inr }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </details>
        } @else {
          <p class="muted">Enter the interest rate and tenure to see an estimated EMI. Until then nothing is calculated.</p>
        }
      </section>
    }
  `,
})
export class CarLoanPage {
  protected readonly store = inject(AppStore);
  protected readonly adding = signal(false);

  protected readonly lender = signal('');
  protected readonly principal = signal('');
  protected readonly rate = signal('');
  protected readonly tenure = signal('');
  protected readonly emi = signal('');
  protected readonly paid = signal('0');
  protected readonly outstanding = signal('');
  protected readonly startDate = signal('');
  protected readonly nextDate = signal('');

  protected readonly errors = signal<string[]>([]);
  protected readonly fieldErrors = signal<Record<string, string>>({});
  protected readonly saved = signal(false);

  private filled = false;

  constructor() {
    effect(() => {
      const car = this.store.data().carLoan;
      if (!car || this.filled) return;
      this.filled = true;
      this.lender.set(car.lender ?? '');
      this.principal.set(paiseToInputText(car.principal));
      this.rate.set(car.interestRatePercent == null ? '' : String(car.interestRatePercent));
      this.tenure.set(car.tenureMonths == null ? '' : String(car.tenureMonths));
      this.emi.set(paiseToInputText(car.emi));
      this.paid.set(String(car.installmentsPaid));
      this.outstanding.set(paiseToInputText(car.outstandingPrincipal));
      this.startDate.set(car.startDate ?? '');
      this.nextDate.set(car.nextEmiDate ?? '');
    });
  }

  protected readonly balance = computed(() => {
    const car = this.store.data().carLoan;
    return car ? carLoanBalance(car) : { amount: 0, basis: 'recorded' as const };
  });

  protected readonly emiShown = computed(() => {
    const emi = this.store.data().carLoan?.emi;
    return emi == null ? 'Not entered yet' : `₹${paiseToInputText(emi)} a month`;
  });

  /** Live estimate from the boxes as typed, so the person sees it before saving. */
  protected readonly estimate = computed(() => {
    const principal = parseRupees(this.principal());
    const rate = parseDecimal(this.rate());
    const months = parseWhole(this.tenure());
    const paid = parseWhole(this.paid());
    if (!principal.ok || !rate.ok || !months.ok || principal.value == null || rate.value == null || months.value == null) return null;
    const emi = calcEmi(principal.value, rate.value, months.value);
    if (emi == null) return null;
    const rows = buildSchedule({ principal: principal.value, annualRatePercent: rate.value, tenureMonths: months.value, firstEmiDate: this.startDate() || null }) ?? [];
    const paidCount = paid.ok && paid.value != null ? paid.value : 0;
    return { emi, rate: rate.value, months: months.value, rows, paid: paidCount, balanceAfterPaid: scheduleBalanceAfter(rows, paidCount) };
  });

  protected useEstimate(emi: number): void {
    this.emi.set(paiseToInputText(emi));
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    this.saved.set(false);
    const fe: Record<string, string> = {};
    const messages: string[] = [];
    const read = <T>(name: string, label: string, parsed: { ok: true; value: T | null } | { ok: false; error: string }): T | null => {
      if (parsed.ok) return parsed.value;
      fe[name] = parsed.error;
      messages.push(`${label}: ${parsed.error}`);
      return null;
    };

    const principal = read('principal', 'Loan amount', parseRupees(this.principal()));
    if (principal == null && !fe['principal']) {
      fe['principal'] = 'Enter the loan amount.';
      messages.push('Loan amount: enter the loan amount.');
    }
    const rate = read('rate', 'Interest rate', parseDecimal(this.rate()));
    const tenure = read('tenure', 'Tenure', parseWhole(this.tenure()));
    const emi = read('emi', 'EMI', parseRupees(this.emi()));
    const outstanding = read('outstanding', 'Outstanding', parseRupees(this.outstanding()));
    const paidText = this.paid().trim() === '' ? '0' : this.paid().trim();
    const paid = /^\d+$/.test(paidText) ? Number(paidText) : null;
    if (paid == null) {
      fe['paid'] = 'Enter a whole number, 0 or more.';
      messages.push('EMIs paid: enter a whole number, 0 or more.');
    } else if (tenure != null && paid > tenure) {
      fe['paid'] = 'More than the tenure.';
      messages.push('EMIs paid cannot be more than the tenure.');
    }
    if (principal != null && outstanding != null && outstanding > principal) {
      fe['outstanding'] = 'More than the loan amount.';
      messages.push('Outstanding cannot be more than the loan amount.');
    }
    this.fieldErrors.set(fe);
    this.errors.set(messages);
    if (messages.length > 0) {
      queueMicrotask(() => document.querySelector<HTMLElement>('.error-summary')?.focus());
      return;
    }

    const base = this.store.data().carLoan;
    const car: CarLoan = {
      id: base?.id ?? this.store.newId(),
      updatedAt: base?.updatedAt ?? '',
      lender: this.lender().trim() || null,
      principal: principal ?? rupeesToPaise(0),
      startDate: this.startDate() || null,
      interestRatePercent: rate,
      tenureMonths: tenure,
      emi,
      installmentsPaid: paid ?? 0,
      outstandingPrincipal: outstanding,
      nextEmiDate: this.nextDate() || null,
      repayments: base?.repayments ?? [],
    };
    const result = await this.store.saveCarLoan(car);
    if (!result.ok) this.errors.set(result.errors);
    else this.saved.set(true);
  }
}
