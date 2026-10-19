import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppStore } from '../../core/app.store';
import {
  buildDigest,
  buildRenewalReminderText,
  buildWhatsAppLink,
  describeDaysRemaining,
  formatMonthKey,
  goldLoanBalance,
  jewelrySummary,
  monthKey,
  sortByNearestRenewal,
  STATUS_LABELS,
  type RenewalStatus,
} from '../../domain';
import { EmptyStateComponent, IndianDatePipe, InrPipe, MemberChipComponent, PageHeaderComponent, StatusBadgeComponent } from '../../shared/ui';
import { ownerOf } from '../owner';

const SUMMARY_ORDER: RenewalStatus[] = ['overdue', 'due-today', 'urgent', 'due-soon', 'upcoming', 'renewed'];

/** Renewal calendar: every loan by due date, grouped by month, with the action to record a renewal. */
@Component({
  selector: 'app-renewals-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageHeaderComponent, EmptyStateComponent, StatusBadgeComponent, MemberChipComponent, InrPipe, IndianDatePipe],
  template: `
    <app-page-header title="Renewals" lead="Every renewal date, month by month.">
      @if (summaryLink(); as link) {
        <a class="btn btn--secondary" [href]="link" target="_blank" rel="noopener">Share what needs action on WhatsApp</a>
      }
    </app-page-header>

    @if (!store.loaded()) {
      <p class="muted" role="status">Loading your records…</p>
    } @else if (months().length === 0) {
      <app-empty-state title="No renewals to show" message="Add a gold loan and its renewal date will appear here.">
        <a class="btn btn--primary" routerLink="/gold-loans/new">Add loan</a>
      </app-empty-state>
    } @else {
      <ul class="summary" aria-label="Count by status">
        @for (s of summary(); track s.status) {
          <li><app-status-badge [status]="s.status" /> <strong class="num">{{ s.count }}</strong></li>
        }
      </ul>

      @for (month of months(); track month.key) {
        <h2 class="group-title">{{ month.label }}</h2>
        <ol class="ledger" [attr.aria-label]="'Renewals in ' + month.label">
          @for (row of month.rows; track row.id) {
            <li class="ledger__row">
              <span class="ledger__date num">{{ row.renewalDate | indianDate }}</span>
              <div>
                <app-status-badge [status]="row.status" />
                <span class="ledger__sub">{{ row.when }}</span>
                <a class="row-link" [routerLink]="['/gold-loans', row.id]"><strong>{{ row.jewelry }}</strong></a>
                <app-member-chip [name]="row.ownerName" [color]="row.ownerColor" />
                <span class="actions">
                  <a class="btn btn--secondary btn--small" [routerLink]="['/renewals', row.id, 'record']">Record renewal</a>
                  <a class="btn btn--ghost btn--small" [href]="row.whatsapp" target="_blank" rel="noopener">Share on WhatsApp</a>
                </span>
              </div>
              <span class="ledger__amount num">{{ row.amount | inr }}</span>
            </li>
          }
        </ol>
      }
    }
  `,
  styles: `
    .summary {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-4);
      margin: 0 0 var(--sp-4);
      padding: 0;
      list-style: none;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-2);
      margin-top: var(--sp-2);
    }
  `,
})
export class RenewalsPage {
  protected readonly store = inject(AppStore);

  protected readonly summary = computed(() => {
    const counts = this.store.statusCounts();
    return SUMMARY_ORDER.filter((status) => counts[status] > 0).map((status) => ({ status, count: counts[status], label: STATUS_LABELS[status] }));
  });

  /** One message listing everything that needs action. You choose the chat and tap Send in WhatsApp. */
  protected readonly summaryLink = computed(() => {
    const digest = buildDigest(this.store.data(), this.store.today());
    return digest ? buildWhatsAppLink(digest.text) : null;
  });

  protected readonly months = computed(() => {
    const views = sortByNearestRenewal(this.store.filteredRenewalViews().map((v) => ({ ...v, id: v.loanId })));
    const groups = new Map<string, typeof views>();
    for (const view of views) {
      const key = monthKey(view.renewalDate);
      groups.set(key, [...(groups.get(key) ?? []), view]);
    }
    return [...groups].map(([key, items]) => ({
      key,
      label: formatMonthKey(key),
      rows: items.map((view) => {
        const owner = ownerOf(this.store.membersById(), view.loan.memberId);
        const amount = goldLoanBalance(view.loan).amount;
        return {
          id: view.loanId,
          status: view.status,
          renewalDate: view.renewalDate,
          when: describeDaysRemaining(view.daysRemaining),
          jewelry: jewelrySummary(view.loan.jewelry),
          ownerName: owner.name,
          ownerColor: owner.color,
          amount,
          whatsapp: buildWhatsAppLink(
            buildRenewalReminderText({
              ownerName: owner.name,
              accountRef: view.loan.accountRef,
              jewelry: view.loan.jewelry,
              amount,
              renewalDate: view.renewalDate,
              daysRemaining: view.daysRemaining,
              status: view.status,
            }),
            owner.phone,
          ),
        };
      }),
    }));
  });
}
