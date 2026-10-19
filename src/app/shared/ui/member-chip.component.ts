import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** A person's name in their own colour, so the same person looks the same on every screen. */
@Component({
  selector: 'app-member-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="chip" [style.--chip-color]="color()">
      <span class="chip__dot" aria-hidden="true"></span>
      <span class="chip__name">{{ name() }}</span>
    </span>
  `,
  styles: `
    .chip {
      display: inline-flex;
      align-items: baseline;
      gap: var(--sp-2);
      color: var(--chip-color);
      font-weight: 650;
    }
    .chip__dot {
      width: 0.5rem;
      height: 0.5rem;
      flex: none;
      border-radius: 1px;
      background: var(--chip-color);
    }
  `,
})
export class MemberChipComponent {
  readonly name = input.required<string>();
  readonly color = input.required<string>();
}
