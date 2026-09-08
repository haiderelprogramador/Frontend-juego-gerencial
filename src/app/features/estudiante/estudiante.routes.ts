import { Routes } from '@angular/router';

/** Rutas de la feature del estudiante (carga perezosa desde app.routes.ts). */
export const ESTUDIANTE_ROUTES: Routes = [
  {
    path: 'toma-decisiones',
    title: 'Toma de decisiones · BizSim',
    loadComponent: () =>
      import('./toma-decisiones/toma-decisiones').then((m) => m.TomaDecisiones),
  },
  {
    path: 'reportes-financieros',
    title: 'Reportes financieros · BizSim',
    loadComponent: () =>
      import('./reportes-financieros/reportes-financieros').then((m) => m.ReportesFinancieros),
  },
  { path: '', pathMatch: 'full', redirectTo: 'toma-decisiones' },
];
