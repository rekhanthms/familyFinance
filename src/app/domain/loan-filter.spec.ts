import { buildRenewalViews } from './renewal-status';
import { createSeedData } from './seed';
import { filterLoanViews } from './loan-filter';

describe('filterLoanViews', () => {
  const data = createSeedData('2026-10-17T10:00:00.000Z');
  const views = buildRenewalViews(data.goldLoans, '2026-10-17');
  const run = (query: string, status: 'all' | 'due-soon' = 'all') => filterLoanViews(views, data.members, { query, status });

  it('returns everything for an empty search', () => expect(run('')).toHaveLength(12));
  it('filters by status', () => expect(run('', 'due-soon')).toHaveLength(3));
  it('finds by owner name, ignoring case', () => {
    const hits = run('PILLAI');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((v) => v.loan.memberId === 'm-pillai')).toBe(true);
  });
  it('finds unassigned loans by that word', () => expect(run('unassigned')).toHaveLength(2));
  it('finds by masked reference', () => expect(run('2724').length).toBeGreaterThan(0));
  it('combines search and status', () => expect(run('unassigned', 'due-soon')).toHaveLength(1));
  it('returns nothing when nothing matches', () => expect(run('zzz')).toEqual([]));
});
