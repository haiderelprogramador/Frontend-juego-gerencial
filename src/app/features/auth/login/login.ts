import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { MOTIVO_SESION_VENCIDA } from '../../../core/services/sesion-vencida.service';
import { Rol } from '../../../core/models/rol.enum';
import { Alerta } from '../../../shared/components/alerta/alerta';

/**
 * Pantalla de inicio de sesión (docs/03 + rediseño 🎨 docs/05).
 *
 * El rol lo determina `AuthService` a partir de las credenciales (docs/03), por
 * eso no hay selector de rol. Los elementos del prototipo que no tenían
 * respaldo en el backend (botón de Google, selector de rol, enlace de
 * recuperación de contraseña) se retiraron; la recuperación de contraseña
 * vuelve cuando exista el flujo por correo en el backend.
 */
@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, Alerta],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);
  /** Llegó acá porque el backend respondió 401 (ver `SesionVencidaService`). */
  readonly sesionVencida = signal(
    this.route.snapshot.queryParamMap.get('motivo') === MOTIVO_SESION_VENCIDA,
  );
  readonly verContrasena = signal(false);

  readonly form = this.fb.group({
    correo: ['', [Validators.required, Validators.email]],
    contrasena: ['', [Validators.required]],
  });

  enviar(): void {
    if (this.form.invalid || this.enviando()) {
      this.form.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.error.set(null);
    this.sesionVencida.set(false);

    this.auth.login(this.form.getRawValue()).subscribe({
      next: (res) => {
        this.enviando.set(false);
        this.redirigirPorRol(res.usuario.rol);
      },
      error: (err: { message?: string; error?: { message?: string } }) => {
        this.enviando.set(false);
        // err.error.message -> HttpErrorResponse real; err.message -> mock demo.
        this.error.set(
          err?.error?.message ?? err?.message ?? 'No se pudo iniciar sesión. Intenta de nuevo.',
        );
      },
    });
  }

  private redirigirPorRol(rol: Rol): void {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    if (returnUrl) {
      void this.router.navigateByUrl(returnUrl);
      return;
    }
    if (rol === Rol.DOCENTE) {
      void this.router.navigate(['/docente/panel']);
      return;
    }
    void this.router.navigate(['/estudiante/caso-actual']);
  }
}
