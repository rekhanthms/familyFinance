import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { App } from '../app';
import { routes } from '../app.routes';
import { AppStore } from '../core/app.store';
import { InMemoryRepositories } from '../core/storage/in-memory-repositories';
import { CLOCK, REPOSITORIES } from '../core/tokens';
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
  const submit = async () => {
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
    await settle();
  };
  return { fixture, el, store: TestBed.inject(AppStore), router: TestBed.inject(Router), settle, type, submit };
}

describe('Gold loans list', () => {
  it('lists all 12 loans with their total and filters by search and status', async () => {
    const { el, type } = await open('/gold-loans');
    expect(el.querySelectorAll('main .ledger__row')).toHaveLength(12);
    expect(el.textContent).toContain('12 loans');
    await type('#loan-search', 'unassigned');
    expect(el.querySelectorAll('main .ledger__row')).toHaveLength(2);
    await type('#loan-search', 'zzzz');
    expect(el.textContent).toContain('No loans match');
  });
});

describe('Loan form', () => {
  it('blocks saving with a clear list of problems and focuses nothing destructive', async () => {
    const { el, submit, store } = await open('/gold-loans/new');
    const before = store.data().goldLoans.length;
    await submit();
    const summary = el.querySelector('.error-summary')!;
    expect(summary.textContent).toContain('register');
    expect(summary.textContent).toContain('Renewal date');
    expect(store.data().goldLoans).toHaveLength(before);
  });

  it('rejects a full account number', async () => {
    const { el, submit, type } = await open('/gold-loans/new');
    await type('#f-ref', '123456789012');
    await submit();
    expect(el.textContent).toContain('last 4 digits, never the full number');
  });

  it('saves a new loan and shows it on its detail page', async () => {
    const { el, submit, type, store, router } = await open('/gold-loans/new');
    await type('#f-amount', '2,00,000');
    await type('#f-renewal', '2026-12-01');
    await type('#f-ref', '4455');
    await submit();
    expect(store.data().goldLoans).toHaveLength(13);
    const saved = store.data().goldLoans.at(-1)!;
    expect(saved.recordedAmount).toBe(20_000_000);
    expect(saved.accountRef).toBe('••••4455');
    expect(saved.memberId).toBeNull();
    expect(router.url).toBe(`/gold-loans/${saved.id}`);
    expect(el.textContent).toContain('₹2,00,000');
  });

  it('edits an existing loan, keeping its renewal history', async () => {
    const { el, submit, type, store } = await open('/gold-loans/gl-008/edit');
    expect((el.querySelector('#f-amount') as HTMLInputElement).value).toBe('1,82,000');
    await type('#f-out', '1,50,000');
    await submit();
    expect(store.data().goldLoans.find((l) => l.id === 'gl-008')!.outstandingAmount).toBe(15_000_000);
    expect(store.data().goldLoans).toHaveLength(12);
  });

  it('says so for a loan that does not exist', async () => {
    const { el } = await open('/gold-loans/nope/edit');
    expect(el.textContent).toContain('no longer exists');
  });
});

describe('Loan detail', () => {
  it('shows balance basis honestly and offers WhatsApp sharing without sending anything', async () => {
    const { el } = await open('/gold-loans/gl-008');
    expect(el.textContent).toContain('29 Oct 2026');
    expect(el.textContent).toContain('not yet confirmed');
    const share = Array.from(el.querySelectorAll('a')).find((a) => a.textContent?.includes('WhatsApp'))!;
    expect(share.getAttribute('href')).toContain('https://wa.me/?text=');
  });
});

describe('Record renewal', () => {
  it('rejects a new date that is not after the completion date', async () => {
    const { el, submit, type, store } = await open('/renewals/gl-008/record');
    await type('#r-next', '2026-10-01');
    await submit();
    expect(el.querySelector('.error-summary')?.textContent).toContain('after the completion date');
    expect(store.data().goldLoans.find((l) => l.id === 'gl-008')!.renewals).toHaveLength(0);
  });

  it('records the renewal, moves the date and marks the loan renewed', async () => {
    const { submit, type, store, router } = await open('/renewals/gl-008/record');
    await type('#r-next', '2027-10-29');
    await submit();
    const loan = store.data().goldLoans.find((l) => l.id === 'gl-008')!;
    expect(loan.renewalDate).toBe('2027-10-29');
    expect(loan.renewals).toHaveLength(1);
    expect(store.renewalViews().find((v) => v.loanId === 'gl-008')!.status).toBe('renewed');
    expect(router.url).toBe('/gold-loans/gl-008');
  });
});

