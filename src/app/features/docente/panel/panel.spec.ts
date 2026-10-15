import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { API_CONFIG, apiUrl } from '../../../core/api/api.config';
import { CasoApi, DecisionEmpresa } from '../../simulacion/models/caso-api.model';
import { Simulacion } from '../simulaciones/models/simulacion.model';
import { Panel } from './panel';

const URL_CASOS = apiUrl(API_CONFIG.endpoints.casos);
const URL_SIMULACIONES = apiUrl(API_CONFIG.endpoints.simulacionesDocente);

/** Solo los campos que usa el panel; el resto del DTO no importa aquí. */
function caso(id: number, idSimulacion: number, estado: 'activo' | 'borrador', nombre = `Caso ${id}`): CasoApi {
  return { id, idSimulacion, estado, nombre } as CasoApi;
}

function simulacion(id: number, estado: Simulacion['estado']): Simulacion {
  return { id, idUsuarioCoordinador: 1, nombre: `Simulación ${id}`, fechaInicio: '', fechaFin: '', estado };
}

function fila(idEmpresa: number, nombreEmpresa: string, decidio: boolean): DecisionEmpresa {
  return {
    idEmpresa,
    codigoEmpresa: `EMP-${idEmpresa}`,
    nombreEmpresa,
    decidio,
    idOpcion: decidio ? 1 : null,
    opcion: decidio ? 'Ampliar planta' : null,
    resultado: decidio ? '+180k' : null,
    decididaPor: decidio ? 'Laura Gómez' : null,
    fechaDecision: decidio ? '2026-10-15T10:30:00' : null,
  };
}

