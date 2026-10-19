import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppStore } from '../core/app.store';

/** Tells the person, in plain words, when their data is at risk: not saved at all, never backed up, or a stale backup. */
@Component({
  selector: 'app-data-notices',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  styles: `
    .notice { padding: var(--sp-2) var(--sp-4); }
  `,
  template: `
    @if (store.error(); as error) {
      <div class="notice notice--danger" role="alert">{{ error }}</div>
    }
    @if (store.loaded()) {
      @if (store.backend() === 'memory') {
        <div class="notice notice--danger" role="alert">
          <strong>This browser can't save your data.</strong>
          <span>
            Anything you enter is lost when you close the page. Open the app in a current Chrome, Edge, Firefox or
            Safari window that isn't private.
          </span>
        </div>
      }
      @if (backupMessage(); as message) {
        @if (!hidden()) {
          <div class="notice notice--warn">
            <span>{{ message }}</span>
            <div class="notice__actions">
              <a class="btn btn--secondary btn--small" routerLink="/settings">Back up now</a>
              <button type="button" class="btn btn--ghost btn--small" (click)="hidden.set(true)">Hide for now</button>
            </div>
          </div>
        }
      }
    }
  `,
})
export class DataNoticesComponent {
  protected readonly store = inject(AppStore);
  /** Hidden only until the page is reloaded, so the reminder always comes back. */
  protected readonly hidden = signal(false);

  protected readonly backupMessage = computed(() => {
    const status = this.store.backupStatus();
    if (status.state === 'ok') return null;
    const base =
      status.state === 'never'
        ? "No backup yet. Clearing this browser's data would delete your records."
        : `Last backup was ${status.daysAgo} days ago. Make a new one.`;
    return this.store.persistent() === false ? `${base} The browser may also clear data when space runs low.` : base;
  });
}
