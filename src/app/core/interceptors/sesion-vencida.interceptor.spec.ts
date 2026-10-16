import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { API_CONFIG, apiUrl } from '../api/api.config';
import { DemoDb } from '../demo/demo-db';
import { Rol } from '../models/rol.enum';
import { AuthService } from '../services/auth.service';
import { sesionVencidaInterceptor } from './sesion-vencida.interceptor';

@Component({ template: '' })
class Vacia {}

const TOKEN = 'token-vigente';
const URL_SIMULACIONES = apiUrl(API_CONFIG.endpoints.simulacionesDocente);
const URL_CASOS = apiUrl(API_CONFIG.endpoints.casos);
const URL_LOGIN = apiUrl(API_CONFIG.endpoints.login);
const URL_CAMBIAR = apiUrl(API_CONFIG.endpoints.cambiarContrasena);

const NO_AUTENTICADO = { message: 'No autenticado: falta el token o venció. Inicia sesión de nuevo' };

describe('sesionVencidaInterceptor', () => {
  let http: HttpTestingController;
  let cliente: HttpClient;
  let router: Router;
  let auth: AuthService;

  beforeEach(async () => {
    new DemoDb().guardarSesion({
      token: TOKEN,
      usuario: { id: '49', nombre: 'Docente', correo: 'd@uni.edu', numeroIdentificacion: '1', rol: Rol.DOCENTE },
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'auth/login', component: Vacia },
          { path: 'docente/casos', component: Vacia },
        ]),
        provideHttpClient(withInterceptors([sesionVencidaInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    cliente = TestBed.inject(HttpClient);
    router = TestBed.inject(Router);
    auth = TestBed.inject(AuthService);
    await router.navigateByUrl('/docente/casos?simulacion=7');
  });

  afterEach(() => {
    http.verify();
    new DemoDb().borrarSesion();
    vi.restoreAllMocks();
  });

  /** Hace la petición y devuelve el error que le llega a quien la pidió. */
  function pedir(method: 'GET' | 'POST', url: string): { error: () => HttpErrorResponse | undefined } {
    let error: HttpErrorResponse | undefined;
    cliente.request(method, url, { body: method === 'POST' ? {} : undefined }).subscribe({ error: (e) => (error = e) });
    return { error: () => error };
  }

  it('un 401 en cualquier endpoint cierra la sesión y lleva al login con el aviso y la ruta de vuelta', async () => {
    const r = pedir('GET', URL_SIMULACIONES);
    http.expectOne(URL_SIMULACIONES).flush(NO_AUTENTICADO, { status: 401, statusText: 'Unauthorized' });
    await vi.waitFor(() => expect(router.url.startsWith('/auth/login')).toBe(true));

    expect(auth.token()).toBeNull();
    expect(new DemoDb().leerSesion()).toBeNull();
    const destino = router.parseUrl(router.url);
    expect(destino.queryParams).toEqual({ motivo: 'sesion-vencida', returnUrl: '/docente/casos?simulacion=7' });
    // El error igual le llega a la pantalla que hizo la petición.
    expect(r.error()?.status).toBe(401);
  });

  it.each([
    ['POST /auth/login (credenciales incorrectas)', URL_LOGIN],
    ['POST /auth/cambiar-contrasena (contraseña actual incorrecta)', URL_CAMBIAR],
  ])('un 401 en %s no cierra la sesión: el error queda para el formulario', (_, url) => {
    const navegar = vi.spyOn(router, 'navigate');
    const r = pedir('POST', url);
    http.expectOne(url).flush({ message: 'Error del formulario' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.token()).toBe(TOKEN);
    expect(navegar).not.toHaveBeenCalled();
    expect(r.error()?.error?.message).toBe('Error del formulario');
  });

  it('varios 401 a la vez producen una sola redirección', () => {
    const navegar = vi.spyOn(router, 'navigate');
    pedir('GET', URL_SIMULACIONES);
    pedir('GET', URL_CASOS);
    pedir('GET', `${URL_CASOS}/5/decisiones`);
    for (const req of http.match(() => true)) {
      req.flush(NO_AUTENTICADO, { status: 401, statusText: 'Unauthorized' });
    }
    expect(navegar).toHaveBeenCalledTimes(1);
    expect(auth.token()).toBeNull();
  });

  it('un 403 (con sesión pero sin permiso) no cierra la sesión', () => {
    const navegar = vi.spyOn(router, 'navigate');
    const r = pedir('GET', URL_SIMULACIONES);
    http
      .expectOne(URL_SIMULACIONES)
      .flush({ message: 'No tienes permiso para esta acción' }, { status: 403, statusText: 'Forbidden' });

    expect(auth.token()).toBe(TOKEN);
    expect(navegar).not.toHaveBeenCalled();
    expect(r.error()?.status).toBe(403);
  });

  it('un 401 sin sesión (ya cerrada) no vuelve a redirigir', () => {
    auth.logout();
    const navegar = vi.spyOn(router, 'navigate');
    pedir('GET', URL_SIMULACIONES);
    http.expectOne(URL_SIMULACIONES).flush(NO_AUTENTICADO, { status: 401, statusText: 'Unauthorized' });
    expect(navegar).not.toHaveBeenCalled();
  });

  it('si el 401 llega estando en /auth, no guarda esa ruta para volver', async () => {
    await router.navigateByUrl('/auth/login');
    const navegar = vi.spyOn(router, 'navigate');
    pedir('GET', URL_SIMULACIONES);
    http.expectOne(URL_SIMULACIONES).flush(NO_AUTENTICADO, { status: 401, statusText: 'Unauthorized' });
    expect(navegar).toHaveBeenCalledWith(['/auth/login'], { queryParams: { motivo: 'sesion-vencida' } });
  });
});
