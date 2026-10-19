import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppStore } from '../../core/app.store';
import {
  describeDaysRemaining,
  filterLoanViews,
  goldLoanBalance,
  goldLoansToCsv,
  jewelrySummary,
  STATUS_LABELS,
  sumPaise,
  type RenewalStatus,
} from '../../domain';
import { downloadTextFile } from '../../shared/download';
import { EmptyStateComponent, IndianDatePipe, InrPipe, MemberChipComponent, PageHeaderComponent, StatusBadgeComponent } from '../../shared/ui';
import { ownerOf } from '../owner';

const STATUS_ORDER: RenewalStatus[] = ['overdue', 'due-today', 'urgent', 'due-soon', 'upcoming', 'renewed'];

@Component({
  selector: 'app-gold-loans-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageHeaderComponent, EmptyStateComponent, StatusBadgeComponent, MemberChipComponent, InrPipe, IndianDatePipe],
  template: `
    <app-page-header title="Gold loans" lead="Every loan, its jewellery and its renewal date.">
      <button type="button" class="btn btn--secondary" (click)="exportCsv()" [disabled]="rows().length === 0">Export CSV</button>
      <a class="btn btn--primary" routerLink="/gold-loans/new">Add loan</a>
    </app-page-header>

    <div class="toolbar">
      <div class="field">
        <label class="field__label" for="loan-search">Search</label>
        <input id="loan-search" class="input" type="search" placeholder="Name, lender, jewellery, last 4 digits" [value]="query()" (input)="query.set($any($event.target).value)" />
      </div>
      <div class="field">
        <label class="field__label" for="loan-status">Status</label>
        <select id="loan-status" class="select" (change)="status.set($any($event.target).value)">
          <option value="all" [selected]="status() === 'all'">All statuses</option>
          @for (s of statusOptions; track s.value) {
            <option [value]="s.value" [selected]="status() === s.value">{{ s.label }}</option>
          }
        </select>
      </div>
    </div>

    @if (!store.loaded()) {
      <p class="muted" role="status">Loading your records…</p>
    } @else if (store.data().goldLoans.length === 0) {
      <app-empty-state title="No gold loans yet" message="Add your first loan to start tracking its renewal date.">
        <a class="btn btn--primary" routerLink="/gold-loans/new">Add loan</a>
      </app-empty-state>
    } @else if (rows().length === 0) {
      <app-empty-state title="No loans match" message="Try a different word, or clear the status filter.">
        <button type="button" class="btn btn--secondary" (click)="clear()">Clear filters</button>
      </app-empty-state>
    } @else {
      <p class="muted" role="status">{{ rows().length }} {{ rows().length === 1 ? 'loan' : 'loans' }}, {{ total() | inr }} in total</p>
      <ol class="ledger" aria-label="Gold loans">
        @for (row of rows(); track row.id) {
          <li class="ledger__row">
            <span class="ledger__date num">{{ row.renewalDate | indianDate }}</span>
            <a class="row-link" [routerLink]="['/gold-loans', row.id]">
              <app-status-badge [status]="row.status" />
              @if (row.unverified) { <span class="badge badge--unverified">Needs verification</span> }
              <span class="ledger__sub">{{ row.when }}{{ row.ref ? ' · ' + row.ref : '' }}</span>
              <strong>{{ row.jewelry }}</strong>
              <app-member-chip [name]="row.ownerName" [color]="row.ownerColor" />
            </a>
            <span class="ledger__amount num">{{ row.amount | inr }}</span>
          </li>
        }
      </ol>
    }
  `,
})
export class GoldLoansPage {
  protected readonly store = inject(AppStore);
  protected readonly query = signal('');
  protected readonly status = signal<RenewalStatus | 'all'>('all');
  protected readonly statusOptions = STATUS_ORDER.map((value) => ({ value, label: STATUS_LABELS[value] }));

  protected readonly rows = computed(() =>
    filterLoanViews(this.store.filteredRenewalViews(), this.store.data().members, { query: this.query(), status: this.status() }).map((view) => {
      const owner = ownerOf(this.store.membersById(), view.loan.memberId);
      return {
        id: view.loanId,
        status: view.status,
        renewalDate: view.renewalDate,
        when: describeDaysRemaining(view.daysRemaining),
        ref: view.loan.accountRef,
        jewelry: jewelrySummary(view.loan.jewelry),
        ownerName: owner.name,
        ownerColor: owner.color,
        amount: goldLoanBalance(view.loan).amount,
        unverified: view.loan.verification === 'needs-verification',
      };
    }),
  );
  protected readonly total = computed(() => sumPaise(this.rows().map((r) => r.amount)));

  protected clear(): void {
    this.query.set('');
    this.status.set('all');
  }

  protected exportCsv(): void {
    const d = this.store.data();
    const csv = goldLoansToCsv(d.goldLoans, d.members, this.store.today());
    downloadTextFile(`gold-loans-${this.store.today()}.csv`, '﻿' + csv, 'text/csv;charset=utf-8');
  }

}
