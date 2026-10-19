import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppStore } from '../core/app.store';
import {
  describeDaysRemaining,
  formatMonthKey,
  goldLoanBalance,
  goldLoansByMember,
  jewelrySummary,
  needsAttention,
  renewalConcentrationByMonth,
  reconcileTotal,
  REGISTER_WRITTEN_TOTAL,
  sumPaise,
  totalGoldLoans,
  UNASSIGNED_COLOR,
  UNASSIGNED_LABEL,
} from '../domain';
import {
  EmptyStateComponent,
  IndianDatePipe,
  InrPipe,
  MemberChipComponent,
  PageHeaderComponent,
  StatusBadgeComponent,
} from '../shared/ui';

@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageHeaderComponent, EmptyStateComponent, StatusBadgeComponent, MemberChipComponent, InrPipe, IndianDatePipe],
  template: `
    <app-page-header title="Dashboard" [lead]="scopeLabel()" />

    @if (!store.loaded()) {
      <p class="muted" role="status">Loading your records…</p>
    } @else if (loanCount() === 0) {
      <app-empty-state title="No gold loans to show" message="Add a loan, or pick Whole family at the top.">
        <a class="btn btn--primary" routerLink="/gold-loans/new">Add loan</a>
      </app-empty-state>
    } @else {
      <dl class="figures" aria-label="Summary">
        <div>
          <dt>Gold loans</dt>
          <dd class="num">{{ total().total | inr }}</dd>
          <dd class="figures__note">
            {{ loanCount() }} {{ loanCount() === 1 ? 'loan' : 'loans' }}.
            {{ total().recordedCount > 0 ? total().recordedCount + ' still use the register amount, not a confirmed balance.' : 'All balances confirmed.' }}
          </dd>
        </div>
        <div>
          <dt>Need action in the next 30 days</dt>
          <dd class="num">{{ due().count }}</dd>
          <dd class="figures__note">@if (due().count) { {{ due().amount | inr }} to arrange } @else { Nothing is due soon. }</dd>
        </div>
        <div>
          <dt>Waiting to be verified</dt>
          <dd class="num">{{ unverified() }}</dd>
          <dd class="figures__note">{{ unverified() ? 'Compare each with the lender, then mark it verified.' : 'Every loan is verified.' }}</dd>
        </div>
      </dl>

      @if (mismatch(); as m) {
        <div class="notice notice--warn register-check" role="status">
          <span>
            <strong>Register total doesn't match.</strong>
            Loans add up to {{ m.computed | inr }}; your register says {{ m.written | inr }}. Difference {{ m.difference | inr }}.
          </span>
        </div>
      }

      <h2 class="group-title">Needs action</h2>
      @if (rows().length === 0) {
        <p class="muted">No renewal falls inside the next 30 days. <a routerLink="/renewals">See the full calendar</a>.</p>
      } @else {
        <ol class="ledger" aria-label="Renewals needing action">
          @for (row of rows(); track row.id) {
            <li class="ledger__row">
              <span class="ledger__date num">{{ row.renewalDate | indianDate }}</span>
              <div>
                <app-status-badge [status]="row.status" />
                <span class="ledger__sub">{{ row.when }}</span>
                <a class="row-link" [routerLink]="['/gold-loans', row.id]"><strong>{{ row.jewelry }}</strong></a>
                <app-member-chip [name]="row.ownerName" [color]="row.ownerColor" />
              </div>
              <span class="ledger__amount num">{{ row.amount | inr }}</span>
            </li>
          }
        </ol>
      }

      <div class="split">
        <section aria-labelledby="by-member">
          <h2 class="group-title" id="by-member">By family member</h2>
          <ul class="bars">
            @for (m of byMember(); track m.name) {
              <li>
                <div class="bars__label"><app-member-chip [name]="m.name" [color]="m.color" /> <span class="ledger__sub">{{ m.count }} {{ m.count === 1 ? 'loan' : 'loans' }}</span></div>
                <div class="bars__track" aria-hidden="true"><span class="bars__fill" [style.width.%]="m.share" [style.background]="m.color"></span></div>
                <span class="num bars__value">{{ m.total | inr }}</span>
              </li>
            }
          </ul>
        </section>

        <section aria-labelledby="by-month">
          <h2 class="group-title" id="by-month">Renewals by month</h2>
          <ul class="bars">
            @for (m of byMonth(); track m.key) {
              <li>
                <div class="bars__label"><strong>{{ m.label }}</strong> <span class="ledger__sub">{{ m.count }} {{ m.count === 1 ? 'loan' : 'loans' }}</span></div>
                <div class="bars__track" aria-hidden="true"><span class="bars__fill bars__fill--forest" [style.width.%]="m.share"></span></div>
                <span class="num bars__value">{{ m.amount | inr }}</span>
              </li>
            }
          </ul>
          @if (busiest(); as b) {
            <p class="muted">{{ b.label }} is the heaviest month with {{ b.count }} renewals. Plan the money for it early.</p>
          }
        </section>
      </div>
    }
  `,
  styles: `
    .figures {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
      gap: var(--sp-5);
      margin: var(--sp-4) 0 var(--sp-5);
      padding-top: var(--sp-3);
      border-top: 2px solid var(--c-ink);
    }
    .figures dt {
      color: var(--c-ink-muted);
      font-size: var(--fs-sm);
    }
    .figures dd {
      margin: 0;
    }
    .figures .num {
      font-size: var(--fs-xl);
      font-weight: 800;
      line-height: 1.2;
    }
    .figures__note {
      margin-top: var(--sp-1);
      font-size: var(--fs-xs);
      color: var(--c-ink-muted);
    }
    .split {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
      gap: var(--sp-6);
    }
    .bars {
      margin: 0;
      padding: 0;
      list-style: none;
      border-top: 2px solid var(--c-ink);
    }
    .bars li {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: var(--sp-1) var(--sp-3);
      padding: var(--sp-3) 0;
      border-bottom: 1px solid var(--c-rule);
    }
    .bars__track {
      grid-column: 1 / -1;
      height: 0.5rem;
      background: var(--c-sunken);
    }
    .bars__fill {
      display: block;
      height: 100%;
    }
    .bars__fill--forest {
      background: var(--c-forest);
    }
    .bars__value {
      font-weight: 700;
      text-align: right;
      grid-row: 1;
      grid-column: 2;
    }
  `,
})
export class DashboardPage {
  protected readonly store = inject(AppStore);

