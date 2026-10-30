import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { API_CONFIG, apiUrl } from '../../../core/api/api.config';
import { CasoEstudiante } from '../../simulacion/models/caso-api.model';
import { financieroANumeros, financieroVacio } from '../../simulacion/models/financiero.model';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CasoActual as CasoActualDto, Decision, MiEmpresa, MiSimulacion } from '../models/portal-estudiante.model';
import { aFechaBogota, calcularFase, CasoActual, formatearCuenta } from './caso-actual';

const URL_CASO_ACTUAL = apiUrl(API_CONFIG.endpoints.estudianteCasoActual);
const URL_DECISION = apiUrl(API_CONFIG.endpoints.estudianteDecision);
const URL_SIMULACIONES = apiUrl(API_CONFIG.endpoints.estudianteSimulaciones);
const URL_EMPRESAS = apiUrl(API_CONFIG.endpoints.estudianteEmpresas);

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

function miSimulacion(idSimulacion: number, estado: string): MiSimulacion {
  return {
    idSimulacion,
    nombreSimulacion: `Simulación ${idSimulacion}`,
    fechaInicio: '2026-10-01',
    fechaFin: '2026-10-09',
    estado,
    idEmpresa: 20,
    codigoEmpresa: 'EMP-001',
    nombreEmpresa: 'TextilAndes S.A.',
    departamento: 'GERENCIA_GENERAL',
    esLider: true,
  };
}

