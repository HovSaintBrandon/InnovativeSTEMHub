import { Component, OnInit, signal } from '@angular/core';
import type { LibraryItem } from '../../core/content';

@Component({
  selector: 'app-library',
  templateUrl: './library.html',
  styleUrl: './library.scss',
})
export class Library implements OnInit {
  protected readonly items = signal<LibraryItem[]>([]);

  ngOnInit(): void {
    this.loadItems();
  }

  private async loadItems(): Promise<void> {
    try {
      const { listLibrary } = await import('../../core/content');
      this.items.set(await listLibrary());
    } catch {
      /* the section simply stays hidden if Firestore isn't reachable */
    }
  }
}