  private readonly scoped = computed(() => this.store.filteredRenewalViews());
  private readonly loans = computed(() => this.scoped().map((v) => v.loan));
  protected readonly loanCount = computed(() => this.loans().length);

  protected readonly scopeLabel = computed(() => {
    const filter = this.store.effectiveMemberFilter();
    if (filter === 'all') return 'The whole family at a glance.';
    if (filter === 'unassigned') return 'Loans whose owner is not confirmed yet.';
    return `${this.store.membersById().get(filter)?.fullName ?? 'This member'}'s loans.`;
  });

  protected readonly total = computed(() => totalGoldLoans(this.loans()));
  protected readonly unverified = computed(() => this.loans().filter((l) => l.verification === 'needs-verification').length);

  protected readonly due = computed(() => {
    const needing = this.scoped().filter((v) => needsAttention(v.status));
    return { count: needing.length, amount: sumPaise(needing.map((v) => goldLoanBalance(v.loan).amount)) };
  });

  /**
   * The register's hand-written total only means something for the whole family, and only while the
   * loans are still the unverified ones copied from it.
   */
  protected readonly mismatch = computed(() => {
    if (this.store.effectiveMemberFilter() !== 'all') return null;
    const all = this.store.data().goldLoans;
    if (!all.some((l) => l.verification === 'needs-verification')) return null;
    const check = reconcileTotal(all, REGISTER_WRITTEN_TOTAL);
    return check.matches ? null : { ...check, difference: Math.abs(check.difference) };
  });

  protected readonly rows = computed(() =>
    this.store.filteredUrgentRenewals().map((view) => {
      const owner = view.loan.memberId ? this.store.membersById().get(view.loan.memberId) : undefined;
      return {
        id: view.loanId,
        status: view.status,
        renewalDate: view.renewalDate,
        when: describeDaysRemaining(view.daysRemaining),
        jewelry: jewelrySummary(view.loan.jewelry),
        ownerName: owner?.fullName ?? UNASSIGNED_LABEL,
        ownerColor: owner?.color ?? UNASSIGNED_COLOR,
        amount: goldLoanBalance(view.loan).amount,
      };
    }),
  );

  protected readonly byMember = computed(() => {
    const groups = goldLoansByMember(this.loans(), this.store.data().members);
    const max = Math.max(1, ...groups.map((g) => g.total));
    return groups.map((g) => ({ ...g, share: (g.total / max) * 100 }));
  });

  protected readonly byMonth = computed(() => {
    const months = renewalConcentrationByMonth(this.loans());
    const max = Math.max(1, ...months.map((m) => m.amount));
    return months.map((m) => ({ ...m, key: m.month, label: formatMonthKey(m.month), share: (m.amount / max) * 100 }));
  });

  protected readonly busiest = computed(() => {
    const months = this.byMonth();
    if (months.length < 2) return null;
    const top = months.reduce((a, b) => (b.count > a.count ? b : a));
    return top.count >= 3 ? top : null;
  });
}
