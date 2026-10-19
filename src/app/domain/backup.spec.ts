import { describe, expect, it } from 'vitest';
import { backupStatus, parseBackup, serializeBackup } from './backup';
import { createSeedData } from './seed';

const NOW = '2026-10-17T10:00:00+05:30';
const seed = createSeedData(NOW);

const tamper = (change: (data: Record<string, any>) => void): string => {
  const file = JSON.parse(serializeBackup(seed, NOW));
  change(file.data);
  return JSON.stringify(file);
};

describe('backup reminder', () => {
  it('says "never" when no backup was ever made', () => {
    expect(backupStatus(null, '2026-10-17')).toEqual({ state: 'never' });
  });

  it('is fine for a recent backup, stale from 30 days', () => {
    expect(backupStatus('2026-10-17T09:00:00+05:30', '2026-10-17')).toEqual({ state: 'ok', daysAgo: 0 });
    expect(backupStatus('2026-09-18T09:00:00+05:30', '2026-10-17')).toEqual({ state: 'ok', daysAgo: 29 });
    expect(backupStatus('2026-09-17T09:00:00+05:30', '2026-10-17')).toEqual({ state: 'stale', daysAgo: 30 });
  });

  it('never reports a negative age, and the limit can be changed', () => {
    expect(backupStatus('2026-10-20T09:00:00+05:30', '2026-10-17')).toEqual({ state: 'ok', daysAgo: 0 });
    expect(backupStatus('2026-10-10T09:00:00+05:30', '2026-10-17', 7)).toEqual({ state: 'stale', daysAgo: 7 });
  });
});

describe('JSON backup and restore', () => {
  it('round-trips everything without loss', () => {
    const result = parseBackup(serializeBackup(seed, NOW));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(seed);
  });

  it('rejects text that is not JSON', () => {
    const result = parseBackup('not json');
    expect(result).toEqual({ ok: false, errors: ['This file is not valid JSON.'] });
  });

  it('rejects JSON that is not a Family Finance backup', () => {
    expect(parseBackup('{"hello":"world"}').ok).toBe(false);
    expect(parseBackup('[]').ok).toBe(false);
  });

  it('rejects an unsupported version', () => {
    expect(parseBackup(tamper((d) => (d['schemaVersion'] = 99))).ok).toBe(false);
  });

  it('rejects missing lists', () => {
    const result = parseBackup(tamper((d) => delete d['goldLoans']));
    expect(result.ok).toBe(false);
  });

  it('rejects a loan with a bad date, a bad amount or an unknown owner', () => {
    expect(parseBackup(tamper((d) => (d['goldLoans'][0].renewalDate = '31-12-2026'))).ok).toBe(false);
    expect(parseBackup(tamper((d) => (d['goldLoans'][0].recordedAmount = 'lots'))).ok).toBe(false);
    expect(parseBackup(tamper((d) => (d['goldLoans'][0].memberId = 'm-ghost'))).ok).toBe(false);
  });

  it('rejects duplicate ids', () => {
    expect(parseBackup(tamper((d) => (d['goldLoans'][1].id = d['goldLoans'][0].id))).ok).toBe(false);
  });
});
