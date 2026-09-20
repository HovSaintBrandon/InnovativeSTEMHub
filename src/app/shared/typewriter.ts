import { Component, Input, OnDestroy, OnInit, signal } from '@angular/core';

@Component({
  selector: 'app-typewriter',
  template: `
    <span aria-hidden="true">{{ display() }}</span>
    <span class="sr-only">{{ words[0] }}</span>
  `,
  styles: `
    :host {
      display: inline;
    }
  `,
})
export class Typewriter implements OnInit, OnDestroy {
  @Input({ required: true }) words: string[] = [];

  protected readonly display = signal('');

  private wordIndex = 0;
  private charIndex = 0;
  private deleting = false;
  private timer?: ReturnType<typeof setTimeout>;
  private readonly reducedMotion =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  ngOnInit(): void {
    if (!this.words.length) {
      return;
    }
    if (this.reducedMotion) {
      this.display.set(this.words[0]);
      return;
    }
    this.tick();
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }

  private tick(): void {
    const current = this.words[this.wordIndex];

    if (!this.deleting) {
      this.charIndex++;
      this.display.set(current.slice(0, this.charIndex));

      if (this.charIndex === current.length) {
        this.deleting = true;
        this.timer = setTimeout(() => this.tick(), 1800);
        return;
      }
      this.timer = setTimeout(() => this.tick(), 90);
      return;
    }

    this.charIndex--;
    this.display.set(current.slice(0, this.charIndex));

    if (this.charIndex === 0) {
      this.deleting = false;
      this.wordIndex = (this.wordIndex + 1) % this.words.length;
      this.timer = setTimeout(() => this.tick(), 300);
      return;
    }
    this.timer = setTimeout(() => this.tick(), 45);
  }
}
