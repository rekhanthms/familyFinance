import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AppStore } from '../../core/app.store';
import { MEMBER_PALETTE, nextMemberColor, goldLoanBalance, sumPaise, type FamilyMember } from '../../domain';
import { ConfirmDialogService, EmptyStateComponent, InrPipe, MemberChipComponent, PageHeaderComponent } from '../../shared/ui';

@Component({
  selector: 'app-family-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, EmptyStateComponent, MemberChipComponent, InrPipe],
  template: `
    <app-page-header title="Family" lead="Members, and how many loans each one holds.">
      @if (!editing()) { <button type="button" class="btn btn--primary" (click)="startAdd()">Add member</button> }
    </app-page-header>

    @if (error()) { <div class="notice notice--danger" role="alert">{{ error() }}</div> }
    @if (message()) { <div class="notice" role="status">{{ message() }}</div> }

    @if (editing()) {
      <form class="form-section" (submit)="save($event)" novalidate aria-label="Member details">
        <h2>{{ editing()!.id ? 'Edit member' : 'Add member' }}</h2>
        <div class="form-grid">
          <div class="field">
            <label class="field__label" for="m-name">Full name</label>
            <input id="m-name" class="input" [value]="name()" (input)="name.set($any($event.target).value)" [attr.aria-invalid]="nameError() ? 'true' : null" />
            @if (nameError()) { <p class="field__error">{{ nameError() }}</p> }
          </div>
          <div class="field">
            <label class="field__label" for="m-rel">Relationship (optional)</label>
            <input id="m-rel" class="input" [value]="relationship()" (input)="relationship.set($any($event.target).value)" />
          </div>
          <div class="field">
            <label class="field__label" for="m-phone">WhatsApp number (optional)</label>
            <input id="m-phone" class="input" type="tel" inputmode="tel" [value]="phone()" (input)="phone.set($any($event.target).value)" aria-describedby="m-phone-hint" [attr.aria-invalid]="phoneError() ? 'true' : null" />
            <p class="field__hint" id="m-phone-hint">With country code, like 91 98765 43210. Used only to open a WhatsApp chat with this person.</p>
            @if (phoneError()) { <p class="field__error">{{ phoneError() }}</p> }
          </div>
          <div class="field">
            <label class="field__label" for="m-color">Colour</label>
            <select id="m-color" class="select" (change)="color.set($any($event.target).value)">
              @for (c of colors; track c.value) { <option [value]="c.value" [selected]="color() === c.value">{{ c.name }}</option> }
            </select>
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn--primary">Save member</button>
          <button type="button" class="btn btn--secondary" (click)="editing.set(null)">Cancel</button>
        </div>
      </form>
    }

    @if (!store.loaded()) {
      <p class="muted" role="status">Loading your records…</p>
    } @else if (rows().length === 0) {
      <app-empty-state title="No family members yet" message="Add the people who hold gold loans, so each loan has an owner." />
    } @else {
      <ol class="ledger" aria-label="Family members">
        @for (row of rows(); track row.member.id) {
          <li class="ledger__row">
            <app-member-chip [name]="row.member.fullName" [color]="row.member.color" />
            <div>
              <span class="ledger__sub">{{ row.member.relationship || 'Relationship not recorded' }} · {{ row.count }} {{ row.count === 1 ? 'loan' : 'loans' }}</span>
              <span class="actions">
                <button type="button" class="btn btn--secondary btn--small" (click)="startEdit(row.member)">Edit {{ row.member.fullName }}</button>
                <button type="button" class="btn btn--ghost btn--small" (click)="remove(row.member, row.count)">Remove {{ row.member.fullName }}</button>
              </span>
            </div>
            <span class="ledger__amount num">{{ row.total | inr }}</span>
          </li>
        }
      </ol>
      @if (unassignedCount() > 0) {
        <p class="muted">{{ unassignedCount() }} {{ unassignedCount() === 1 ? 'loan has' : 'loans have' }} no confirmed owner. Open the loan and choose an owner to assign it.</p>
      }
    }
  `,
  styles: `
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-2);
      margin-top: var(--sp-2);
    }
  `,
})
export class FamilyPage {
  protected readonly store = inject(AppStore);
  private readonly confirm = inject(ConfirmDialogService);

  protected readonly colors = MEMBER_PALETTE.map((value, i) => ({ value, name: ['Blue', 'Brown', 'Plum', 'Olive', 'Violet', 'Teal'][i]! }));
  protected readonly editing = signal<{ id: string | null } | null>(null);
  protected readonly name = signal('');
  protected readonly relationship = signal('');
  protected readonly color = signal<string>(MEMBER_PALETTE[0]);
  protected readonly phone = signal('');
  protected readonly phoneError = signal('');
  protected readonly nameError = signal('');
  protected readonly error = signal('');
  protected readonly message = signal('');

  protected readonly rows = computed(() => {
    const loans = this.store.data().goldLoans;
    return this.store.data().members.map((member) => {
      const mine = loans.filter((l) => l.memberId === member.id);
      return { member, count: mine.length, total: sumPaise(mine.map((l) => goldLoanBalance(l).amount)) };
    });
  });
  protected readonly unassignedCount = computed(() => this.store.data().goldLoans.filter((l) => !l.memberId).length);

  protected startAdd(): void {
    this.reset();
    this.color.set(nextMemberColor(this.store.data().members.map((m) => m.color)));
    this.editing.set({ id: null });
  }

  protected startEdit(member: FamilyMember): void {
    this.reset();
    this.name.set(member.fullName);
    this.relationship.set(member.relationship ?? '');
    this.phone.set(member.phone ?? '');
    this.color.set(member.color);
    this.editing.set({ id: member.id });
  }

  private reset(): void {
    this.name.set('');
    this.relationship.set('');
    this.phone.set('');
    this.phoneError.set('');
    this.nameError.set('');
    this.error.set('');
    this.message.set('');
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    const target = this.editing();
    if (!target) return;
    if (!this.name().trim()) {
      this.nameError.set("Enter the member's name.");
      return;
    }
    const digits = this.phone().replace(/\D/g, '');
    if (this.phone().trim() && (digits.length < 8 || digits.length > 15)) {
      this.phoneError.set('Enter the number with country code, 8 to 15 digits.');
      return;
    }
    this.phoneError.set('');
    const existing = this.store.data().members.find((m) => m.id === target.id);
    const result = await this.store.saveMember({
      id: existing?.id ?? this.store.newId(),
      updatedAt: existing?.updatedAt ?? '',
      fullName: this.name(),
      color: this.color(),
      ...(this.relationship().trim() ? { relationship: this.relationship().trim() } : {}),
      ...(digits ? { phone: digits } : {}),
      ...(existing?.notes ? { notes: existing.notes } : {}),
    });
    if (!result.ok) {
      this.error.set(result.errors.join(' '));
      return;
    }
    this.editing.set(null);
    this.message.set(`${result.value.fullName} saved.`);
  }

  protected async remove(member: FamilyMember, loanCount: number): Promise<void> {
    const yes = await this.confirm.ask({
      title: `Remove ${member.fullName}?`,
      message:
        loanCount > 0
          ? `Their ${loanCount} ${loanCount === 1 ? 'loan stays' : 'loans stay'} in the register and will show as "Unassigned" until you choose a new owner.`
          : 'They have no loans, so nothing else changes.',
      confirmLabel: 'Remove member',
      danger: true,
    });
    if (!yes) return;
    const result = await this.store.removeMember(member.id);
    if (!result.ok) {
      this.error.set(result.errors.join(' '));
      return;
    }
    this.error.set('');
    this.message.set(`${member.fullName} removed.`);
  }
}
