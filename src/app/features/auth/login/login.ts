import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { Rol } from '../../../core/models/rol.enum';
import { Alerta } from '../../../shared/components/alerta/alerta';

/**
 * Pantalla de inicio de sesión (docs/03 + rediseño 🎨 docs/05).
 *
 * Elementos 🎨 del prototipo que NO están confirmados por el cliente y aquí son
 * solo visuales:
 *  - "Continuar con Google": sin backend OAuth, no hace nada.
 *  - Selector "Ingresar como Estudiante/Docente": cosmético. El rol real lo
 *    determina `AuthService` a partir de las credenciales (docs/03).
 *  - "¿Olvidaste tu contraseña?": aún sin flujo de recuperación.
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
  readonly verContrasena = signal(false);
  /** 🎨 cosmético — no afecta el login real. */
  readonly rolPreferido = signal<'ESTUDIANTE' | 'DOCENTE'>('ESTUDIANTE');

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

    this.auth.login(this.form.getRawValue()).subscribe({
      next: (res) => {
        this.enviando.set(false);
        this.redirigirPorRol(res.usuario.rol);
      },
      error: (err: { message?: string }) => {
        this.enviando.set(false);
        this.error.set(err?.message ?? 'No se pudo iniciar sesión. Intenta de nuevo.');
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
    void this.router.navigate(['/estudiante/toma-decisiones']);
  }
}
