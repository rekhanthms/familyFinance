import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { AppStore } from '../../core/app.store';
import { formatIndianDate } from '../../domain';
import { downloadTextFile } from '../../shared/download';
import { ConfirmDialogService, PageHeaderComponent } from '../../shared/ui';
import { SyncPanelComponent } from './sync-panel.component';

@Component({
  selector: 'app-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, SyncPanelComponent],
  template: `
    <app-page-header title="Settings" lead="Backup, restore and when warnings start." />

    @if (message()) { <div class="notice" role="status">{{ message() }}</div> }
    @if (problems().length > 0) {
      <div class="notice notice--danger error-summary" role="alert" tabindex="-1">
        <div><strong>That didn't work:</strong><ul>@for (p of problems(); track p) { <li>{{ p }}</li> }</ul></div>
      </div>
    }

    <section class="form-section" aria-labelledby="s-backup">
      <h2 id="s-backup">Backup and restore</h2>
      <dl class="facts">
        <dt>Stored in</dt><dd>{{ storage() }}</dd>
        <dt>Protected from automatic clearing</dt><dd>{{ persistence() }}</dd>
        <dt>Last backup</dt><dd>{{ backup() }}</dd>
      </dl>
      <p class="muted">A backup is one file with everything in this app. Keep a copy somewhere other than this device, such as your email or Drive.</p>
      <div class="form-actions">
        <button type="button" class="btn btn--primary" (click)="backupNow()">Download backup</button>
        <label class="btn btn--secondary" for="restore-file">Restore from a backup file</label>
        <input id="restore-file" class="visually-hidden" type="file" accept="application/json,.json" (change)="restore($event)" />
      </div>
    </section>

    <app-sync-panel />

    <section class="form-section" aria-labelledby="s-warn">
      <h2 id="s-warn">When warnings start</h2>
      <form (submit)="saveThresholds($event)" novalidate>
        <div class="form-grid">
          <div class="field">
            <label class="field__label" for="t-soon">"Due soon" starts (days before)</label>
            <input id="t-soon" class="input" inputmode="numeric" [value]="soon()" (input)="soon.set($any($event.target).value)" />
          </div>
          <div class="field">
            <label class="field__label" for="t-urgent">"Urgent" starts (days before)</label>
            <input id="t-urgent" class="input" inputmode="numeric" [value]="urgent()" (input)="urgent.set($any($event.target).value)" />
          </div>
          <div class="field">
            <label class="field__label" for="t-renewed">Show "Renewed" for (days)</label>
            <input id="t-renewed" class="input" inputmode="numeric" [value]="renewed()" (input)="renewed.set($any($event.target).value)" />
          </div>
        </div>
        <div class="form-actions"><button type="submit" class="btn btn--primary">Save</button></div>
      </form>
    </section>

    <section class="form-section" aria-labelledby="s-data">
      <h2 id="s-data">Replace all data</h2>
      <p class="muted">Both options remove what is stored now. Download a backup first.</p>
      <div class="form-actions">
        <button type="button" class="btn btn--secondary" (click)="resetDemo()">Reset to the register from your notebook</button>
        <button type="button" class="btn btn--danger" (click)="startEmpty()">Delete everything and start empty</button>
      </div>
    </section>
  `,
})
export class SettingsPage {
  private readonly store = inject(AppStore);
  private readonly confirm = inject(ConfirmDialogService);

  protected readonly message = signal('');
  protected readonly problems = signal<string[]>([]);
  protected readonly soon = signal('');
  protected readonly urgent = signal('');
  protected readonly renewed = signal('');
  private filled = false;

  constructor() {
    effect(() => {
      if (!this.store.loaded() || this.filled) return;
      this.filled = true;
      const t = this.store.data().settings.renewalThresholds;
      this.soon.set(String(t.dueSoonDays));
      this.urgent.set(String(t.urgentDays));
      this.renewed.set(String(t.renewedBadgeDays));
    });
  }

  protected readonly storage = computed(() =>
    this.store.backend() === 'memory' ? 'Memory only (lost when you close the page)' : 'This browser (IndexedDB)',
  );
  protected readonly persistence = computed(() => {
    const value = this.store.persistent();
    return value === null ? 'Not checked' : value ? 'Yes' : 'No, the browser may clear it when space is low';
  });
  protected readonly backup = computed(() => {
    const status = this.store.backupStatus();
    if (status.state === 'never') return 'Never';
    return status.daysAgo === 0 ? `Today, ${formatIndianDate(this.store.today())}` : `${status.daysAgo} days ago`;
  });

  private done(message: string): void {
    this.problems.set([]);
    this.message.set(message);
  }
  private failed(errors: string[]): void {
    this.message.set('');
    this.problems.set(errors);
    queueMicrotask(() => document.querySelector<HTMLElement>('.error-summary')?.focus());
  }

  protected async backupNow(): Promise<void> {
    const result = await this.store.exportBackup();
    if (!result.ok) return this.failed(result.errors);
    downloadTextFile(`family-finance-backup-${this.store.today()}.json`, result.value, 'application/json');
    this.done('Backup downloaded. Store the file somewhere safe.');
  }

  protected async restore(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const text = await file.text();
    const yes = await this.confirm.ask({
      title: 'Restore this backup?',
      message: `Everything stored now will be replaced by the contents of ${file.name}.`,
      confirmLabel: 'Restore backup',
      danger: true,
    });
    if (!yes) return;
    const result = await this.store.restoreBackup(text);
    if (!result.ok) return this.failed(result.errors);
    this.done('Backup restored.');
  }

  protected async saveThresholds(event: Event): Promise<void> {
    event.preventDefault();
    const num = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : NaN);
    const result = await this.store.updateSettings({
      renewalThresholds: { dueSoonDays: num(this.soon()), urgentDays: num(this.urgent()), renewedBadgeDays: num(this.renewed()) },
    });
    if (!result.ok) return this.failed(result.errors);
    this.done('Warning days saved.');
  }

  protected async resetDemo(): Promise<void> {
    const yes = await this.confirm.ask({
      title: 'Reset to the notebook register?',
      message: 'All changes you made are replaced by the 12 loans copied from the register.',
      confirmLabel: 'Reset data',
      danger: true,
    });
    if (!yes) return;
    const result = await this.store.resetToDemo();
    result.ok ? this.done('Data reset to the register.') : this.failed(result.errors);
  }

  protected async startEmpty(): Promise<void> {
    const yes = await this.confirm.ask({
      title: 'Delete everything?',
      message: 'Every loan, member, asset and note is removed. You can bring it back only from a backup.',
      confirmLabel: 'Delete everything',
      danger: true,
    });
    if (!yes) return;
    const result = await this.store.startEmpty();
    result.ok ? this.done('All data deleted.') : this.failed(result.errors);
  }
}
