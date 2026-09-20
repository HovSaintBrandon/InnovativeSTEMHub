import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from './firebase';

export interface ResearchItem {
  id: string;
  title: string;
  year: string;
  url?: string;
  summary?: string;
  createdAt: number;
}

export interface LibraryItem {
  id: string;
  title: string;
  author?: string;
  type: 'book' | 'read';
  url?: string;
  note?: string;
  createdAt: number;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImageUrl?: string;
  status: 'draft' | 'published';
  createdAt: number;
  updatedAt: number;
}

export interface BlogComment {
  id: string;
  postId: string;
  name: string;
  comment: string;
  approved: boolean;
  createdAt: number;
}

function toMillis(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === 'number') return value;
  return Date.now();
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/* ---------------- Home photo ---------------- */

export async function getHomePhotoUrl(): Promise<string | null> {
  const snap = await getDoc(doc(db, 'profile', 'home'));
  return snap.exists() ? ((snap.data()['photoUrl'] as string) ?? null) : null;
}

export async function setHomePhoto(file: File): Promise<string> {
  const path = `site/home-photo-${Date.now()}-${file.name}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);
  await setDoc(doc(db, 'profile', 'home'), { photoUrl: url, updatedAt: Date.now() });
  return url;
}

/* ---------------- Research ---------------- */

export async function listResearch(): Promise<ResearchItem[]> {
  const snap = await getDocs(collection(db, 'research'));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data(), createdAt: toMillis(d.data()['createdAt']) }) as ResearchItem)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function addResearch(item: Omit<ResearchItem, 'id' | 'createdAt'>): Promise<void> {
  await addDoc(collection(db, 'research'), { ...item, createdAt: Date.now() });
}

export async function deleteResearch(id: string): Promise<void> {
  await deleteDoc(doc(db, 'research', id));
}

/* ---------------- Library (books & reads) ---------------- */

export async function listLibrary(): Promise<LibraryItem[]> {
  const snap = await getDocs(collection(db, 'library'));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data(), createdAt: toMillis(d.data()['createdAt']) }) as LibraryItem)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function addLibraryItem(item: Omit<LibraryItem, 'id' | 'createdAt'>): Promise<void> {
  await addDoc(collection(db, 'library'), { ...item, createdAt: Date.now() });
}

export async function deleteLibraryItem(id: string): Promise<void> {
  await deleteDoc(doc(db, 'library', id));
}

/* ---------------- Blog posts ---------------- */

export async function listPublishedPosts(): Promise<BlogPost[]> {
  const snap = await getDocs(query(collection(db, 'blogPosts'), where('status', '==', 'published')));
  return snap.docs
    .map(
      (d) =>
        ({
          id: d.id,
          ...d.data(),
          createdAt: toMillis(d.data()['createdAt']),
          updatedAt: toMillis(d.data()['updatedAt']),
        }) as BlogPost,
    )
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function listAllPosts(): Promise<BlogPost[]> {
  const snap = await getDocs(collection(db, 'blogPosts'));
  return snap.docs
    .map(
      (d) =>
        ({
          id: d.id,
          ...d.data(),
          createdAt: toMillis(d.data()['createdAt']),
          updatedAt: toMillis(d.data()['updatedAt']),
        }) as BlogPost,
    )
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  // Filters on both slug and status so this satisfies the security rule for
  // anonymous readers (published-only) without a separate admin-only path.
  const snap = await getDocs(
    query(collection(db, 'blogPosts'), where('slug', '==', slug), where('status', '==', 'published')),
  );
  const found = snap.docs[0];
  if (!found) return null;
  return {
    id: found.id,
    ...found.data(),
    createdAt: toMillis(found.data()['createdAt']),
    updatedAt: toMillis(found.data()['updatedAt']),
  } as BlogPost;
}

export async function createPost(input: {
  title: string;
  excerpt: string;
  content: string;
  coverImageUrl?: string;
  status: 'draft' | 'published';
}): Promise<void> {
  const now = Date.now();
  await addDoc(collection(db, 'blogPosts'), {
    ...input,
    slug: `${slugify(input.title)}-${now.toString(36)}`,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updatePost(
  id: string,
  input: Partial<Pick<BlogPost, 'title' | 'excerpt' | 'content' | 'coverImageUrl' | 'status'>>,
): Promise<void> {
  await updateDoc(doc(db, 'blogPosts', id), { ...input, updatedAt: Date.now() });
}

export async function deletePost(id: string): Promise<void> {
  await deleteDoc(doc(db, 'blogPosts', id));
}

export async function uploadCoverImage(file: File): Promise<string> {
  const path = `site/blog-${Date.now()}-${file.name}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}

/* ---------------- Comments ---------------- */

export async function listApprovedComments(postId: string): Promise<BlogComment[]> {
  const snap = await getDocs(
    query(collection(db, 'blogComments'), where('postId', '==', postId), where('approved', '==', true)),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data(), createdAt: toMillis(d.data()['createdAt']) }) as BlogComment)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function listPendingComments(): Promise<BlogComment[]> {
  const snap = await getDocs(query(collection(db, 'blogComments'), where('approved', '==', false)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data(), createdAt: toMillis(d.data()['createdAt']) }) as BlogComment)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function addComment(postId: string, name: string, comment: string): Promise<void> {
  await addDoc(collection(db, 'blogComments'), {
    postId,
    name,
    comment,
    approved: false,
    createdAt: Date.now(),
  });
}

export async function approveComment(id: string): Promise<void> {
  await updateDoc(doc(db, 'blogComments', id), { approved: true });
}

export async function deleteComment(id: string): Promise<void> {
  await deleteDoc(doc(db, 'blogComments', id));
}
