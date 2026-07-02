import { Routes } from '@angular/router';
import { AdminLayout } from './layout/admin-layout/admin-layout';
import { authGuard, loginGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // Public routes
  {
    path: 'login',
    canActivate: [loginGuard],
    loadComponent: () =>
      import('./features/auth/pages/login/login').then((m) => m.Login),
  },
  {
    path: 'forbidden',
    loadComponent: () =>
      import('./features/auth/pages/forbidden/forbidden').then(
        (m) => m.Forbidden,
      ),
  },

  // Protected admin routes (all under AdminLayout shell)
  {
    path: '',
    component: AdminLayout,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./features/users/users').then((m) => m.Users),
      },
      {
        path: 'organizers',
        loadComponent: () =>
          import('./features/organizers/organizers').then(
            (m) => m.Organizers,
          ),
      },
      {
        path: 'events',
        loadComponent: () =>
          import('./features/events/events').then((m) => m.Events),
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./features/orders/orders').then((m) => m.Orders),
      },
      {
        path: 'tickets',
        loadComponent: () =>
          import('./features/tickets/tickets').then((m) => m.Tickets),
      },
      {
        path: 'payments',
        loadComponent: () =>
          import('./features/payments/payments').then((m) => m.Payments),
      },
      {
        path: 'promotions',
        loadComponent: () =>
          import('./features/promotions/promotions').then(
            (m) => m.Promotions,
          ),
      },
      {
        path: 'audit-logs',
        loadComponent: () =>
          import('./features/audit-logs/audit-logs').then(
            (m) => m.AuditLogs,
          ),
      },
      {
        path: 'reports',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings').then((m) => m.Settings),
      },
    ],
  },

  // Catch-all
  { path: '**', redirectTo: 'dashboard' },
];
