import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import * as XLSX from 'xlsx';

import { API_CONFIG, apiUrl } from '../../../core/api/api.config';
import { afterEach, vi } from 'vitest';

import { CasoApi, DecisionEmpresa } from '../../simulacion/models/caso-api.model';
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
    esPrimerCaso: true,
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
  function crearFixture(
    casosIniciales: CasoApi[] = [casoApi(1, 'TextilAndes S.A.', 'activo'), casoApi(2, 'Crisis de proveedores')],
    simulaciones: Simulacion[] = [simulacion(1), simulacion(2, 'BORRADOR')],
  ) {
    const fixture = TestBed.createComponent(Casos);
    http.expectOne({ method: 'GET', url: URL_CASOS }).flush(casosIniciales);
    http.expectOne({ method: 'GET', url: URL_SIMULACIONES }).flush(simulaciones);
    fixture.detectChanges();
    return fixture;
  }

  it('arranca en la lista de casos, con lo que devuelve el backend', () => {
    const fixture = crearFixture();
    expect(fixture.componentInstance.vista()).toBe('lista');
    expect(fixture.componentInstance.casos()).toHaveLength(2);
    expect((fixture.nativeElement as HTMLElement).querySelector('.tabla-casos')).toBeTruthy();
  });

  it('sin los endpoints del boletín (disponible.boletin = false) no muestra el botón "Boletín"', () => {
    const fixture = crearFixture();
    const botones = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.acciones-caso button'));
    expect(botones.some((b) => b.textContent?.trim() === 'Boletín')).toBe(false);
  });

  it('con el boletín disponible, "Boletín" abre la vista del boletín de ese caso', () => {
    const fixture = crearFixture();
    fixture.componentInstance.boletinDisponible.set(true);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const boton = Array.from(host.querySelectorAll<HTMLButtonElement>('.acciones-caso button')).find(
      (b) => b.textContent?.trim() === 'Boletín',
    );
    expect(boton).toBeTruthy();

    boton!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.vista()).toBe('boletin');
    expect(host.querySelector('app-boletin-caso')).toBeTruthy();
    http
      .expectOne({ method: 'GET', url: `${URL_CASOS}/1/boletin` })
      .flush(null, { status: 204, statusText: 'No Content' });

    fixture.componentInstance.volverALista();
    fixture.detectChanges();
    expect(fixture.componentInstance.vista()).toBe('lista');
    expect(fixture.componentInstance.casoBoletin()).toBeNull();
  });

  it('con la simulación FINALIZADA, "Boletín" abre el boletín de solo lectura', () => {
    const fixture = crearFixture([casoApi(1, 'TextilAndes S.A.', 'activo')], [simulacion(1, 'FINALIZADA')]);
    fixture.componentInstance.boletinDisponible.set(true);
    fixture.componentInstance.abrirBoletin(1);
    fixture.detectChanges();
    http.expectOne({ method: 'GET', url: `${URL_CASOS}/1/boletin` }).flush({
      idCaso: 1,
      inflacion: 5.2,
      tasaInteres: 9.75,
      tasaCambio: 4150,
      nota: null,
      publicadoEn: '2026-10-01T08:00:00',
      actualizadoEn: '2026-10-01T08:00:00',
    });
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain('La simulación terminó');
    expect(host.textContent).not.toContain('Actualizar boletín');
    expect(host.textContent).not.toContain('Eliminar boletín');
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
    c.idSimulacion.set(2); // simulación sin casos: es el primero
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
    c.idSimulacion.set(2); // simulación sin casos: es el primero
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
    c.idSimulacion.set(2); // simulación sin casos: es el primero
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
    c.idSimulacion.set(2); // simulación sin casos: es el primero
    c.financiero.set({ ...BALANCE_CUADRADO, inventarios: '-250000', efectivo: '700000' });

    c.guardarCaso();

    expect(c.errorFormulario()).toContain('Inventarios');
    http.expectNone({ method: 'POST', url: URL_CASOS });
  });

  it('un % de impacto menor a -100 bloquea el guardado y lleva a la pestaña Opciones', () => {
    const fixture = crearFixture();
    const c = fixture.componentInstance;
    c.nuevoCaso();
    c.idSimulacion.set(2); // simulación sin casos: es el primero
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

  describe('caso siguiente (balance heredado)', () => {
    /** Caso siguiente tal como lo devuelve el backend: solo las 6 partidas del estado de resultados, totales de balance en null. */
    function casoSiguiente(id: number): CasoApi {
      const caso = casoApi(id, 'Caso 2');
      caso.esPrimerCaso = false;
      caso.financiero = {
        ...PARTIDAS_NULAS,
        activoTotal: null,
        pasivoTotal: null,
        patrimonio: null,
        utilidadNeta: 130000,
        ventasNetas: 1200000,
        costoVentas: 700000,
        gastosAdministracion: 150000,
        gastosVentas: 100000,
        gastosFinancieros: 50000,
        impuestoRenta: 70000,
      };
      return caso;
    }

    it('un caso nuevo en una simulación que ya tiene casos oculta Balance y Flujo y avisa que se hereda', () => {
      const fixture = crearFixture();
      const c = fixture.componentInstance;
      c.nuevoCaso();
      c.idSimulacion.set(1);
      c.tabForm.set('financiera');
      fixture.detectChanges();

      expect(c.esPrimerCaso()).toBe(false);
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.fin-subtabs')).toBeNull();
      expect(el.querySelector('.fin-indicadores')).toBeNull();
      expect(el.textContent).toContain('El balance se hereda');
      expect(el.textContent).toContain('Ventas netas');
      expect(el.textContent).not.toContain('Cuentas por cobrar');
    });

    it('en una simulación sin casos, el caso nuevo es el primero (las 19 partidas, como siempre)', () => {
      const fixture = crearFixture();
      const c = fixture.componentInstance;
      c.nuevoCaso();
      c.idSimulacion.set(2);
      c.tabForm.set('financiera');
      fixture.detectChanges();

      expect(c.esPrimerCaso()).toBe(true);
      expect((fixture.nativeElement as HTMLElement).querySelector('.fin-subtabs')).toBeTruthy();
    });

    it('solo exige las 6 del estado de resultados, sin cuadre, y manda solo esas 6', () => {
      const fixture = crearFixture();
      const c = fixture.componentInstance;
      c.nuevoCaso();
      c.idSimulacion.set(1);

      c.guardarCaso();
      expect(c.errorFormulario()).toContain('6 partidas del Estado de Resultados');
      http.expectNone({ method: 'POST', url: URL_CASOS });

      c.financiero.set({ ...BALANCE_CUADRADO, efectivo: '', inventarios: '-1' });
      c.guardarCaso();

      const peticion = http.expectOne({ method: 'POST', url: URL_CASOS });
      expect(peticion.request.body.financiero).toEqual({
        ventasNetas: 1200000,
        costoVentas: 700000,
        gastosAdministracion: 150000,
        gastosVentas: 100000,
        gastosFinancieros: 50000,
        impuestoRenta: 70000,
      });
      peticion.flush(casoSiguiente(5));
      http.expectOne({ method: 'GET', url: URL_CASOS }).flush([]);
    });

    it('"Editar" un caso siguiente usa esPrimerCaso del backend y deja guardar con solo las 6', () => {
      const fixture = crearFixture([casoApi(1, 'Caso 1'), casoSiguiente(2)]);
      const c = fixture.componentInstance;
      c.editarCaso(2);

      expect(c.esPrimerCaso()).toBe(false);
      expect(c.totalesAnteriores()).toBeNull();
      expect(c.financiero().ventasNetas).toBe('1200000');

      c.guardarCaso();

      const peticion = http.expectOne({ method: 'PUT', url: `${URL_CASOS}/2` });
      expect(Object.keys(peticion.request.body.financiero)).toHaveLength(6);
      peticion.flush(casoSiguiente(2));
      http.expectOne({ method: 'GET', url: URL_CASOS }).flush([]);
    });

    it('la vista previa del impacto solo muestra la utilidad neta (el balance es de cada empresa)', () => {
      const fixture = crearFixture();
      const c = fixture.componentInstance;
      c.nuevoCaso();
      c.idSimulacion.set(1);
      c.financiero.set(BALANCE_CUADRADO);
      c.actualizarOpcionImpacto(c.opciones()[0].id, {
        ...c.opciones()[0].impacto,
        ventasNetas: { tipo: 'porcentaje', valor: '10' },
      });
      c.tabForm.set('opciones');
      fixture.detectChanges();

      const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(texto).toContain('Utilidad neta pasa de');
      expect(texto).not.toContain('Efectivo pasa de');
      expect(texto).toContain('Ilustrativo');
    });

    it('si el backend todavía no manda esPrimerCaso, todo caso se trata como primero (como antes)', () => {
      const sinCampo = casoApi(1, 'Sin D2') as Partial<CasoApi>;
      delete sinCampo.esPrimerCaso;
      const fixture = crearFixture([sinCampo as CasoApi]);
      const c = fixture.componentInstance;
      c.nuevoCaso();
      c.idSimulacion.set(1);

      expect(c.esPrimerCaso()).toBe(true);
    });

    // -- Simulación sin casos / sin simulación elegida --

    it('sin simulación elegida todavía, el formulario arranca como primer caso', () => {
      const fixture = crearFixture();
      fixture.componentInstance.nuevoCaso();

      expect(fixture.componentInstance.idSimulacion()).toBeNull();
      expect(fixture.componentInstance.esPrimerCaso()).toBe(true);
    });

    it('sin ningún caso en todo el sistema, el caso nuevo es el primero', () => {
      const fixture = crearFixture([]);
      const c = fixture.componentInstance;
      c.nuevoCaso();
      c.idSimulacion.set(1);

      expect(c.esPrimerCaso()).toBe(true);
    });

    it('cambiar de simulación en el formulario cambia el modo (con casos -> siguiente, sin casos -> primero)', () => {
      const fixture = crearFixture();
      const c = fixture.componentInstance;
      c.nuevoCaso();
      c.tabForm.set('financiera');

      c.idSimulacion.set(1);
      fixture.detectChanges();
      expect(c.esPrimerCaso()).toBe(false);
      expect((fixture.nativeElement as HTMLElement).querySelector('.fin-subtabs')).toBeNull();

      c.idSimulacion.set(2);
      fixture.detectChanges();
      expect(c.esPrimerCaso()).toBe(true);
      expect((fixture.nativeElement as HTMLElement).querySelector('.fin-subtabs')).toBeTruthy();
    });

    it('una simulación recién creada con "+ Nueva simulación" no tiene casos: el caso nuevo es el primero', () => {
      const fixture = crearFixture();
      const c = fixture.componentInstance;
      c.nuevoCaso();
      c.abrirNuevaSimulacion();
      c.nuevaSimNombre.set('Nueva');
      c.nuevaSimInicio.set('2026-10-05T08:00');
      c.crearSimulacion();
      http.expectOne({ method: 'POST', url: URL_SIMULACIONES }).flush(simulacion(7, 'BORRADOR'));

      expect(c.idSimulacion()).toBe(7);
      expect(c.esPrimerCaso()).toBe(true);
    });

    // -- Al editar manda el flag del backend, no el conteo --

    it('"Editar" el primer caso de una simulación con otros casos sigue exigiendo las 19 y el cuadre', () => {
      const fixture = crearFixture([casoApi(1, 'Caso 1'), casoSiguiente(2)]);
      const c = fixture.componentInstance;
      c.editarCaso(1);
      expect(c.esPrimerCaso()).toBe(true);

      c.financiero.set({ ...BALANCE_CUADRADO, efectivo: '230000' });
      c.guardarCaso();
      expect(c.errorFormulario()).toContain('no cuadra');
      http.expectNone({ method: 'PUT', url: `${URL_CASOS}/1` });

      c.financiero.set(BALANCE_CUADRADO);
      c.guardarCaso();
      const peticion = http.expectOne({ method: 'PUT', url: `${URL_CASOS}/1` });
      expect(Object.keys(peticion.request.body.financiero).sort()).toEqual([...CAMPOS_FINANCIEROS].sort());
      peticion.flush(casoApi(1, 'Caso 1'));
      http.expectOne({ method: 'GET', url: URL_CASOS }).flush([]);
    });

    it('al pasar de editar un caso siguiente a "+ Nuevo caso" en una simulación vacía, vuelve al modo primero', () => {
      const fixture = crearFixture([casoApi(1, 'Caso 1'), casoSiguiente(2)]);
      const c = fixture.componentInstance;
      c.editarCaso(2);
      expect(c.esPrimerCaso()).toBe(false);

      c.volverALista();
      c.nuevoCaso();
      c.idSimulacion.set(2);
      expect(c.esPrimerCaso()).toBe(true);
    });

    // -- Transición: backend sin esPrimerCaso --

    it('transición: si un solo caso de la lista viene sin esPrimerCaso, todo se trata como primero', () => {
      const sinCampo = casoApi(3, 'Sin D2') as Partial<CasoApi>;
      delete sinCampo.esPrimerCaso;
      const fixture = crearFixture([casoApi(1, 'Caso 1'), casoSiguiente(2), sinCampo as CasoApi]);
      const c = fixture.componentInstance;

      c.editarCaso(2);
      expect(c.esPrimerCaso()).toBe(true);
    });

    it('transición: sin esPrimerCaso, un caso nuevo exige las 19 + cuadre y manda las 19', () => {
      const sinCampo = casoApi(1, 'Sin D2') as Partial<CasoApi>;
      delete sinCampo.esPrimerCaso;
      const fixture = crearFixture([sinCampo as CasoApi]);
      const c = fixture.componentInstance;
      c.nuevoCaso();
      c.idSimulacion.set(1);
      c.financiero.set({ ...BALANCE_CUADRADO, efectivo: '' });

      c.guardarCaso();
      expect(c.errorFormulario()).toContain('Faltan: Efectivo');
      http.expectNone({ method: 'POST', url: URL_CASOS });

      c.financiero.set(BALANCE_CUADRADO);
      c.guardarCaso();
      const peticion = http.expectOne({ method: 'POST', url: URL_CASOS });
      expect(Object.keys(peticion.request.body.financiero)).toHaveLength(19);
      peticion.flush(casoApi(5, 'X'));
      http.expectOne({ method: 'GET', url: URL_CASOS }).flush([]);
    });

    // -- Validación de los 6 en casos siguientes --

    it('caso siguiente: si falta alguna de las 6, dice cuál (y no menciona las de balance)', () => {
      const fixture = crearFixture();
      const c = fixture.componentInstance;
      c.nuevoCaso();
      c.idSimulacion.set(1);
      c.financiero.set({ ...BALANCE_CUADRADO, costoVentas: '', efectivo: '' });

      c.guardarCaso();

      expect(c.errorFormulario()).toContain('Faltan: Costo de ventas.');
      expect(c.errorFormulario()).not.toContain('Efectivo');
      expect(c.tabForm()).toBe('financiera');
      http.expectNone({ method: 'POST', url: URL_CASOS });
    });

    it('caso siguiente: un negativo en una de las 6 bloquea el guardado', () => {
      const fixture = crearFixture();
      const c = fixture.componentInstance;
      c.nuevoCaso();
      c.idSimulacion.set(1);
      c.financiero.set({ ...BALANCE_CUADRADO, gastosVentas: '-100' });

      c.guardarCaso();

      expect(c.errorFormulario()).toContain('Gastos de ventas');
      http.expectNone({ method: 'POST', url: URL_CASOS });
    });

    it('caso siguiente: con balance descuadrado y negativos en el balance igual guarda (el balance no se manda)', () => {
      const fixture = crearFixture();
      const c = fixture.componentInstance;
      c.nuevoCaso();
      c.idSimulacion.set(1);
      c.financiero.set({ ...BALANCE_CUADRADO, efectivo: '999999', inventarios: '-5' });

      c.guardarCaso();

      const peticion = http.expectOne({ method: 'POST', url: URL_CASOS });
      expect(peticion.request.body.financiero.efectivo).toBeUndefined();
      expect(peticion.request.body.financiero.inventarios).toBeUndefined();
      peticion.flush(casoSiguiente(5));
      http.expectOne({ method: 'GET', url: URL_CASOS }).flush([]);
    });

    it('caso siguiente: "sin datos" para la vista previa mira solo las 6 (el balance cargado no cuenta)', () => {
      const fixture = crearFixture();
      const c = fixture.componentInstance;
      c.nuevoCaso();
      c.idSimulacion.set(1);
      c.financiero.update((f) => ({ ...f, efectivo: '200000' }));
      expect(c.financieroSinDatos()).toBe(true);

      c.financiero.update((f) => ({ ...f, ventasNetas: '1000' }));
      expect(c.financieroSinDatos()).toBe(false);
    });
  });

  describe('botón "Editar" según el estado de la simulación', () => {
    function botonesEditar(fixture: { nativeElement: unknown }): number {
      return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.acciones-caso button')).filter(
        (b) => b.textContent?.trim() === 'Editar',
      ).length;
    }

    it.each(['BORRADOR', 'PROGRAMADA'] as const)('aparece con la simulación en %s', (estado) => {
      const fixture = crearFixture([casoApi(1, 'Caso 1')], [simulacion(1, estado)]);
      expect(botonesEditar(fixture)).toBe(1);
    });

    it.each(['EN_CURSO', 'FINALIZADA'] as const)('no aparece con la simulación en %s', (estado) => {
      const fixture = crearFixture([casoApi(1, 'Caso 1')], [simulacion(1, estado)]);
      expect(botonesEditar(fixture)).toBe(0);
      // "Activar" no depende de esto: sigue disponible para el caso en borrador.
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Activar');
    });

    it('en una lista mixta, solo lo muestra en los casos de simulaciones editables', () => {
      const enCurso = casoApi(2, 'En curso');
      enCurso.idSimulacion = 2;
      const fixture = crearFixture([casoApi(1, 'Programada'), enCurso], [simulacion(1), simulacion(2, 'EN_CURSO')]);

      const filas = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.tabla-casos tbody tr'));
      expect(filas[0].textContent).toContain('Editar');
      expect(filas[1].textContent).not.toContain('Editar');
    });

    it('si la simulación no está en la lista (ej. falló el GET), deja el botón: el backend igual valida', () => {
      const fixture = crearFixture([casoApi(1, 'Caso 1')], []);
      expect(botonesEditar(fixture)).toBe(1);
    });
  });

  describe('"Activar" (cierra el caso activo de la misma simulación)', () => {
    afterEach(() => vi.restoreAllMocks());

    function fila(idEmpresa: number, decidio: boolean): DecisionEmpresa {
      return {
        idEmpresa,
        codigoEmpresa: `EMP-${idEmpresa}`,
        nombreEmpresa: `Empresa ${idEmpresa}`,
        decidio,
        idOpcion: null,
        opcion: null,
        resultado: null,
        decididaPor: null,
        fechaDecision: null,
      };
    }

    function activarYRefrescar() {
      http.expectOne({ method: 'POST', url: `${URL_CASOS}/2/activar` }).flush(casoApi(2, 'B', 'activo'));
      http
        .expectOne({ method: 'GET', url: URL_CASOS })
        .flush([casoApi(1, 'A', 'borrador'), casoApi(2, 'B', 'activo')]);
    }

    it('avisa cuántas empresas no decidieron y, si se confirma, activa y refresca la lista', () => {
      const fixture = crearFixture([casoApi(1, 'A', 'activo'), casoApi(2, 'B', 'borrador')]);
      const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);

      fixture.componentInstance.activarCaso(2);
      http
        .expectOne({ method: 'GET', url: `${URL_CASOS}/1/decisiones` })
        .flush([fila(1, true), fila(2, false), fila(3, false)]);

      expect(confirmar).toHaveBeenCalledWith(
        'Activar «B» cierra «A» ahora mismo. 2 empresas todavía no han decidido y recibirán la penalización.',
      );
      activarYRefrescar();
      const activos = fixture.componentInstance.casos().filter((c) => c.estado === 'activo');
      expect(activos.map((c) => c.id)).toEqual([2]);
      expect(fixture.componentInstance.activandoId()).toBeNull();
    });

    it('si todas decidieron basta con una confirmación simple', () => {
      const fixture = crearFixture([casoApi(1, 'A', 'activo'), casoApi(2, 'B', 'borrador')]);
      const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);

      fixture.componentInstance.activarCaso(2);
      http.expectOne({ method: 'GET', url: `${URL_CASOS}/1/decisiones` }).flush([fila(1, true), fila(2, true)]);

      expect(confirmar.mock.calls[0][0]).toBe('Activar «B» cierra «A» ahora mismo. Todas las empresas ya decidieron. ¿Continuar?');
      activarYRefrescar();
    });

    it('si el docente cancela, no activa nada', () => {
      const fixture = crearFixture([casoApi(1, 'A', 'activo'), casoApi(2, 'B', 'borrador')]);
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      fixture.componentInstance.activarCaso(2);
      http.expectOne({ method: 'GET', url: `${URL_CASOS}/1/decisiones` }).flush([fila(1, false)]);

      http.expectNone({ method: 'POST', url: `${URL_CASOS}/2/activar` });
      expect(fixture.componentInstance.activandoId()).toBeNull();
    });

    it('sin otro caso activo en esa simulación activa directo, sin preguntar', () => {
      const otraSim = { ...casoApi(1, 'A', 'activo'), idSimulacion: 2 };
      const fixture = crearFixture([otraSim, casoApi(2, 'B', 'borrador')]);
      const confirmar = vi.spyOn(window, 'confirm');

      fixture.componentInstance.activarCaso(2);

      expect(confirmar).not.toHaveBeenCalled();
      http.expectNone((r) => r.url.endsWith('/decisiones'));
      http.expectOne({ method: 'POST', url: `${URL_CASOS}/2/activar` }).flush(casoApi(2, 'B', 'activo'));
      http.expectOne({ method: 'GET', url: URL_CASOS }).flush([otraSim, casoApi(2, 'B', 'activo')]);
    });

    it('si no se pueden consultar las decisiones, igual advierte la penalización', () => {
      const fixture = crearFixture([casoApi(1, 'A', 'activo'), casoApi(2, 'B', 'borrador')]);
      const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);

      fixture.componentInstance.activarCaso(2);
      http
        .expectOne({ method: 'GET', url: `${URL_CASOS}/1/decisiones` })
        .flush(null, { status: 500, statusText: 'Server Error' });

      expect(confirmar.mock.calls[0][0]).toContain('No se pudo consultar cuántas empresas faltan');
      expect(confirmar.mock.calls[0][0]).toContain('recibirán la penalización');
    });

    it('si la fecha de fin del caso activo ya pasó (ya está cerrado), no cuenta pendientes', () => {
      const yaCerrado = { ...casoApi(1, 'A', 'activo'), fechaFinPartida: '2020-01-01T00:00:00' };
      const fixture = crearFixture([yaCerrado, casoApi(2, 'B', 'borrador')]);
      const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);

      fixture.componentInstance.activarCaso(2);

      http.expectNone((r) => r.url.endsWith('/decisiones'));
      expect(confirmar).toHaveBeenCalledWith('¿Activar «B»?');
      http.expectOne({ method: 'POST', url: `${URL_CASOS}/2/activar` }).flush(casoApi(2, 'B', 'activo'));
      http.expectOne({ method: 'GET', url: URL_CASOS }).flush([casoApi(2, 'B', 'activo')]);
    });
  });

  it('"+ Nueva simulación" crea la simulación en BORRADOR (sin programarla) y la deja seleccionada', () => {
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
    // Con el arranque automático, programarla acá la haría arrancar sola sin estar armada.
    http.expectNone({ method: 'POST', url: `${URL_SIMULACIONES}/7/programar` });
    fixture.detectChanges();

    expect(c.creandoSimulacion()).toBe(false);
    expect(c.idSimulacion()).toBe(7);
    expect(c.simulacionesDisponibles().map((s) => s.id)).toContain(7);
    expect(c.simulaciones().find((s) => s.id === 7)?.estado).toBe('BORRADOR');
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
