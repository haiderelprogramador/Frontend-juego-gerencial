import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { API_CONFIG, apiUrl } from '../../../core/api/api.config';
import { CasoApi, DecisionEmpresa } from '../../simulacion/models/caso-api.model';
import { Simulacion } from '../simulaciones/models/simulacion.model';
import { Panel, aInputDia, mensajeDesprogramar, mensajeEliminar, mensajeProgramar, validarEdicion } from './panel';

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
    // El paso 4 (Programar) es real: no depende de los pasos 1-3, que siguen siendo mock.
    expect(fixture.componentInstance.pasos()[3].bloqueado).toBe(false);
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

  describe('Programar simulación (paso 4)', () => {
    afterEach(() => vi.restoreAllMocks());

    function botonProgramar(host: HTMLElement): HTMLButtonElement | undefined {
      return [...host.querySelectorAll<HTMLButtonElement>('.paso button')].find((b) =>
        b.textContent?.includes('Programar'),
      );
    }

    it('sin simulaciones en BORRADOR lo dice en el paso 4', () => {
      const fixture = crearFixture([], [simulacion(10, 'PROGRAMADA')]);
      const host = fixture.nativeElement as HTMLElement;
      expect(botonProgramar(host)).toBeUndefined();
      expect(host.textContent).toContain('No hay simulaciones en borrador');
    });

    it('confirma que arranca sola y que después no se puede cambiar; si se acepta, programa y refresca', () => {
      const fixture = crearFixture([], [simulacion(11, 'BORRADOR'), simulacion(10, 'EN_CURSO')]);
      const host = fixture.nativeElement as HTMLElement;
      const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);
      expect(botonProgramar(host)?.textContent).toContain('Programar «Simulación 11»');

      botonProgramar(host)!.click();
      const texto = confirmar.mock.calls[0][0] as string;
      expect(texto).toContain('«Simulación 11»');
      expect(texto).toContain('arranca sola');
      expect(texto).toContain('ya no se pueden cambiar sus empresas ni sus casos');

      http.expectOne({ method: 'POST', url: `${URL_SIMULACIONES}/11/programar` }).flush(simulacion(11, 'PROGRAMADA'));
      http.expectOne({ method: 'GET', url: URL_CASOS }).flush([]);
      http.expectOne({ method: 'GET', url: URL_SIMULACIONES }).flush([simulacion(11, 'PROGRAMADA')]);
      fixture.detectChanges();

      expect(host.textContent).toContain('quedó programada');
      expect(host.textContent).toContain('No hay simulaciones en borrador');
    });

    it('si el docente cancela no programa', () => {
      const fixture = crearFixture([], [simulacion(11, 'BORRADOR')]);
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      fixture.componentInstance.programarSimulacion();
      http.expectNone({ method: 'POST', url: `${URL_SIMULACIONES}/11/programar` });
    });

    it('si el backend dice que no está lista, muestra cada motivo con su enlace (Casos o Empresas)', () => {
      const fixture = crearFixture([], [simulacion(11, 'BORRADOR')]);
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      fixture.componentInstance.programarSimulacion();
      http.expectOne({ method: 'POST', url: `${URL_SIMULACIONES}/11/programar` }).flush(
        {
          message: 'La simulación no está lista para programarse',
          errores: [
            { campo: 'casos', mensaje: 'La simulación no tiene casos' },
            { campo: 'casos', mensaje: 'El primer caso («Expansión») no tiene un balance inicial completo que cuadre' },
            { campo: 'empresas', mensaje: 'Ninguna empresa tiene integrantes' },
            { campo: 'empresas', mensaje: 'Estas empresas no tienen líder: EMP-002 (Grupo Norte)' },
          ],
        },
        { status: 400, statusText: 'Bad Request' },
      );
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;

      expect(host.querySelector('.programar-error')?.textContent).toContain('no está lista para programarse');
      const motivos = [...host.querySelectorAll('.programar-error__lista li')];
      expect(motivos).toHaveLength(4);
      expect(motivos[1].textContent).toContain('El primer caso («Expansión») no tiene un balance inicial completo');
      // Casos -> botón que abre la pestaña; Empresas -> enlace a la pantalla con la simulación.
      expect(motivos[0].querySelector('button')?.textContent).toContain('Ir a Casos');
      expect(motivos[3].querySelector('a')?.getAttribute('href')).toBe('/docente/empresas?simulacion=11');
      expect(motivos[3].textContent).toContain('EMP-002 (Grupo Norte)');
      expect(fixture.componentInstance.programando()).toBe(false);

      motivos[0].querySelector('button')!.click();
      expect(fixture.componentInstance.tab()).toBe('casos');
      // Casos carga su propia lista al montarse.
      fixture.detectChanges();
      http.match(URL_CASOS).forEach((r) => r.flush([]));
      http.match(URL_SIMULACIONES).forEach((r) => r.flush([]));
    });

    it('un motivo con otro campo (o sin campo) se muestra sin enlace', () => {
      const fixture = crearFixture([], [simulacion(11, 'BORRADOR')]);
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      fixture.componentInstance.programarSimulacion();
      http
        .expectOne({ method: 'POST', url: `${URL_SIMULACIONES}/11/programar` })
        .flush({ message: 'No está lista', errores: [{ mensaje: 'Otro motivo' }] }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();
      const li = (fixture.nativeElement as HTMLElement).querySelector('.programar-error__lista li')!;
      expect(li.textContent?.trim()).toBe('Otro motivo');
      expect(li.querySelector('a, button')).toBeNull();
    });

    it('con varias en BORRADOR deja elegir cuál programar', () => {
      const fixture = crearFixture([], [simulacion(11, 'BORRADOR'), simulacion(12, 'BORRADOR')]);
      const host = fixture.nativeElement as HTMLElement;
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const select = host.querySelector<HTMLSelectElement>('.paso__programar select')!;
      expect(select.options).toHaveLength(2);

      select.value = '12';
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      botonProgramar(host)!.click();
      http.expectOne({ method: 'POST', url: `${URL_SIMULACIONES}/12/programar` }).flush(simulacion(12, 'PROGRAMADA'));
      http.expectOne({ method: 'GET', url: URL_CASOS }).flush([]);
      http.expectOne({ method: 'GET', url: URL_SIMULACIONES }).flush([simulacion(11, 'BORRADOR')]);
    });

    it('mensajeProgramar con fecha la escribe "5 de octubre de 2026, 08:00" (24 h)', () => {
      const sim = { ...simulacion(1, 'BORRADOR'), fechaInicio: '2026-10-05T08:00:00' };
      expect(mensajeProgramar(sim)).toContain('arranca sola el 5 de octubre de 2026, 08:00 y');
    });

    it('mensajeProgramar sin fecha válida dice "en su fecha de inicio"', () => {
      expect(mensajeProgramar(simulacion(1, 'BORRADOR'))).toContain('arranca sola en su fecha de inicio');
    });
  });

  describe('Desprogramar (paso 4)', () => {
    afterEach(() => vi.restoreAllMocks());

    const programada = { ...simulacion(12, 'PROGRAMADA'), fechaInicio: '2026-10-05T08:00:00' };

    function botonDesprogramar(host: HTMLElement): HTMLButtonElement | undefined {
      return [...host.querySelectorAll<HTMLButtonElement>('.programadas button')].find((b) =>
        b.textContent?.includes('Desprogramar'),
      );
    }

    it('lista las simulaciones PROGRAMADAS con cuándo arrancan (y no las de otros estados)', () => {
      const fixture = crearFixture([], [programada, simulacion(11, 'BORRADOR'), simulacion(10, 'EN_CURSO')]);
      const host = fixture.nativeElement as HTMLElement;
      const items = host.querySelectorAll('.programadas__item');
      expect(items).toHaveLength(1);
      expect(items[0].textContent!.replace(/\s+/g, ' ')).toContain(
        'Simulación 12 · Programada · arranca el 5 de octubre de 2026, 08:00',
      );
      expect(botonDesprogramar(host)).toBeTruthy();
      // Programar sigue ofreciendo la de BORRADOR.
      expect(host.textContent).toContain('Programar «Simulación 11»');
    });

    it('sin PROGRAMADAS no muestra la lista', () => {
      const fixture = crearFixture([], [simulacion(11, 'BORRADOR')]);
      expect((fixture.nativeElement as HTMLElement).querySelector('.programadas')).toBeNull();
    });

    it('confirma (no arranca sola; no hace falta para corregir), desprograma y refresca', () => {
      const fixture = crearFixture([], [programada]);
      const host = fixture.nativeElement as HTMLElement;
      const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);

      botonDesprogramar(host)!.click();
      const texto = confirmar.mock.calls[0][0] as string;
      expect(texto).toContain('¿Desprogramar «Simulación 12»?');
      expect(texto).toContain('no va a arrancar sola el 5 de octubre de 2026, 08:00');
      expect(texto).toContain('todavía se pueden editar sus casos y empresas');

      http.expectOne({ method: 'POST', url: `${URL_SIMULACIONES}/12/desprogramar` }).flush({ ...programada, estado: 'BORRADOR' });
      http.expectOne({ method: 'GET', url: URL_CASOS }).flush([]);
      http.expectOne({ method: 'GET', url: URL_SIMULACIONES }).flush([{ ...programada, estado: 'BORRADOR' }]);
      fixture.detectChanges();

      expect(host.textContent).toContain('volvió a borrador');
      expect(host.querySelector('.programadas')).toBeNull();
      expect(host.textContent).toContain('Programar «Simulación 12»');
    });

    it('si el docente cancela no desprograma', () => {
      const fixture = crearFixture([], [programada]);
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      fixture.componentInstance.desprogramarSimulacion(programada);
      http.expectNone({ method: 'POST', url: `${URL_SIMULACIONES}/12/desprogramar` });
    });

    it.each([
      'Solo se puede desprogramar una simulación PROGRAMADA',
      'La simulación ya tiene decisiones de empresas; no se puede desprogramar',
    ])('un 400 muestra el mensaje del backend tal cual: %s', (msg) => {
      const fixture = crearFixture([], [programada]);
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      fixture.componentInstance.desprogramarSimulacion(programada);
      http
        .expectOne({ method: 'POST', url: `${URL_SIMULACIONES}/12/desprogramar` })
        .flush({ message: msg }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();

      expect(fixture.componentInstance.errorDesprogramar()).toBe(msg);
      expect((fixture.nativeElement as HTMLElement).textContent).toContain(msg);
      expect(fixture.componentInstance.desprogramandoId()).toBeNull();
    });

    it('mensajeDesprogramar sin fecha válida dice "en su fecha de inicio"', () => {
      expect(mensajeDesprogramar(simulacion(1, 'PROGRAMADA'))).toContain('no va a arrancar sola en su fecha de inicio');
    });
  });

  describe('Editar y eliminar simulación (paso 4)', () => {
    afterEach(() => vi.restoreAllMocks());

    /** "YYYY-MM-DD" a `dias` de hoy (como manda el backend), para que "inicio no pasado" no dependa del día. */
    const en = (dias: number) => {
      const d = new Date(Date.now() + dias * 86_400_000);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const borrador = { ...simulacion(11, 'BORRADOR'), fechaInicio: en(10), fechaFin: en(20) };
    const programada = { ...simulacion(12, 'PROGRAMADA'), fechaInicio: en(5), fechaFin: en(15) };

    function boton(host: HTMLElement, selector: string, texto: string): HTMLButtonElement | undefined {
      return [...host.querySelectorAll<HTMLButtonElement>(`${selector} button`)].find((b) =>
        b.textContent?.includes(texto),
      );
    }

    function escribir(host: HTMLElement, campo: 'Nombre' | 'Inicio' | 'Fin', valor: string): void {
      const label = [...host.querySelectorAll<HTMLLabelElement>('.edicion-sim label')].find(
        (l) => l.querySelector('.field__label')?.textContent === campo,
      )!;
      const input = label.querySelector('input')!;
      input.value = valor;
      input.dispatchEvent(new Event('input'));
    }

    it('BORRADOR ofrece Editar y Eliminar; PROGRAMADA, Editar y Desprogramar (no Eliminar)', () => {
      const fixture = crearFixture([], [borrador, programada, simulacion(10, 'EN_CURSO')]);
      const host = fixture.nativeElement as HTMLElement;

      expect(host.querySelectorAll('.borradores__item')).toHaveLength(1);
      expect(boton(host, '.borradores', 'Editar')).toBeTruthy();
      expect(boton(host, '.borradores', 'Eliminar')).toBeTruthy();
      expect(boton(host, '.programadas', 'Editar')).toBeTruthy();
      expect(boton(host, '.programadas', 'Eliminar')).toBeUndefined();
      expect(host.textContent).not.toContain('Simulación 10');
    });

    it('Editar precarga nombre y fechas de día; Guardar hace PUT con las fechas tal cual y refresca', () => {
      const fixture = crearFixture([], [borrador]);
      const host = fixture.nativeElement as HTMLElement;
      boton(host, '.borradores', 'Editar')!.click();
      fixture.detectChanges();

      const inputs = host.querySelectorAll<HTMLInputElement>('.edicion-sim input');
      expect(inputs[0].value).toBe('Simulación 11');
      expect(inputs[1].type).toBe('date');
      expect(inputs[1].value).toBe(borrador.fechaInicio);
      expect(inputs[2].value).toBe(borrador.fechaFin);
      // Solo una PROGRAMADA avisa del arranque automático.
      expect(host.querySelector('.edicion-sim')?.textContent).not.toContain('arranca sola');

      escribir(host, 'Nombre', '  Gerencia 2026-2  ');
      escribir(host, 'Inicio', en(12));
      boton(host, '.edicion-sim', 'Guardar')!.click();

      const req = http.expectOne({ method: 'PUT', url: `${URL_SIMULACIONES}/11` });
      // Sin toISOString(): en la noche de Bogotá correría el día (el backend guarda solo la fecha).
      expect(req.request.body).toEqual({ nombre: 'Gerencia 2026-2', fechaInicio: en(12), fechaFin: borrador.fechaFin });
      req.flush({ ...borrador, nombre: 'Gerencia 2026-2' });
      http.expectOne({ method: 'GET', url: URL_CASOS }).flush([]);
      http.expectOne({ method: 'GET', url: URL_SIMULACIONES }).flush([{ ...borrador, nombre: 'Gerencia 2026-2' }]);
      fixture.detectChanges();

      expect(host.querySelector('.edicion-sim')).toBeNull();
      expect(host.textContent).toContain('«Gerencia 2026-2» se actualizó.');
    });

    it('en una PROGRAMADA avisa que arranca sola en la nueva fecha, también al guardar', () => {
      const fixture = crearFixture([], [programada]);
      const host = fixture.nativeElement as HTMLElement;
      boton(host, '.programadas', 'Editar')!.click();
      fixture.detectChanges();
      expect(host.querySelector('.edicion-sim')?.textContent).toContain('arranca sola en la nueva fecha de inicio');

      boton(host, '.edicion-sim', 'Guardar')!.click();
      const nueva = { ...programada, fechaInicio: '2027-03-05' };
      http.expectOne({ method: 'PUT', url: `${URL_SIMULACIONES}/12` }).flush(nueva);
      http.expectOne({ method: 'GET', url: URL_CASOS }).flush([]);
      http.expectOne({ method: 'GET', url: URL_SIMULACIONES }).flush([nueva]);
      fixture.detectChanges();

      expect(host.textContent).toContain('«Simulación 12» se actualizó: arranca sola el 5 de marzo de 2027.');
    });

    it.each([
      ['sin nombre', { nombre: '   ' }, 'Poné un nombre y la fecha de inicio.'],
      // El backend acepta un inicio pasado (200, probado el 21-oct-2026): solo lo frena esta validación.
      ['inicio pasado', { fechaInicio: en(-1) }, 'La fecha de inicio no puede ser pasada.'],
      ['fin anterior al inicio', { fechaFin: en(2) }, 'La fecha de fin no puede ser anterior a la de inicio.'],
    ])('valida antes de enviar: %s', (_caso, cambios, msg) => {
      const fixture = crearFixture([], [borrador]);
      const cmp = fixture.componentInstance;
      cmp.editarSimulacion(borrador);
      cmp.actualizarEdicion(cambios);
      cmp.guardarEdicion();
      fixture.detectChanges();

      http.expectNone({ method: 'PUT', url: `${URL_SIMULACIONES}/11` });
      expect(cmp.errorSimulacion()?.mensaje).toBe(msg);
      expect((fixture.nativeElement as HTMLElement).querySelector('.edicion-sim__error')?.textContent).toContain(msg);
    });

    it('inicio hoy y fin igual al inicio sí se permiten (como en el backend)', () => {
      expect(validarEdicion('X', '2026-10-21', '2026-10-21', '2026-10-21')).toBeNull();
      expect(validarEdicion('X', '2026-10-21', '', '2026-10-21')).toBeNull();
      expect(validarEdicion('X', '2026-10-20', '', '2026-10-21')).toBe('La fecha de inicio no puede ser pasada.');
    });

    it('un 400 al guardar muestra el mensaje del backend y sus errores[]; el formulario sigue abierto', () => {
      const fixture = crearFixture([], [borrador]);
      const cmp = fixture.componentInstance;
      cmp.editarSimulacion(borrador);
      cmp.guardarEdicion();
      http.expectOne({ method: 'PUT', url: `${URL_SIMULACIONES}/11` }).flush(
        {
          message: 'El nombre del curso es obligatorio',
          errores: [{ campo: 'nombre', mensaje: 'El nombre del curso no puede tener más de 100 caracteres' }],
        },
        { status: 400, statusText: 'Bad Request' },
      );
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;

      const error = host.querySelector('.edicion-sim__error')!.textContent!;
      expect(error).toContain('El nombre del curso es obligatorio');
      expect(error).toContain('El nombre del curso no puede tener más de 100 caracteres');
      expect(host.querySelector('.edicion-sim')).toBeTruthy();
      expect(cmp.guardandoEdicion()).toBe(false);
    });

    it('Cancelar cierra el formulario sin enviar', () => {
      const fixture = crearFixture([], [borrador]);
      const host = fixture.nativeElement as HTMLElement;
      boton(host, '.borradores', 'Editar')!.click();
      fixture.detectChanges();
      boton(host, '.edicion-sim', 'Cancelar')!.click();
      fixture.detectChanges();
      expect(host.querySelector('.edicion-sim')).toBeNull();
      http.expectNone({ method: 'PUT', url: `${URL_SIMULACIONES}/11` });
    });

    it('Eliminar confirma que se borran sus empresas y casos; con 204 avisa y refresca', () => {
      const fixture = crearFixture([], [borrador]);
      const host = fixture.nativeElement as HTMLElement;
      const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);

      boton(host, '.borradores', 'Eliminar')!.click();
      const texto = confirmar.mock.calls[0][0] as string;
      expect(texto).toContain('¿Eliminar «Simulación 11»?');
      expect(texto).toContain('Se borran también todas sus empresas y sus casos');

      http.expectOne({ method: 'DELETE', url: `${URL_SIMULACIONES}/11` }).flush(null, { status: 204, statusText: 'No Content' });
      http.expectOne({ method: 'GET', url: URL_CASOS }).flush([]);
      http.expectOne({ method: 'GET', url: URL_SIMULACIONES }).flush([]);
      fixture.detectChanges();

      expect(host.textContent).toContain('«Simulación 11» se eliminó, con sus empresas y casos.');
      expect(host.querySelector('.borradores')).toBeNull();
      expect(host.textContent).toContain('No hay simulaciones en borrador');
    });

    it('si el docente cancela no elimina', () => {
      const fixture = crearFixture([], [borrador]);
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      fixture.componentInstance.eliminarSimulacion(borrador);
      http.expectNone({ method: 'DELETE', url: `${URL_SIMULACIONES}/11` });
    });

    it('no intenta eliminar una PROGRAMADA (ni pregunta)', () => {
      const fixture = crearFixture([], [programada]);
      const confirmar = vi.spyOn(window, 'confirm');
      fixture.componentInstance.eliminarSimulacion(programada);
      expect(confirmar).not.toHaveBeenCalled();
      http.expectNone({ method: 'DELETE', url: `${URL_SIMULACIONES}/12` });
    });

    it('un error al eliminar muestra el mensaje del backend junto a la simulación', () => {
      const fixture = crearFixture([], [borrador]);
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      fixture.componentInstance.eliminarSimulacion(borrador);
      http
        .expectOne({ method: 'DELETE', url: `${URL_SIMULACIONES}/11` })
        .flush({ message: 'Solo se puede eliminar una simulación en BORRADOR' }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).querySelector('.edicion-sim__error')?.textContent).toContain(
        'Solo se puede eliminar una simulación en BORRADOR',
      );
      expect(fixture.componentInstance.eliminandoId()).toBeNull();
    });

    it('mensajeEliminar nombra la simulación y lo que se borra con ella', () => {
      expect(mensajeEliminar(borrador)).toBe(
        '¿Eliminar «Simulación 11»? Se borran también todas sus empresas y sus casos. Esta acción no se puede deshacer.',
      );
    });

    it('aInputDia toma el día de la fecha del backend, o "" si no trae una', () => {
      expect(aInputDia('2026-11-20')).toBe('2026-11-20');
      expect(aInputDia('')).toBe('');
      expect(aInputDia('no-es-fecha')).toBe('');
    });

    it('una fecha de día se muestra como ese día, no corrida por la zona horaria', () => {
      const fixture = crearFixture([], [{ ...programada, fechaInicio: '2026-11-20' }]);
      const texto = (fixture.nativeElement as HTMLElement).querySelector('.programadas__item')!.textContent!;
      expect(texto.replace(/\s+/g, ' ')).toContain('arranca el 20 de noviembre de 2026');
      expect(texto).not.toContain('19 de noviembre');
    });
  });

  describe('Finalizar simulación', () => {
    afterEach(() => vi.restoreAllMocks());

    /** Panel con el caso 5 activo en la simulación 10, y sus entregas ya cargadas. */
    function panelCon(estado: Simulacion['estado'], filas = [fila(1, 'TextilAndes', true), fila(2, 'Grupo Norte', false)]) {
      const fixture = crearFixture([caso(5, 10, 'activo', 'Expansión regional')], [simulacion(10, estado)]);
      http.expectOne({ method: 'GET', url: `${URL_CASOS}/5/decisiones` }).flush(filas);
      fixture.detectChanges();
      return fixture;
    }

    function botonFinalizar(host: HTMLElement): HTMLButtonElement | undefined {
      return [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
        b.textContent?.includes('Finalizar simulación'),
      );
    }

    it('el botón falso "Cerrar periodo y calcular" ya no está', () => {
      const fixture = panelCon('EN_CURSO');
      fixture.componentInstance.aplicarPreview(true);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Cerrar periodo y calcular');
    });

    it('solo aparece con la simulación EN_CURSO (en los dos estados del panel)', () => {
      const enCurso = panelCon('EN_CURSO');
      const host = enCurso.nativeElement as HTMLElement;
      expect(botonFinalizar(host)).toBeTruthy();
      enCurso.componentInstance.aplicarPreview(true);
      enCurso.detectChanges();
      expect(botonFinalizar(host)).toBeTruthy();
      enCurso.destroy();

      for (const estado of ['PROGRAMADA', 'FINALIZADA'] as const) {
        const f = panelCon(estado);
        expect(botonFinalizar(f.nativeElement as HTMLElement)).toBeUndefined();
        f.destroy();
      }
    });

    it('confirma cuántas empresas serán penalizadas, finaliza y refresca el panel', () => {
      const fixture = panelCon('EN_CURSO');
      const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);

      botonFinalizar(fixture.nativeElement as HTMLElement)!.click();
      http
        .expectOne({ method: 'GET', url: `${URL_CASOS}/5/decisiones` })
        .flush([fila(1, 'TextilAndes', true), fila(2, 'Grupo Norte', false), fila(3, 'Agro Sur', false)]);
      expect(confirmar).toHaveBeenCalledWith(
        'Finalizar «Simulación 10» cierra «Expansión regional» ahora mismo. 2 empresas todavía no han decidido y recibirán la penalización.',
      );

      http.expectOne({ method: 'POST', url: `${URL_SIMULACIONES}/10/finalizar` }).flush(simulacion(10, 'FINALIZADA'));
      // Refresco: casos, simulaciones y las entregas del caso.
      http.expectOne({ method: 'GET', url: URL_CASOS }).flush([caso(5, 10, 'activo', 'Expansión regional')]);
      http.expectOne({ method: 'GET', url: URL_SIMULACIONES }).flush([simulacion(10, 'FINALIZADA')]);
      http.expectOne({ method: 'GET', url: `${URL_CASOS}/5/decisiones` }).flush([]);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;

      expect(host.textContent).toContain('quedó finalizada');
      expect(botonFinalizar(host)).toBeUndefined();
      expect(fixture.componentInstance.finalizando()).toBe(false);
    });

    it('si el docente cancela no finaliza', () => {
      const fixture = panelCon('EN_CURSO');
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      fixture.componentInstance.finalizarSimulacion();
      http.expectOne({ method: 'GET', url: `${URL_CASOS}/5/decisiones` }).flush([fila(1, 'TextilAndes', false)]);
      http.expectNone({ method: 'POST', url: `${URL_SIMULACIONES}/10/finalizar` });
      expect(fixture.componentInstance.finalizando()).toBe(false);
    });

    it('muestra el error del backend si finalizar falla', () => {
      const fixture = panelCon('EN_CURSO');
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      fixture.componentInstance.finalizarSimulacion();
      http.expectOne({ method: 'GET', url: `${URL_CASOS}/5/decisiones` }).flush([]);
      http
        .expectOne({ method: 'POST', url: `${URL_SIMULACIONES}/10/finalizar` })
        .flush({ message: 'La simulación no está en curso' }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('La simulación no está en curso');
      expect(botonFinalizar(fixture.nativeElement as HTMLElement)).toBeTruthy();
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
