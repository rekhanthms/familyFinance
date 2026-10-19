import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { SyncService } from '../../core/sync/sync.service';
import { formatIndianDate } from '../../domain';

@Component({
  selector: 'app-sync-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="form-section" aria-labelledby="s-sync">
      <h2 id="s-sync">Sync between devices</h2>

      @switch (sync.status()) {
        @case ('not-configured') {
          <p>Sync is not set up. Your data stays on this device only. The steps are in <code>docs/SYNC_SETUP.md</code>.</p>
        }
        @default {
          @if (sync.error()) { <div class="notice notice--danger" role="alert">{{ sync.error() }}</div> }

          @if (!sync.email()) {
            @if (!sync.codeSentTo()) {
              <form (submit)="send($event)" novalidate>
                <div class="field">
                  <label class="field__label" for="sync-email">Email address</label>
                  <input id="sync-email" class="input" type="email" autocomplete="email" [value]="email()" (input)="email.set($any($event.target).value)" />
                  <p class="field__hint">We email you a 6-digit code. No password.</p>
                </div>
                <div class="form-actions"><button type="submit" class="btn btn--primary">Send code</button></div>
              </form>
            } @else {
              <form (submit)="verify($event)" novalidate>
                <div class="field">
                  <label class="field__label" for="sync-code">Code sent to {{ sync.codeSentTo() }}</label>
                  <input id="sync-code" class="input" inputmode="numeric" autocomplete="one-time-code" [value]="code()" (input)="code.set($any($event.target).value)" />
                </div>
                <div class="form-actions"><button type="submit" class="btn btn--primary">Sign in</button></div>
              </form>
            }
          } @else {
            <dl class="facts">
              <dt>Signed in as</dt><dd>{{ sync.email() }}</dd>
              <dt>Last synced</dt><dd>{{ lastSynced() }}</dd>
              <dt>Status</dt><dd role="status">{{ statusText() }}</dd>
            </dl>

            @if (sync.status() === 'choose') {
              <div class="notice notice--warn">
                <span>A shared copy already exists. Which should this device use?</span>
              </div>
              <div class="form-actions">
                <button type="button" class="btn btn--primary" (click)="sync.useSharedCopy()">Use the shared copy (replace this device's data)</button>
                <button type="button" class="btn btn--secondary" (click)="sync.combineWithSharedCopy()">Combine with this device's data</button>
              </div>
            } @else {
              <div class="form-actions">
                <button type="button" class="btn btn--secondary" (click)="sync.syncNow()" [disabled]="sync.status() === 'syncing'">Sync now</button>
                <button type="button" class="btn btn--ghost" (click)="sync.signOut()">Sign out</button>
              </div>
            }
          }
        }
      }
    </section>
  `,
})
export class SyncPanelComponent {
  protected readonly sync = inject(SyncService);
  protected readonly email = signal('');
  protected readonly code = signal('');

  protected lastSynced(): string {
    const at = this.sync.lastSyncedAt();
    return at ? `${formatIndianDate(at.slice(0, 10))}, ${new Date(at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Not yet';
  }

  protected statusText(): string {
    switch (this.sync.status()) {
      case 'syncing': return 'Syncing…';
      case 'error': return 'Last sync failed. Your data on this device is safe.';
      case 'choose': return 'Waiting for your choice';
      default: return 'Up to date';
    }
  }

  protected async send(event: Event): Promise<void> {
    event.preventDefault();
    if (this.email().trim()) await this.sync.sendCode(this.email());
  }

  protected async verify(event: Event): Promise<void> {
    event.preventDefault();
    if (this.code().trim()) await this.sync.verifyCode(this.code());
    this.code.set('');
  }
}
