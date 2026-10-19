import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Page title with an optional one-line purpose. Buttons placed between the tags (e.g. "Add loan") sit on the right. */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-header">
      <div>
        <h1>{{ title() }}</h1>
        @if (lead()) {
          <p class="muted">{{ lead() }}</p>
        }
      </div>
      <div class="page-header__actions"><ng-content /></div>
    </header>
  `,
  styles: `
    .page-header {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: var(--sp-3) var(--sp-5);
      margin-bottom: var(--sp-5);
    }
    h1 + p {
      margin-top: var(--sp-1);
    }
    .page-header__actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-2);
    }
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly lead = input<string>('');
}
