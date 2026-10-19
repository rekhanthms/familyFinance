import { describe, expect, it } from 'vitest';
import { FixedClock, SystemClock } from './clock';
import {
  addDays,
  addMonths,
  daysBetween,
  formatIndianDate,
  formatMonthKey,
  isISODate,
  monthKey,
  parseIndianDate,
} from './dates';

describe('dates', () => {
  it('validates real calendar dates only', () => {
    expect(isISODate('2026-10-17')).toBe(true);
    expect(isISODate('2028-02-29')).toBe(true);
    expect(isISODate('2026-02-29')).toBe(false);
    expect(isISODate('2026-13-01')).toBe(false);
    expect(isISODate('17-10-2026')).toBe(false);
    expect(isISODate(undefined)).toBe(false);
  });

  it('counts whole days in both directions, across month and year ends', () => {
    expect(daysBetween('2026-10-17', '2026-10-29')).toBe(12);
    expect(daysBetween('2026-10-17', '2026-11-11')).toBe(25);
    expect(daysBetween('2026-10-17', '2026-10-17')).toBe(0);
    expect(daysBetween('2026-10-17', '2026-10-10')).toBe(-7);
    expect(daysBetween('2026-12-30', '2027-01-02')).toBe(3);
  });

  it('adds days and months, clamping to month end', () => {
    expect(addDays('2026-10-17', 14)).toBe('2026-10-31');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2027-01-31', 1)).toBe('2027-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-10-29', 12)).toBe('2027-10-29');
    expect(addMonths('2026-11-11', -2)).toBe('2026-09-11');
  });

  it('formats in readable Indian style', () => {
    expect(formatIndianDate('2026-10-17')).toBe('17 Oct 2026');
    expect(formatIndianDate('2027-01-09')).toBe('9 Jan 2027');
    expect(monthKey('2026-11-11')).toBe('2026-11');
    expect(formatMonthKey('2026-11')).toBe('Nov 2026');
  });

  it('parses dates as written in the register', () => {
    expect(parseIndianDate('16-10-2027')).toBe('2027-10-16');
    expect(parseIndianDate('9/12/2026')).toBe('2026-12-09');
    expect(parseIndianDate('31-02-2027')).toBeNull();
    expect(parseIndianDate('garbage')).toBeNull();
  });
});

describe('clock', () => {
  it('system clock returns an ISO date', () => {
    expect(isISODate(new SystemClock().today())).toBe(true);
  });

  it('fixed clock returns the date it was given', () => {
    expect(new FixedClock('2026-10-17').today()).toBe('2026-10-17');
    expect(new FixedClock('2026-10-17').nowIso()).toBe('2026-10-17T09:00:00+05:30');
  });

  it('system clock returns a full timestamp', () => {
    expect(new SystemClock().nowIso()).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
