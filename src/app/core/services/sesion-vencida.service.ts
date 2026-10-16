import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from './auth.service';

/** Valor de `?motivo=` con el que el login muestra "Tu sesión venció". */
export const MOTIVO_SESION_VENCIDA = 'sesion-vencida';

/**
 * Qué hacer cuando el backend responde 401 (sin token, o token inválido o
 * vencido): cerrar la sesión y mandar al login, guardando la ruta actual en
 * `returnUrl` para volver después de entrar (el login ya la respeta).
 *
 * Si llegan varios 401 a la vez (por ejemplo, una pantalla que pide tres
 * cosas en paralelo), se redirige una sola vez: el primero cierra la sesión y
 * los siguientes ya no encuentran sesión que cerrar.
 */
@Injectable({ providedIn: 'root' })
export class SesionVencidaService {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  manejar(): void {
    if (!this.auth.token()) {
      return;
    }
    this.auth.logout();
    const actual = this.router.url;
    // Volver a una pantalla de /auth después de entrar no tiene sentido.
    const returnUrl = actual && !actual.startsWith('/auth') ? actual : null;
    void this.router.navigate(['/auth/login'], {
      queryParams: { motivo: MOTIVO_SESION_VENCIDA, ...(returnUrl ? { returnUrl } : {}) },
    });
  }
}
