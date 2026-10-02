import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { API_CONFIG, apiUrl } from '../../../core/api/api.config';
import { CasoEstudiante } from '../../simulacion/models/caso-api.model';
import { financieroANumeros, financieroVacio } from '../../simulacion/models/financiero.model';
import { CasoActual as CasoActualDto, Decision } from '../models/portal-estudiante.model';
import { aFechaBogota, calcularFase, CasoActual, formatearCuenta } from './caso-actual';

const URL_CASO_ACTUAL = apiUrl(API_CONFIG.endpoints.estudianteCasoActual);
const URL_DECISION = apiUrl(API_CONFIG.endpoints.estudianteDecision);

const AHORA = Date.parse('2026-09-29T12:00:00');
const UNA_HORA_MS = 60 * 60 * 1000;

function casoEstudiante(inicioOffsetMs: number, finOffsetMs: number): CasoEstudiante {
  return {
    id: 12,
    idSimulacion: 23,
    nombre: 'TextilAndes S.A.',
    tipo: 'Manufactura',
    estado: 'activo',
    mision: 'Misión de prueba.',
    vision: 'Visión de prueba.',
    financiero: { activoTotal: 1, pasivoTotal: 1, patrimonio: 1, utilidadNeta: 1, ...financieroANumeros(financieroVacio()) },
    penalizacionMin: 1,
    penalizacionMax: 3,
    fechaVisualizacion: new Date(AHORA - 2 * UNA_HORA_MS).toISOString(),
    fechaInicioPartida: new Date(AHORA + inicioOffsetMs).toISOString(),
    fechaFinPartida: new Date(AHORA + finOffsetMs).toISOString(),
    asignacionEquipos: 'automatica',
    partidaIniciada: false,
    partidaFinalizada: false,
    opciones: [
      { id: 1, orden: 1, opcion: 'Ampliar planta' },
      { id: 2, orden: 2, opcion: 'Mantener capacidad' },
      { id: 3, orden: 3, opcion: 'No hacer nada' },
    ],
  };
}

function decision(idOpcion: number, resultado: string): Decision {
  return {
    idCaso: 12,
    idEmpresa: 20,
    idOpcion,
    opcion: 'Ampliar planta',
    resultado,
    impacto: null,
    decididaPor: 'Estudiante Líder',
    fechaDecision: new Date(AHORA).toISOString(),
  };
}

function casoActualDto(overrides: Partial<CasoActualDto> = {}): CasoActualDto {
  return {
    idSimulacion: 23,
    nombreSimulacion: 'Simulación de prueba',
    idEmpresa: 20,
    nombreEmpresa: 'TextilAndes S.A.',
    esLider: true,
    puedeDecidir: true,
    caso: casoEstudiante(UNA_HORA_MS, 2 * UNA_HORA_MS),
    decision: null,
    ...overrides,
  };
}

describe('aFechaBogota', () => {
  it('interpreta una fecha sin zona como hora de Bogotá (UTC-5), sin importar la zona local del navegador', () => {
    expect(aFechaBogota('2026-09-29T14:00:00')).toBe(Date.parse('2026-09-29T14:00:00-05:00'));
  });

  it('respeta la zona si la fecha ya la trae (Z u offset explícito)', () => {
    expect(aFechaBogota('2026-09-29T14:00:00Z')).toBe(Date.parse('2026-09-29T14:00:00Z'));
    expect(aFechaBogota('2026-09-29T14:00:00+02:00')).toBe(Date.parse('2026-09-29T14:00:00+02:00'));
  });

  it('NaN para vacío/undefined, en vez de romper', () => {
    expect(Number.isNaN(aFechaBogota(''))).toBe(true);
    expect(Number.isNaN(aFechaBogota(undefined))).toBe(true);
  });
});

describe('calcularFase (pura)', () => {
  const caso = { fechaInicioPartida: '2026-09-29T10:00:00', fechaFinPartida: '2026-09-29T14:00:00' } as CasoEstudiante;

  it('antes del inicio -> visualizacion', () => {
    expect(calcularFase(caso, aFechaBogota('2026-09-29T09:00:00'))).toBe('visualizacion');
  });

  it('entre inicio y fin -> partida', () => {
    expect(calcularFase(caso, aFechaBogota('2026-09-29T12:00:00'))).toBe('partida');
  });

  it('después del fin -> cierre', () => {
    expect(calcularFase(caso, aFechaBogota('2026-09-29T15:00:00'))).toBe('cierre');
  });

  it('con fechas inválidas/vacías no rompe (cae en partida)', () => {
    expect(
      calcularFase({ fechaInicioPartida: '', fechaFinPartida: '' } as CasoEstudiante, Date.now()),
    ).toBe('partida');
  });
});

describe('formatearCuenta', () => {
  it('descompone milisegundos en dias/horas/min/seg con ceros a la izquierda', () => {
    expect(formatearCuenta(90061000)).toEqual({ dias: '01', horas: '01', min: '01', seg: '01' });
  });

  it('si ya pasó el objetivo, devuelve todo en 00', () => {
    expect(formatearCuenta(-5000)).toEqual({ dias: '00', horas: '00', min: '00', seg: '00' });
  });
});

