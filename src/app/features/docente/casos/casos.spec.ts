import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import * as XLSX from 'xlsx';

import { API_CONFIG, apiUrl } from '../../../core/api/api.config';
import { CasoApi } from '../../simulacion/models/caso-api.model';
import { CAMPOS_FINANCIEROS, CampoFinanciero, FinancieroTexto } from '../../simulacion/models/financiero.model';
import { Simulacion } from '../simulaciones/models/simulacion.model';
import { Casos } from './casos';

const URL_CASOS = apiUrl(API_CONFIG.endpoints.casos);
const URL_SIMULACIONES = apiUrl(API_CONFIG.endpoints.simulacionesDocente);

function casoApi(id: number, nombre: string, estado: 'borrador' | 'activo' = 'borrador'): CasoApi {
  return {
    id,
    idSimulacion: 1,
    nombre,
    tipo: 'Manufactura',
    estado,
    mision: '',
    vision: '',
    // Caso viejo: 4 totales y las 19 partidas en null (así lo devuelve el backend real).
    financiero: { activoTotal: 1850000, pasivoTotal: 720000, patrimonio: 1130000, utilidadNeta: 142000, ...PARTIDAS_NULAS },
    penalizacionMin: 1,
    penalizacionMax: 3,
    fechaVisualizacion: '',
    fechaInicioPartida: '',
    fechaFinPartida: '',
    asignacionEquipos: 'automatica',
    opciones: [{ id: 10, orden: 1, opcion: 'Ampliar planta', resultado: '+180k', impacto: null }],
  };
}

const PARTIDAS_NULAS = Object.fromEntries(CAMPOS_FINANCIEROS.map((c) => [c, null])) as Record<
  CampoFinanciero,
  null
>;

/** Activo 1.550.000 = pasivo 700.000 + patrimonio 850.000 (capital + retenidas + utilidad neta 130.000). */
const BALANCE_CUADRADO: FinancieroTexto = {
  efectivo: '200000',
  cuentasPorCobrar: '150000',
  inventarios: '250000',
  propiedadPlantaEquipo: '900000',
  activosIntangibles: '50000',
  cuentasPorPagar: '180000',
  obligacionesFinancierasCortoPlazo: '120000',
  obligacionesFinancierasLargoPlazo: '400000',
  capitalSocial: '600000',
  utilidadesRetenidas: '120000',
  ventasNetas: '1200000',
  costoVentas: '700000',
  gastosAdministracion: '150000',
  gastosVentas: '100000',
  gastosFinancieros: '50000',
  impuestoRenta: '70000',
  flujoOperativo: '180000',
  flujoInversion: '-80000',
  flujoFinanciacion: '-50000',
};

function simulacion(id: number, estado: Simulacion['estado'] = 'PROGRAMADA'): Simulacion {
  return {
    id,
    idUsuarioCoordinador: 9,
    nombre: `Simulación ${id}`,
    fechaInicio: '2026-10-01T08:00:00',
    fechaFin: '2026-12-01T23:59:00',
    estado,
  };
}

