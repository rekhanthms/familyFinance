import type { ISODate, ISODateTime } from './dates';

/**
 * The only source of "today" and "now". Inject it everywhere so tests and demos can fix the date
 * (the seed demo uses 17 Oct 2026) and the future daily-reminder job can reuse the same logic.
 */
export interface Clock {
  today(): ISODate;
  /** Full timestamp, used for updatedAt and history records. */
  nowIso(): ISODateTime;
}

/** Real date in India Standard Time, regardless of the device's own time zone. */
export class SystemClock implements Clock {
  today(): ISODate {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  nowIso(): ISODateTime {
    return new Date().toISOString();
  }
}

export class FixedClock implements Clock {
  constructor(protected date: ISODate) {}

  today(): ISODate {
    return this.date;
  }

  nowIso(): ISODateTime {
    return `${this.date}T09:00:00+05:30`;
  }
}
