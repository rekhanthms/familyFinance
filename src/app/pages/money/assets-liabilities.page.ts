import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppStore } from '../../core/app.store';
import {
  paiseToInputText,
  parseRupees,
  type Asset,
  type AssetKind,
  type ManualLiability,
  type ManualLiabilityKind,
} from '../../domain';
import { ConfirmDialogService, InrPipe, PageHeaderComponent } from '../../shared/ui';

const ASSET_KINDS: Array<{ value: AssetKind; label: string }> = [
  { value: 'property', label: 'Property' },
  { value: 'savings', label: 'Savings' },
  { value: 'fixed-deposit', label: 'Fixed deposit' },
  { value: 'investment', label: 'Investment' },
  { value: 'gold-jewelry', label: 'Gold jewellery owned' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'other', label: 'Other' },
];

const LIABILITY_KINDS: Array<{ value: ManualLiabilityKind; label: string }> = [
  { value: 'home-loan', label: 'Home loan' },
  { value: 'personal-loan', label: 'Personal loan' },
  { value: 'credit-card', label: 'Credit card' },
  { value: 'other', label: 'Other' },
];

interface Draft {
  id: string | null;
  kind: string;
  name: string;
  amount: string;
  monthly: string;
}

@Component({
  selector: 'app-assets-liabilities-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageHeaderComponent, InrPipe],
  template: `
    <app-page-header title="Assets and liabilities" lead="What the family owns and owes, each counted once." />

    @if (error()) { <div class="notice notice--danger" role="alert">{{ error() }}</div> }

    <dl class="facts" aria-label="Net position">
      <dt>Assets entered</dt><dd class="num">{{ worth().totalAssets | inr }}</dd>
      <dt>Total liabilities</dt><dd class="num">{{ worth().totalLiabilities | inr }}</dd>
      <dt>Net position</dt>
      <dd class="num">
        @if (store.data().assets.length === 0) {
          Add your assets to see this
        } @else {
          {{ worth().netWorth | inr }}
        }
      </dd>
    </dl>

    <section class="form-section" aria-labelledby="assets-h">
      <h2 id="assets-h">Assets</h2>
      @if (store.data().assets.length === 0 && !assetDraft()) {
        <p class="muted">No assets entered yet. Enter only what you can put a value on.</p>
      }
      <ol class="ledger" aria-label="Assets">
        @for (a of store.data().assets; track a.id) {
          <li class="ledger__row">
            <span class="ledger__date">{{ assetLabel(a.kind) }}</span>
            <div>
              <strong>{{ a.name }}</strong>
              <span class="actions">
                <button type="button" class="btn btn--secondary btn--small" (click)="editAsset(a)">Edit {{ a.name }}</button>
                <button type="button" class="btn btn--ghost btn--small" (click)="removeAsset(a)">Delete {{ a.name }}</button>
              </span>
            </div>
            <span class="ledger__amount num">{{ a.estimatedValue | inr }}</span>
          </li>
        }
      </ol>
      @if (assetDraft(); as d) {
        <form (submit)="saveAsset($event)" novalidate aria-label="Asset details">
          <div class="form-grid">
            <div class="field">
              <label class="field__label" for="a-kind">Kind</label>
              <select id="a-kind" class="select" (change)="patchAsset('kind', $any($event.target).value)">
                @for (k of assetKinds; track k.value) { <option [value]="k.value" [selected]="d.kind === k.value">{{ k.label }}</option> }
              </select>
            </div>
            <div class="field">
              <label class="field__label" for="a-name">Name</label>
              <input id="a-name" class="input" [value]="d.name" (input)="patchAsset('name', $any($event.target).value)" />
            </div>
            <div class="field">
              <label class="field__label" for="a-value">Estimated value (₹)</label>
              <input id="a-value" class="input" inputmode="decimal" [value]="d.amount" (input)="patchAsset('amount', $any($event.target).value)" />
            </div>
          </div>
          @if (formError()) { <p class="field__error" role="alert">{{ formError() }}</p> }
          <div class="form-actions">
            <button type="submit" class="btn btn--primary">Save asset</button>
            <button type="button" class="btn btn--secondary" (click)="assetDraft.set(null)">Cancel</button>
          </div>
        </form>
      } @else {
        <button type="button" class="btn btn--secondary" (click)="newAsset()">Add asset</button>
      }
    </section>

    <section class="form-section" aria-labelledby="liab-h">
      <h2 id="liab-h">Liabilities</h2>
      <p class="muted">Gold loans and the car loan come from their own screens, so they are listed here but never entered twice.</p>
      <ol class="ledger" aria-label="Liabilities">
        <li class="ledger__row">
          <span class="ledger__date">Gold loans</span>
          <div><a class="row-link" routerLink="/gold-loans"><strong>All gold loans</strong></a></div>
          <span class="ledger__amount num">{{ worth().goldLoans | inr }}</span>
        </li>
        @if (store.data().carLoan) {
          <li class="ledger__row">
            <span class="ledger__date">Car loan</span>
            <div><a class="row-link" routerLink="/car-loan"><strong>Car loan</strong></a></div>
            <span class="ledger__amount num">{{ worth().carLoan | inr }}</span>
          </li>
        }
        @for (l of store.data().liabilities; track l.id) {
          <li class="ledger__row">
            <span class="ledger__date">{{ liabilityLabel(l.kind) }}</span>
            <div>
              <strong>{{ l.name }}</strong>
              <span class="ledger__sub">{{ l.monthlyPayment == null ? 'Monthly payment not entered' : (l.monthlyPayment | inr) + ' a month' }}</span>
              <span class="actions">
                <button type="button" class="btn btn--secondary btn--small" (click)="editLiability(l)">Edit {{ l.name }}</button>
                <button type="button" class="btn btn--ghost btn--small" (click)="removeLiability(l)">Delete {{ l.name }}</button>
              </span>
            </div>
            <span class="ledger__amount num">{{ l.outstanding | inr }}</span>
          </li>
        }
      </ol>
      @if (liabilityDraft(); as d) {
        <form (submit)="saveLiability($event)" novalidate aria-label="Liability details">
          <div class="form-grid">
            <div class="field">
              <label class="field__label" for="l-kind">Kind</label>
              <select id="l-kind" class="select" (change)="patchLiability('kind', $any($event.target).value)">
                @for (k of liabilityKinds; track k.value) { <option [value]="k.value" [selected]="d.kind === k.value">{{ k.label }}</option> }
              </select>
            </div>
            <div class="field">
              <label class="field__label" for="l-name">Name</label>
              <input id="l-name" class="input" [value]="d.name" (input)="patchLiability('name', $any($event.target).value)" />
            </div>
            <div class="field">
              <label class="field__label" for="l-out">Outstanding (₹)</label>
              <input id="l-out" class="input" inputmode="decimal" [value]="d.amount" (input)="patchLiability('amount', $any($event.target).value)" />
            </div>
            <div class="field">
              <label class="field__label" for="l-monthly">Monthly payment (₹, optional)</label>
              <input id="l-monthly" class="input" inputmode="decimal" [value]="d.monthly" (input)="patchLiability('monthly', $any($event.target).value)" />
            </div>
          </div>
          @if (formError()) { <p class="field__error" role="alert">{{ formError() }}</p> }
          <div class="form-actions">
            <button type="submit" class="btn btn--primary">Save liability</button>
            <button type="button" class="btn btn--secondary" (click)="liabilityDraft.set(null)">Cancel</button>
          </div>
        </form>
      } @else {
        <button type="button" class="btn btn--secondary" (click)="newLiability()">Add liability</button>
      }
    </section>
  `,
  styles: `
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-2);
      margin-top: var(--sp-2);
    }
    form {
      margin: var(--sp-4) 0;
    }
  `,
})
export class AssetsLiabilitiesPage {
  protected readonly store = inject(AppStore);
  private readonly confirm = inject(ConfirmDialogService);

