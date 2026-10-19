import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AppStore } from '../core/app.store';
import { UNASSIGNED_LABEL } from '../domain';

/** Header control: narrows the pages to one person's loans, or shows the whole family. */
@Component({
  selector: 'app-family-selector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="selector">
      <span class="selector__label">Showing</span>
      <select class="select" (change)="onChange($event)">
        <option value="all" [selected]="filter() === 'all'">Whole family</option>
        @for (member of members(); track member.id) {
          <option [value]="member.id" [selected]="filter() === member.id">{{ member.fullName }}</option>
        }
        @if (showUnassigned()) {
          <option value="unassigned" [selected]="filter() === 'unassigned'">{{ unassignedLabel }}</option>
        }
      </select>
    </label>
  `,
  styles: `
    .selector {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-2);
      min-width: 0;
    }
    .selector__label {
      font-size: var(--fs-sm);
      color: var(--c-ink-muted);
    }
    .select {
      min-width: 0;
      max-width: 15rem;
    }
  `,
})
export class FamilySelectorComponent {
  private readonly store = inject(AppStore);
  protected readonly unassignedLabel = UNASSIGNED_LABEL;
  protected readonly filter = this.store.effectiveMemberFilter;
  protected readonly members = computed(() => this.store.data().members);
  protected readonly showUnassigned = computed(
    () => this.store.hasUnassignedLoans() || this.store.effectiveMemberFilter() === 'unassigned',
  );

  protected onChange(event: Event): void {
    this.store.setMemberFilter((event.target as HTMLSelectElement).value);
  }
}
