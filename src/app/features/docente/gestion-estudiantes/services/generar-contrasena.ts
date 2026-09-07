/**
 * Generación de la contraseña de un estudiante cargado por Excel.
 *
 * ⚠️ En el sistema real esto lo hace el BACKEND. Este helper existe SOLO para
 * que el servicio mock (`EstudianteService` en modo demo) pueda simular esa
 * respuesta mientras no hay Spring Boot. El componente de UI no lo usa.
 *
 * Patrón confirmado con el cliente (docs/03), ejemplo textual:
 *   USU-001-NUMERO DE IDENTIFICACION
 * es decir: prefijo fijo + consecutivo + número de identificación.
 *
 * TODO: confirmar con el cliente:
 *  - Alcance del consecutivo: ¿es global de todo el sistema, o reinicia por
 *    carga / por curso / por docente? (aquí se asume: continúa desde la cantidad
 *    de estudiantes que el docente ya tenía cargados).
 *  - Cantidad de dígitos del consecutivo (aquí se asume 3, con ceros a la
 *    izquierda: 001, 002, ... 010 ... 100).
 *  - Si el número de identificación se usa tal cual o sin espacios/guiones
 *    (aquí se limpian los espacios para que la contraseña no tenga espacios).
 *  - Si esta contraseña debe cambiarse obligatoriamente en el primer ingreso.
 */

export const PREFIJO_CONTRASENA = 'USU';
export const DIGITOS_CONSECUTIVO = 3;

/** Formatea el consecutivo con ceros a la izquierda: 1 -> "001". */
export function formatearConsecutivo(consecutivo: number): string {
  return String(consecutivo).padStart(DIGITOS_CONSECUTIVO, '0');
}

/**
 * Devuelve la contraseña generada para un estudiante.
 * @param consecutivo posición 1-based dentro de la numeración
 * @param numeroIdentificacion número de identificación tal como vino del Excel
 */
export function generarContrasena(consecutivo: number, numeroIdentificacion: string): string {
  const idLimpio = numeroIdentificacion.trim().replace(/\s+/g, '');
  return `${PREFIJO_CONTRASENA}-${formatearConsecutivo(consecutivo)}-${idLimpio}`;
}
