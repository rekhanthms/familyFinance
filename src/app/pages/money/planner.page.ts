import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppStore } from '../../core/app.store';
import { formatMonthKey, paiseToInputText, parseRupees } from '../../domain';
import { InrPipe, PageHeaderComponent } from '../../shared/ui';

/** Plans only from numbers the person has entered. Anything missing is named, never guessed. */
@Component({
  selector: 'app-planner-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageHeaderComponent, InrPipe],
  template: `
    <app-page-header title="Planner" lead="Plan repayments from the numbers you have recorded." />

    <form class="form-section" (submit)="save($event)" novalidate aria-label="Monthly figures">
      <h2>Your monthly figures</h2>
      <div class="form-grid">
        <div class="field">
          <label class="field__label" for="p-income">Monthly income (₹)</label>
          <input id="p-income" class="input" inputmode="decimal" [value]="income()" (input)="income.set($any($event.target).value)" />
        </div>
        <div class="field">
          <label class="field__label" for="p-exp">Monthly expenses (₹)</label>
          <input id="p-exp" class="input" inputmode="decimal" [value]="expenses()" (input)="expenses.set($any($event.target).value)" aria-describedby="p-exp-hint" />
          <p class="field__hint" id="p-exp-hint">Without loan EMIs, which are added from your loan records.</p>
        </div>
        <div class="field">
          <label class="field__label" for="p-goal">Savings goal (₹)</label>
          <input id="p-goal" class="input" inputmode="decimal" [value]="goal()" (input)="goal.set($any($event.target).value)" />
        </div>
      </div>
      @if (error()) { <p class="field__error" role="alert">{{ error() }}</p> }
      @if (savedNote()) { <p role="status">Saved.</p> }
      <div class="form-actions"><button type="submit" class="btn btn--primary">Save figures</button></div>
    </form>

    <section class="form-section" aria-labelledby="pl-out">
      <h2 id="pl-out">What it shows</h2>
      <dl class="facts">
        <dt>Loan EMIs entered</dt>
        <dd class="num">{{ obligations().total | inr }} a month</dd>
        @if (obligations().hasUnknownEmi) {
          <dt>Missing</dt>
          <dd>An EMI is not entered for at least one loan, so real commitments are higher. <a routerLink="/car-loan">Check the car loan</a>.</dd>
        }
        <dt>Left each month</dt>
        <dd class="num">
          @if (surplus() === null) { Enter income and expenses } @else { {{ surplus() | inr }}{{ obligations().hasUnknownEmi ? ' or less' : '' }} }
        </dd>
        @if (monthsToGoal() !== null) {
          <dt>Time to reach your goal</dt>
          <dd>About {{ monthsToGoal() }} {{ monthsToGoal() === 1 ? 'month' : 'months' }} of saving everything that is left</dd>
        } @else if (surplus() !== null && surplus()! <= 0) {
          <dt>Savings goal</dt>
          <dd>Nothing is left after commitments, so a goal can't be reached at these figures.</dd>
        }
      </dl>
    </section>

    <section class="form-section" aria-labelledby="pl-renew">
      <h2 id="pl-renew">Gold loans falling due, by month</h2>
      <p class="muted">These are the balances up for renewal, not the cash needed. The interest or part-payment the lender asks for is not recorded.</p>
      @if (months().length === 0) {
        <p class="muted">No gold loans yet.</p>
      } @else {
        <ol class="ledger" aria-label="Renewals by month">
          @for (m of months(); track m.month) {
            <li class="ledger__row">
              <span class="ledger__date">{{ m.label }}</span>
              <span>{{ m.count }} {{ m.count === 1 ? 'loan' : 'loans' }}</span>
              <span class="ledger__amount num">{{ m.amount | inr }}</span>
            </li>
          }
        </ol>
      }
    </section>
  `,
})
export class PlannerPage {
  protected readonly store = inject(AppStore);
  protected readonly income = signal('');
  protected readonly expenses = signal('');
  protected readonly goal = signal('');
  protected readonly error = signal('');
  protected readonly savedNote = signal(false);
  private filled = false;

  constructor() {
    effect(() => {
      if (!this.store.loaded() || this.filled) return;
      this.filled = true;
      const s = this.store.data().settings;
      this.income.set(paiseToInputText(s.monthlyIncome));
      this.expenses.set(paiseToInputText(s.monthlyExpenses));
      this.goal.set(paiseToInputText(s.savingsGoal));
    });
  }

  protected readonly obligations = this.store.obligations;
  protected readonly months = computed(() => this.store.renewalsByMonth().map((m) => ({ ...m, label: formatMonthKey(m.month) })));

  private readonly settings = computed(() => this.store.data().settings);
  protected readonly surplus = computed(() => {
    const { monthlyIncome, monthlyExpenses } = this.settings();
    return monthlyIncome == null || monthlyExpenses == null ? null : monthlyIncome - monthlyExpenses - this.obligations().total;
  });
  protected readonly monthsToGoal = computed(() => {
    const { savingsGoal } = this.settings();
    const left = this.surplus();
    return savingsGoal == null || left == null || left <= 0 ? null : Math.ceil(savingsGoal / left);
  });

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    this.savedNote.set(false);
    const income = parseRupees(this.income());
    const expenses = parseRupees(this.expenses());
    const goal = parseRupees(this.goal());
    const bad = [income, expenses, goal].find((p) => !p.ok);
    if (bad && !bad.ok) return this.error.set(bad.error);
    this.error.set('');
    const result = await this.store.updateSettings({
      monthlyIncome: income.ok ? income.value : null,
      monthlyExpenses: expenses.ok ? expenses.value : null,
      savingsGoal: goal.ok ? goal.value : null,
    });
    if (!result.ok) this.error.set(result.errors.join(' '));
    else this.savedNote.set(true);
  }
}
