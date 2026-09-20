import { Component, Input } from '@angular/core';

export type IconName =
  | 'mail'
  | 'phone'
  | 'pin'
  | 'download'
  | 'send'
  | 'chevron-down'
  | 'play'
  | 'network'
  | 'cap';

@Component({
  selector: 'app-icon',
  template: `
    <svg
      [attr.width]="size"
      [attr.height]="size"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      @switch (name) {
        @case ('mail') {
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 7l9 6 9-6" />
        }
        @case ('phone') {
          <path
            d="M6 3h3l1.5 4-2 1.6a11 11 0 0 0 5.9 5.9l1.6-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.2 5.2 2 2 0 0 1 6 3z"
          />
        }
        @case ('pin') {
          <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" />
          <circle cx="12" cy="9.5" r="2.3" />
        }
        @case ('download') {
          <path d="M12 3.5v11" />
          <path d="M7.5 11.5 12 16l4.5-4.5" />
          <path d="M4.5 19.5h15" />
        }
        @case ('send') {
          <path d="M4 12 20 4l-6.5 16-3-6-6.5-2z" />
        }
        @case ('chevron-down') {
          <path d="M6 9l6 6 6-6" />
        }
        @case ('play') {
          <rect x="3" y="5" width="18" height="14" rx="4" />
          <path d="M10.3 9.1v5.8l5-2.9-5-2.9z" fill="currentColor" stroke="none" />
        }
        @case ('network') {
          <circle cx="7" cy="7" r="2.4" />
          <circle cx="17" cy="17" r="2.4" />
          <path d="M9 8.5 15 15.5" />
        }
        @case ('cap') {
          <path d="M2 9.5 12 5l10 4.5-10 4.5-10-4.5z" />
          <path d="M6 11.8v4.4c0 1.4 2.7 2.6 6 2.6s6-1.2 6-2.6v-4.4" />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
    }
  `,
})
export class Icon {
  @Input({ required: true }) name!: IconName;
  @Input() size = 20;
}
