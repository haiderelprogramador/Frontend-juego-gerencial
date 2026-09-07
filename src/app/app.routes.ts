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

  // Zona pública (sin sesión): login + registro de docente, dentro del AuthLayout.
  {
    path: 'auth',
    loadComponent: () => import('./layout/auth-layout/auth-layout').then((m) => m.AuthLayout),
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },

  // Zona del docente (con sesión y rol DOCENTE), dentro del MainLayout.
  {
    path: 'docente',
    canActivate: [authGuard, roleGuard(Rol.DOCENTE)],
    loadComponent: () => import('./layout/main-layout/main-layout').then((m) => m.MainLayout),
    loadChildren: () => import('./features/docente/docente.routes').then((m) => m.DOCENTE_ROUTES),
  },

  // TODO: confirmar con el cliente — feature 'estudiante' (panel del estudiante).
  // { path: 'estudiante', canActivate: [authGuard, roleGuard(Rol.ESTUDIANTE)], ... }

  { path: '**', redirectTo: 'auth/login' },
];