describe('Renewals tracker', () => {
  it('groups renewals by month, nearest first', async () => {
    const { el } = await open('/renewals');
    const titles = Array.from(el.querySelectorAll('main h2')).map((h) => h.textContent?.trim());
    expect(titles[0]).toBe('Oct 2026');
    expect(el.querySelectorAll('main .ledger__row')).toHaveLength(12);
    expect(el.querySelector('.summary')?.textContent).toContain('Due soon');
  });
});

describe('Family page', () => {
  it('lists members with loan counts and totals', async () => {
    const { el } = await open('/family');
    expect(el.querySelectorAll('main .ledger__row')).toHaveLength(4);
    expect(el.textContent).toContain('2 loans have no confirmed owner');
  });

  it('adds a member with the next free colour', async () => {
    const { el, settle, type, submit, store } = await open('/family');
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Add member'))!.click();
    await settle();
    await type('#m-name', 'Test Person');
    await submit();
    expect(store.data().members).toHaveLength(5);
    expect(store.data().members.at(-1)!.fullName).toBe('Test Person');
  });

  it('refuses a blank name', async () => {
    const { el, settle, submit, store } = await open('/family');
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Add member'))!.click();
    await settle();
    await submit();
    expect(el.textContent).toContain("Enter the member's name.");
    expect(store.data().members).toHaveLength(4);
  });
});

describe('Dashboard', () => {
  it('shows the total, action count, register mismatch and charts for the whole family', async () => {
    const { el } = await open('/dashboard');
    const figures = el.querySelector('.figures')!.textContent!;
    expect(figures).toContain('₹18,82,000');
    expect(figures).toContain('12 loans');
    expect(figures).toContain('12 still use the register amount');
    expect(el.querySelector('.register-check')?.textContent).toContain('₹17,82,000');
    expect(el.querySelector('.register-check')?.textContent).toContain('₹1,00,000');
    expect(el.querySelectorAll('main .ledger__row')).toHaveLength(3);
    expect(el.querySelectorAll('#by-member ~ .bars li')).toHaveLength(5);
    expect(el.querySelectorAll('#by-month ~ .bars li').length).toBeGreaterThan(1);
  });

  it('narrows everything to one member and hides the register check', async () => {
    const { el, store, settle } = await open('/dashboard');
    store.setMemberFilter('unassigned');
    await settle();
    expect(el.querySelector('.register-check')).toBeNull();
    expect(el.querySelector('.figures')!.textContent).toContain('2 loans');
    expect(el.querySelectorAll('#by-member ~ .bars li')).toHaveLength(1);
  });

  it('stops warning about the register once every loan is verified', async () => {
    const { el, store, settle } = await open('/dashboard');
    for (const loan of store.data().goldLoans) await store.saveGoldLoan({ ...loan, verification: 'verified' });
    await settle();
    expect(el.querySelector('.register-check')).toBeNull();
    expect(el.querySelector('.figures')!.textContent).toContain('Every loan is verified');
  });

  it('shows the empty state when the family has no loans', async () => {
    const { el, store, settle } = await open('/dashboard');
    for (const loan of [...store.data().goldLoans]) await store.deleteGoldLoan(loan.id);
    await settle();
    expect(el.textContent).toContain('No gold loans to show');
  });
});

describe('WhatsApp sharing', () => {
  it('summary link lists everything that needs action', async () => {
    const { el } = await open('/renewals');
    const link = Array.from(el.querySelectorAll('a')).find((a) => a.textContent?.includes('Share what needs action'))!;
    const text = decodeURIComponent(link.getAttribute('href')!.split('text=')[1]!);
    expect(text).toContain('29 Oct 2026');
    expect(text).toContain('11 Nov 2026');
  });

  it('a loan share is addressed to the owner when their number is saved', async () => {
    const { el, store, settle, router } = await open('/family');
    const member = store.data().members[0]!;
    await store.saveMember({ ...member, phone: '919876543210' });
    const loan = store.data().goldLoans.find((l) => l.memberId === member.id)!;
    await router.navigateByUrl(`/gold-loans/${loan.id}`);
    await settle();
    const share = Array.from(el.querySelectorAll('a')).find((a) => a.textContent?.includes('WhatsApp'))!;
    expect(share.getAttribute('href')).toContain('https://wa.me/919876543210?text=');
  });

  it('the member form rejects a number that is too short', async () => {
    const { el, settle, type, submit, store } = await open('/family');
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Add member'))!.click();
    await settle();
    await type('#m-name', 'Someone');
    await type('#m-phone', '12345');
    await submit();
    expect(el.textContent).toContain('country code');
    expect(store.data().members).toHaveLength(4);
  });
});
