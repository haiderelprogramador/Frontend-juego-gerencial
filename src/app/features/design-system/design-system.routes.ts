import { Routes } from '@angular/router';

/** Ruta de la página del design system (visible para ambos roles). */
export const DESIGN_SYSTEM_ROUTES: Routes = [
  {
    path: '',
    title: 'Design system · BizSim',
    loadComponent: () => import('./design-system').then((m) => m.DesignSystem),
  },
];
