import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { STATUS_LABELS, type RenewalStatus } from '../../domain';

/** Renewal status as written text on a tinted background. Colour reinforces the word, never replaces it. */
@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [class]="'badge--' + status()">{{ label() }}</span>`,
})
export class StatusBadgeComponent {
  readonly status = input.required<RenewalStatus>();
  protected readonly label = computed(() => STATUS_LABELS[this.status()]);
}
