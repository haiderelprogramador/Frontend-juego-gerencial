import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';

import { AuthService } from '../services/auth.service';

/**
 * Adjunta el token de sesión como `Authorization: Bearer <token>` a cada
 * petición saliente.
 *
 * En MODO DEMO casi no se usa (los servicios resuelven en memoria), pero queda
 * cableado para que, al activar el backend real, no haya que tocar nada más.
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
