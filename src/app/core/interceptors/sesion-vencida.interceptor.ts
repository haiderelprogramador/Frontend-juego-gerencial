import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { API_CONFIG, apiUrl } from '../api/api.config';
import { SesionVencidaService } from '../services/sesion-vencida.service';

/**
 * Rutas donde un 401 NO significa sesión vencida, sino un error del formulario:
 *  - POST /auth/login: credenciales incorrectas.
 *  - POST /auth/cambiar-contrasena: la contraseña actual está mal (con el token
 *    válido; ver el test "un 401 de contraseña actual incorrecta no cierra
 *    sesión" en mi-cuenta.spec.ts).
 */
const EXCEPCIONES_401 = [API_CONFIG.endpoints.login, API_CONFIG.endpoints.cambiarContrasena].map(apiUrl);

function esExcepcion(req: HttpRequest<unknown>): boolean {
  const url = req.url.split('?')[0];
  return req.method === 'POST' && EXCEPCIONES_401.includes(url);
}

/**
 * Manejo global de la sesión vencida: ante un 401 (sin token, token inválido o
 * vencido; el backend lo responde en JSON) cierra la sesión y manda al login
 * con el aviso y la ruta de vuelta (`SesionVencidaService`). El error se
 * propaga igual, por si la pantalla quiere reaccionar. Un 403 (con sesión pero
 * sin permiso) no cierra la sesión: lo maneja cada pantalla.
 */
export const sesionVencidaInterceptor: HttpInterceptorFn = (req, next) => {
  const sesion = inject(SesionVencidaService);
  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && !esExcepcion(req)) {
        sesion.manejar();
      }
      return throwError(() => err);
    }),
  );
};
