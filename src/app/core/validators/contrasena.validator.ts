import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Reglas de contraseña del contrato (API Estratego, 57 endpoints, 5-oct-2026):
 * las mismas para registro y para cambiar contraseña.
 *
 * TODO: confirmar con el cliente qué cuenta como "símbolo" exactamente. Acá:
 * cualquier carácter que no sea letra ASCII, dígito ni espacio.
 */
export const REGLAS_CONTRASENA: readonly { mensaje: string; cumple: (v: string) => boolean }[] = [
  { mensaje: 'mínimo 8 caracteres', cumple: (v) => v.length >= 8 },
  { mensaje: 'máximo 72 caracteres', cumple: (v) => v.length <= 72 },
  { mensaje: 'una mayúscula', cumple: (v) => /[A-Z]/.test(v) },
  { mensaje: 'una minúscula', cumple: (v) => /[a-z]/.test(v) },
  { mensaje: 'un número', cumple: (v) => /[0-9]/.test(v) },
  { mensaje: 'un símbolo', cumple: (v) => /[^A-Za-z0-9\s]/.test(v) },
];

/** Las reglas que `valor` no cumple, como texto legible. */
export function reglasContrasenaFaltantes(valor: string): string[] {
  return REGLAS_CONTRASENA.filter((r) => !r.cumple(valor)).map((r) => r.mensaje);
}

/**
 * `{ contrasena: { faltan: [...] } }` si no cumple alguna regla. Un valor
 * vacío no da error acá: eso es de `Validators.required`.
 */
export function contrasenaSegura(): ValidatorFn {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    const valor = control.value ?? '';
    if (valor === '') {
      return null;
    }
    const faltan = reglasContrasenaFaltantes(valor);
    return faltan.length > 0 ? { contrasena: { faltan } } : null;
  };
}

/** Mensaje para mostrar bajo el campo, o null si no hay error. */
export function mensajeErrorContrasena(errores: ValidationErrors | null): string | null {
  if (!errores) {
    return null;
  }
  if (errores['required']) {
    return 'Escribe una contraseña.';
  }
  const faltan: string[] | undefined = errores['contrasena']?.faltan;
  return faltan?.length ? `Debe tener ${faltan.join(', ')}.` : null;
}
