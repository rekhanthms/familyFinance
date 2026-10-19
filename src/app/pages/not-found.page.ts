import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent, PageHeaderComponent } from '../shared/ui';

@Component({
  selector: 'app-not-found-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, EmptyStateComponent, RouterLink],
  template: `
    <app-page-header title="Page not found" />
    <app-empty-state title="There is nothing at this address" message="The link may be old or mistyped.">
      <a class="btn btn--primary" routerLink="/dashboard">Go to dashboard</a>
    </app-empty-state>
  `,
})
export class NotFoundPage {}
