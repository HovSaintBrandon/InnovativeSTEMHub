import { Component, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import type { BlogComment, BlogPost, LibraryItem, ResearchItem } from '../../core/content';

type Tab = 'photo' | 'research' | 'library' | 'posts' | 'comments';

@Component({
  selector: 'app-admin',
  imports: [ReactiveFormsModule],
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
})
export class Admin implements OnInit {
  protected readonly tabs: { id: Tab; label: string }[] = [
    { id: 'photo', label: 'Home photo' },
    { id: 'research', label: 'Research' },
    { id: 'library', label: 'Books & reads' },
    { id: 'posts', label: 'Blog posts' },
    { id: 'comments', label: 'Comments' },
  ];

  protected readonly activeTab = signal<Tab>('photo');
  protected readonly email = signal('');

  // Photo
  protected readonly currentPhotoUrl = signal<string | null>(null);
  protected readonly photoUploading = signal(false);
  protected selectedPhoto: File | null = null;

  // Research
  protected readonly researchItems = signal<ResearchItem[]>([]);
  protected readonly researchForm = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    year: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    url: new FormControl('', { nonNullable: true }),
    summary: new FormControl('', { nonNullable: true }),
  });

  // Library
  protected readonly libraryItems = signal<LibraryItem[]>([]);
  protected readonly libraryForm = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    author: new FormControl('', { nonNullable: true }),
    type: new FormControl<'book' | 'read'>('book', { nonNullable: true }),
    url: new FormControl('', { nonNullable: true }),
    note: new FormControl('', { nonNullable: true }),
  });

  // Blog posts
  protected readonly posts = signal<BlogPost[]>([]);
  protected readonly editingPostId = signal<string | null>(null);
  protected readonly postSaving = signal(false);
  protected selectedCover: File | null = null;
  protected readonly postForm = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    excerpt: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    content: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    status: new FormControl<'draft' | 'published'>('draft', { nonNullable: true }),
  });

  // Comments
  protected readonly pendingComments = signal<BlogComment[]>([]);

  private readonly postCovers = new Map<string, string>();

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    this.loadEverything();
  }

  private async loadEverything(): Promise<void> {
    const [{ currentUser }, content] = await Promise.all([import('../../core/auth'), import('../../core/content')]);
    const user = await currentUser();
    this.email.set(user?.email ?? '');

    this.currentPhotoUrl.set(await content.getHomePhotoUrl());
    this.researchItems.set(await content.listResearch());
    this.libraryItems.set(await content.listLibrary());
    this.posts.set(await content.listAllPosts());
    this.pendingComments.set(await content.listPendingComments());

    for (const post of this.posts()) {
      if (post.coverImageUrl) {
        this.postCovers.set(post.id, post.coverImageUrl);
      }
    }
  }

  setTab(tab: Tab): void {
    this.activeTab.set(tab);
  }

  async signOut(): Promise<void> {
    const { logout } = await import('../../core/auth');
    await logout();
    this.router.navigateByUrl('/');
  }

  /* ---- Photo ---- */

  onPhotoSelected(event: Event): void {
    this.selectedPhoto = (event.target as HTMLInputElement).files?.[0] ?? null;
  }

  async uploadPhoto(): Promise<void> {
    if (!this.selectedPhoto) return;
    this.photoUploading.set(true);
    try {
      const { setHomePhoto } = await import('../../core/content');
      const url = await setHomePhoto(this.selectedPhoto);
      this.currentPhotoUrl.set(url);
      this.selectedPhoto = null;
    } finally {
      this.photoUploading.set(false);
    }
  }

  /* ---- Research ---- */

  async addResearch(): Promise<void> {
    if (this.researchForm.invalid) {
      this.researchForm.markAllAsTouched();
      return;
    }
    const { addResearch, listResearch } = await import('../../core/content');
    const { title, year, url, summary } = this.researchForm.getRawValue();
    await addResearch({ title, year, url: url || undefined, summary: summary || undefined });
    this.researchForm.reset({ title: '', year: '', url: '', summary: '' });
    this.researchItems.set(await listResearch());
  }

  async removeResearch(id: string): Promise<void> {
    const { deleteResearch, listResearch } = await import('../../core/content');
    await deleteResearch(id);
    this.researchItems.set(await listResearch());
  }

  /* ---- Library ---- */

  async addLibraryItem(): Promise<void> {
    if (this.libraryForm.invalid) {
      this.libraryForm.markAllAsTouched();
      return;
    }
    const { addLibraryItem, listLibrary } = await import('../../core/content');
    const { title, author, type, url, note } = this.libraryForm.getRawValue();
    await addLibraryItem({
      title,
      type,
      author: author || undefined,
      url: url || undefined,
      note: note || undefined,
    });
    this.libraryForm.reset({ title: '', author: '', type: 'book', url: '', note: '' });
    this.libraryItems.set(await listLibrary());
  }

  async removeLibraryItem(id: string): Promise<void> {
    const { deleteLibraryItem, listLibrary } = await import('../../core/content');
    await deleteLibraryItem(id);
    this.libraryItems.set(await listLibrary());
  }

  /* ---- Blog posts ---- */

  coverFor(post: BlogPost): string | undefined {
    return this.postCovers.get(post.id);
  }

  onCoverSelected(event: Event): void {
    this.selectedCover = (event.target as HTMLInputElement).files?.[0] ?? null;
  }

  editPost(post: BlogPost): void {
    this.editingPostId.set(post.id);
    this.postForm.setValue({
      title: post.title,
      excerpt: post.excerpt,
      content: post.content,
      status: post.status,
    });
    this.setTab('posts');
  }

  cancelEditPost(): void {
    this.editingPostId.set(null);
    this.selectedCover = null;
    this.postForm.reset({ title: '', excerpt: '', content: '', status: 'draft' });
  }

  async savePost(): Promise<void> {
    if (this.postForm.invalid) {
      this.postForm.markAllAsTouched();
      return;
    }
    this.postSaving.set(true);
    try {
      const content = await import('../../core/content');
      const values = this.postForm.getRawValue();
      let coverImageUrl: string | undefined;
      if (this.selectedCover) {
        coverImageUrl = await content.uploadCoverImage(this.selectedCover);
      }

      const editingId = this.editingPostId();
      if (editingId) {
        await content.updatePost(editingId, { ...values, ...(coverImageUrl ? { coverImageUrl } : {}) });
      } else {
        await content.createPost({ ...values, coverImageUrl });
      }

      this.posts.set(await content.listAllPosts());
      this.cancelEditPost();
    } finally {
      this.postSaving.set(false);
    }
  }

  async togglePostStatus(post: BlogPost): Promise<void> {
    const { updatePost, listAllPosts } = await import('../../core/content');
    await updatePost(post.id, { status: post.status === 'published' ? 'draft' : 'published' });
    this.posts.set(await listAllPosts());
  }

  async removePost(id: string): Promise<void> {
    const { deletePost, listAllPosts } = await import('../../core/content');
    await deletePost(id);
    this.posts.set(await listAllPosts());
  }

  /* ---- Comments ---- */

  postTitle(postId: string): string {
    return this.posts().find((post) => post.id === postId)?.title ?? 'Untitled post';
  }

  async approve(id: string): Promise<void> {
    const { approveComment, listPendingComments } = await import('../../core/content');
    await approveComment(id);
    this.pendingComments.set(await listPendingComments());
  }

  async reject(id: string): Promise<void> {
    const { deleteComment, listPendingComments } = await import('../../core/content');
    await deleteComment(id);
    this.pendingComments.set(await listPendingComments());
  }
}
