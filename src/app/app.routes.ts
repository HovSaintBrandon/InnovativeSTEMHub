import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { authGuard } from './core/auth-guard';

export const routes: Routes = [
  { path: '', component: Home },
  {
    path: 'blog',
    loadComponent: () => import('./pages/blog-list/blog-list').then((m) => m.BlogList),
  },
  {
    path: 'blog/:slug',
    loadComponent: () => import('./pages/blog-post/blog-post').then((m) => m.BlogPost),
  },
  {
    path: 'admin/login',
    loadComponent: () => import('./pages/admin-login/admin-login').then((m) => m.AdminLogin),
  },
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin').then((m) => m.Admin),
    canActivate: [authGuard],
  },
  { path: '**', redirectTo: '' },
];
