import { Routes } from '@angular/router';

/** Ruta de la feature Clasificación (vista compartida estudiante + docente). */
export const CLASIFICACION_ROUTES: Routes = [
  {
    path: '',
    title: 'Clasificación · BizSim',
    loadComponent: () => import('./clasificacion').then((m) => m.Clasificacion),
  },
];
