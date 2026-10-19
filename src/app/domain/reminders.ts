import { formatIndianDate, type ISODate } from './dates';
import { formatINR, type Paise } from './money';
import type { JewelryItem } from './models';
import type { RenewalStatus } from './renewal-status';

/** "Chain ×1, Kammal / Jhumki (Kammal) ×4" */
export function jewelrySummary(items: readonly JewelryItem[]): string {
  return items
    .map((item) => `${item.type}${item.description && item.description !== item.type ? ` (${item.description})` : ''} ×${item.quantity}`)
    .join(', ');
}

/** "12 days left", "1 day left", "due today", "overdue by 3 days". One wording for banners and messages. */
export function describeDaysRemaining(daysRemaining: number): string {
  if (daysRemaining === 0) return 'due today';
  const count = Math.abs(daysRemaining);
  const unit = count === 1 ? 'day' : 'days';
  return daysRemaining < 0 ? `overdue by ${count} ${unit}` : `${count} ${unit} left`;
}

export interface ReminderInput {
  ownerName: string;
  accountRef: string | null;
  jewelry: readonly JewelryItem[];
  amount: Paise;
  renewalDate: ISODate;
  daysRemaining: number;
  status: RenewalStatus;
}

/** Plain text for a one-tap share. It describes data the user entered; it promises nothing was sent. */
export function buildRenewalReminderText(input: ReminderInput): string {
  const lines = [
    `Gold loan renewal reminder - ${input.ownerName}`,
    `${input.accountRef ? `Loan ${input.accountRef}: ` : ''}${jewelrySummary(input.jewelry)}`,
    `Amount: ${formatINR(input.amount)}`,
    `Renewal date: ${formatIndianDate(input.renewalDate)} (${describeDaysRemaining(input.daysRemaining)})`,
  ];
  return lines.join('\n');
}

/**
 * Link that opens WhatsApp with the message pre-filled. The user taps Send themselves - this is
 * not an automated send. Pass a number with country code (digits only, e.g. "919876543210") to
 * address a specific person; without one, WhatsApp lets the user pick the chat.
 */
export function buildWhatsAppLink(text: string, phoneWithCountryCode?: string): string {
  const digits = (phoneWithCountryCode ?? '').replace(/\D/g, '');
  const hasUsablePhone = digits.length >= 8 && digits.length <= 15;
  return `https://wa.me/${hasUsablePhone ? digits : ''}?text=${encodeURIComponent(text)}`;
}
