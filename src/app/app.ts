import { Component, inject } from '@angular/core';
import { AppStore } from './core/app.store';
import { requestPersistentStorage } from './core/storage/create-repositories';
import { SyncService } from './core/sync/sync.service';
import { ShellComponent } from './layout/shell.component';

@Component({
  selector: 'app-root',
  imports: [ShellComponent],
  template: `<app-shell />`,
  host: { '(document:visibilitychange)': 'onVisibilityChange()', '(window:online)': 'onOnline()' },
})
export class App {
  private readonly store = inject(AppStore);
  private readonly sync = inject(SyncService);

  constructor() {
    void this.start();
  }

  private async start(): Promise<void> {
    await this.store.load();
    this.store.setPersistent(await requestPersistentStorage());
    await this.sync.init();
  }

  /** Reopening the app on a new day must move every status forward. */
  protected onVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      this.store.refreshToday();
      void this.sync.onForeground();
    }
  }

  protected onOnline(): void {
    void this.sync.onForeground();
  }
}
