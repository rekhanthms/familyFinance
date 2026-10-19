import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ConfirmDialogService, EmptyStateComponent, IndianDatePipe, InrPipe, MemberChipComponent, PageHeaderComponent, StatusBadgeComponent } from '.';

@Component({
  imports: [InrPipe, IndianDatePipe, StatusBadgeComponent, MemberChipComponent, PageHeaderComponent, EmptyStateComponent],
  template: `
    <p id="a">{{ 182000_00 | inr }}</p>
    <p id="b">{{ null | inr }}</p>
    <p id="c">{{ '2026-10-29' | indianDate }}</p>
    <p id="d">{{ null | indianDate }}</p>
    <app-status-badge status="due-soon" />
    <app-member-chip name="Pillai" color="#2B5C9E" />
    <app-page-header title="Loans" lead="All loans"><button>Add</button></app-page-header>
    <app-empty-state title="Nothing" message="Add one."><a>Go</a></app-empty-state>
  `,
})
class Host {}

describe('shared UI', () => {
  it('renders pipes, badge, chip, header and empty state', () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('#a')?.textContent).toBe('₹1,82,000');
    expect(el.querySelector('#b')?.textContent).toBe('—');
    expect(el.querySelector('#c')?.textContent).toBe('29 Oct 2026');
    expect(el.querySelector('#d')?.textContent).toBe('—');
    expect(el.querySelector('.badge')?.textContent).toContain('Due soon');
    expect(el.querySelector('app-member-chip')?.textContent).toContain('Pillai');
    expect(el.querySelector('h1')?.textContent).toBe('Loans');
    expect(el.querySelector('app-page-header button')?.textContent).toBe('Add');
    expect(el.querySelector('app-empty-state h2')?.textContent).toBe('Nothing');
  });
});

describe('ConfirmDialogService', () => {
  const req = { title: 'Sure?', message: 'm', confirmLabel: 'Do it' };
  it('resolves true on confirm and false on cancel', async () => {
    const s = TestBed.inject(ConfirmDialogService);
    const a = s.ask(req);
    s.answer(true);
    expect(await a).toBe(true);
    const b = s.ask(req);
    s.answer(false);
    expect(await b).toBe(false);
    expect(s.pending()).toBeNull();
  });
  it('resolves an older question as false when a new one replaces it', async () => {
    const s = TestBed.inject(ConfirmDialogService);
    const first = s.ask(req);
    const second = s.ask(req);
    expect(await first).toBe(false);
    s.answer(true);
    expect(await second).toBe(true);
  });
});
