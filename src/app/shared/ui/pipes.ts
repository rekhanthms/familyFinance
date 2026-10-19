import { Pipe, type PipeTransform } from '@angular/core';
import { formatINR, formatIndianDate } from '../../domain';

/** `{{ loan.recordedAmount | inr }}` -> "₹2,00,000". A missing value shows a dash, never "₹0". */
@Pipe({ name: 'inr' })
export class InrPipe implements PipeTransform {
  transform(paise: number | null | undefined): string {
    return paise == null ? '—' : formatINR(paise);
  }
}

/** `{{ loan.renewalDate | indianDate }}` -> "29 Oct 2026". */
@Pipe({ name: 'indianDate' })
export class IndianDatePipe implements PipeTransform {
  transform(date: string | null | undefined): string {
    return date ? formatIndianDate(date) : '—';
  }
}
