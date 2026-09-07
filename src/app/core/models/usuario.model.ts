import { Rol } from './rol.enum';

/**
 * Usuario autenticado del sistema (docente o estudiante).
 *
 * Campos mínimos confirmados con el cliente (docs/03):
 *  nombre, correo, número de identificación, rol.
 * La contraseña nunca viaja de vuelta al frontend: solo se envía al hacer login
 * o registro.
 */
export interface Usuario {
  id: string;
  nombre: string;
  correo: string;
  numeroIdentificacion: string;
  rol: Rol;
}

/** Cuerpo de la petición de login. Mismo formulario para docente y estudiante. */
export interface LoginRequest {
  correo: string;
  contrasena: string;
}

/** Cuerpo de la petición de registro de docente (docs/03: solo el docente se registra). */
export interface RegistroDocenteRequest {
  nombre: string;
  correo: string;
  numeroIdentificacion: string;
  contrasena: string;
}

/**
 * Respuesta de /auth/login y /auth/registro-docente.
 * `token` será un JWT emitido por Spring Boot; en modo demo es un valor simulado.
 */
export interface AuthResponse {
  token: string;
  usuario: Usuario;
}
