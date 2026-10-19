import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** For an empty list: say what belongs here and offer the next step (projected as a button). */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty" role="status">
      <h2>{{ title() }}</h2>
      <p class="muted">{{ message() }}</p>
      <div class="empty__action"><ng-content /></div>
    </div>
  `,
  styles: `
    p {
      margin-top: var(--sp-2);
    }
    .empty__action {
      margin-top: var(--sp-4);
    }
    .empty__action:empty {
      display: none;
    }
  `,
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly message = input.required<string>();
}
