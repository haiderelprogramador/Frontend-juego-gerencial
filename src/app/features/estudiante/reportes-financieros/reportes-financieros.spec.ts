import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture } from '@angular/core/testing';

import { API_CONFIG, apiUrl } from '../../../core/api/api.config';
import { CasoEstudiante } from '../../simulacion/models/caso-api.model';
import { FinancieroEntrada, IndicadoresFinancieros } from '../../simulacion/models/financiero.model';
import { CasoActual, EstadoFinancieroEmpresa, HistoriaCasoEmpresa } from '../models/portal-estudiante.model';
import { ReportesFinancieros } from './reportes-financieros';

const PARTIDAS: FinancieroEntrada = {
  efectivo: 100,
  cuentasPorCobrar: 50,
  inventarios: 50,
  propiedadPlantaEquipo: 200,
  activosIntangibles: 0,
  cuentasPorPagar: 40,
  obligacionesFinancierasCortoPlazo: 30,
  obligacionesFinancierasLargoPlazo: 100,
  capitalSocial: 200,
  utilidadesRetenidas: 30,
  ventasNetas: 1000,
  costoVentas: 600,
  gastosAdministracion: 100,
  gastosVentas: 50,
  gastosFinancieros: 20,
  impuestoRenta: 30,
  flujoOperativo: 10,
  flujoInversion: -5,
  flujoFinanciacion: -5,
};

const INDICADORES: IndicadoresFinancieros = {
  razonCorriente: 2.8571,
  pruebaAcida: 2.1429,
  endeudamiento: 0.425,
  margenNeto: 0.2,
  roe: 0.8696,
  roa: 0.5,
};

function estado<O extends string>(
  origen: O,
  utilidadNeta = 200,
  indicadores: IndicadoresFinancieros = INDICADORES,
): EstadoFinancieroEmpresa<O> {
  return { origen, ...PARTIDAS, activoTotal: 400, pasivoTotal: 170, patrimonio: 230, utilidadNeta, indicadores };
}

/** Un caso de la historia; `cierre` null = caso en curso. */
function casoHistoria(
  idCaso: number,
  cierre: { utilidadNeta: number; efectivo: number; patrimonio: number } | null,
): HistoriaCasoEmpresa {
  return {
    idCaso,
    nombreCaso: `Caso ${idCaso}`,
    fechaInicioPartida: '2026-09-05T00:00:00',
    inicial: estado('docente'),
    final: cierre ? { ...estado('decision', cierre.utilidadNeta), ...cierre } : null,
  };
}

function casoActual(overrides: Partial<CasoActual> = {}): CasoActual {
  const caso = {
    id: 1,
    idSimulacion: 7,
    nombre: 'Expansión regional',
    tipo: 'Expansión',
    mision: '',
    vision: '',
    penalizacionMin: 1,
    penalizacionMax: 3,
    fechaVisualizacion: '2026-09-01T00:00:00',
    fechaInicioPartida: '2026-09-05T00:00:00',
    fechaFinPartida: '2026-09-30T00:00:00',
    asignacionEquipos: 'manual',
    estado: 'activo',
    partidaIniciada: true,
    partidaFinalizada: false,
    financiero: { ...PARTIDAS, activoTotal: 400, pasivoTotal: 170, patrimonio: 230, utilidadNeta: 200 },
    opciones: [],
  } as unknown as CasoEstudiante;
  return {
    idSimulacion: 7,
    nombreSimulacion: 'Gerencia 2026-2',
    idEmpresa: 1,
    nombreEmpresa: 'Andina Corp.',
    financieroEmpresa: { inicial: estado('docente'), final: null },
    esLider: true,
    puedeDecidir: true,
    caso,
    decision: null,
    boletin: null,
    ...overrides,
  };
}

