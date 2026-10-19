import { ApplicationConfig, Injectable, provideBrowserGlobalErrorListeners } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { provideRouter, RouterStateSnapshot, TitleStrategy, withComponentInputBinding } from '@angular/router';
import { inject } from '@angular/core';
import { routes } from './app.routes';

/** Every page title ends with the app name, so browser tabs and history stay readable. */
@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const page = this.buildTitle(snapshot);
    this.title.setTitle(page ? `${page} - Family Finance` : 'Family Finance');
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    { provide: TitleStrategy, useClass: AppTitleStrategy },
  ],
};