function archivoDesdeFilas(filas: Record<string, unknown>[]): File {
  const hoja = XLSX.utils.json_to_sheet(filas);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Hoja1');
  const buffer = XLSX.write(libro, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new File([buffer], 'prueba.xlsx');
}

function eventoConArchivo(archivo: File): Event {
  const input = document.createElement('input');
  input.type = 'file';
  Object.defineProperty(input, 'files', { value: [archivo] });
  return { target: input } as unknown as Event;
}

describe('Casos', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Casos],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** El constructor dispara GET /docente/casos y GET /docente/simulaciones. */
  function crearFixture(casosIniciales: CasoApi[] = [casoApi(1, 'TextilAndes S.A.', 'activo'), casoApi(2, 'Crisis de proveedores')]) {
    const fixture = TestBed.createComponent(Casos);
    http.expectOne({ method: 'GET', url: URL_CASOS }).flush(casosIniciales);
    http.expectOne({ method: 'GET', url: URL_SIMULACIONES }).flush([simulacion(1), simulacion(2, 'BORRADOR')]);
    fixture.detectChanges();
    return fixture;
  }

  it('arranca en la lista de casos, con lo que devuelve el backend', () => {
    const fixture = crearFixture();
    expect(fixture.componentInstance.vista()).toBe('lista');
    expect(fixture.componentInstance.casos()).toHaveLength(2);
    expect((fixture.nativeElement as HTMLElement).querySelector('.tabla-casos')).toBeTruthy();
  });

  it('"+ Nuevo caso" abre el formulario en la pestaña Info General', () => {
    const fixture = crearFixture();
    fixture.componentInstance.nuevoCaso();
    fixture.detectChanges();
    expect(fixture.componentInstance.vista()).toBe('formulario');
    expect(fixture.componentInstance.tabForm()).toBe('general');
  });

  it('"+ Agregar opción" añade una tarjeta de opción', () => {
    const fixture = crearFixture();
    fixture.componentInstance.nuevoCaso();
    fixture.componentInstance.tabForm.set('opciones');
    fixture.detectChanges();

    expect(fixture.componentInstance.opciones()).toHaveLength(1);
    fixture.componentInstance.agregarOpcion();
    fixture.detectChanges();
    expect(fixture.componentInstance.opciones()).toHaveLength(2);
  });

  it('importa el Excel financiero y precarga las partidas manuales', async () => {
    const fixture = crearFixture();
    const archivo = archivoDesdeFilas([{ Efectivo: '200000', 'Ventas netas': '1200000' }]);

    await fixture.componentInstance.onArchivoFinanciero(eventoConArchivo(archivo));
    fixture.detectChanges();

    expect(fixture.componentInstance.financiero().efectivo).toBe('200000');
    expect(fixture.componentInstance.financiero().ventasNetas).toBe('1200000');
    expect(fixture.componentInstance.modoFinanciera()).toBe('manual');
    expect(fixture.componentInstance.errorImportFinanciero()).toBeNull();
  });

  it('importa el Excel de opciones y reemplaza el catálogo', async () => {
    const fixture = crearFixture();
    const archivo = archivoDesdeFilas([
      { Opción: 'Ampliar planta', Resultado: 'Activo +180k' },
      { Opción: 'Mantener capacidad', Resultado: 'Utilidad +25k' },
    ]);

    await fixture.componentInstance.onArchivoOpciones(eventoConArchivo(archivo));
    fixture.detectChanges();

    expect(fixture.componentInstance.opciones()).toHaveLength(2);
    expect(fixture.componentInstance.opciones()[0].opcion).toBe('Ampliar planta');
    expect(fixture.componentInstance.modoOpciones()).toBe('manual');
  });

  it('muestra un error si el Excel no tiene las columnas esperadas', async () => {
    const fixture = crearFixture();
    const archivo = archivoDesdeFilas([{ Foo: '1' }]);

    await fixture.componentInstance.onArchivoFinanciero(eventoConArchivo(archivo));
    fixture.detectChanges();

    expect(fixture.componentInstance.errorImportFinanciero()).toBeTruthy();
  });

  it('sin simulación elegida, "Guardar caso" no llama al backend y avisa el error', () => {
    const fixture = crearFixture();
    fixture.componentInstance.nuevoCaso();
    fixture.componentInstance.empresa.set('Caso sin simulación');

    fixture.componentInstance.guardarCaso();

    expect(fixture.componentInstance.errorFormulario()).toBeTruthy();
    http.expectNone({ method: 'POST', url: URL_CASOS });
  });

  it('"Guardar caso" crea el caso (totales calculados desde las partidas) y refresca la lista', () => {
    const fixture = crearFixture([]);
    fixture.componentInstance.nuevoCaso();
    fixture.componentInstance.idSimulacion.set(1);
    fixture.componentInstance.empresa.set('Caso de prueba');
    fixture.componentInstance.financiero.set(BALANCE_CUADRADO);

    fixture.componentInstance.guardarCaso();

    const peticion = http.expectOne({ method: 'POST', url: URL_CASOS });
    expect(peticion.request.body.idSimulacion).toBe(1);
    // Las 19 partidas como número; los 4 totales no se mandan (los calcula el backend).
    const financiero = peticion.request.body.financiero;
    expect(Object.keys(financiero).sort()).toEqual([...CAMPOS_FINANCIEROS].sort());
    expect(financiero.efectivo).toBe(200000);
    expect(financiero.flujoInversion).toBe(-80000);
    expect(financiero.activoTotal).toBeUndefined();
    peticion.flush(casoApi(5, 'Caso de prueba'));

    http.expectOne({ method: 'GET', url: URL_CASOS }).flush([casoApi(5, 'Caso de prueba')]);

    expect(fixture.componentInstance.vista()).toBe('lista');
    expect(fixture.componentInstance.casos().some((c) => c.nombre === 'Caso de prueba')).toBe(true);
  });

  it('"Editar" un caso viejo (partidas en null) deja las partidas vacías, muestra los totales viejos y exige completarlas antes del PUT', () => {
    const viejo = casoApi(1, 'TextilAndes S.A.', 'activo');
    const fixture = crearFixture([viejo]);
    const c = fixture.componentInstance;
    c.editarCaso(1);
    c.tabForm.set('financiera');
    fixture.detectChanges();

    expect(c.empresa()).toBe('TextilAndes S.A.');
    expect(c.financiero().efectivo).toBe('');
    expect(c.totalesAnteriores()?.activoTotal).toBe(1850000);
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('modelo anterior');
    expect(html).not.toContain('null');

    // Sin partidas no se manda nada: mandarlas como 0 pisaría los totales viejos.
    c.empresa.set('Nombre editado');
    c.guardarCaso();
    http.expectNone({ method: 'PUT', url: `${URL_CASOS}/1` });
    expect(c.errorFormulario()).toContain('Completá las 19 partidas');

    c.financiero.set(BALANCE_CUADRADO);
    c.guardarCaso();

    const peticion = http.expectOne({ method: 'PUT', url: `${URL_CASOS}/1` });
    expect(peticion.request.body.nombre).toBe('Nombre editado');
    expect(peticion.request.body.financiero.efectivo).toBe(200000);
    peticion.flush(casoApi(1, 'Nombre editado', 'activo'));

    http.expectOne({ method: 'GET', url: URL_CASOS }).flush([casoApi(1, 'Nombre editado', 'activo')]);
    expect(fixture.componentInstance.casos()[0].nombre).toBe('Nombre editado');
  });

  it('"Editar" un caso con partidas las precarga y no muestra totales viejos', () => {
    const caso = casoApi(1, 'Con partidas');
    caso.financiero = { ...caso.financiero, efectivo: 200000, flujoInversion: -80000 };
    const fixture = crearFixture([caso]);
    fixture.componentInstance.editarCaso(1);

    expect(fixture.componentInstance.financiero().efectivo).toBe('200000');
    expect(fixture.componentInstance.financiero().flujoInversion).toBe('-80000');
    expect(fixture.componentInstance.totalesAnteriores()).toBeNull();
  });

  it('con partidas sin completar, "Guardar caso" no llama al backend y dice cuáles faltan', () => {
    const fixture = crearFixture();
    const c = fixture.componentInstance;
    c.nuevoCaso();
    c.idSimulacion.set(1);
    c.financiero.set({ ...BALANCE_CUADRADO, inventarios: '', gastosVentas: ' ' });

    c.guardarCaso();

    expect(c.errorFormulario()).toContain('Faltan: Inventarios, Gastos de ventas');
    expect(c.tabForm()).toBe('financiera');
    http.expectNone({ method: 'POST', url: URL_CASOS });
  });

  it('si el balance no cuadra, "Guardar caso" no llama al backend y lleva a la pestaña financiera', () => {
    const fixture = crearFixture();
    const c = fixture.componentInstance;
    c.nuevoCaso();
    c.idSimulacion.set(1);
    c.financiero.set({ ...BALANCE_CUADRADO, efectivo: '230000' });

    c.guardarCaso();

    expect(c.errorFormulario()).toContain('no cuadra');
    expect(c.tabForm()).toBe('financiera');
    http.expectNone({ method: 'POST', url: URL_CASOS });
  });

  it('el error de guardado desaparece en cuanto el docente corrige el dato', () => {
    const fixture = crearFixture();
    const c = fixture.componentInstance;
    c.nuevoCaso();
    c.idSimulacion.set(1);
    c.financiero.set({ ...BALANCE_CUADRADO, efectivo: '230000' });
    fixture.detectChanges(); // como en la app: cada tecla pasa por un ciclo de detección
    c.guardarCaso();
    fixture.detectChanges();
    expect(c.errorFormulario()).toContain('no cuadra');

    c.financiero.update((f) => ({ ...f, efectivo: '200000' }));
    fixture.detectChanges();

    expect(c.errorFormulario()).toBeNull();
  });

  it('un negativo en una partida que no lo admite bloquea el guardado', () => {
    const fixture = crearFixture();
    const c = fixture.componentInstance;
    c.nuevoCaso();
    c.idSimulacion.set(1);
    c.financiero.set({ ...BALANCE_CUADRADO, inventarios: '-250000', efectivo: '700000' });

    c.guardarCaso();

    expect(c.errorFormulario()).toContain('Inventarios');
    http.expectNone({ method: 'POST', url: URL_CASOS });
  });

  it('un % de impacto menor a -100 bloquea el guardado y lleva a la pestaña Opciones', () => {
    const fixture = crearFixture();
    const c = fixture.componentInstance;
    c.nuevoCaso();
    c.idSimulacion.set(1);
    c.financiero.set(BALANCE_CUADRADO);
    const id = c.opciones()[0].id;
    c.actualizarOpcionTexto(id, 'Bajar precios');
    c.actualizarOpcionImpacto(id, {
      ...c.opciones()[0].impacto,
      ventasNetas: { tipo: 'porcentaje', valor: '-120' },
    });

    c.guardarCaso();

    expect(c.errorFormulario()).toContain('-100');
    expect(c.errorFormulario()).toContain('Opción 1: Ventas netas');
    expect(c.tabForm()).toBe('opciones');
    http.expectNone({ method: 'POST', url: URL_CASOS });
  });

  it('manda el impacto declarado (solo drivers con valor) y lo omite en opciones sin impacto', () => {
    const fixture = crearFixture([]);
    const c = fixture.componentInstance;
    c.nuevoCaso();
    c.idSimulacion.set(1);
    c.financiero.set(BALANCE_CUADRADO);
    const id = c.opciones()[0].id;
    c.actualizarOpcionTexto(id, 'Subir precios');
    c.actualizarOpcionImpacto(id, {
      ...c.opciones()[0].impacto,
      ventasNetas: { tipo: 'porcentaje', valor: '10' },
      costoVentas: { tipo: 'monto', valor: '50000' },
    });
    c.agregarOpcion();
    c.actualizarOpcionTexto(c.opciones()[1].id, 'No hacer nada');

    c.guardarCaso();

    const peticion = http.expectOne({ method: 'POST', url: URL_CASOS });
    expect(peticion.request.body.opciones).toEqual([
      {
        opcion: 'Subir precios',
        resultado: '',
        impacto: { ventasNetas: { tipo: 'porcentaje', valor: 10 }, costoVentas: { tipo: 'monto', valor: 50000 } },
      },
      { opcion: 'No hacer nada', resultado: '' },
    ]);
    peticion.flush(casoApi(5, 'X'));
    http.expectOne({ method: 'GET', url: URL_CASOS }).flush([]);
  });

  it('"Editar" carga el impacto que devuelve el backend en cada opción', () => {
    const caso = casoApi(1, 'Con impacto');
    caso.opciones = [
      { id: 10, orden: 1, opcion: 'Ampliar planta', resultado: '', impacto: { costoVentas: { tipo: 'monto', valor: 50000 } } },
    ];
    const fixture = crearFixture([caso]);
    fixture.componentInstance.editarCaso(1);

    const impacto = fixture.componentInstance.opciones()[0].impacto;
    expect(impacto.costoVentas).toEqual({ tipo: 'monto', valor: '50000' });
    expect(impacto.ventasNetas.valor).toBe('');
  });

  it('"Activar" llama al backend y refresca la lista', () => {
    const fixture = crearFixture([casoApi(1, 'A', 'activo'), casoApi(2, 'B', 'borrador')]);

    fixture.componentInstance.activarCaso(2);

    http.expectOne({ method: 'POST', url: `${URL_CASOS}/2/activar` }).flush(casoApi(2, 'B', 'activo'));
    http
      .expectOne({ method: 'GET', url: URL_CASOS })
      .flush([casoApi(1, 'A', 'borrador'), casoApi(2, 'B', 'activo')]);

    const activos = fixture.componentInstance.casos().filter((c) => c.estado === 'activo');
    expect(activos).toHaveLength(1);
    expect(activos[0].id).toBe(2);
  });

  it('"+ Nueva simulación" crea, programa y deja seleccionada la simulación nueva', () => {
    const fixture = crearFixture();
    const c = fixture.componentInstance;
    c.nuevoCaso();
    c.abrirNuevaSimulacion();
    c.nuevaSimNombre.set('Gerencia 2026-2');
    c.nuevaSimInicio.set('2026-10-05T08:00');
    c.nuevaSimFin.set('2026-12-05T18:00');
    fixture.detectChanges();

    c.crearSimulacion();

    const alta = http.expectOne({ method: 'POST', url: URL_SIMULACIONES });
    expect(alta.request.body).toEqual({
      nombre: 'Gerencia 2026-2',
      fechaInicio: new Date('2026-10-05T08:00').toISOString(),
      fechaFin: new Date('2026-12-05T18:00').toISOString(),
    });
    alta.flush({ ...simulacion(7, 'BORRADOR'), nombre: 'Gerencia 2026-2' });
    http
      .expectOne({ method: 'POST', url: `${URL_SIMULACIONES}/7/programar` })
      .flush({ ...simulacion(7, 'PROGRAMADA'), nombre: 'Gerencia 2026-2' });
    fixture.detectChanges();

    expect(c.creandoSimulacion()).toBe(false);
    expect(c.idSimulacion()).toBe(7);
    expect(c.simulacionesDisponibles().map((s) => s.id)).toContain(7);
    const select = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>('.selector-sim select')!;
    expect(select.value).toBe('7');
  });

  it('sin nombre o fecha de inicio, "Crear simulación" no llama al backend', () => {
    const fixture = crearFixture();
    const c = fixture.componentInstance;
    c.nuevoCaso();
    c.abrirNuevaSimulacion();
    c.nuevaSimNombre.set('Sin fecha');

    c.crearSimulacion();

    expect(c.errorNuevaSimulacion()).toBeTruthy();
    http.expectNone({ method: 'POST', url: URL_SIMULACIONES });
  });

  it('si /programar falla, la simulación queda en borrador pero igual seleccionada', () => {
    const fixture = crearFixture();
    const c = fixture.componentInstance;
    c.nuevoCaso();
    c.abrirNuevaSimulacion();
    c.nuevaSimNombre.set('X');
    c.nuevaSimInicio.set('2026-10-05T08:00');

    c.crearSimulacion();

    const alta = http.expectOne({ method: 'POST', url: URL_SIMULACIONES });
    expect(alta.request.body.fechaFin).toBeUndefined();
    alta.flush(simulacion(8, 'BORRADOR'));
    http
      .expectOne({ method: 'POST', url: `${URL_SIMULACIONES}/8/programar` })
      .flush({ message: 'Error' }, { status: 400, statusText: 'Bad Request' });

    expect(c.idSimulacion()).toBe(8);
    expect(c.errorFormulario()).toContain('borrador');
  });

  it('un error al listar simulaciones se muestra en vez de dejar el selector vacío en silencio', () => {
    const fixture = TestBed.createComponent(Casos);
    http.expectOne({ method: 'GET', url: URL_CASOS }).flush([]);
    http
      .expectOne({ method: 'GET', url: URL_SIMULACIONES })
      .flush({ message: 'Token inválido' }, { status: 401, statusText: 'Unauthorized' });
    fixture.componentInstance.nuevoCaso();
    fixture.detectChanges();

    expect(fixture.componentInstance.errorSimulaciones()).toBe('Token inválido');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Token inválido');
  });
});
