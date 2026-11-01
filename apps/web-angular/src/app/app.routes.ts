import { Routes } from '@angular/router';
import { authGuard } from './core/auth-guard';
import { Shell } from './layout/shell/shell';

export const routes: Routes = [
  {
    path: '',
    component: Shell,
    children: [
      { path: '', loadComponent: () => import('./pages/welcome/welcome').then((m) => m.Welcome) },
      { path: 'about', loadComponent: () => import('./pages/about/about').then((m) => m.About) },
      {
        path: 'dashboard',
        canActivate: [authGuard],
        loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'settings',
        canActivate: [authGuard],
        loadComponent: () => import('./pages/settings/settings').then((m) => m.Settings),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
