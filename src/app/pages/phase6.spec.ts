import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { App } from '../app';
import { routes } from '../app.routes';
import { AppStore } from '../core/app.store';
import { InMemoryRepositories } from '../core/storage/in-memory-repositories';
import { CLOCK, REPOSITORIES } from '../core/tokens';
import { ConfirmDialogService } from '../shared/ui';
import { FixedClock } from '../domain';

async function open(url: string) {
  TestBed.configureTestingModule({
    imports: [App],
    providers: [
      provideRouter(routes, withComponentInputBinding()),
      { provide: REPOSITORIES, useValue: new InMemoryRepositories() },
      { provide: CLOCK, useValue: new FixedClock('2026-10-17') },
    ],
  });
  const fixture = TestBed.createComponent(App);
  await fixture.whenStable();
  await TestBed.inject(Router).navigateByUrl(url);
  await fixture.whenStable();
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const type = async (selector: string, value: string) => {
    const input = el.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  };
  const submit = async (formSelector = 'form') => {
    el.querySelector(formSelector)!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
    await settle();
  };
  const click = async (text: string) => {
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes(text))!.click();
    await settle();
  };
  return { el, store: TestBed.inject(AppStore), confirm: TestBed.inject(ConfirmDialogService), settle, type, submit, click };
}

describe('Car loan', () => {
  it('shows ₹3,00,000 and calculates nothing while rate and tenure are unknown', async () => {
    const { el } = await open('/car-loan');
    expect(el.textContent).toContain('₹3,00,000');
    expect(el.textContent).toContain('Not entered yet');
    expect(el.textContent).toContain('Until then nothing is calculated');
    expect(el.querySelector('details')).toBeNull();
  });

  it('estimates an EMI from typed terms but does not count it until saved as the EMI', async () => {
    const { el, type, store, click } = await open('/car-loan');
    await type('#c-rate', '9');
    await type('#c-tenure', '36');
    expect(el.querySelector('details')).not.toBeNull();
    expect(el.textContent).toContain('not your lender');
    expect(store.obligations().total).toBe(0);
    await click('Use as EMI');
    expect((el.querySelector('#c-emi') as HTMLInputElement).value).not.toBe('');
  });

  it('saves the EMI and then counts it in monthly commitments', async () => {
    const { type, submit, store } = await open('/car-loan');
    await type('#c-emi', '9,500');
    await submit();
    expect(store.data().carLoan!.emi).toBe(950_000);
    expect(store.obligations()).toEqual({ total: 950_000, hasUnknownEmi: false });
  });

  it('rejects more EMIs paid than the tenure and an outstanding above the loan', async () => {
    const { el, type, submit, store } = await open('/car-loan');
    await type('#c-tenure', '12');
    await type('#c-paid', '20');
    await type('#c-out', '4,00,000');
    await submit();
    const text = el.querySelector('.error-summary')!.textContent!;
    expect(text).toContain('cannot be more than the tenure');
    expect(text).toContain('Outstanding cannot be more than the loan amount');
    expect(store.data().carLoan!.tenureMonths).toBeNull();
  });
});

describe('Assets and liabilities', () => {
  it('counts gold loans and the car loan once, and nets assets against them', async () => {
    const { el, click, type, submit, store } = await open('/assets-liabilities');
    expect(el.textContent).toContain('Add your assets to see this');
    await click('Add asset');
    await type('#a-name', 'Savings account');
    await type('#a-value', '5,00,000');
    await submit('form[aria-label="Asset details"]');
    expect(store.data().assets).toHaveLength(1);
    expect(store.netWorth().totalLiabilities).toBe(188_200_000 + 30_000_000); // Rs 18,82,000 gold + Rs 3,00,000 car
    expect(store.netWorth().netWorth).toBe(50_000_000 - 218_200_000);
  });

  it('validates a liability and keeps an unknown monthly payment unknown', async () => {
    const { el, click, type, submit, store } = await open('/assets-liabilities');
    await click('Add liability');
    await submit('form[aria-label="Liability details"]');
    expect(el.textContent).toContain('Enter a name.');
    await type('#l-name', 'Personal loan');
    await type('#l-out', '1,00,000');
    await submit('form[aria-label="Liability details"]');
    expect(store.data().liabilities[0]!.monthlyPayment).toBeNull();
    expect(store.obligations().hasUnknownEmi).toBe(true);
  });

  it('only deletes after confirming', async () => {
    const { el, click, type, submit, store, confirm, settle } = await open('/assets-liabilities');
    await click('Add asset');
    await type('#a-name', 'FD');
    await type('#a-value', '1,00,000');
    await submit('form[aria-label="Asset details"]');
    await click('Delete FD');
    confirm.answer(false);
    await settle();
    expect(store.data().assets).toHaveLength(1);
    await click('Delete FD');
    confirm.answer(true);
    await settle();
    await settle();
    expect(store.data().assets).toHaveLength(0);
    expect(el.textContent).toContain('No assets entered yet');
  });
});

describe('Planner', () => {
  it('names what is missing instead of guessing', async () => {
    const { el } = await open('/planner');
    expect(el.textContent).toContain('Enter income and expenses');
    expect(el.textContent).toContain('An EMI is not entered');
  });

  it('works out what is left from the entered figures and the time to a goal', async () => {
    const { el, type, submit, store } = await open('/planner');
    await type('#p-income', '1,00,000');
    await type('#p-exp', '40,000');
    await type('#p-goal', '3,00,000');
    await submit();
    expect(store.data().settings.monthlyIncome).toBe(10_000_000);
    expect(el.textContent).toContain('₹60,000 or less');
    expect(el.textContent).toContain('About 5 months');
  });

  it('lists gold loans by renewal month', async () => {
    const { el } = await open('/planner');
    expect(el.querySelectorAll('[aria-label="Renewals by month"] li').length).toBeGreaterThan(1);
  });
});

describe('Settings', () => {
  it('saves valid warning days and refuses an urgent value that is not smaller', async () => {
    const { el, type, submit, store } = await open('/settings');
    await type('#t-soon', '45');
    await submit();
    expect(store.data().settings.renewalThresholds.dueSoonDays).toBe(45);
    await type('#t-urgent', '50');
    await submit();
    expect(el.querySelector('.error-summary')?.textContent).toContain('greater than the urgent days');
    expect(store.data().settings.renewalThresholds.urgentDays).toBe(7);
  });

  it('start empty asks first, then removes everything', async () => {
    const { el, click, confirm, settle, store } = await open('/settings');
    await click('Delete everything');
    confirm.answer(false);
    await settle();
    expect(store.data().goldLoans).toHaveLength(12);
    await click('Delete everything');
    confirm.answer(true);
    await settle();
    await settle();
    expect(store.data().goldLoans).toHaveLength(0);
    expect(el.textContent).toContain('All data deleted');
  });

  it('records the backup time when a backup is made', async () => {
    const { store } = await open('/settings');
    const result = await store.exportBackup();
    expect(result.ok).toBe(true);
    expect(store.backupStatus()).toEqual({ state: 'ok', daysAgo: 0 });
  });
});

describe('Settings: sync panel', () => {
  it('says plainly that sync is not set up, and the app still works', async () => {
    const { el } = await open('/settings');
    expect(el.textContent).toContain('Sync is not set up');
    expect(el.textContent).toContain('Download backup');
  });
});