describe('Panel', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Panel],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** El constructor pide GET /docente/casos y GET /docente/simulaciones para hallar el caso activo. */
  function crearFixture(casos: CasoApi[] = [], simulaciones: Simulacion[] = []) {
    const fixture = TestBed.createComponent(Panel);
    http.expectOne({ method: 'GET', url: URL_CASOS }).flush(casos);
    http.expectOne({ method: 'GET', url: URL_SIMULACIONES }).flush(simulaciones);
    fixture.detectChanges();
    return fixture;
  }

  it('arranca sin configuración: muestra el checklist y "Sin simulación activa"', () => {
    const fixture = crearFixture();
    const host = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.configuracionCompleta()).toBe(false);
    expect(host.querySelector('.checklist')).toBeTruthy();
    expect(host.textContent).toContain('Sin simulación activa');
    // el paso 4 queda bloqueado hasta completar 1-3
    expect(fixture.componentInstance.pasos()[3].bloqueado).toBe(true);
  });

  it('con configuración completa muestra el bloque de simulación activa', () => {
    const fixture = crearFixture();
    fixture.componentInstance.aplicarPreview(true);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.configuracionCompleta()).toBe(true);
    expect(host.querySelector('.checklist')).toBeNull();
    expect(host.querySelector('.periodos__stats')).toBeTruthy();
    expect(host.textContent).toContain('Simulación activa');
  });

  describe('Entregas por empresa', () => {
    it('sin caso activo muestra el estado vacío y no pide decisiones', () => {
      const fixture = crearFixture([caso(1, 10, 'borrador')], [simulacion(10, 'EN_CURSO')]);
      const host = fixture.nativeElement as HTMLElement;

      expect(host.querySelector('.entregas__vacio')).toBeTruthy();
      expect(host.textContent).toContain('No hay un caso activo');
      http.expectNone((r) => r.url.endsWith('/decisiones'));
    });

    it('lista todas las empresas del caso activo con decidió / pendiente', () => {
      const fixture = crearFixture([caso(5, 10, 'activo', 'Expansión regional')], [simulacion(10, 'EN_CURSO')]);
      http
        .expectOne({ method: 'GET', url: `${URL_CASOS}/5/decisiones` })
        .flush([fila(1, 'TextilAndes', true), fila(2, 'Grupo Norte', false), fila(3, 'Agro Sur', false)]);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;

      const items = host.querySelectorAll('.entregas__item');
      expect(items).toHaveLength(3);
      expect(items[0].textContent).toContain('TextilAndes');
      expect(items[0].textContent).toContain('Decidió');
      expect(items[0].textContent).toContain('Laura Gómez');
      expect(items[1].textContent).toContain('Pendiente');
      expect(host.querySelector('.entregas__conteo')?.textContent?.trim()).toBe('1 / 3');
      expect(host.querySelector('.entregas__caso')?.textContent).toContain('Simulación 10 · Expansión regional');
      // Ya no queda la lista de ejemplo.
      expect(host.textContent).not.toContain('Andina Corp.');
    });

    it('con varias simulaciones con caso activo elige la EN_CURSO y deja cambiar de caso', () => {
      const fixture = crearFixture(
        [caso(5, 10, 'activo'), caso(6, 11, 'activo'), caso(7, 11, 'borrador')],
        [simulacion(10, 'PROGRAMADA'), simulacion(11, 'EN_CURSO')],
      );
      http.expectOne({ method: 'GET', url: `${URL_CASOS}/6/decisiones` }).flush([fila(1, 'TextilAndes', false)]);
      fixture.detectChanges();
      const cmp = fixture.componentInstance;
      const host = fixture.nativeElement as HTMLElement;

      expect(cmp.casosActivos().map((c) => c.id)).toEqual([6, 5]);
      expect(host.querySelector('.entregas__selector')).toBeTruthy();

      cmp.elegirCasoEntregas(5);
      http.expectOne({ method: 'GET', url: `${URL_CASOS}/5/decisiones` }).flush([fila(2, 'Grupo Norte', true)]);
      fixture.detectChanges();
      expect(cmp.entregas().map((e) => e.nombreEmpresa)).toEqual(['Grupo Norte']);
    });

    it('si la simulación no tiene empresas lo dice y lleva a Empresas', () => {
      const fixture = crearFixture([caso(5, 10, 'activo')], [simulacion(10, 'EN_CURSO')]);
      http.expectOne({ method: 'GET', url: `${URL_CASOS}/5/decisiones` }).flush([]);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      expect(host.textContent).toContain('todavía no tiene empresas');
      expect(host.querySelector('.entregas__list')).toBeNull();
    });

    it('muestra el error del backend si fallan las decisiones', () => {
      const fixture = crearFixture([caso(5, 10, 'activo')], [simulacion(10, 'EN_CURSO')]);
      http
        .expectOne({ method: 'GET', url: `${URL_CASOS}/5/decisiones` })
        .flush({ message: 'Caso no encontrado' }, { status: 404, statusText: 'Not Found' });
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('.entregas')?.textContent).toContain(
        'Caso no encontrado',
      );
    });

    it('si falla la lista de simulaciones igual muestra las entregas del caso activo', () => {
      const fixture = TestBed.createComponent(Panel);
      http.expectOne({ method: 'GET', url: URL_CASOS }).flush([caso(5, 10, 'activo')]);
      http
        .expectOne({ method: 'GET', url: URL_SIMULACIONES })
        .flush(null, { status: 500, statusText: 'Server Error' });
      http.expectOne({ method: 'GET', url: `${URL_CASOS}/5/decisiones` }).flush([fila(1, 'TextilAndes', true)]);
      fixture.detectChanges();
      expect(fixture.componentInstance.entregas()).toHaveLength(1);
      expect(fixture.componentInstance.casoEntregas()?.simulacion).toBe('Simulación #10');
    });
  });

  it('la tab "casos" muestra el componente Casos', () => {
    const fixture = crearFixture();
    fixture.componentInstance.irA('casos');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-casos')).toBeTruthy();
    // Casos carga su propia lista al montarse.
    http.match(URL_CASOS).forEach((r) => r.flush([]));
    http.match(URL_SIMULACIONES).forEach((r) => r.flush([]));
  });

  it('la tab "parametros" muestra el placeholder', () => {
    const fixture = crearFixture();
    fixture.componentInstance.irA('parametros');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.placeholder')).toBeTruthy();
  });
});
