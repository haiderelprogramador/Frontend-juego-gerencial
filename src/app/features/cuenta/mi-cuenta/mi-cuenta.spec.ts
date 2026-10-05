import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { API_CONFIG, apiUrl } from '../../../core/api/api.config';
import { MiCuenta } from './mi-cuenta';

const URL = apiUrl(API_CONFIG.endpoints.cambiarContrasena);

describe('MiCuenta', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MiCuenta],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('no envía si la contraseña nueva no cumple las reglas, y dice cuál falta', () => {
    const cmp = TestBed.createComponent(MiCuenta).componentInstance;
    cmp.form.setValue({ contrasenaActual: 'vieja', contrasenaNueva: 'claveSegura', confirmar: 'claveSegura' });
    cmp.enviar();
    http.expectNone(URL);
    expect(cmp.errorContrasenaNueva()).toBe('Debe tener un número, un símbolo.');
  });

  it('no envía si la confirmación no coincide', () => {
    const cmp = TestBed.createComponent(MiCuenta).componentInstance;
    cmp.form.setValue({ contrasenaActual: 'vieja', contrasenaNueva: 'claveSegura1!', confirmar: 'otraCosa1!' });
    cmp.enviar();
    http.expectNone(URL);
    expect(cmp.form.hasError('noCoincide')).toBe(true);
  });

  it.runIf(!API_CONFIG.demoMode)('postea {contrasenaActual, contrasenaNueva} y muestra el mensaje del backend', () => {
    const cmp = TestBed.createComponent(MiCuenta).componentInstance;
    cmp.form.setValue({ contrasenaActual: 'vieja', contrasenaNueva: 'claveSegura1!', confirmar: 'claveSegura1!' });
    cmp.enviar();

    const peticion = http.expectOne({ method: 'POST', url: URL });
    expect(peticion.request.body).toEqual({ contrasenaActual: 'vieja', contrasenaNueva: 'claveSegura1!' });
    peticion.flush({ message: 'Contraseña actualizada correctamente' });

    expect(cmp.exito()).toBe('Contraseña actualizada correctamente');
    expect(cmp.form.controls.contrasenaNueva.value).toBe('');
  });

  it.runIf(!API_CONFIG.demoMode)('muestra el error del backend (ej. contraseña actual incorrecta)', () => {
    const cmp = TestBed.createComponent(MiCuenta).componentInstance;
    cmp.form.setValue({ contrasenaActual: 'mala', contrasenaNueva: 'claveSegura1!', confirmar: 'claveSegura1!' });
    cmp.enviar();
    http
      .expectOne(URL)
      .flush({ message: 'La contraseña actual no es correcta' }, { status: 400, statusText: 'Bad Request' });
    expect(cmp.error()).toBe('La contraseña actual no es correcta');
  });
});
