import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { API_CONFIG, apiUrl } from '../../../core/api/api.config';
import { DemoDb } from '../../../core/demo/demo-db';
import { authInterceptor } from '../../../core/interceptors/auth.interceptor';
import { Rol } from '../../../core/models/rol.enum';
import { AuthService } from '../../../core/services/auth.service';
import { MiCuenta } from './mi-cuenta';

const URL = apiUrl(API_CONFIG.endpoints.cambiarContrasena);
const TOKEN = 'token-de-prueba';

describe('MiCuenta', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    // Sesión iniciada ANTES de crear AuthService (la lee al construirse).
    new DemoDb().guardarSesion({
      token: TOKEN,
      usuario: { id: '7', nombre: 'Ana', correo: 'ana@uni.edu', numeroIdentificacion: '123456', rol: Rol.DOCENTE },
    });
    await TestBed.configureTestingModule({
      imports: [MiCuenta],
      // El interceptor real de la app, para probar el flujo HTTP completo.
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    new DemoDb().borrarSesion();
  });

  function llenar(contrasenaActual: string, contrasenaNueva: string, confirmar = contrasenaNueva) {
    const fixture = TestBed.createComponent(MiCuenta);
    fixture.componentInstance.form.setValue({ contrasenaActual, contrasenaNueva, confirmar });
    return fixture;
  }

  it('no envía si la contraseña nueva no cumple las reglas, y dice cuál falta', () => {
    const cmp = llenar('Vieja123!', 'claveSegura').componentInstance;
    cmp.enviar();
    http.expectNone(URL);
    expect(cmp.errorContrasenaNueva()).toBe('Debe tener un número, un símbolo.');
  });

  it('no envía si la nueva es igual a la actual (el backend respondería 400)', () => {
    const cmp = llenar('claveSegura1!', 'claveSegura1!').componentInstance;
    cmp.enviar();
    http.expectNone(URL);
    expect(cmp.errorContrasenaNueva()).toBe('Tiene que ser distinta de la contraseña actual.');
  });

  it('no envía si la confirmación no coincide', () => {
    const cmp = llenar('Vieja123!', 'claveSegura1!', 'otraCosa1!').componentInstance;
    cmp.enviar();
    http.expectNone(URL);
    expect(cmp.form.hasError('noCoincide')).toBe(true);
  });

  it.runIf(!API_CONFIG.demoMode)('postea {contrasenaActual, contrasenaNueva} con Bearer y muestra el mensaje', () => {
    const cmp = llenar('Vieja123!', 'claveSegura1!').componentInstance;
    cmp.enviar();

    const peticion = http.expectOne({ method: 'POST', url: URL });
    expect(peticion.request.body).toEqual({ contrasenaActual: 'Vieja123!', contrasenaNueva: 'claveSegura1!' });
    expect(peticion.request.headers.get('Authorization')).toBe(`Bearer ${TOKEN}`);
    peticion.flush({ message: 'Contraseña actualizada correctamente' });

    expect(cmp.exito()).toBe('Contraseña actualizada correctamente');
    expect(cmp.form.controls.contrasenaNueva.value).toBe('');
  });

  it.runIf(!API_CONFIG.demoMode)('un 401 de contraseña actual incorrecta no cierra sesión: muestra el error en el formulario', () => {
    const auth = TestBed.inject(AuthService);
    const fixture = llenar('MalEscrita1!', 'claveSegura1!');
    fixture.componentInstance.enviar();

    http
      .expectOne(URL)
      .flush({ message: 'La contraseña actual es incorrecta' }, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();

    const alerta = (fixture.nativeElement as HTMLElement).querySelector('app-alerta');
    expect(alerta?.textContent).toContain('La contraseña actual es incorrecta');
    expect(auth.autenticado()).toBe(true);
    expect(auth.token()).toBe(TOKEN);
    expect(new DemoDb().leerSesion()?.token).toBe(TOKEN);
  });
});
