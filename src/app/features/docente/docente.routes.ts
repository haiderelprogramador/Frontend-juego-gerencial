import { Routes } from '@angular/router';

/**
 * Rutas de la feature del docente. Se cargan de forma perezosa desde
 * `app.routes.ts` bajo el prefijo `/docente`, dentro del `MainLayout` y
 * protegidas por `authGuard` + `roleGuard(Rol.DOCENTE)`.
 */
export const DOCENTE_ROUTES: Routes = [
  {
    path: 'panel',
    title: 'Panel del docente · Juego Gerencial',
    loadComponent: () => import('./panel/panel').then((m) => m.Panel),
  },
  {
    path: 'gestion-estudiantes',
    title: 'Carga de estudiantes · Juego Gerencial',
    loadComponent: () =>
      import('./gestion-estudiantes/gestion-estudiantes').then((m) => m.GestionEstudiantes),
  },
  { path: '', pathMatch: 'full', redirectTo: 'panel' },
];
