import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { Rol } from './core/models/rol.enum';

/**
 * Composición de rutas de alto nivel. Cada feature se carga de forma perezosa
 * (`loadComponent` / `loadChildren`): nada de una feature entra al bundle
 * inicial si el usuario no la visita.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'auth/login' },

  // Zona pública (sin sesión): login + registro, dentro del AuthLayout (2 columnas).
  {
    path: 'auth',
    loadComponent: () => import('./layout/auth-layout/auth-layout').then((m) => m.AuthLayout),
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },

  // Zona con sesión: todo dentro del AppShell (sidebar oscuro).
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/app-shell/app-shell').then((m) => m.AppShell),
    children: [
      {
        path: 'estudiante',
        canActivate: [roleGuard(Rol.ESTUDIANTE)],
        loadChildren: () =>
          import('./features/estudiante/estudiante.routes').then((m) => m.ESTUDIANTE_ROUTES),
      },
      {
        path: 'docente',
        canActivate: [roleGuard(Rol.DOCENTE)],
        loadChildren: () => import('./features/docente/docente.routes').then((m) => m.DOCENTE_ROUTES),
      },
      {
        path: 'clasificacion',
        loadChildren: () =>
          import('./features/clasificacion/clasificacion.routes').then((m) => m.CLASIFICACION_ROUTES),
      },
      {
        path: 'design-system',
        loadChildren: () =>
          import('./features/design-system/design-system.routes').then((m) => m.DESIGN_SYSTEM_ROUTES),
      },
    ],
  },

  { path: '**', redirectTo: 'auth/login' },
];
