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

/**
 * Errores de grupo: `igualActual` si la nueva es igual a la actual (el backend
 * responde 400) y `noCoincide` si la confirmación no es igual a la nueva.
 */
function validarContrasenas(grupo: AbstractControl): ValidationErrors | null {
  const actual = grupo.get('contrasenaActual')?.value;
  const nueva = grupo.get('contrasenaNueva')?.value;
  const confirmar = grupo.get('confirmar')?.value;
  const errores: ValidationErrors = {};
  if (nueva && nueva === actual) {
    errores['igualActual'] = true;
  }
  if (confirmar && nueva !== confirmar) {
    errores['noCoincide'] = true;
  }
  return Object.keys(errores).length > 0 ? errores : null;
}

/**
 * "Mi cuenta" — misma pantalla para docente y estudiante. Por ahora solo
 * cambiar contraseña (POST /auth/cambiar-contrasena), con las mismas reglas
 * que el registro. Una contraseña actual incorrecta (401) se muestra como
 * error del formulario; la sesión sigue abierta.
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
    { validators: validarContrasenas },
  );

  errorContrasenaNueva(): string | null {
    const reglas = mensajeErrorContrasena(this.form.controls.contrasenaNueva.errors);
    if (reglas) {
      return reglas;
    }
    return this.form.hasError('igualActual') ? 'Tiene que ser distinta de la contraseña actual.' : null;
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
