import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ConfirmDialogService, MemberChipComponent, PageHeaderComponent, StatusBadgeComponent } from '../shared/ui';
import { MEMBER_PALETTE, type RenewalStatus } from '../domain';

const SWATCHES = [
  ['Paper', '--c-paper'],
  ['Surface', '--c-surface'],
  ['Sunken', '--c-sunken'],
  ['Ink', '--c-ink'],
  ['Ink muted', '--c-ink-muted'],
  ['Forest', '--c-forest'],
  ['Gold', '--c-gold'],
  ['Gold ink', '--c-gold-ink'],
  ['Danger', '--c-danger'],
] as const;

/** Reference page for every shared piece, at /design. Handy for reviewing changes by eye. */
@Component({
  selector: 'app-design-system-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, StatusBadgeComponent, MemberChipComponent],
  template: `
    <app-page-header title="Design system" lead="Colours, status badges, controls and the ledger." />

    <section aria-labelledby="ds-colour">
      <h2 id="ds-colour">Colour</h2>
      <ul class="swatches">
        @for (s of swatches; track s[1]) {
          <li><span class="swatch" [style.background]="'var(' + s[1] + ')'"></span>{{ s[0] }}</li>
        }
      </ul>
    </section>

    <section aria-labelledby="ds-status">
      <h2 id="ds-status">Status and members</h2>
      <p class="row">
        @for (s of statuses; track s) {
          <app-status-badge [status]="s" />
        }
        <span class="badge badge--unverified">Needs verification</span>
      </p>
      <p class="row">
        @for (c of palette; track c) {
          <app-member-chip name="Family member" [color]="c" />
        }
      </p>
    </section>

    <section aria-labelledby="ds-controls">
      <h2 id="ds-controls">Buttons and fields</h2>
      <p class="row">
        <button type="button" class="btn btn--primary">Save loan</button>
        <button type="button" class="btn btn--secondary">Cancel</button>
        <button type="button" class="btn btn--ghost">Dismiss</button>
        <button type="button" class="btn btn--danger" (click)="askDelete()">Delete loan</button>
      </p>
      <p class="muted" role="status">{{ lastAnswer() }}</p>
      <div class="field">
        <label for="ds-amount">Amount borrowed</label>
        <input id="ds-amount" class="input" inputmode="decimal" placeholder="e.g. 1,82,000" />
        <p class="field__hint">Enter rupees. Leave blank if you don't know.</p>
      </div>
    </section>

    <section aria-labelledby="ds-notices">
      <h2 id="ds-notices">Notices</h2>
      <div class="notice notice--warn">A warning that needs a look.</div>
      <div class="notice notice--danger">Something failed and needs fixing.</div>
    </section>
  `,
  styles: `
    section {
      margin-bottom: var(--sp-6);
    }
    h2 {
      margin-bottom: var(--sp-3);
    }
    .swatches {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-3);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .swatch {
      display: block;
      width: 5rem;
      height: 2.5rem;
      margin-bottom: var(--sp-1);
      border: 1px solid var(--c-rule);
      border-radius: var(--r-sm);
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-2);
      margin-bottom: var(--sp-3);
    }
  `,
})
export class DesignSystemPage {
  private readonly confirm = inject(ConfirmDialogService);
  protected readonly swatches = SWATCHES;
  protected readonly palette = MEMBER_PALETTE;
  protected readonly statuses: RenewalStatus[] = ['upcoming', 'due-soon', 'urgent', 'due-today', 'overdue', 'renewed'];
  protected readonly lastAnswer = signal('');

  protected async askDelete(): Promise<void> {
    const yes = await this.confirm.ask({
      title: 'Delete this loan?',
      message: 'This removes the loan and its renewal history. You can restore it only from a backup.',
      confirmLabel: 'Delete loan',
      danger: true,
    });
    this.lastAnswer.set(yes ? 'Confirmed.' : 'Cancelled. Nothing was changed.');
  }
}
