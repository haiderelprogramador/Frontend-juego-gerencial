import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { Rol } from '../../../core/models/rol.enum';
import { Alerta } from '../../../shared/components/alerta/alerta';

/**
 * Pantalla única de inicio de sesión para DOCENTE y ESTUDIANTE (docs/03).
 * El rol lo determina el backend a partir de las credenciales; aquí solo se
 * redirige según el rol que devuelve la sesión.
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
  /** Alterna entre <input type="password"> y "text" en el campo de contraseña. */
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

    // TODO: confirmar con el cliente — todavía no existe el panel del estudiante.
    // Cuando exista, redirigir a su ruta (p. ej. '/estudiante').
    void this.router.navigate(['/auth/login']);
    this.error.set('El panel del estudiante aún no está disponible en esta versión.');
  }
}