  protected readonly assetKinds = ASSET_KINDS;
  protected readonly liabilityKinds = LIABILITY_KINDS;
  protected readonly worth = this.store.netWorth;
  protected readonly assetDraft = signal<Draft | null>(null);
  protected readonly liabilityDraft = signal<Draft | null>(null);
  protected readonly formError = signal('');
  protected readonly error = signal('');

  protected readonly assetLabel = (kind: AssetKind) => ASSET_KINDS.find((k) => k.value === kind)?.label ?? kind;
  protected readonly liabilityLabel = (kind: ManualLiabilityKind) => LIABILITY_KINDS.find((k) => k.value === kind)?.label ?? kind;

  // ---- assets ----
  protected newAsset(): void {
    this.formError.set('');
    this.assetDraft.set({ id: null, kind: 'savings', name: '', amount: '', monthly: '' });
  }
  protected editAsset(a: Asset): void {
    this.formError.set('');
    this.assetDraft.set({ id: a.id, kind: a.kind, name: a.name, amount: paiseToInputText(a.estimatedValue), monthly: '' });
  }
  protected patchAsset(field: keyof Draft, value: string): void {
    this.assetDraft.update((d) => (d ? { ...d, [field]: value } : d));
  }
  protected async saveAsset(event: Event): Promise<void> {
    event.preventDefault();
    const d = this.assetDraft();
    if (!d) return;
    const value = parseRupees(d.amount);
    if (!d.name.trim()) return this.formError.set('Enter a name.');
    if (!value.ok) return this.formError.set(value.error);
    if (value.value == null) return this.formError.set('Enter an estimated value, or leave this asset out.');
    const existing = this.store.data().assets.find((a) => a.id === d.id);
    const result = await this.store.saveAsset({
      id: existing?.id ?? this.store.newId(),
      updatedAt: existing?.updatedAt ?? '',
      kind: d.kind as AssetKind,
      name: d.name.trim(),
      ownerMemberId: existing?.ownerMemberId ?? null,
      estimatedValue: value.value,
      valuationDate: existing?.valuationDate ?? this.store.today(),
      ...(existing?.notes ? { notes: existing.notes } : {}),
    });
    if (!result.ok) return this.formError.set(result.errors.join(' '));
    this.assetDraft.set(null);
  }
  protected async removeAsset(a: Asset): Promise<void> {
    const yes = await this.confirm.ask({ title: `Delete ${a.name}?`, message: 'It will no longer count towards your assets.', confirmLabel: 'Delete asset', danger: true });
    if (!yes) return;
    const result = await this.store.deleteAsset(a.id);
    this.error.set(result.ok ? '' : result.errors.join(' '));
  }

