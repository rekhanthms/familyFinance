import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AppStore } from '../../core/app.store';
import {
  buildRenewalReminderText,
  buildWhatsAppLink,
  computeRenewalStatus,
  describeDaysRemaining,
  goldLoanBalance,
  jewelrySummary,
} from '../../domain';
import {
  ConfirmDialogService,
  EmptyStateComponent,
  IndianDatePipe,
  InrPipe,
  MemberChipComponent,
  PageHeaderComponent,
  StatusBadgeComponent,
} from '../../shared/ui';
import { ownerOf } from '../owner';

const INTEREST_LABELS = { simple: 'Simple', compound: 'Compound', reducing: 'Reducing balance' } as const;

@Component({
  selector: 'app-loan-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageHeaderComponent, EmptyStateComponent, StatusBadgeComponent, MemberChipComponent, InrPipe, IndianDatePipe],
  template: `
    @if (!store.loaded()) {
      <p class="muted" role="status">Loading your records…</p>
    } @else if (view(); as v) {
      <app-page-header [title]="v.title" [lead]="v.jewelry">
        <a class="btn btn--primary" [routerLink]="['/renewals', v.loan.id, 'record']">Record renewal</a>
        <a class="btn btn--secondary" [routerLink]="['/gold-loans', v.loan.id, 'edit']">Edit</a>
        <a class="btn btn--secondary" [href]="v.whatsapp" target="_blank" rel="noopener">Share on WhatsApp</a>
        <button type="button" class="btn btn--danger" (click)="remove()">Delete</button>
      </app-page-header>

      @if (error()) { <div class="notice notice--danger" role="alert">{{ error() }}</div> }

      <p>
        <app-status-badge [status]="v.status" />
        @if (v.loan.verification === 'needs-verification') { <span class="badge badge--unverified">Needs verification</span> }
        <app-member-chip [name]="v.ownerName" [color]="v.ownerColor" />
      </p>

      <dl class="facts">
        <dt>Renewal due</dt><dd class="num">{{ v.loan.renewalDate | indianDate }} ({{ v.when }})</dd>
        <dt>Balance</dt><dd class="num">{{ v.balance.amount | inr }} <span class="muted">{{ v.balance.basis === 'confirmed' ? 'confirmed' : 'from the register, not yet confirmed' }}</span></dd>
        <dt>Register amount</dt><dd class="num">{{ v.loan.recordedAmount | inr }}</dd>
        <dt>Lender</dt><dd>{{ v.loan.lender ?? 'Not recorded' }}</dd>
        <dt>Reference</dt><dd>{{ v.loan.accountRef ?? 'Not recorded' }}</dd>
        <dt>Interest</dt><dd>{{ v.interest }}</dd>
        <dt>Pledged on</dt><dd class="num">{{ v.loan.pledgeDate | indianDate }}</dd>
        <dt>Renews every</dt><dd>{{ v.loan.renewalIntervalMonths ? v.loan.renewalIntervalMonths + ' months' : 'Not recorded' }}</dd>
        @if (v.loan.notes) { <dt>Notes</dt><dd>{{ v.loan.notes }}</dd> }
      </dl>

      <h2 class="group-title">Renewal history</h2>
      @if (v.loan.renewals.length === 0) {
        <p class="muted">No renewal has been recorded for this loan yet.</p>
      } @else {
        <ol class="ledger" aria-label="Renewal history">
          @for (r of history(); track r.id) {
            <li class="ledger__row">
              <span class="ledger__date num">{{ r.completedOn | indianDate }}</span>
              <div>
                Moved from {{ r.previousRenewalDate | indianDate }} to {{ r.newRenewalDate | indianDate }}
                @if (r.lenderReference) { <span class="ledger__sub">Lender reference: {{ r.lenderReference }}</span> }
                @if (r.notes) { <span class="ledger__sub">{{ r.notes }}</span> }
              </div>
              <span class="ledger__amount num">{{ r.updatedOutstanding == null ? '' : (r.updatedOutstanding | inr) }}</span>
            </li>
          }
        </ol>
      }
    } @else {
      <app-page-header title="Loan not found" />
      <app-empty-state title="This loan no longer exists" message="It may have been deleted.">
        <a class="btn btn--secondary" routerLink="/gold-loans">Back to gold loans</a>
      </app-empty-state>
    }
  `,
})
export class LoanDetailPage {
  protected readonly store = inject(AppStore);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmDialogService);

  readonly id = input.required<string>();
  protected readonly error = signal('');

  protected readonly view = computed(() => {
    const loan = this.store.data().goldLoans.find((l) => l.id === this.id());
    if (!loan) return null;
    const settings = this.store.data().settings;
    const result = computeRenewalStatus(loan, this.store.today(), settings.renewalThresholds);
    const owner = ownerOf(this.store.membersById(), loan.memberId);
    const balance = goldLoanBalance(loan);
    const jewelry = jewelrySummary(loan.jewelry);
    const text = buildRenewalReminderText({
      ownerName: owner.name,
      accountRef: loan.accountRef,
      jewelry: loan.jewelry,
      amount: balance.amount,
      renewalDate: loan.renewalDate,
      daysRemaining: result.daysRemaining,
      status: result.status,
    });
    const interest = [
      loan.interestRatePercent == null ? null : `${loan.interestRatePercent}% a year`,
      loan.interestMethod ? INTEREST_LABELS[loan.interestMethod] : null,
    ].filter(Boolean);
    return {
      loan,
      title: `${owner.name}${loan.accountRef ? ' · ' + loan.accountRef : ''}`,
      jewelry,
      ownerName: owner.name,
      ownerColor: owner.color,
      status: result.status,
      when: describeDaysRemaining(result.daysRemaining),
      balance,
      interest: interest.length ? interest.join(', ') : 'Not recorded',
      whatsapp: buildWhatsAppLink(text, owner.phone),
    };
  });

  protected readonly history = computed(() => [...(this.view()?.loan.renewals ?? [])].reverse());

  protected async remove(): Promise<void> {
    const v = this.view();
    if (!v) return;
    const yes = await this.confirm.ask({
      title: 'Delete this loan?',
      message: `${v.title} and its renewal history will be removed. You can bring it back only from a backup.`,
      confirmLabel: 'Delete loan',
      danger: true,
    });
    if (!yes) return;
    const result = await this.store.deleteGoldLoan(v.loan.id);
    if (!result.ok) {
      this.error.set(result.errors.join(' '));
      return;
    }
    await this.router.navigate(['/gold-loans']);
  }
}
