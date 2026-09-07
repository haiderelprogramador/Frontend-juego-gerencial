import { Routes } from '@angular/router';

/**
 * Rutas de la feature de autenticación. Se cargan de forma perezosa desde
 * `app.routes.ts` bajo el prefijo `/auth`, dentro del `AuthLayout`.
 */
export const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    title: 'Iniciar sesión · Juego Gerencial',
    loadComponent: () => import('./login/login').then((m) => m.Login),
  },
  {
    path: 'registro-docente',
    title: 'Registro de docente · Juego Gerencial',
    loadComponent: () => import('./registro-docente/registro-docente').then((m) => m.RegistroDocente),
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
];
