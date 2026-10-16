import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';

import { AuthService } from '../services/auth.service';

/**
 * Adjunta el token de sesión como `Authorization: Bearer <token>` a cada
 * petición saliente.
 *
 * En MODO DEMO casi no se usa (los servicios resuelven en memoria), pero queda
 * cableado para que, al activar el backend real, no haya que tocar nada más.
 *
 * No maneja el 401: eso lo hace `sesionVencidaInterceptor`, que exceptúa
 * `POST /auth/login` y `POST /auth/cambiar-contrasena` (un 401 ahí es un error
 * del formulario, no una sesión vencida).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).token();

  if (!token) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    }),
  );
};
