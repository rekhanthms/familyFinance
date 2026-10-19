import { Injectable, signal } from '@angular/core';

export interface ConfirmRequest {
  title: string;
  message: string;
  /** Name the action, e.g. "Delete loan", not "OK". */
  confirmLabel: string;
  cancelLabel?: string;
  /** Styles the confirm button as destructive. */
  danger?: boolean;
}

export interface PendingConfirm extends ConfirmRequest {
  resolve: (confirmed: boolean) => void;
}

/**
 * Ask before anything destructive:
 *   if (await confirm.ask({ title: 'Delete this loan?', ..., danger: true })) { ... }
 * Resolves true only on an explicit confirm. Escape, Cancel or a newer question all resolve false.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  readonly pending = signal<PendingConfirm | null>(null);

  ask(request: ConfirmRequest): Promise<boolean> {
    this.pending()?.resolve(false);
    return new Promise<boolean>((resolve) => this.pending.set({ ...request, resolve }));
  }

  answer(confirmed: boolean): void {
    const current = this.pending();
    if (!current) return;
    this.pending.set(null);
    current.resolve(confirmed);
  }
}
