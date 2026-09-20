import { Component, OnInit, signal } from '@angular/core';
import type { ResearchItem } from '../../core/content';
import { RESEARCH } from '../../data/profile';

@Component({
  selector: 'app-research',
  templateUrl: './research.html',
  styleUrl: './research.scss',
})
export class Research implements OnInit {
  protected readonly stats = RESEARCH.stats;
  protected readonly profiles = RESEARCH.profiles;
  protected readonly currentResearch = signal<ResearchItem[]>([]);

  ngOnInit(): void {
    this.loadResearch();
  }

  private async loadResearch(): Promise<void> {
    try {
      const { listResearch } = await import('../../core/content');
      this.currentResearch.set(await listResearch());
    } catch {
      /* the section simply stays hidden if Firestore isn't reachable */
    }
  }
}
