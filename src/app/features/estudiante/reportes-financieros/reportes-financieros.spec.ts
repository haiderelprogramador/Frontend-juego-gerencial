import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { API_CONFIG, apiUrl } from '../../../core/api/api.config';
import { CasoEstudiante } from '../../simulacion/models/caso-api.model';
import { FinancieroEntrada } from '../../simulacion/models/financiero.model';
import { CasoActual, EstadoFinancieroEmpresa } from '../models/portal-estudiante.model';
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

function estado<O extends string>(origen: O, utilidadNeta = 200): EstadoFinancieroEmpresa<O> {
  return { origen, ...PARTIDAS, activoTotal: 400, pasivoTotal: 170, patrimonio: 230, utilidadNeta };
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

  function render(respuesta: CasoActual | null) {
    const fixture = TestBed.createComponent(ReportesFinancieros);
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
    expect(host.querySelectorAll('.comparativo__tabla tbody tr')).toHaveLength(13);
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
    expect(host.querySelectorAll('.comparativo__tabla thead th')).toHaveLength(3);
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

  it('sin caso visible (204) muestra el estado vacío', () => {
    const host = render(null);
    expect(host.querySelector('.reportes__vacio')).toBeTruthy();
    expect(host.querySelectorAll('app-kpi')).toHaveLength(0);
  });
});
