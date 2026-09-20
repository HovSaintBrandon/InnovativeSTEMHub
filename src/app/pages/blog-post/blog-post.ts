import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { marked } from 'marked';
import type { BlogComment, BlogPost as BlogPostModel } from '../../core/content';

type LoadState = 'loading' | 'ready' | 'not-found' | 'error';
type CommentStatus = 'idle' | 'sending' | 'sent' | 'error';

@Component({
  selector: 'app-blog-post',
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './blog-post.html',
  styleUrl: './blog-post.scss',
})
export class BlogPost implements OnInit, OnDestroy {
  protected readonly state = signal<LoadState>('loading');
  protected readonly post = signal<BlogPostModel | null>(null);
  protected readonly contentHtml = signal<SafeHtml>('');
  protected readonly comments = signal<BlogComment[]>([]);
  protected readonly commentStatus = signal<CommentStatus>('idle');

  protected readonly commentForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
    comment: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] }),
  });

  private subscription?: Subscription;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly sanitizer: DomSanitizer,
  ) {}

  ngOnInit(): void {
    this.subscription = this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug');
      if (slug) {
        this.load(slug);
      }
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  private async load(slug: string): Promise<void> {
    this.state.set('loading');
    try {
      const { getPostBySlug, listApprovedComments } = await import('../../core/content');
      const post = await getPostBySlug(slug);
      if (!post) {
        this.state.set('not-found');
        return;
      }
      this.post.set(post);
      this.contentHtml.set(this.sanitizer.bypassSecurityTrustHtml(await marked.parse(post.content)));
      this.comments.set(await listApprovedComments(post.id));
      this.state.set('ready');
    } catch {
      this.state.set('error');
    }
  }

  protected formatDate(millis: number): string {
    return new Date(millis).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  protected async submitComment(): Promise<void> {
    const post = this.post();
    if (!post || this.commentForm.invalid || this.commentStatus() === 'sending') {
      this.commentForm.markAllAsTouched();
      return;
    }
    this.commentStatus.set('sending');
    try {
      const { addComment } = await import('../../core/content');
      const { name, comment } = this.commentForm.getRawValue();
      await addComment(post.id, name, comment);
      this.commentStatus.set('sent');
      this.commentForm.reset();
    } catch {
      this.commentStatus.set('error');
    }
  }
}
