import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, skip } from 'rxjs';
import { AppStore } from '../core/app.store';
import { ConfirmDialogComponent } from '../shared/ui';
import { AlertBannerComponent } from './alert-banner.component';
import { DataNoticesComponent } from './data-notices.component';
import { FamilySelectorComponent } from './family-selector.component';
import { NAV_ITEMS } from './nav-items';

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    FamilySelectorComponent,
    AlertBannerComponent,
    DataNoticesComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
  host: { '(document:keydown.escape)': 'moreOpen.set(false)' },
})
export class ShellComponent {
  private readonly store = inject(AppStore);
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');

  protected readonly items = NAV_ITEMS;
  protected readonly primaryItems = NAV_ITEMS.filter((item) => item.primary);
  protected readonly secondaryItems = NAV_ITEMS.filter((item) => !item.primary);
  protected readonly moreOpen = signal(false);

  /** Number beside "Renewals" in the navigation, so warnings stay visible on every screen size. */
  protected readonly alertCount = computed(() => this.store.alerts().length);
  protected readonly alertSevere = computed(() => this.store.alerts().some((alert) => alert.status !== 'due-soon'));

  constructor() {
    // After each page change, move focus to the content so screen readers start at the new page.
    // The first navigation is skipped so opening the app doesn't steal focus.
    inject(Router)
      .events.pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        skip(1),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.moreOpen.set(false);
        this.main().nativeElement.focus({ preventScroll: true });
      });
  }
}