  // ---- liabilities ----
  protected newLiability(): void {
    this.formError.set('');
    this.liabilityDraft.set({ id: null, kind: 'personal-loan', name: '', amount: '', monthly: '' });
  }
  protected editLiability(l: ManualLiability): void {
    this.formError.set('');
    this.liabilityDraft.set({ id: l.id, kind: l.kind, name: l.name, amount: paiseToInputText(l.outstanding), monthly: paiseToInputText(l.monthlyPayment) });
  }
  protected patchLiability(field: keyof Draft, value: string): void {
    this.liabilityDraft.update((d) => (d ? { ...d, [field]: value } : d));
  }
  protected async saveLiability(event: Event): Promise<void> {
    event.preventDefault();
    const d = this.liabilityDraft();
    if (!d) return;
    const out = parseRupees(d.amount);
    const monthly = parseRupees(d.monthly);
    if (!d.name.trim()) return this.formError.set('Enter a name.');
    if (!out.ok) return this.formError.set(out.error);
    if (out.value == null) return this.formError.set('Enter the outstanding amount.');
    if (!monthly.ok) return this.formError.set(monthly.error);
    const existing = this.store.data().liabilities.find((l) => l.id === d.id);
    const result = await this.store.saveLiability({
      id: existing?.id ?? this.store.newId(),
      updatedAt: existing?.updatedAt ?? '',
      kind: d.kind as ManualLiabilityKind,
      name: d.name.trim(),
      ownerMemberId: existing?.ownerMemberId ?? null,
      outstanding: out.value,
      monthlyPayment: monthly.value,
      ...(existing?.notes ? { notes: existing.notes } : {}),
    });
    if (!result.ok) return this.formError.set(result.errors.join(' '));
    this.liabilityDraft.set(null);
  }
  protected async removeLiability(l: ManualLiability): Promise<void> {
    const yes = await this.confirm.ask({ title: `Delete ${l.name}?`, message: 'It will no longer count towards your liabilities.', confirmLabel: 'Delete liability', danger: true });
    if (!yes) return;
    const result = await this.store.deleteLiability(l.id);
    this.error.set(result.ok ? '' : result.errors.join(' '));
  }
}
