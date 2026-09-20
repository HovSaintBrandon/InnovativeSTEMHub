import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const authGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const { currentUser } = await import('./auth');
  const user = await currentUser();
  return user ? true : router.parseUrl('/admin/login');
};
