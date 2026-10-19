import { describe, expect, it } from 'vitest';
import { createSeedData } from './seed';
import { validateGoldLoan } from './validation';

const base = createSeedData('2026-10-17T10:00:00+05:30').goldLoans[0]!;

describe('validateGoldLoan', () => {
  it('accepts a good loan', () => {
    expect(validateGoldLoan(base)).toEqual([]);
  });

  it('requires a valid renewal date', () => {
    expect(validateGoldLoan({ ...base, renewalDate: '' })).toHaveLength(1);
    expect(validateGoldLoan({ ...base, renewalDate: '2027-02-30' })).toHaveLength(1);
  });

  it('requires a positive amount and non-negative optional numbers', () => {
    expect(validateGoldLoan({ ...base, recordedAmount: 0 })).toHaveLength(1);
    expect(validateGoldLoan({ ...base, outstandingAmount: -1 })).toHaveLength(1);
    expect(validateGoldLoan({ ...base, interestRatePercent: -0.5 })).toHaveLength(1);
    expect(validateGoldLoan({ ...base, outstandingAmount: 0, interestRatePercent: 0 })).toEqual([]);
  });

  it('checks the pledge date and renewal interval', () => {
    expect(validateGoldLoan({ ...base, pledgeDate: '2028-01-01' })).toHaveLength(1);
    expect(validateGoldLoan({ ...base, pledgeDate: '2026-01-01' })).toEqual([]);
    expect(validateGoldLoan({ ...base, renewalIntervalMonths: 0 })).toHaveLength(1);
    expect(validateGoldLoan({ ...base, renewalIntervalMonths: 12 })).toEqual([]);
  });

  it('requires at least one jewelry item with a type and a whole-number quantity', () => {
    expect(validateGoldLoan({ ...base, jewelry: [] })).toHaveLength(1);
    expect(validateGoldLoan({ ...base, jewelry: [{ type: ' ', quantity: 1 }] })).toHaveLength(1);
    expect(validateGoldLoan({ ...base, jewelry: [{ type: 'Chain', quantity: 0 }] })).toHaveLength(1);
    expect(validateGoldLoan({ ...base, jewelry: [{ type: 'Chain', quantity: 1.5 }] })).toHaveLength(1);
  });
});
