import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { InMemoryRepositories } from './core/storage/in-memory-repositories';
import { CLOCK, REPOSITORIES } from './core/tokens';
import { FixedClock } from './domain';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        { provide: REPOSITORIES, useValue: new InMemoryRepositories() },
        { provide: CLOCK, useValue: new FixedClock('2026-10-17') },
      ],
    }).compileComponents();
  });

  async function open(url: string) {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('opens on the dashboard and lists renewals needing action, nearest first', async () => {
    const page = await open('/');
    expect(page.querySelector('h1')?.textContent).toContain('Dashboard');
    const rows = Array.from(page.querySelectorAll('main .ledger__row')).map((r) => r.textContent ?? '');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain('29 Oct 2026');
    expect(rows[0]).toContain('Due soon');
    expect(rows[0]).toContain('12 days left');
    expect(rows[0]).toContain('₹1,82,000');
  });

  it('shows the top renewal alert in the banner on every page', async () => {
    const page = await open('/settings');
    const banner = page.querySelector('app-alert-banner');
    expect(banner?.textContent).toContain('29 Oct 2026');
    expect(banner?.textContent).toContain('View all 3');
  });

  it('shows a not-found page for unknown addresses', async () => {
    const page = await open('/nope');
    expect(page.querySelector('h1')?.textContent).toContain('Page not found');
  });
});
