/**
 * Money is always stored as an integer number of paise (1 rupee = 100 paise).
 * Never store balances as floating-point rupees.
 */
export type Paise = number;

export const PAISE_PER_RUPEE = 100;

export function rupeesToPaise(rupees: number): Paise {
  return Math.round(rupees * PAISE_PER_RUPEE);
}

export function paiseToRupees(paise: Paise): number {
  return paise / PAISE_PER_RUPEE;
}

export function isValidPaise(value: unknown): value is Paise {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

export function sumPaise(values: readonly Paise[]): Paise {
  return values.reduce((total, value) => total + value, 0);
}

const inrWhole = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const inrFraction = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Indian digit grouping: 200000 rupees -> "₹2,00,000". */
export function formatINR(paise: Paise): string {
  const isWholeRupee = paise % PAISE_PER_RUPEE === 0;
  return (isWholeRupee ? inrWhole : inrFraction).format(paise / PAISE_PER_RUPEE);
}

function trimDecimals(value: number): string {
  return Number(value.toFixed(2)).toString();
}

/** Compact form for tight spaces: "₹18.82 L", "₹1.2 Cr". Falls back to full form below one lakh. */
export function formatINRCompact(paise: Paise): string {
  const rupees = Math.abs(paise) / PAISE_PER_RUPEE;
  const sign = paise < 0 ? '-' : '';
  if (rupees >= 1_00_00_000) return `${sign}₹${trimDecimals(rupees / 1_00_00_000)} Cr`;
  if (rupees >= 1_00_000) return `${sign}₹${trimDecimals(rupees / 1_00_000)} L`;
  return formatINR(paise);
}
