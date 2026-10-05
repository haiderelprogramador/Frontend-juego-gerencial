import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { delay, tap } from 'rxjs/operators';

import { API_CONFIG, apiUrl } from '../api/api.config';
import { DemoDb } from '../demo/demo-db';
import { Rol } from '../models/rol.enum';
import {
  AuthResponse,
  CambiarContrasenaRequest,
  LoginRequest,
  RegistroDocenteRequest,
  Usuario,
} from '../models/usuario.model';

/**
 * Autenticación y sesión de la app.
 *
 * Contrato de API (API Estratego, 57 endpoints, 5-oct-2026):
 *  - POST {@link API_CONFIG.endpoints.login}             body LoginRequest              -> AuthResponse
 *  - POST {@link API_CONFIG.endpoints.registroDocente}   body RegistroDocenteRequest    -> AuthResponse
 *  - GET  {@link API_CONFIG.endpoints.sesion}            (Bearer token)                 -> { usuario: Usuario }
 *  - POST {@link API_CONFIG.endpoints.cambiarContrasena} body CambiarContrasenaRequest  -> { message }
 *
 * Mientras `API_CONFIG.demoMode` sea true, cada método resuelve contra
 * {@link DemoDb} (localStorage) simulando latencia de red. La firma pública
 * (Observables con los mismos DTOs) no cambia cuando llegue el backend: solo
 * se sustituye el cuerpo `if (demoMode)` por la llamada `HttpClient` de al lado.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly demo = inject(DemoDb);

  private readonly _sesion = signal<AuthResponse | null>(this.demo.leerSesion());

  /** Usuario autenticado actual, o null si no hay sesión. */
  readonly usuarioActual = computed<Usuario | null>(() => this._sesion()?.usuario ?? null);
  /** true si hay una sesión iniciada. */
  readonly autenticado = computed<boolean>(() => this._sesion() !== null);

  // ---------------------------------------------------------------------------
  // Login (docente y estudiante usan la misma pantalla y el mismo endpoint)
  // ---------------------------------------------------------------------------

  login(req: LoginRequest): Observable<AuthResponse> {
    if (!API_CONFIG.demoMode) {
      return this.http
        .post<AuthResponse>(apiUrl(API_CONFIG.endpoints.login), req)
        .pipe(tap((res) => this.establecerSesion(res)));
    }

    // --- Implementación DEMO ---------------------------------------------------
    const correo = req.correo.trim().toLowerCase();

    const docente = this.demo.buscarDocentePorCorreo(correo);
    if (docente && docente.contrasena === req.contrasena) {
      return this.responderDemo(this.construirAuth(docente.usuario)).pipe(
        tap((res) => this.establecerSesion(res)),
      );
    }

    const estudiante = this.demo.buscarEstudiantePorCorreo(correo);
    if (estudiante && estudiante.contrasena === req.contrasena) {
      return this.responderDemo(this.construirAuth(estudiante.usuario)).pipe(
        tap((res) => this.establecerSesion(res)),
      );
    }

    return throwError(() => ({
      status: 401,
      message: 'Correo o contraseña incorrectos.',
    })).pipe(delay(API_CONFIG.demoLatenciaMs));
  }

  // ---------------------------------------------------------------------------
  // Registro de docente (docs/03: solo el docente se autorregistra)
  // ---------------------------------------------------------------------------

  registrarDocente(req: RegistroDocenteRequest): Observable<AuthResponse> {
    if (!API_CONFIG.demoMode) {
      return this.http
        .post<AuthResponse>(apiUrl(API_CONFIG.endpoints.registroDocente), req)
        .pipe(tap((res) => this.establecerSesion(res)));
    }

    // --- Implementación DEMO ---------------------------------------------------
    const correo = req.correo.trim().toLowerCase();
    if (this.demo.buscarDocentePorCorreo(correo)) {
      return throwError(() => ({
        status: 409,
        message: 'Ya existe un docente registrado con ese correo.',
      })).pipe(delay(API_CONFIG.demoLatenciaMs));
    }

    const usuario: Usuario = {
      id: `doc-${Date.now()}`,
      nombre: req.nombre.trim(),
      correo,
      numeroIdentificacion: req.numeroIdentificacion.trim(),
      rol: Rol.DOCENTE,
    };
    this.demo.agregarDocente({ usuario, contrasena: req.contrasena });

    return this.responderDemo(this.construirAuth(usuario)).pipe(
      tap((res) => this.establecerSesion(res)),
    );
  }

  // ---------------------------------------------------------------------------
  // Sesión
  // ---------------------------------------------------------------------------

  /**
   * Valida el token actual contra el backend y refresca el `Usuario` en
   * memoria (rehidratar la sesión al recargar la página). 401 si el token no
   * es válido — el llamador decide si hace `logout()` con eso.
   */
  sesion(): Observable<{ usuario: Usuario }> {
    if (!API_CONFIG.demoMode) {
      return this.http.get<{ usuario: Usuario }>(apiUrl(API_CONFIG.endpoints.sesion)).pipe(
        tap((res) => {
          const actual = this._sesion();
          if (actual) {
            this.establecerSesion({ ...actual, usuario: res.usuario });
          }
        }),
      );
    }

    // --- Implementación DEMO ---------------------------------------------------
    const actual = this._sesion();
    if (!actual) {
      return throwError(() => ({ status: 401, message: 'No hay sesión activa.' })).pipe(
        delay(API_CONFIG.demoLatenciaMs),
      );
    }
    return of({ usuario: actual.usuario }).pipe(delay(API_CONFIG.demoLatenciaMs));
  }

  /**
   * Cambia la contraseña del usuario con sesión (docente o estudiante). La
   * sesión sigue igual: no devuelve token nuevo. 400 si la nueva no cumple las
   * reglas (ver `contrasenaSegura()`) o es igual a la actual; 401 si la actual
   * es incorrecta. Ese 401 es un error de formulario, NO de sesión: si algún
   * día se agrega un "logout ante 401", tiene que exceptuar esta ruta.
   */
  cambiarContrasena(req: CambiarContrasenaRequest): Observable<{ message: string }> {
    if (!API_CONFIG.demoMode) {
      return this.http.post<{ message: string }>(apiUrl(API_CONFIG.endpoints.cambiarContrasena), req);
    }

    // --- Implementación DEMO ---------------------------------------------------
    if (req.contrasenaNueva === req.contrasenaActual) {
      return throwError(() => ({
        status: 400,
        message: 'La nueva contraseña debe ser diferente a la actual',
      })).pipe(delay(API_CONFIG.demoLatenciaMs));
    }
    const correo = this._sesion()?.usuario.correo;
    if (!correo || !this.demo.cambiarContrasena(correo, req.contrasenaActual, req.contrasenaNueva)) {
      return throwError(() => ({
        status: 401,
        message: 'La contraseña actual es incorrecta',
      })).pipe(delay(API_CONFIG.demoLatenciaMs));
    }
    return of({ message: 'Contraseña actualizada correctamente' }).pipe(delay(API_CONFIG.demoLatenciaMs));
  }

  logout(): void {
    this.demo.borrarSesion();
    this._sesion.set(null);
  }

  token(): string | null {
    return this._sesion()?.token ?? null;
  }

  estaAutenticado(): boolean {
    return this.autenticado();
  }

  tieneRol(...roles: Rol[]): boolean {
    const actual = this.usuarioActual();
    return actual !== null && roles.includes(actual.rol);
  }

  // ---------------------------------------------------------------------------
  // Internos
  // ---------------------------------------------------------------------------

  private establecerSesion(res: AuthResponse): void {
    this.demo.guardarSesion(res);
    this._sesion.set(res);
  }

  private construirAuth(usuario: Usuario): AuthResponse {
    // TODO: confirmar con el cliente — formato/expiración del token. En el
    // sistema real será el JWT que emita Spring Boot; aquí es un valor simulado.
    return { token: `demo-token.${usuario.id}`, usuario };
  }

  private responderDemo(res: AuthResponse): Observable<AuthResponse> {
    return of(res).pipe(delay(API_CONFIG.demoLatenciaMs));
  }
}
