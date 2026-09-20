import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { BlogPost } from '../../core/content';

type LoadState = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-blog-list',
  imports: [RouterLink],
  templateUrl: './blog-list.html',
  styleUrl: './blog-list.scss',
})
export class BlogList implements OnInit {
  protected readonly posts = signal<BlogPost[]>([]);
  protected readonly state = signal<LoadState>('loading');

  ngOnInit(): void {
    this.loadPosts();
  }

  private async loadPosts(): Promise<void> {
    try {
      const { listPublishedPosts } = await import('../../core/content');
      this.posts.set(await listPublishedPosts());
      this.state.set('ready');
    } catch {
      this.state.set('error');
    }
  }

  protected formatDate(millis: number): string {
    return new Date(millis).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }
}