describe('ReportesFinancieros', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReportesFinancieros],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function render(respuesta: CasoActual | null, antes?: (f: ComponentFixture<ReportesFinancieros>) => void) {
    const fixture = TestBed.createComponent(ReportesFinancieros);
    antes?.(fixture);
    fixture.detectChanges();
    const req = http.expectOne((r) => r.url === apiUrl(API_CONFIG.endpoints.estudianteCasoActual));
    req.flush(respuesta, { status: respuesta ? 200 : 204, statusText: respuesta ? 'OK' : 'No Content' });
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('con el caso en curso muestra los 4 totales iniciales, el estado de resultados y el aviso de cierre pendiente', () => {
    const host = render(casoActual());
    expect(host.querySelectorAll('app-kpi')).toHaveLength(4);
    expect(host.textContent).toContain('Balance inicial definido por el docente');
    expect(host.querySelector('.comparativo__pendiente')).toBeTruthy();
    // Balance detallado: 10 partidas + 3 totales.
    expect(host.querySelectorAll('.comparativo .comparativo__tabla tbody tr')).toHaveLength(13);
    expect(host.textContent).toContain('Propiedad, planta y equipo');
    expect(host.querySelectorAll('.estado__row').length).toBeGreaterThan(6);
    // Utilidad bruta = 1000 − 600
    expect(host.textContent).toContain('$400');
    expect(host.textContent).not.toContain('Cóndor');
  });

  it('con el caso cerrado compara inicio vs. cierre y explica el origen del resultado', () => {
    const host = render(
      casoActual({
        financieroEmpresa: { inicial: estado('heredado'), final: estado('penalizacion', 150) },
      }),
    );
    expect(host.querySelectorAll('.comparativo .comparativo__tabla thead th')).toHaveLength(3);
    expect(host.textContent).toContain('heredado de los casos anteriores');
    expect(host.textContent).toContain('penalización');
    expect(host.textContent).toContain('vs. inicio');
  });

  it('sin financieroEmpresa (backend en transición) usa caso.financiero como estado inicial', () => {
    const dto = casoActual();
    delete (dto as Partial<CasoActual>).financieroEmpresa;
    const host = render(dto);
    expect(host.querySelectorAll('app-kpi')).toHaveLength(4);
    expect(host.querySelector('.comparativo__pendiente')).toBeTruthy();
  });

  it('respaldo en un caso siguiente (balance en null): solo utilidad neta, aviso y sin la tabla del balance', () => {
    const dto = casoActual();
    delete (dto as Partial<CasoActual>).financieroEmpresa;
    const nulos = Object.fromEntries(Object.keys(dto.caso.financiero).map((k) => [k, null]));
    dto.caso = {
      ...dto.caso,
      financiero: { ...nulos, ...Object.fromEntries(['ventasNetas', 'costoVentas', 'gastosAdministracion', 'gastosVentas', 'gastosFinancieros', 'impuestoRenta'].map((k) => [k, (PARTIDAS as unknown as Record<string, number>)[k]])), utilidadNeta: 200 },
    } as CasoActual['caso'];
    const host = render(dto);

    const kpis = host.querySelectorAll('app-kpi');
    expect(kpis).toHaveLength(1);
    expect(kpis[0].textContent).toContain('Utilidad neta');
    expect(kpis[0].textContent).toContain('$200');
    expect(host.textContent).toContain('El balance propio de tu empresa todavía no está disponible; aparecerá aquí en cuanto se publique.');
    expect(host.querySelector('.comparativo')).toBeNull();
    // El estado de resultados (las 6 partidas) sí se muestra.
    expect(host.querySelectorAll('.estado__row').length).toBeGreaterThan(6);
    expect(host.querySelector('.reportes__kpis')?.textContent).not.toContain('—');
  });

  it('sin caso visible (204) muestra el estado vacío', () => {
    const host = render(null);
    expect(host.querySelector('.reportes__vacio')).toBeTruthy();
    expect(host.querySelectorAll('app-kpi')).toHaveLength(0);
  });

  describe('indicadores (contrato A)', () => {
    /** Texto de cada fila de la tabla de indicadores, con espacios normalizados. */
    function filas(host: HTMLElement): string[] {
      return [...host.querySelectorAll('.indicadores tbody tr')].map((tr) =>
        [...tr.querySelectorAll('td')].map((td) => td.textContent!.trim()).join(' '),
      );
    }

    it('con el caso en curso muestra los 6 indicadores al inicio, razones con 2 decimales y el resto en %', () => {
      const host = render(casoActual());
      const f = filas(host);
      expect(f).toHaveLength(6);
      expect(f[0]).toBe('Razón corriente 2,86');
      expect(f[2]).toMatch(/^Endeudamiento 42,5\s?%$/);
      expect(host.querySelectorAll('.indicadores thead th')).toHaveLength(2);
    });

    it('con el caso cerrado compara inicio vs. cierre, y un null se ve como "—"', () => {
      const alCierre = { ...INDICADORES, roe: null, margenNeto: -0.05 };
      const host = render(
        casoActual({ financieroEmpresa: { inicial: estado('docente'), final: estado('decision', -50, alCierre) } }),
      );
      const f = filas(host);
      expect(host.querySelectorAll('.indicadores thead th')).toHaveLength(3);
      expect(f[4]).toMatch(/^ROE 87,0\s?% —$/);
      expect(f[3]).toMatch(/^Margen neto 20,0\s?% -5,0\s?%$/);
    });

    it('sin indicadores en financieroEmpresa (backend sin el contrato A) no muestra la sección', () => {
      const ini = estado('docente') as Partial<EstadoFinancieroEmpresa<'docente'>>;
      delete ini.indicadores;
      const host = render(casoActual({ financieroEmpresa: { inicial: ini as EstadoFinancieroEmpresa<'docente'>, final: null } }));
      expect(host.querySelector('.indicadores')).toBeNull();
      expect(host.querySelectorAll('app-kpi')).toHaveLength(4);
    });

    it('con el respaldo de caso.financiero tampoco la muestra', () => {
      const dto = casoActual();
      delete (dto as Partial<CasoActual>).financieroEmpresa;
      expect(render(dto).querySelector('.indicadores')).toBeNull();
    });
  });

  describe('evolución (historia por empresa, contrato B)', () => {
    const URL_HISTORIA = `${apiUrl(API_CONFIG.endpoints.estudianteEmpresas)}/1/historia`;

    /** Con la historia activa: caso-actual y después GET /estudiante/empresas/1/historia. */
    function renderConHistoria(historia: HistoriaCasoEmpresa[] | 'error') {
      let fixture!: ComponentFixture<ReportesFinancieros>;
      render(casoActual(), (f) => {
        fixture = f;
        f.componentInstance.historiaDisponible.set(true);
      });
      const req = http.expectOne({ method: 'GET', url: URL_HISTORIA });
      if (historia === 'error') {
        req.flush({ message: 'La empresa no pertenece al estudiante' }, { status: 400, statusText: 'Bad Request' });
      } else {
        req.flush(historia);
      }
      fixture.detectChanges();
      return fixture;
    }

    function hostConHistoria(historia: HistoriaCasoEmpresa[] | 'error'): HTMLElement {
      return renderConHistoria(historia).nativeElement as HTMLElement;
    }

    it('con disponible.historia = false no la pide ni muestra la sección', () => {
      const host = render(casoActual());
      http.expectNone(URL_HISTORIA);
      expect(host.querySelector('.evolucion')).toBeNull();
    });

    it('dibuja una línea por serie con los casos cerrados (el en curso no entra), con leyenda y tabla', () => {
      const host = hostConHistoria([
        casoHistoria(1, { utilidadNeta: 120000, efectivo: 300000, patrimonio: 900000 }),
        casoHistoria(2, { utilidadNeta: -40000, efectivo: 150000, patrimonio: 860000 }),
        casoHistoria(3, null),
      ]);
      expect(host.querySelectorAll('.evo__linea')).toHaveLength(3);
      // 3 series × 2 casos cerrados.
      expect(host.querySelectorAll('.evo__punto')).toHaveLength(6);
      expect(host.querySelector('.evo__leyenda')?.textContent).toContain('Patrimonio');
      const filas = host.querySelectorAll('.evo__tabla tbody tr');
      expect(filas).toHaveLength(2);
      expect(filas[1].textContent).toContain('−$40.000');
      expect(filas[1].querySelector('.evo__neg')).toBeTruthy();
      expect(host.textContent).not.toContain('Caso 3');
    });

    it('al pasar el cursor por un caso muestra el tooltip con sus tres cifras', () => {
      const fixture = renderConHistoria([
        casoHistoria(1, { utilidadNeta: 120000, efectivo: 300000, patrimonio: 900000 }),
        casoHistoria(2, { utilidadNeta: 80000, efectivo: 150000, patrimonio: 980000 }),
      ]);
      const host = fixture.nativeElement as HTMLElement;
      expect(host.querySelector('.evo__tooltip')).toBeNull();
      const franjas = host.querySelectorAll('.evo__franja');
      expect(franjas).toHaveLength(2);

      franjas[1].dispatchEvent(new Event('mouseenter'));
      fixture.detectChanges();
      const tooltip = host.querySelector('.evo__tooltip')!.textContent!.replace(/\s+/g, ' ');
      expect(tooltip).toContain('Caso 2');
      expect(tooltip).toContain('$80.000');
      expect(tooltip).toContain('$150.000');
      expect(tooltip).toContain('$980.000');

      host.querySelector('.evo__plot')!.dispatchEvent(new Event('mouseleave'));
      fixture.detectChanges();
      expect(host.querySelector('.evo__tooltip')).toBeNull();
    });

    it('con un solo caso cerrado no hay gráfico: solo el aviso y la tabla', () => {
      const host = hostConHistoria([casoHistoria(1, { utilidadNeta: 1, efectivo: 2, patrimonio: 3 }), casoHistoria(2, null)]);
      expect(host.querySelector('.evolucion svg')).toBeNull();
      expect(host.textContent).toContain('al menos dos casos cerrados');
      expect(host.querySelectorAll('.evo__tabla tbody tr')).toHaveLength(1);
    });

    describe('caso-actual en 204 (hueco entre casos)', () => {
      const URL_SIMULACIONES = apiUrl(API_CONFIG.endpoints.estudianteSimulaciones);

      function render204(simulaciones: unknown[]) {
        const fixture = TestBed.createComponent(ReportesFinancieros);
        fixture.componentInstance.historiaDisponible.set(true);
        fixture.detectChanges();
        http
          .expectOne((r) => r.url === apiUrl(API_CONFIG.endpoints.estudianteCasoActual))
          .flush(null, { status: 204, statusText: 'No Content' });
        http.expectOne({ method: 'GET', url: URL_SIMULACIONES }).flush(simulaciones);
        return fixture;
      }

      const miSimulacion = {
        idSimulacion: 7,
        nombreSimulacion: 'Gerencia 2026-2',
        idEmpresa: 1,
        nombreEmpresa: 'Andina Corp.',
        estado: 'EN_CURSO',
      };

      it('muestra el último caso de la historia (inicio vs. cierre) y avisa que es el anterior', () => {
        const fixture = render204([miSimulacion]);
        expect(fixture.componentInstance.cargando()).toBe(true);
        http.expectOne({ method: 'GET', url: URL_HISTORIA }).flush([
          casoHistoria(1, { utilidadNeta: 120000, efectivo: 300000, patrimonio: 900000 }),
          casoHistoria(2, { utilidadNeta: 150, efectivo: 100, patrimonio: 230 }),
        ]);
        fixture.detectChanges();
        const host = fixture.nativeElement as HTMLElement;

        expect(host.querySelector('.reportes__vacio')).toBeNull();
        expect(host.querySelector('.reportes__sub')?.textContent).toContain('Andina Corp. · Gerencia 2026-2 · Caso 2');
        expect(host.textContent).toContain('Estos son los resultados de tu último caso');
        // Caso cerrado: columnas Inicio y Cierre.
        expect(host.querySelectorAll('.comparativo .comparativo__tabla thead th')).toHaveLength(3);
        expect(host.querySelectorAll('.evo__linea')).toHaveLength(3);
      });

      it('sin simulaciones queda el estado vacío de siempre', () => {
        const fixture = render204([]);
        http.expectNone(URL_HISTORIA);
        fixture.detectChanges();
        expect((fixture.nativeElement as HTMLElement).querySelector('.reportes__vacio')).toBeTruthy();
        expect(fixture.componentInstance.cargando()).toBe(false);
      });

      it('con historia vacía también queda el estado vacío', () => {
        const fixture = render204([miSimulacion]);
        http.expectOne({ method: 'GET', url: URL_HISTORIA }).flush([]);
        fixture.detectChanges();
        expect((fixture.nativeElement as HTMLElement).querySelector('.reportes__vacio')).toBeTruthy();
      });
    });

    it('si la historia falla muestra el mensaje del backend', () => {
      const host = hostConHistoria('error');
      expect(host.querySelector('.evolucion')?.textContent).toContain('La empresa no pertenece al estudiante');
    });
  });
});
