import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { Rol } from '../models/rol.enum';
import { AuthService } from '../services/auth.service';

/**
 * Fábrica de guard por rol. Uso en las rutas:
 *
 *   canActivate: [authGuard, roleGuard(Rol.DOCENTE)]
 *
 * Si el usuario está autenticado pero con otro rol, lo manda a login
 * (no hay pantalla de "acceso denegado" todavía).
 * TODO: confirmar con el cliente — a dónde debe ir un estudiante que intenta
 * entrar a una ruta de docente (¿su propio panel? ¿mensaje de error?).
 */
export function roleGuard(...rolesPermitidos: Rol[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (auth.tieneRol(...rolesPermitidos)) {
      return true;
    }

    return router.createUrlTree(['/auth/login']);
  };
}
