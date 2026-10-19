import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppStore } from '../core/app.store';
import { InMemoryRepositories } from '../core/storage/in-memory-repositories';
import { CLOCK, REPOSITORIES } from '../core/tokens';
import { FixedClock } from '../domain';
import { routes } from '../app.routes';
import { AlertBannerComponent } from './alert-banner.component';
import { DataNoticesComponent } from './data-notices.component';
import { FamilySelectorComponent } from './family-selector.component';
import { ShellComponent } from './shell.component';

async function setup<T>(component: new () => T) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      { provide: REPOSITORIES, useValue: new InMemoryRepositories() },
      { provide: CLOCK, useValue: new FixedClock('2026-10-17') },
    ],
  });
  const store = TestBed.inject(AppStore);
  await store.load();
  const fixture = TestBed.createComponent(component);
  fixture.detectChanges();
  return { store, fixture, el: fixture.nativeElement as HTMLElement };
}

describe('ShellComponent', () => {
  it('has a skip link, both navs and a count on Renewals', async () => {
    const { el } = await setup(ShellComponent);
    expect(el.querySelector('a.skip-link')?.getAttribute('href')).toBe('#main-content');
    expect(el.querySelectorAll('nav[aria-label="Main"] a')).toHaveLength(8);
    expect(el.querySelectorAll('.bottom-nav a')).toHaveLength(4);
    const renewals = Array.from(el.querySelectorAll('nav[aria-label="Main"] a')).find((a) => a.textContent?.includes('Renewals'));
    expect(renewals?.textContent).toContain('3');
    expect(renewals?.querySelector('.count--severe')).toBeNull();
  });

  it('opens and closes the More menu', async () => {
    const { fixture, el } = await setup(ShellComponent);
    const more = el.querySelector<HTMLButtonElement>('.bottom-nav button')!;
    more.click();
    fixture.detectChanges();
    expect(el.querySelectorAll('.more-sheet a')).toHaveLength(4);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(el.querySelector('.more-sheet')).toBeNull();
  });
});

describe('FamilySelectorComponent', () => {
  it('lists whole family, members and Unassigned, and filters', async () => {
    const { store, fixture, el } = await setup(FamilySelectorComponent);
    const options = Array.from(el.querySelectorAll('option')).map((o) => o.textContent?.trim());
    expect(options[0]).toBe('Whole family');
    expect(options).toHaveLength(6);
    expect(options.at(-1)).toContain('Unassigned');
    const select = el.querySelector('select')!;
    select.value = 'unassigned';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(store.effectiveMemberFilter()).toBe('unassigned');
    expect(store.filteredRenewalViews()).toHaveLength(2);
  });
});

describe('AlertBannerComponent', () => {
  it('shows the nearest alert and Dismiss hides it without renewing the loan', async () => {
    const { store, fixture, el } = await setup(AlertBannerComponent);
    expect(el.textContent).toContain('29 Oct 2026');
    expect(el.textContent).toContain('12 days left');
    const before = JSON.stringify(store.data().goldLoans);
    el.querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(store.alerts()).toHaveLength(2);
    expect(el.textContent).toContain('11 Nov 2026');
    expect(JSON.stringify(store.data().goldLoans)).toBe(before);
  });
});

describe('DataNoticesComponent', () => {
  it('warns when no backup has been made', async () => {
    const { el } = await setup(DataNoticesComponent);
    expect(el.textContent).toContain("No backup yet");
  });

  it('hides the backup notice only for this session', async () => {
    const { fixture, el } = await setup(DataNoticesComponent);
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Hide'))!.click();
    fixture.detectChanges();
    expect(el.textContent).not.toContain('backup');
  });
});

describe('AppStore member filter', () => {
  it('falls back to the whole family when the chosen member no longer exists', async () => {
    const { store } = await setup(FamilySelectorComponent);
    store.setMemberFilter('m-b');
    expect(store.filteredRenewalViews().every((v) => v.loan.memberId === 'm-b')).toBe(true);
    await store.removeMember('m-b');
    expect(store.effectiveMemberFilter()).toBe('all');
    expect(store.filteredRenewalViews()).toHaveLength(12);
  });
});
