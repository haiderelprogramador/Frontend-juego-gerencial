import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';

import { AuthService } from '../../../core/services/auth.service';
import { contrasenaSegura, mensajeErrorContrasena } from '../../../core/validators/contrasena.validator';
import { Alerta } from '../../../shared/components/alerta/alerta';

/** Error de grupo `noCoincide` si la confirmación no es igual a la contraseña nueva. */
function confirmacionCoincide(grupo: AbstractControl): ValidationErrors | null {
  const nueva = grupo.get('contrasenaNueva')?.value;
  const confirmar = grupo.get('confirmar')?.value;
  return confirmar && nueva !== confirmar ? { noCoincide: true } : null;
}

/**
 * "Mi cuenta" — misma pantalla para docente y estudiante. Por ahora solo
 * cambiar contraseña (POST /auth/cambiar-contrasena), con las mismas reglas
 * que el registro.
 */
@Component({
  selector: 'app-mi-cuenta',
  imports: [ReactiveFormsModule, Alerta],
  templateUrl: './mi-cuenta.html',
  styleUrl: './mi-cuenta.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MiCuenta {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);

  readonly usuario = this.auth.usuarioActual;
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);
  readonly exito = signal<string | null>(null);
  readonly verContrasenas = signal(false);

  readonly form = this.fb.group(
    {
      contrasenaActual: ['', Validators.required],
      contrasenaNueva: ['', [Validators.required, contrasenaSegura()]],
      confirmar: ['', Validators.required],
    },
    { validators: confirmacionCoincide },
  );

  errorContrasenaNueva(): string | null {
    return mensajeErrorContrasena(this.form.controls.contrasenaNueva.errors);
  }

  enviar(): void {
    if (this.form.invalid || this.enviando()) {
      this.form.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.error.set(null);
    this.exito.set(null);

    const { contrasenaActual, contrasenaNueva } = this.form.getRawValue();
    this.auth.cambiarContrasena({ contrasenaActual, contrasenaNueva }).subscribe({
      next: (res) => {
        this.enviando.set(false);
        this.exito.set(res?.message || 'Contraseña actualizada.');
        this.form.reset();
      },
      error: (err: { message?: string; error?: { message?: string } }) => {
        this.enviando.set(false);
        // err.error.message -> HttpErrorResponse real; err.message -> mock demo.
        this.error.set(err?.error?.message ?? err?.message ?? 'No se pudo cambiar la contraseña.');
      },
    });
  }
}
