import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  while (auth.loading()) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  if (!auth.currentUser()) {
    return router.createUrlTree(['/login']);
  }

  if (!auth.isAdmin()) {
    return router.createUrlTree(['/forbidden']);
  }

  return true;
};