import { Routes } from '@angular/router';

/**
 * Rutas de la feature del docente. Carga perezosa desde `app.routes.ts` bajo
 * `/docente`, dentro del AppShell y protegidas por authGuard + roleGuard.
 */
export const DOCENTE_ROUTES: Routes = [
  {
    path: 'panel',
    title: 'Panel del docente · BizSim',
    loadComponent: () => import('./panel/panel').then((m) => m.Panel),
  },
  {
    path: 'estudiantes',
    title: 'Carga de estudiantes · BizSim',
    loadComponent: () =>
      import('./gestion-estudiantes/gestion-estudiantes').then((m) => m.GestionEstudiantes),
  },
  { path: '', pathMatch: 'full', redirectTo: 'panel' },
];
