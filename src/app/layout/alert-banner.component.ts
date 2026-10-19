import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppStore } from '../core/app.store';
import { describeDaysRemaining, goldLoanBalance, UNASSIGNED_COLOR, UNASSIGNED_LABEL } from '../domain';
import { IndianDatePipe, InrPipe, MemberChipComponent, StatusBadgeComponent } from '../shared/ui';

/**
 * Always visible, on every screen and phone width: the most pressing renewal that hasn't been dismissed.
 * Dismissing hides this warning only. The loan is NOT marked renewed.
 */
@Component({
  selector: 'app-alert-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, StatusBadgeComponent, MemberChipComponent, InrPipe, IndianDatePipe],
  template: `
    @if (top(); as item) {
      <section class="notice alert" [class.alert--severe]="item.severe" aria-label="Renewal needing action">
        <app-status-badge [status]="item.status" />
        <strong class="num">{{ item.renewalDate | indianDate }}</strong>
        <span>{{ item.when }}</span>
        <app-member-chip [name]="item.ownerName" [color]="item.ownerColor" />
        <span class="num">{{ item.amount | inr }}</span>
        <div class="notice__actions">
          <a class="btn btn--secondary btn--small" routerLink="/renewals">
            {{ count() > 1 ? 'View all ' + count() : 'Open renewals' }}
          </a>
          <button type="button" class="btn btn--ghost btn--small" (click)="dismiss(item.key)">Dismiss</button>
        </div>
      </section>
    }
  `,
  styles: `
    .alert {
      --notice-bg: var(--c-surface);
      --notice-edge: var(--c-gold);
      border-bottom: 1px solid var(--c-rule);
    }
    .alert--severe {
      --notice-edge: var(--c-danger);
    }
  `,
})
export class AlertBannerComponent {
  private readonly store = inject(AppStore);
  protected readonly count = computed(() => this.store.alerts().length);

  protected readonly top = computed(() => {
    const alert = this.store.alerts()[0];
    const loan = alert && this.store.data().goldLoans.find((l) => l.id === alert.loanId);
    if (!alert || !loan) return null;
    const owner = loan.memberId ? this.store.membersById().get(loan.memberId) : undefined;
    return {
      key: alert.key,
      status: alert.status,
      renewalDate: alert.renewalDate,
      when: describeDaysRemaining(alert.daysRemaining),
      ownerName: owner?.fullName ?? UNASSIGNED_LABEL,
      ownerColor: owner?.color ?? UNASSIGNED_COLOR,
      amount: goldLoanBalance(loan).amount,
      severe: alert.status !== 'due-soon',
    };
  });

  protected dismiss(key: string): void {
    void this.store.dismissAlert(key);
  }
}
