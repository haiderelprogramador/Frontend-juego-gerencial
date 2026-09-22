import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { Alerta } from '../../../shared/components/alerta/alerta';

/**
 * Registro de DOCENTE (docs/03: solo el docente se autorregistra; el estudiante
 * lo crea el docente por carga masiva).
 *
 * TODO: confirmar con el cliente si "Admin" es un rol aparte que también se
 * registra por aquí o con otro flujo.
 */
@Component({
  selector: 'app-registro-docente',
  imports: [ReactiveFormsModule, RouterLink, Alerta],
  templateUrl: './registro-docente.html',
  styleUrl: './registro-docente.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistroDocente {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);
  /** Alterna entre <input type="password"> y "text" en el campo de contraseña. */
  readonly verContrasena = signal(false);

  readonly form = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(3)]],
    correo: ['', [Validators.required, Validators.email]],
    numeroIdentificacion: ['', [Validators.required, Validators.pattern(/^[0-9]{5,15}$/)]],
    contrasena: ['', [Validators.required, Validators.minLength(8)]],
  });

  enviar(): void {
    if (this.form.invalid || this.enviando()) {
      this.form.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.error.set(null);

    this.auth.registrarDocente(this.form.getRawValue()).subscribe({
      next: () => {
        this.enviando.set(false);
        void this.router.navigate(['/docente/panel']);
      },
      error: (err: { message?: string; error?: { message?: string } }) => {
        this.enviando.set(false);
        // err.error.message -> HttpErrorResponse real; err.message -> mock demo.
        this.error.set(
          err?.error?.message ?? err?.message ?? 'No se pudo completar el registro. Intenta de nuevo.',
        );
      },
    });
  }
}
