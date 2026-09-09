/**
 * Generación de la contraseña de un estudiante cargado por Excel.
 *
 * ⚠️ En el sistema real esto lo hace el BACKEND. Este helper existe SOLO para
 * que el servicio mock (`EstudianteService` en modo demo) pueda simular esa
 * respuesta mientras no hay Spring Boot. El componente de UI no lo usa.
 *
 * ⚠️ EL PATRÓN EXACTO NO ESTÁ DEFINIDO. `docs/03` lo resumió como
 * `USU-001-NUMERODEIDENTIFICACION` (prefijo primero), pero en `docs/08` §2 el
 * cliente lo describió como "número de identificación + USU" (orden inverso), y
 * no dio un ejemplo literal (¿`12345678USU`? ¿`USU-12345678`? ¿lleva el `001`?
 * ¿guiones?). El formato de aquí abajo (`USU-###-<id>`) es un **placeholder de
 * demo**, NO el patrón real — no debe tomarse como confirmado ni portarse al
 * backend hasta que el cliente dé un ejemplo concreto.
 *
 * Confirmado en `docs/08`: la contraseña generada **se envía por correo al
 * estudiante** y el cambio de contraseña es **opcional** (desde el perfil), NO
 * un paso obligatorio en el primer login.
 *
 * TODO: pedir al cliente un ejemplo literal del patrón. Pendiente también el
 * alcance del consecutivo (aquí se asume: continúa desde los ya cargados) y la
 * cantidad de dígitos (aquí se asume 3).
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
