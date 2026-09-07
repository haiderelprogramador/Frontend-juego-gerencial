/**
 * Roles con acceso al sistema.
 *
 * Confirmado con el cliente (docs/02 y docs/03):
 *  - DOCENTE y ESTUDIANTE inician sesión desde la misma pantalla de login.
 *  - Solo el DOCENTE tiene flujo de registro propio (docs/03).
 *  - El ESTUDIANTE no se autorregistra: lo crea el docente por carga masiva.
 *
 * TODO: confirmar con el cliente — en docs/03 el cliente describe "Admin" y
 * "Docente" como "casi lo mismo". Falta confirmar si Admin es un rol técnico
 * separado (con permisos propios) o si es exactamente el mismo rol que Docente.
 * Mientras no se confirme, NO se agrega ADMIN como rol operativo; si termina
 * siendo un rol aparte, se añade aquí y en los guards.
 */
export enum Rol {
  DOCENTE = 'DOCENTE',
  ESTUDIANTE = 'ESTUDIANTE',
}
