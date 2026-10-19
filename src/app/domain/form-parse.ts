import { rupeesToPaise, type Paise } from './money';

/** Outcome of reading a text box: blank is allowed (unknown), junk is an error the form can show. */
export type ParsedField<T> = { ok: true; value: T | null } | { ok: false; error: string };

/**
 * "1,82,000" or "₹ 1,82,000.50" -> paise. Blank -> null (unknown). Anything else -> error.
 * Commas and the rupee sign are ignored; negative numbers are rejected.
 */
export function parseRupees(text: string): ParsedField<Paise> {
  const cleaned = text.replace(/[₹,\s]/g, '');
  if (cleaned === '') return { ok: true, value: null };
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return { ok: false, error: 'Enter an amount in rupees, like 1,82,000.' };
  return { ok: true, value: rupeesToPaise(Number(cleaned)) };
}

/** A plain non-negative number such as an interest rate. Blank -> null. */
export function parseDecimal(text: string): ParsedField<number> {
  const cleaned = text.trim();
  if (cleaned === '') return { ok: true, value: null };
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return { ok: false, error: 'Enter a number, like 1.5.' };
  return { ok: true, value: Number(cleaned) };
}

/** A whole number of 1 or more. Blank -> null. */
export function parseWhole(text: string): ParsedField<number> {
  const cleaned = text.trim();
  if (cleaned === '') return { ok: true, value: null };
  if (!/^\d+$/.test(cleaned) || Number(cleaned) < 1) return { ok: false, error: 'Enter a whole number, 1 or more.' };
  return { ok: true, value: Number(cleaned) };
}

/** Shows paise back in a text box without the rupee sign: 18200000 -> "1,82,000". */
export function paiseToInputText(paise: Paise | null): string {
  if (paise == null) return '';
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(rupees);
}
