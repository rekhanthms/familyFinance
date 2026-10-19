import { ChangeDetectionStrategy, Component, effect, ElementRef, inject, viewChild } from '@angular/core';
import { ConfirmDialogService } from './confirm-dialog.service';

/** Place once, in the app shell. Uses the browser's native <dialog>: focus is trapped and Escape works for free. */
@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialog
      class="dialog"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
      (close)="service.answer(false)"
    >
      @if (service.pending(); as request) {
        <h2 id="confirm-title">{{ request.title }}</h2>
        <p id="confirm-message">{{ request.message }}</p>
        <div class="dialog__actions">
          <button type="button" class="btn btn--secondary" (click)="service.answer(false)">
            {{ request.cancelLabel ?? 'Cancel' }}
          </button>
          <button
            type="button"
            class="btn"
            [class.btn--danger]="request.danger"
            [class.btn--primary]="!request.danger"
            (click)="service.answer(true)"
          >
            {{ request.confirmLabel }}
          </button>
        </div>
      }
    </dialog>
  `,
})
export class ConfirmDialogComponent {
  protected readonly service = inject(ConfirmDialogService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const open = this.service.pending() !== null;
      const element = this.dialog().nativeElement;
      if (open && !element.open) {
        if (typeof element.showModal === 'function') element.showModal();
        else element.setAttribute('open', '');
      } else if (!open && element.open) {
        if (typeof element.close === 'function') element.close();
        else element.removeAttribute('open');
      }
    });
  }
}
