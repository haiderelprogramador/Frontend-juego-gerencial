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
 * A propósito NO cierra sesión ante un 401: `POST /auth/cambiar-contrasena`
 * responde 401 cuando la contraseña actual está mal, con el token válido. Si
 * algún día se agrega un "logout ante 401", tiene que exceptuar esa ruta
 * (ver el test "un 401 de contraseña actual incorrecta no cierra sesión" en
 * mi-cuenta.spec.ts).
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
