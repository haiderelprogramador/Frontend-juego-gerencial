import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { delay, tap } from 'rxjs/operators';

import { API_CONFIG, apiUrl } from '../api/api.config';
import { DemoDb } from '../demo/demo-db';
import { Rol } from '../models/rol.enum';
import {
  AuthResponse,
  LoginRequest,
  RegistroDocenteRequest,
  Usuario,
} from '../models/usuario.model';

/**
 * Autenticación y sesión de la app.
 *
 * Contrato de API (Spring Boot, aún no implementado):
 *  - POST {@link API_CONFIG.endpoints.login}          body LoginRequest            -> AuthResponse
 *  - POST {@link API_CONFIG.endpoints.registroDocente} body RegistroDocenteRequest -> AuthResponse
 *  - GET  {@link API_CONFIG.endpoints.sesion}          (Bearer token)              -> { usuario: Usuario }
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