function casoActualDto(overrides: Partial<CasoActualDto> = {}): CasoActualDto {
  return {
    idSimulacion: 23,
    nombreSimulacion: 'Simulación de prueba',
    idEmpresa: 20,
    nombreEmpresa: 'TextilAndes S.A.',
    financieroEmpresa: {
      inicial: {
        origen: 'docente',
        penalizacionPorcentaje: null,
        activoTotal: 1,
        pasivoTotal: 1,
        patrimonio: 1,
        utilidadNeta: 1,
        ...financieroANumeros(financieroVacio()),
        indicadores: { razonCorriente: null, pruebaAcida: null, endeudamiento: null, margenNeto: null, roe: null, roa: null },
      },
      final: null,
    },
    esLider: true,
    puedeDecidir: true,
    caso: casoEstudiante(UNA_HORA_MS, 2 * UNA_HORA_MS),
    decision: null,
    boletin: null,
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

  it('partidaFinalizada en true -> cierre, aunque la fecha de fin no haya llegado (cierre anticipado)', () => {
    const cerrado = { ...caso, partidaFinalizada: true } as CasoEstudiante;
    expect(calcularFase(cerrado, aFechaBogota('2026-09-29T12:00:00'))).toBe('cierre');
  });

  it('partidaFinalizada en false no adelanta el cierre: entre inicio y fin sigue en partida', () => {
    const abierto = { ...caso, partidaFinalizada: false } as CasoEstudiante;
    expect(calcularFase(abierto, aFechaBogota('2026-09-29T12:00:00'))).toBe('partida');
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
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // "Mi empresa" se pide en cada pantalla con empresa; solo la prueban sus propios tests.
    http.match((r) => r.url.startsWith(`${URL_EMPRESAS}/`));
    http.verify();
    vi.useRealTimers();
  });

  /** El constructor dispara GET /estudiante/caso-actual (sin idSimulacion) y GET /estudiante/simulaciones. */
  function crearFixture(dto: CasoActualDto | null, simulaciones: MiSimulacion[] = []) {
    const fixture = TestBed.createComponent(CasoActual);
    http.expectOne({ method: 'GET', url: URL_CASO_ACTUAL }).flush(dto, dto === null ? { status: 204, statusText: 'No Content' } : undefined);
    http.expectOne({ method: 'GET', url: URL_SIMULACIONES }).flush(simulaciones);
    fixture.detectChanges();
    return fixture;
  }

  it('sin caso activo (204), muestra el estado vacío', () => {
    const fixture = crearFixture(null);
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('No hay un caso activo todavía');
  });

  describe('balance mientras no llega financieroEmpresa (respaldo con caso.financiero)', () => {
    /** Caso siguiente tal como lo devuelve develop hoy: balance en null, solo el estado de resultados. */
    function casoSiguiente(): CasoEstudiante {
      const base = casoEstudiante(UNA_HORA_MS, 2 * UNA_HORA_MS);
      const nulos = Object.fromEntries(Object.keys(base.financiero).map((k) => [k, null]));
      return {
        ...base,
        financiero: { ...nulos, utilidadNeta: 130000, ventasNetas: 1200000, costoVentas: 700000 } as CasoEstudiante['financiero'],
      };
    }

    function sinFinancieroEmpresa(caso: CasoEstudiante): CasoActualDto {
      const dto = casoActualDto({ caso });
      delete (dto as Partial<CasoActualDto>).financieroEmpresa;
      return dto;
    }

    it('en un caso siguiente muestra la utilidad neta y el aviso, no "—"', () => {
      const fixture = crearFixture(sinFinancieroEmpresa(casoSiguiente()));
      const host = fixture.nativeElement as HTMLElement;
      const items = [...host.querySelectorAll('.financiero__item')].map(
        (i) => `${i.querySelector('.financiero__label')?.textContent?.trim()}: ${i.querySelector('.financiero__val')?.textContent?.trim()}`,
      );

      expect(fixture.componentInstance.balanceNoDisponible()).toBe(true);
      expect(items).toEqual(['Utilidad neta: $130.000']);
      expect(host.querySelector('.financiero__aviso')?.textContent).toContain('El balance propio de tu empresa todavía no está disponible; aparecerá aquí en cuanto se publique.');
      expect(host.querySelector('.financiero__grid')?.textContent).not.toContain('—');
    });

    it('en el primer caso (totales con valor) muestra los 4 totales, sin aviso', () => {
      const fixture = crearFixture(sinFinancieroEmpresa(casoEstudiante(UNA_HORA_MS, 2 * UNA_HORA_MS)));
      const host = fixture.nativeElement as HTMLElement;
      expect(fixture.componentInstance.balanceNoDisponible()).toBe(false);
      expect(host.querySelectorAll('.financiero__item')).toHaveLength(4);
      expect(host.querySelector('.financiero__aviso')).toBeNull();
    });

    it('con financieroEmpresa no aplica, aunque caso.financiero venga en null', () => {
      const fixture = crearFixture(casoActualDto({ caso: casoSiguiente() }));
      expect(fixture.componentInstance.balanceNoDisponible()).toBe(false);
      expect((fixture.nativeElement as HTMLElement).querySelectorAll('.financiero__item')).toHaveLength(4);
    });
  });

  it('muestra el boletín del período cuando caso-actual lo trae', () => {
    const fixture = crearFixture(
      casoActualDto({
        boletin: {
          idCaso: 12,
          inflacion: 5.2,
          tasaInteres: 9.75,
          tasaCambio: 4150,
          nota: 'El dólar viene subiendo.',
          publicadoEn: '2026-09-29T08:00:00',
          actualizadoEn: '2026-09-29T08:00:00',
        },
      }),
    );
    const card = (fixture.nativeElement as HTMLElement).querySelector('.boletin');
    expect(card).toBeTruthy();
    const texto = card!.textContent!.replace(/\s+/g, ' ');
    expect(texto).toContain('Boletín del período');
    expect(texto).toContain('5,2 %');
    expect(texto).toContain('9,75 %');
    expect(texto).toContain('4.150 COP/USD');
    expect(texto).toContain('El dólar viene subiendo.');
  });

  describe('boletín: solo el de caso-actual, sin llamada aparte', () => {
    const URL_BOLETIN = `${apiUrl(API_CONFIG.endpoints.estudianteCasos)}/12/boletin`;
    const boletinPublicado = {
      idCaso: 12,
      inflacion: 3.1,
      tasaInteres: 11,
      tasaCambio: 4000,
      nota: null,
      publicadoEn: '2026-09-29T08:00:00',
      actualizadoEn: '2026-09-29T08:00:00',
    };

    it('con boletin: null no muestra la tarjeta ni pide /estudiante/casos/{id}/boletin', () => {
      const fixture = crearFixture(casoActualDto({ boletin: null }));
      expect((fixture.nativeElement as HTMLElement).querySelector('.boletin')).toBeNull();
      http.expectNone(URL_BOLETIN);
    });

    it('con el boletín en caso-actual lo muestra, sin la llamada aparte', () => {
      const fixture = crearFixture(casoActualDto({ boletin: boletinPublicado }));
      http.expectNone(URL_BOLETIN);
      expect((fixture.nativeElement as HTMLElement).querySelector('.boletin')!.textContent).toContain('3,1 %');
    });

    it('al cambiar de simulación o refrescar tampoco lo pide aparte', () => {
      const fixture = crearFixture(casoActualDto({ boletin: boletinPublicado }), [
        miSimulacion(23, 'EN_CURSO'),
        miSimulacion(40, 'EN_CURSO'),
      ]);
      fixture.componentInstance.elegirSimulacion(40);
      http
        .expectOne((r) => r.url === URL_CASO_ACTUAL && r.params.get('idSimulacion') === '40')
        .flush(casoActualDto({ idSimulacion: 40, boletin: null }));
      fixture.detectChanges();

      http.expectNone((r) => r.url.endsWith('/boletin'));
      expect((fixture.nativeElement as HTMLElement).querySelector('.boletin')).toBeNull();
    });
  });

  describe('financieroEmpresa (D2, doc 30-oct-2026)', () => {
    const inicial = () => casoActualDto().financieroEmpresa.inicial!;

    it('normaliza origen en MAYÚSCULAS (ejemplo JSON del doc) en el servicio: el subtítulo sigue funcionando', () => {
      const dto = casoActualDto({
        financieroEmpresa: { inicial: { ...inicial(), origen: 'HEREDADO' as 'heredado' }, final: null },
      });
      const fixture = crearFixture(dto);
      expect(fixture.componentInstance.subtituloFinanciero()).toBe('Heredada de las decisiones anteriores de tu empresa');
    });

    it('con inicial y final en null no rompe: usa caso.financiero y no muestra penalización', () => {
      const fixture = crearFixture(casoActualDto({ financieroEmpresa: { inicial: null, final: null } }));
      const host = fixture.nativeElement as HTMLElement;
      expect(fixture.componentInstance.balanceNoDisponible()).toBe(false);
      expect(host.querySelectorAll('.financiero__item')).toHaveLength(4);
      expect(host.textContent).toContain('Información financiera inicial');
    });

    it('con inicial null en un caso siguiente (balance en null) muestra el aviso, no "—"', () => {
      const base = casoEstudiante(UNA_HORA_MS, 2 * UNA_HORA_MS);
      const nulos = Object.fromEntries(Object.keys(base.financiero).map((k) => [k, null]));
      const caso = { ...base, financiero: { ...nulos, utilidadNeta: 5 } as CasoEstudiante['financiero'] };
      const fixture = crearFixture(casoActualDto({ caso, financieroEmpresa: { inicial: null, final: null } }));
      expect(fixture.componentInstance.balanceNoDisponible()).toBe(true);
      expect((fixture.nativeElement as HTMLElement).querySelector('.financiero__aviso')).toBeTruthy();
    });
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

  it('cierre anticipado (partidaFinalizada antes de la fecha de fin): un integrante ve el cierre, no el bloqueo por no ser líder', () => {
    const caso = { ...casoEstudiante(-UNA_HORA_MS, UNA_HORA_MS), partidaFinalizada: true };
    const fixture = crearFixture(casoActualDto({ caso, esLider: false, puedeDecidir: false, decision: null }));
    expect(fixture.componentInstance.fase()).toBe('cierre');
    expect(fixture.componentInstance.estadoOpciones()).toBe('resultado');
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).not.toContain('Solo el líder de tu empresa puede decidir');
    expect(host.textContent).toContain('se aplicó la penalización');
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

  it('muestra el impacto de la opción elegida en un detalle cerrado por defecto', () => {
    const fixture = crearFixture(
      casoActualDto({
        caso: casoEstudiante(-2 * UNA_HORA_MS, -UNA_HORA_MS),
        decision: {
          ...decision(1, 'Las ventas suben.'),
          impacto: { ventasNetas: { tipo: 'porcentaje', valor: 15 }, gastosFinancieros: { tipo: 'monto', valor: 30000 } },
        },
      }),
    );
    const detalle = (fixture.nativeElement as HTMLElement).querySelector<HTMLDetailsElement>('details.detalle-financiero')!;
    expect(detalle.open).toBe(false);
    expect(detalle.querySelector('summary')!.textContent).toContain('Ver detalle financiero');
    const lineas = [...detalle.querySelectorAll('li')].map((li) => li.textContent!.replace(/\s+/g, ' ').trim());
    expect(lineas).toEqual(['Ventas netas: +15%', 'Gastos financieros: +$30.000']);
  });

  it('sin impacto en la opción elegida, no muestra el detalle financiero', () => {
    const fixture = crearFixture(
      casoActualDto({ caso: casoEstudiante(-2 * UNA_HORA_MS, -UNA_HORA_MS), decision: decision(2, 'Sin cambios') }),
    );
    expect((fixture.nativeElement as HTMLElement).querySelector('details.detalle-financiero')).toBeNull();
  });

  it('con una sola simulación no muestra el selector', () => {
    const fixture = crearFixture(casoActualDto(), [miSimulacion(23, 'EN_CURSO')]);
    expect((fixture.nativeElement as HTMLElement).querySelector('.selector-simulacion')).toBeNull();
  });

  it('con varias simulaciones muestra el selector y cambiar de simulación recarga ese caso-actual', () => {
    const fixture = crearFixture(casoActualDto(), [miSimulacion(23, 'FINALIZADA'), miSimulacion(40, 'EN_CURSO')]);
    const select = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>('.selector-simulacion select')!;
    expect(select.value).toBe('23'); // la que eligió el backend
    expect(select.options[1].textContent).toContain('Simulación 40 · TextilAndes S.A. (en curso)');

    select.value = '40';
    select.dispatchEvent(new Event('change'));
    http
      .expectOne((r) => r.url === URL_CASO_ACTUAL && r.params.get('idSimulacion') === '40')
      .flush(casoActualDto({ idSimulacion: 40 }));
    fixture.detectChanges();

    expect(fixture.componentInstance.idSimulacionMostrada()).toBe(40);
  });

  it('si la simulación elegida no tiene caso activo (204), el selector sigue visible para volver', () => {
    const fixture = crearFixture(casoActualDto(), [miSimulacion(23, 'EN_CURSO'), miSimulacion(40, 'PROGRAMADA')]);
    fixture.componentInstance.elegirSimulacion(40);
    http
      .expectOne((r) => r.url === URL_CASO_ACTUAL && r.params.get('idSimulacion') === '40')
      .flush(null, { status: 204, statusText: 'No Content' });
    // Simulación sin casos visibles todavía: no es el hueco entre dos casos.
    http.expectOne({ method: 'GET', url: `${URL_SIMULACIONES}/40/casos` }).flush([]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('No hay un caso activo todavía');
    expect(host.querySelector<HTMLSelectElement>('.selector-simulacion select')!.value).toBe('40');
  });

  describe('caso cerrado por el docente mientras el estudiante miraba', () => {
    it('si decidir da 400 y al recargar el caso ya cerró, avisa y muestra la información nueva', () => {
      const fixture = crearFixture(casoActualDto({ caso: casoEstudiante(-UNA_HORA_MS, UNA_HORA_MS) }));
      const cmp = fixture.componentInstance;
      cmp.eleccion.set('1');
      cmp.confirmarDecision();
      http
        .expectOne({ method: 'POST', url: URL_DECISION })
        .flush({ message: 'El caso no está activo' }, { status: 400, statusText: 'Bad Request' });

      // Recarga la MISMA simulación: el backend ya pasó al caso siguiente.
      const siguiente = { ...casoEstudiante(-UNA_HORA_MS, UNA_HORA_MS), id: 13, nombre: 'Crisis de proveedores' };
      http
        .expectOne((r) => r.url === URL_CASO_ACTUAL && r.params.get('idSimulacion') === '23')
        .flush(casoActualDto({ caso: siguiente }));
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;

      expect(host.textContent).toContain('El docente cerró este caso antes de que se registrara la decisión.');
      expect(cmp.caso()?.id).toBe(13);
      expect(cmp.error()).toBeNull();
      expect(cmp.eleccion()).toBe('');
    });

    it('si decidir da 400 pero el caso sigue abierto, muestra el error del backend (no el aviso de cierre)', () => {
      const fixture = crearFixture(casoActualDto({ caso: casoEstudiante(-UNA_HORA_MS, UNA_HORA_MS) }));
      const cmp = fixture.componentInstance;
      cmp.eleccion.set('1');
      cmp.confirmarDecision();
      http
        .expectOne({ method: 'POST', url: URL_DECISION })
        .flush({ message: 'Solo el líder puede decidir' }, { status: 400, statusText: 'Bad Request' });
      http
        .expectOne((r) => r.url === URL_CASO_ACTUAL && r.params.get('idSimulacion') === '23')
        .flush(casoActualDto({ caso: casoEstudiante(-UNA_HORA_MS, UNA_HORA_MS) }));

      expect(cmp.error()).toBe('Solo el líder puede decidir');
      expect(cmp.avisoCierre()).toBeNull();
    });

    it('un error que no es 400 no recarga: solo lo muestra', () => {
      const fixture = crearFixture(casoActualDto({ caso: casoEstudiante(-UNA_HORA_MS, UNA_HORA_MS) }));
      const cmp = fixture.componentInstance;
      cmp.eleccion.set('1');
      cmp.confirmarDecision();
      http
        .expectOne({ method: 'POST', url: URL_DECISION })
        .flush({ message: 'Error interno' }, { status: 500, statusText: 'Server Error' });
      http.expectNone((r) => r.url === URL_CASO_ACTUAL);
      expect(cmp.error()).toBe('Error interno');
    });

    it('al volver a la pestaña recarga en silencio la misma simulación', () => {
      const fixture = crearFixture(casoActualDto({ caso: casoEstudiante(-UNA_HORA_MS, UNA_HORA_MS) }));
      const cmp = fixture.componentInstance;
      cmp.eleccion.set('2');
      const visibilidad = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');

      document.dispatchEvent(new Event('visibilitychange'));
      expect(cmp.cargando()).toBe(false);
      const siguiente = { ...casoEstudiante(-UNA_HORA_MS, UNA_HORA_MS), id: 13 };
      http
        .expectOne((r) => r.url === URL_CASO_ACTUAL && r.params.get('idSimulacion') === '23')
        .flush(casoActualDto({ caso: siguiente }));

      expect(cmp.caso()?.id).toBe(13);
      // Caso distinto: la selección del caso viejo no aplica.
      expect(cmp.eleccion()).toBe('');
      visibilidad.mockRestore();
    });

    it('con la pestaña oculta no recarga, y al destruir deja de escuchar', () => {
      const fixture = crearFixture(casoActualDto());
      const visibilidad = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
      http.expectNone((r) => r.url === URL_CASO_ACTUAL);

      visibilidad.mockReturnValue('visible');
      fixture.destroy();
      document.dispatchEvent(new Event('visibilitychange'));
      http.expectNone((r) => r.url === URL_CASO_ACTUAL);
      visibilidad.mockRestore();
    });

    it('204 en una simulación que ya tuvo casos: explica el hueco entre casos y apunta a Reportes', () => {
      const fixture = TestBed.createComponent(CasoActual);
      http.expectOne({ method: 'GET', url: URL_CASO_ACTUAL }).flush(null, { status: 204, statusText: 'No Content' });
      http.expectOne({ method: 'GET', url: URL_SIMULACIONES }).flush([miSimulacion(23, 'EN_CURSO')]);
      // Sin simulación elegida, mira la más reciente del estudiante.
      http.expectOne({ method: 'GET', url: `${URL_SIMULACIONES}/23/casos` }).flush([casoEstudiante(-2 * UNA_HORA_MS, -UNA_HORA_MS)]);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;

      expect(host.textContent).toContain('El caso anterior se cerró. El siguiente todavía no está publicado');
      expect(host.querySelector('a[href="/estudiante/reportes-financieros"]')).toBeTruthy();
      expect(host.textContent).not.toContain('No hay un caso activo todavía');
    });
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

  describe('Mi empresa', () => {
    function empresa(overrides: Partial<MiEmpresa> = {}): MiEmpresa {
      return {
        id: 20,
        idSimulacion: 23,
        codigoEmpresa: 'EMP-001',
        nombre: 'TextilAndes S.A.',
        estrategia: null,
        tipoJugador: 'MULTIUSUARIO',
        estado: 'ACTIVA',
        integrantes: [
          { idUsuario: 1, nombre: 'Laura Gómez', correo: 'laura@uni.test', departamento: 'GERENCIA_GENERAL', esLider: true },
          { idUsuario: 2, nombre: 'Andrés Ruiz', correo: 'andres@uni.test', departamento: 'COMERCIAL', esLider: false },
        ],
        ...overrides,
      };
    }

    function tarjeta(host: HTMLElement): HTMLElement | null {
      return host.querySelector('.mi-empresa');
    }

    it('con caso muestra los integrantes de la empresa de caso-actual, con departamento y quién es el líder', () => {
      const fixture = crearFixture(casoActualDto());
      http.expectOne({ method: 'GET', url: `${URL_EMPRESAS}/20` }).flush(empresa());
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;

      const items = host.querySelectorAll('.mi-empresa__item');
      expect(items).toHaveLength(2);
      expect(items[0].textContent).toContain('Laura Gómez');
      expect(items[0].textContent).toContain('Gerencia general');
      expect(items[0].textContent).toContain('Líder');
      expect(items[1].textContent).toContain('Andrés Ruiz');
      expect(items[1].textContent).toContain('Comercial');
      expect(items[1].textContent).not.toContain('Líder');
      expect(tarjeta(host)!.textContent).toContain('2 integrantes');
    });

    it('si responde 400 la tarjeta no se muestra (y el resto de la pantalla sí)', () => {
      const fixture = crearFixture(casoActualDto());
      http
        .expectOne({ method: 'GET', url: `${URL_EMPRESAS}/20` })
        .flush({ message: 'No perteneces a esta empresa', status: 400 }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;

      expect(tarjeta(host)).toBeNull();
      expect(fixture.componentInstance.error()).toBeNull();
      expect(host.textContent).toContain('Opciones de decisión');
    });

    it('con un solo integrante dice "1 integrante"', () => {
      const fixture = crearFixture(casoActualDto());
      http
        .expectOne({ method: 'GET', url: `${URL_EMPRESAS}/20` })
        .flush(empresa({ integrantes: [empresa().integrantes[0]] }));
      fixture.detectChanges();
      const texto = tarjeta(fixture.nativeElement)!.textContent!;

      expect(texto).toContain('1 integrante');
      expect(texto).not.toContain('1 integrantes');
    });

    it('sin caso (204) toma la empresa de misSimulaciones', () => {
      const fixture = TestBed.createComponent(CasoActual);
      http.expectOne({ method: 'GET', url: URL_CASO_ACTUAL }).flush(null, { status: 204, statusText: 'No Content' });
      http.expectOne({ method: 'GET', url: URL_SIMULACIONES }).flush([{ ...miSimulacion(23, 'PROGRAMADA'), idEmpresa: 31 }]);
      http.expectOne({ method: 'GET', url: `${URL_SIMULACIONES}/23/casos` }).flush([]);
      http.expectOne({ method: 'GET', url: `${URL_EMPRESAS}/31` }).flush(empresa({ id: 31 }));
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;

      expect(host.textContent).toContain('No hay un caso activo todavía');
      expect(host.querySelectorAll('.mi-empresa__item')).toHaveLength(2);
    });

    it('al cambiar a una simulación con otra empresa la vuelve a pedir; con la misma, no', () => {
      const fixture = crearFixture(casoActualDto(), [miSimulacion(23, 'EN_CURSO'), miSimulacion(40, 'EN_CURSO')]);
      http.expectOne({ method: 'GET', url: `${URL_EMPRESAS}/20` }).flush(empresa());

      fixture.componentInstance.elegirSimulacion(40);
      http
        .expectOne((r) => r.url === URL_CASO_ACTUAL && r.params.get('idSimulacion') === '40')
        .flush(casoActualDto({ idSimulacion: 40, idEmpresa: 55 }));
      // Mientras llega la nueva, no se muestra la empresa anterior.
      fixture.detectChanges();
      expect(tarjeta(fixture.nativeElement)).toBeNull();
      http.expectOne({ method: 'GET', url: `${URL_EMPRESAS}/55` }).flush(empresa({ id: 55, nombre: 'Grupo Norte' }));
      fixture.detectChanges();
      expect(tarjeta(fixture.nativeElement)!.textContent).toContain('Grupo Norte');

      fixture.componentInstance.elegirSimulacion(40);
      http
        .expectOne((r) => r.url === URL_CASO_ACTUAL && r.params.get('idSimulacion') === '40')
        .flush(casoActualDto({ idSimulacion: 40, idEmpresa: 55 }));
      http.expectNone(`${URL_EMPRESAS}/55`);
    });
  });
});

describe('CasoActual — simulación recordada', () => {
  let http: HttpTestingController;
  const CLAVE = 'portal-estudiante.simulacion.50';

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
    await TestBed.configureTestingModule({
      imports: [CasoActual],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { usuarioActual: signal({ id: '50' }) } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.match((r) => r.url.startsWith(`${URL_EMPRESAS}/`));
    http.verify();
    localStorage.removeItem(CLAVE);
    vi.useRealTimers();
  });

  it('recuerda la simulación elegida: al volver a entrar (F5) pide esa, no la del backend', () => {
    const primera = TestBed.createComponent(CasoActual);
    http.expectOne({ method: 'GET', url: URL_CASO_ACTUAL }).flush(casoActualDto());
    http.expectOne({ method: 'GET', url: URL_SIMULACIONES }).flush([miSimulacion(23, 'FINALIZADA'), miSimulacion(40, 'EN_CURSO')]);
    primera.componentInstance.elegirSimulacion(40);
    http.expectOne((r) => r.url === URL_CASO_ACTUAL && r.params.get('idSimulacion') === '40').flush(casoActualDto({ idSimulacion: 40 }));
    primera.destroy();

    TestBed.createComponent(CasoActual);
    http.expectOne((r) => r.url === URL_CASO_ACTUAL && r.params.get('idSimulacion') === '40').flush(casoActualDto({ idSimulacion: 40 }));
    http.expectOne({ method: 'GET', url: URL_SIMULACIONES }).flush([]);
  });

  it('si la simulación recordada ya no es válida, la olvida y vuelve a la del backend', () => {
    localStorage.setItem(CLAVE, '99');
    const fixture = TestBed.createComponent(CasoActual);
    http
      .expectOne((r) => r.url === URL_CASO_ACTUAL && r.params.get('idSimulacion') === '99')
      .flush({ message: 'No perteneces a esa simulación' }, { status: 400, statusText: 'Bad Request' });
    http.expectOne((r) => r.url === URL_CASO_ACTUAL && !r.params.has('idSimulacion')).flush(casoActualDto());
    http.expectOne({ method: 'GET', url: URL_SIMULACIONES }).flush([]);
    fixture.detectChanges();

    expect(localStorage.getItem(CLAVE)).toBeNull();
    expect(fixture.componentInstance.error()).toBeNull();
    expect(fixture.componentInstance.caso()).toBeTruthy();
  });
});
