import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

/**
 * Guard: redirects to /login if user is not authenticated.
 * If authenticated but not admin → redirects to /forbidden.
 */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Wait for auth state to resolve on first load
  await auth.waitForAuthInit();

  if (!auth.currentUser()) {
    return router.createUrlTree(['/login']);
  }

  if (!auth.isAdmin()) {
    return router.createUrlTree(['/forbidden']);
  }

  return true;
};

/**
 * Guard: redirects logged-in admins away from the login page.
 */
export const loginGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.waitForAuthInit();

  if (auth.currentUser() && auth.isAdmin()) {
    return router.createUrlTree(['/dashboard']);
  }

  return true;
};
