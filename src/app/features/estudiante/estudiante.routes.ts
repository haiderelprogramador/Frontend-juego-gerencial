import { Routes } from '@angular/router';

/** Rutas de la feature del estudiante (carga perezosa desde app.routes.ts). */
export const ESTUDIANTE_ROUTES: Routes = [
  {
    path: 'caso-actual',
    title: 'Caso actual · BizSim',
    loadComponent: () => import('./caso-actual/caso-actual').then((m) => m.CasoActual),
  },
  {
    path: 'reportes-financieros',
    title: 'Reportes financieros · BizSim',
    loadComponent: () =>
      import('./reportes-financieros/reportes-financieros').then((m) => m.ReportesFinancieros),
  },
  { path: '', pathMatch: 'full', redirectTo: 'caso-actual' },
];