describe('CasoActual', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
    await TestBed.configureTestingModule({
      imports: [CasoActual],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  /** El constructor dispara GET /estudiante/caso-actual. */
  function crearFixture(dto: CasoActualDto | null) {
    const fixture = TestBed.createComponent(CasoActual);
    http.expectOne({ method: 'GET', url: URL_CASO_ACTUAL }).flush(dto, dto === null ? { status: 204, statusText: 'No Content' } : undefined);
    fixture.detectChanges();
    return fixture;
  }

  it('sin caso activo (204), muestra el estado vacío', () => {
    const fixture = crearFixture(null);
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('No hay un caso activo todavía');
  });

  it('en visualización, arranca bloqueado con cuenta regresiva y sin selector manual de fase', () => {
    const fixture = crearFixture(casoActualDto({ caso: casoEstudiante(UNA_HORA_MS, 2 * UNA_HORA_MS) }));
    expect(fixture.componentInstance.fase()).toBe('visualizacion');
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('.bloqueada')).toHaveLength(3);
    expect(host.textContent).not.toContain('Vista previa de fase');
    expect((fixture.componentInstance as unknown as Record<string, unknown>)['irAFase']).toBeUndefined();
  });

  it('en fase "partida", si puedeDecidir, permite elegir una opción y confirmar contra el backend', () => {
    const fixture = crearFixture(
      casoActualDto({ caso: casoEstudiante(-UNA_HORA_MS, UNA_HORA_MS), puedeDecidir: true }),
    );
    expect(fixture.componentInstance.fase()).toBe('partida');
    expect(fixture.componentInstance.estadoOpciones()).toBe('seleccion');

    const host = fixture.nativeElement as HTMLElement;
    const radios = host.querySelectorAll('input[type=radio]');
    expect(radios).toHaveLength(3);
    (radios[0] as HTMLInputElement).dispatchEvent(new Event('change'));
    fixture.detectChanges();

    fixture.componentInstance.confirmarDecision();
    const peticion = http.expectOne({ method: 'POST', url: URL_DECISION });
    expect(peticion.request.body).toEqual({ idCaso: 12, idOpcion: 1 });
    peticion.flush(decision(1, 'Activo total +180000'));

    // Al confirmar, recarga el caso-actual DE LA MISMA simulación para traer la decisión real.
    http
      .expectOne((r) => r.url === URL_CASO_ACTUAL && r.params.get('idSimulacion') === '23')
      .flush(
        casoActualDto({
          caso: casoEstudiante(-UNA_HORA_MS, UNA_HORA_MS),
          decision: decision(1, 'Activo total +180000'),
        }),
      );
    fixture.detectChanges();

    expect(fixture.componentInstance.fase()).toBe('partida'); // el caso NO cerró
    expect(fixture.componentInstance.estadoOpciones()).toBe('resultado');
    const kpi = (fixture.nativeElement as HTMLElement).querySelector('app-kpi');
    expect(kpi).toBeTruthy();
  });

  it('bloqueado sin cuenta regresiva cuando no es líder (puedeDecidir false) aunque ya esté en partida', () => {
    const fixture = crearFixture(
      casoActualDto({ caso: casoEstudiante(-UNA_HORA_MS, UNA_HORA_MS), esLider: false, puedeDecidir: false }),
    );
    expect(fixture.componentInstance.fase()).toBe('partida');
    expect(fixture.componentInstance.estadoOpciones()).toBe('bloqueado');
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Solo el líder de tu empresa puede decidir');
    expect(host.querySelector('.cuenta-regresiva')).toBeFalsy();
  });

  it('en fase "cierre" sin decisión, muestra el aviso de penalización por defecto (no inventa un resultado)', () => {
    const fixture = crearFixture(
      casoActualDto({ caso: casoEstudiante(-2 * UNA_HORA_MS, -UNA_HORA_MS), decision: null }),
    );
    expect(fixture.componentInstance.fase()).toBe('cierre');
    expect(fixture.componentInstance.estadoOpciones()).toBe('resultado');
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('app-kpi')).toBeFalsy();
    expect(host.textContent).toContain('penalización por defecto');
  });

  it('en fase "cierre" con decisión ya tomada, muestra el resultado real', () => {
    const fixture = crearFixture(
      casoActualDto({
        caso: casoEstudiante(-2 * UNA_HORA_MS, -UNA_HORA_MS),
        decision: decision(2, 'Utilidad neta +25000'),
      }),
    );
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('.revisada')).toHaveLength(3);
    expect(host.querySelector('app-kpi')).toBeTruthy();
    expect(host.textContent).toContain('Utilidad neta +25000');
  });

  it('pasa de "visualizacion" a "partida" solo, sin recargar, cuando el reloj cruza fechaInicioPartida', () => {
    const fixture = crearFixture(casoActualDto({ caso: casoEstudiante(3000, UNA_HORA_MS) }));
    expect(fixture.componentInstance.fase()).toBe('visualizacion');

    vi.advanceTimersByTime(5000);
    fixture.detectChanges();

    expect(fixture.componentInstance.fase()).toBe('partida');
  });

  it('ngOnDestroy() cancela el timer (no sigue recalculando después de destruir)', () => {
    const fixture = crearFixture(casoActualDto({ caso: casoEstudiante(3000, UNA_HORA_MS) }));
    const instancia = fixture.componentInstance;

    fixture.destroy();
    vi.advanceTimersByTime(60000);

    expect(instancia.fase()).toBe('visualizacion');
  });
});
