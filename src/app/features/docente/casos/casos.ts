import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';

import { API_CONFIG } from '../../../core/api/api.config';
import { Badge } from '../../../shared/components/badge/badge';
import { Alerta } from '../../../shared/components/alerta/alerta';
import { LiquidGlassDirective } from '../../../shared/directives/liquid-glass.directive';
import { formatearFechaBogota } from '../../../shared/utils/fecha-bogota';
import { ExcelCasoService } from './services/excel-caso.service';
import {
  AsignacionEquiposCaso,
  CasoApi,
  CasoRequest,
  FinancieroCaso as FinancieroCasoTotales,
} from '../../simulacion/models/caso-api.model';
import {
  CAMPOS_ESTADO_RESULTADOS,
  CAMPOS_FINANCIEROS,
  CampoFinanciero,
  ETIQUETAS_FINANCIERO,
  FinancieroTexto,
  ImpactoTexto,
  calcularFinanciero,
  camposConSignoInvalido,
  camposSinCompletar,
  financieroANumeros,
  financieroDesdeApi,
  financieroEstaVacio,
  financieroVacio,
  driversConPorcentajeInvalido,
  estadoResultadosDe,
  impactoANumeros,
  impactoDesdeApi,
  impactoVacio,
} from '../../simulacion/models/financiero.model';
import { BoletinCaso } from './boletin-caso/boletin-caso';
import { FinancieroCaso } from './financiero-caso/financiero-caso';
import { ImpactoFinancieroOpcion } from './impacto-opcion/impacto-opcion';
import { CasoApiService } from './services/caso-api.service';
import { CierreCasoService } from './services/cierre-caso.service';
import { Simulacion, SimulacionRequest } from '../simulaciones/models/simulacion.model';
import { validarFechasSimulacion } from '../simulaciones/models/fechas-simulacion';
import { SimulacionService } from '../simulaciones/services/simulacion.service';

type VistaCasos = 'lista' | 'formulario' | 'boletin';
type TabFormulario = 'general' | 'financiera' | 'opciones';
type ModoDatos = 'manual' | 'excel';
type ErrorHttp = { message?: string; error?: { message?: string } };

/** Fila de opción editable en el formulario: `id` es solo una clave de UI
 * (para el trackBy); el backend asigna su propio id/orden al guardar. */
interface OpcionEdit {
  id: string;
  opcion: string;
  resultado: string;
  /** Impacto financiero declarado (opcional); un driver sin valor no tiene efecto. */
  impacto: ImpactoTexto;
}

function opcionVacia(id: string): OpcionEdit {
  return { id, opcion: '', resultado: '', impacto: impactoVacio() };
}

function mensaje(err: ErrorHttp, porDefecto: string): string {
  return err?.error?.message ?? err?.message ?? porDefecto;
}

/** Agrega los segundos que pide el backend a un valor de `<input type="datetime-local">`. */
function conSegundos(valor: string): string {
  return valor.length === 16 ? `${valor}:00` : valor;
}

/**
 * Panel del docente → tab "Casos" (docs/00 🎨 Decisión del equipo: el caso lo
 * configura el docente en el sistema, no hay documento externo — docs/08 §7).
 *
 * Conectado al backend real: `CasoApiService` (`/docente/casos`) y
 * `SimulacionService` (`/docente/simulaciones`): pobla el selector de
 * simulación al crear un caso (`CasoRequest` exige `idSimulacion`) y permite
 * crear una simulación nueva desde ese mismo selector ("+ Nueva simulación"),
 * que es el único lugar de la app donde el docente da de alta simulaciones.
 */
@Component({
  selector: 'app-casos',
  imports: [Badge, Alerta, BoletinCaso, FinancieroCaso, ImpactoFinancieroOpcion, LiquidGlassDirective],
  templateUrl: './casos.html',
  styleUrl: './casos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ExcelCasoService],
})
export class Casos {
  private readonly excelCaso = inject(ExcelCasoService);
  private readonly casoApi = inject(CasoApiService);
  private readonly cierreCaso = inject(CierreCasoService);
  private readonly simulacionService = inject(SimulacionService);

  readonly casos = signal<CasoApi[]>([]);
  readonly simulaciones = signal<Simulacion[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  /** Caso que se está activando (confirmación + POST), para no disparar dos veces. */
  readonly activandoId = signal<number | null>(null);
  /** Error de la lista (carga inicial o activar), separado del error del formulario. */
  readonly error = signal<string | null>(null);
  readonly errorFormulario = signal<string | null>(null);
  /** Error al listar simulaciones (si no, un 401/500 se vería igual que "no hay ninguna"). */
  readonly errorSimulaciones = signal<string | null>(null);

  // -- Alta rápida de simulación (panel dentro del selector del formulario) --
  readonly creandoSimulacion = signal(false);
  readonly guardandoSimulacion = signal(false);
  readonly errorNuevaSimulacion = signal<string | null>(null);
  readonly nuevaSimNombre = signal('');
  readonly nuevaSimInicio = signal('');
  readonly nuevaSimFin = signal('');

  /** Simulaciones donde el backend permite crear un caso (400 en cualquier otro estado). */
  readonly simulacionesDisponibles = computed(() =>
    this.simulaciones().filter((s) => s.estado === 'BORRADOR' || s.estado === 'PROGRAMADA'),
  );

  readonly vista = signal<VistaCasos>('lista');
  /** Hasta que los endpoints del boletín (D14) estén en develop, el botón no se muestra. */
  readonly boletinDisponible = signal<boolean>(API_CONFIG.disponible.boletin);
  /** Caso cuyo boletín se está editando (vista 'boletin'). */
  readonly casoBoletin = signal<CasoApi | null>(null);
  readonly tabForm = signal<TabFormulario>('general');
  /** `null` = creando un caso nuevo; con valor = editando ese caso existente. */
  readonly casoEnEdicionId = signal<number | null>(null);

  /** Indicador elástico Liquid Glass para las sub-pestañas del formulario de casos */
  readonly subtabsContainer = viewChild<ElementRef<HTMLElement>>('subtabsContainer');
  readonly subtabLeft = signal<number>(0);
  readonly subtabWidth = signal<number>(0);
  readonly subtabOpacity = signal<number>(0);
  readonly isSubtabMoving = signal<boolean>(false);
  private subtabTimer: ReturnType<typeof setTimeout> | null = null;

  // -- Info general --
  readonly idSimulacion = signal<number | null>(null);
  readonly empresa = signal('');
  readonly mision = signal('');
  readonly vision = signal('');
  readonly tipo = signal('Manufactura');
  readonly penalizacionMin = signal(1);
  readonly penalizacionMax = signal(3);
  readonly fechaVisualizacion = signal('');
  readonly fechaInicioPartida = signal('');
  readonly fechaFinPartida = signal('');
  readonly asignacionEquipos = signal<AsignacionEquiposCaso>('automatica');

  // -- Información financiera: las 19 partidas (texto de formulario) --
  readonly modoFinanciera = signal<ModoDatos>('manual');
  readonly financiero = signal<FinancieroTexto>(financieroVacio());
  /** Solo para casos creados antes del modelo detallado (partidas en null): sus 4 totales viejos. */
  readonly totalesAnteriores = signal<FinancieroCasoTotales | null>(null);
  /**
   * `true`: primer caso de la simulación (las 19 partidas + cuadre, como
   * siempre). `false`: caso siguiente, cuyo balance se hereda por empresa, así
   * que solo se cargan las 6 partidas del estado de resultados.
   * - Al editar: `esPrimerCaso` del backend. Nunca se infiere por fechas.
   * - Al crear: primero si la simulación elegida todavía no tiene casos.
   * - Si el backend todavía no manda `esPrimerCaso` (antes del deploy de D2),
   *   todo caso se trata como primero, igual que antes.
   */
  readonly esPrimerCaso = computed(() => {
    const casos = this.casos();
    if (casos.some((c) => typeof c.esPrimerCaso !== 'boolean')) {
      return true;
    }
    const idEnEdicion = this.casoEnEdicionId();
    if (idEnEdicion != null) {
      return casos.find((c) => c.id === idEnEdicion)?.esPrimerCaso ?? true;
    }
    // TODO: confirmar con el cliente qué hacer si el caso nuevo queda con fecha anterior al primero
    // (el backend respondería 400 pidiendo las 19 partidas, y aquí estarían ocultas).
    const idSim = this.idSimulacion();
    return idSim == null || !casos.some((c) => c.idSimulacion === idSim);
  });
  /** Las partidas que el docente carga en este caso: las 19, o solo las 6 del estado de resultados. */
  readonly camposRequeridos = computed<readonly CampoFinanciero[]>(() =>
    this.esPrimerCaso() ? CAMPOS_FINANCIEROS : CAMPOS_ESTADO_RESULTADOS,
  );
  /** Partidas del caso en número: base de los totales y de la vista previa de impacto de cada opción. */
  readonly baseFinanciera = computed(() => financieroANumeros(this.financiero()));
  readonly financieroSinDatos = computed(() =>
    this.camposRequeridos().every((c) => this.financiero()[c].trim() === ''),
  );
  readonly resultadoFinanciero = computed(() => calcularFinanciero(this.baseFinanciera()));
  readonly errorImportFinanciero = signal<string | null>(null);

  // -- Opciones --
  readonly modoOpciones = signal<ModoDatos>('manual');
  readonly opciones = signal<OpcionEdit[]>([opcionVacia('op-1')]);
  readonly errorImportOpciones = signal<string | null>(null);

  constructor() {
    this.cargarCasos();
    this.cargarSimulaciones();

    // Un error de guardado (del cliente o un 400 del backend) deja de aplicar
    // en cuanto el docente corrige el formulario: no dejarlo colgado al lado
    // del aviso verde de "el balance cuadra".
    effect(() => {
      this.financiero();
      this.opciones();
      untracked(() => this.errorFormulario.set(null));
    });

    effect(() => {
      const v = this.vista();
      const t = this.tabForm();
      if (v === 'formulario' && t) {
        setTimeout(() => this.updateSubtabIndicator(), 25);
      }
    });
  }

  cambiarTabForm(tab: TabFormulario, event?: MouseEvent): void {
    this.tabForm.set(tab);
    if (event?.currentTarget) {
      this.isSubtabMoving.set(true);
      if (this.subtabTimer) clearTimeout(this.subtabTimer);
      this.subtabTimer = setTimeout(() => {
        this.isSubtabMoving.set(false);
      }, 460);
      this.updateSubtabIndicator(event.currentTarget as HTMLElement);
    }
  }

  irAPasoSiguiente(): void {
    const actual = this.tabForm();
    if (actual === 'general') {
      if (!this.casoEnEdicionId() && this.idSimulacion() == null) {
        this.errorFormulario.set('Elegí la simulación para este caso.');
        return;
      }
      this.errorFormulario.set(null);
      this.animarCambioSubtab('financiera');
    } else if (actual === 'financiera') {
      const errorFinanciero = this.validarFinanciero();
      if (errorFinanciero) {
        this.errorFormulario.set(errorFinanciero);
        return;
      }
      this.errorFormulario.set(null);
      this.animarCambioSubtab('opciones');
    }
  }

  irAPasoAnterior(): void {
    const actual = this.tabForm();
    this.errorFormulario.set(null);
    if (actual === 'opciones') {
      this.animarCambioSubtab('financiera');
    } else if (actual === 'financiera') {
      this.animarCambioSubtab('general');
    }
  }

  private animarCambioSubtab(destino: TabFormulario): void {
    this.isSubtabMoving.set(true);
    if (this.subtabTimer) clearTimeout(this.subtabTimer);
    this.subtabTimer = setTimeout(() => {
      this.isSubtabMoving.set(false);
    }, 460);
    this.tabForm.set(destino);
    setTimeout(() => this.updateSubtabIndicator(), 20);
  }

  updateSubtabIndicator(targetBtn?: HTMLElement): void {
    const container = this.subtabsContainer()?.nativeElement;
    if (!container) return;

    const btn = targetBtn ?? (container.querySelector('button.is-active') as HTMLElement | null);
    if (!btn) {
      this.subtabOpacity.set(0);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const left = btnRect.left - containerRect.left + container.scrollLeft;
    const width = btn.offsetWidth || btnRect.width;

    if (this.subtabOpacity() > 0 && Math.abs(left - this.subtabLeft()) > 3) {
      this.isSubtabMoving.set(true);
      if (this.subtabTimer) clearTimeout(this.subtabTimer);
      this.subtabTimer = setTimeout(() => {
        this.isSubtabMoving.set(false);
      }, 460);
    }

    this.subtabLeft.set(left);
    this.subtabWidth.set(width);
    this.subtabOpacity.set(1);
  }

  abrirNuevaSimulacion(): void {
    this.nuevaSimNombre.set('');
    this.nuevaSimInicio.set('');
    this.nuevaSimFin.set('');
    this.errorNuevaSimulacion.set(null);
    this.creandoSimulacion.set(true);
  }

  cancelarNuevaSimulacion(): void {
    this.creandoSimulacion.set(false);
  }

  /**
   * Crea la simulación en BORRADOR y la deja seleccionada en el formulario
   * del caso. NO la programa: con el arranque automático, una simulación
   * PROGRAMADA pasa sola a EN_CURSO en su fecha de inicio, aunque el docente
   * no haya terminado de armarla. Se programa desde el panel (paso 4).
   */
  crearSimulacion(): void {
    if (this.guardandoSimulacion()) {
      return;
    }
    const nombre = this.nuevaSimNombre().trim();
    const inicio = this.nuevaSimInicio();
    const fin = this.nuevaSimFin();
    const error = validarFechasSimulacion(nombre, inicio, fin);
    if (error) {
      this.errorNuevaSimulacion.set(error);
      return;
    }
    // Fechas de día tal cual, sin toISOString() (ver fechas-simulacion.ts).
    const req: SimulacionRequest = { nombre, fechaInicio: inicio, ...(fin ? { fechaFin: fin } : {}) };

    this.errorNuevaSimulacion.set(null);
    this.guardandoSimulacion.set(true);
    this.simulacionService.crear(req).subscribe({
      next: (creada) => this.simulacionCreada(creada),
      error: (err: ErrorHttp) => {
        this.guardandoSimulacion.set(false);
        this.errorNuevaSimulacion.set(mensaje(err, 'No se pudo crear la simulación.'));
      },
    });
  }

  /** Nombre de la simulación dueña de un caso, para la columna de la tabla. */
  nombreSimulacion(idSimulacion: number): string {
    return this.simulaciones().find((s) => s.id === idSimulacion)?.nombre ?? `Simulación #${idSimulacion}`;
  }

  /**
   * Un caso solo se edita con su simulación en BORRADOR o PROGRAMADA (contrato
   * D2: en EN_CURSO ya hay decisiones, sin excepciones). Si la simulación no
   * está en la lista (ej. falló el GET), se deja el botón: el backend igual lo valida.
   */
  puedeEditar(idSimulacion: number): boolean {
    const estado = this.simulaciones().find((s) => s.id === idSimulacion)?.estado;
    return estado == null || estado === 'BORRADOR' || estado === 'PROGRAMADA';
  }

  /** Con la simulación FINALIZADA el backend no deja editar el boletín: se abre de solo lectura. */
  simulacionFinalizada(idSimulacion: number): boolean {
    return this.simulaciones().find((s) => s.id === idSimulacion)?.estado === 'FINALIZADA';
  }

  nuevoCaso(): void {
    this.casoEnEdicionId.set(null);
    this.resetFormulario();
    this.vista.set('formulario');
    this.tabForm.set('general');
  }

  editarCaso(id: number): void {
    const caso = this.casos().find((c) => c.id === id);
    if (!caso) {
      return;
    }
    this.casoEnEdicionId.set(id);
    this.cargarFormulario(caso);
    this.vista.set('formulario');
    this.tabForm.set('general');
  }

  /**
   * Marca el caso como activo — el que verán los estudiantes en "Caso actual".
   * Si su simulación ya tiene otro caso activo, el backend lo cierra en ese
   * momento y penaliza a las empresas que no decidieron: antes se pide
   * confirmación diciendo cuántas son.
   */
  activarCaso(id: number): void {
    const caso = this.casos().find((c) => c.id === id);
    if (!caso || this.activandoId() !== null) {
      return;
    }
    const abierto =
      this.casos().find((c) => c.idSimulacion === caso.idSimulacion && c.estado === 'activo' && c.id !== id) ?? null;
    this.error.set(null);
    this.activandoId.set(id);
    this.cierreCaso.confirmar(`Activar «${caso.nombre}»`, abierto).subscribe((confirmado) => {
      if (!confirmado) {
        this.activandoId.set(null);
        return;
      }
      this.casoApi.activar(id).subscribe({
        next: () => {
          this.activandoId.set(null);
          this.cargarCasos();
        },
        error: (err: ErrorHttp) => {
          this.activandoId.set(null);
          this.error.set(mensaje(err, 'No se pudo activar el caso.'));
        },
      });
    });
  }

  guardarCaso(): void {
    if (this.guardando()) {
      return;
    }
    const idEnEdicion = this.casoEnEdicionId();
    if (!idEnEdicion && this.idSimulacion() == null) {
      this.errorFormulario.set('Elegí la simulación para este caso.');
      this.tabForm.set('general');
      return;
    }

    const errorFinanciero = this.validarFinanciero();
    if (errorFinanciero) {
      this.errorFormulario.set(errorFinanciero);
      this.tabForm.set('financiera');
      return;
    }

    const errorImpacto = this.validarImpactos();
    if (errorImpacto) {
      this.errorFormulario.set(errorImpacto);
      this.tabForm.set('opciones');
      return;
    }

    const req: CasoRequest = {
      idSimulacion: this.idSimulacion()!,
      nombre: this.empresa().trim() || 'Caso sin nombre',
      tipo: this.tipo(),
      mision: this.mision(),
      vision: this.vision(),
      // Primer caso: las 19 partidas. Siguientes: solo las 6 del estado de
      // resultados (el balance se hereda). Los totales los calcula el backend.
      financiero: this.esPrimerCaso() ? this.baseFinanciera() : estadoResultadosDe(this.baseFinanciera()),
      penalizacionMin: this.penalizacionMin(),
      penalizacionMax: this.penalizacionMax(),
      fechaVisualizacion: conSegundos(this.fechaVisualizacion()),
      fechaInicioPartida: conSegundos(this.fechaInicioPartida()),
      fechaFinPartida: conSegundos(this.fechaFinPartida()),
      asignacionEquipos: this.asignacionEquipos(),
      opciones: this.opciones()
        .filter((o) => o.opcion.trim() !== '')
        .map((o) => {
          const impacto = impactoANumeros(o.impacto);
          return Object.keys(impacto).length > 0
            ? { opcion: o.opcion, resultado: o.resultado, impacto }
            : { opcion: o.opcion, resultado: o.resultado };
        }),
    };

    this.errorFormulario.set(null);
    this.guardando.set(true);

    const guardado = idEnEdicion ? this.casoApi.actualizar(idEnEdicion, req) : this.casoApi.crear(req);

    guardado.subscribe({
      next: () => {
        this.guardando.set(false);
        this.cargarCasos();
        this.volverALista();
      },
      error: (err: ErrorHttp) => {
        this.guardando.set(false);
        this.errorFormulario.set(mensaje(err, 'No se pudo guardar el caso.'));
      },
    });
  }

  volverALista(): void {
    this.vista.set('lista');
    this.casoBoletin.set(null);
  }

  /**
   * Texto del botón del boletín, según `tieneBoletin` de la lista (no se pide
   * el boletín de cada caso). Con la simulación FINALIZADA se abre de solo
   * lectura. Si el backend no manda el campo, queda "Boletín".
   */
  etiquetaBoletin(c: CasoApi): string {
    if (this.simulacionFinalizada(c.idSimulacion)) {
      return c.tieneBoletin === false ? 'Sin boletín' : 'Ver boletín';
    }
    if (c.tieneBoletin === undefined) {
      return 'Boletín';
    }
    return c.tieneBoletin ? 'Boletín publicado' : 'Publicar boletín';
  }

  /** Lo avisa el boletín al cargarlo, publicarlo o eliminarlo: la lista queda al día sin recargarla. */
  marcarBoletin(idCaso: number, tiene: boolean): void {
    this.casos.update((lista) =>
      lista.map((c) => (c.id === idCaso && c.tieneBoletin !== tiene ? { ...c, tieneBoletin: tiene } : c)),
    );
  }

  abrirBoletin(id: number): void {
    const caso = this.casos().find((c) => c.id === id);
    if (!caso) {
      return;
    }
    this.casoBoletin.set(caso);
    this.vista.set('boletin');
  }

  agregarOpcion(): void {
    const n = this.opciones().length + 1;
    this.opciones.update((ops) => [...ops, opcionVacia(`op-${n}`)]);
  }

  quitarOpcion(id: string): void {
    this.opciones.update((ops) => (ops.length > 1 ? ops.filter((o) => o.id !== id) : ops));
  }

  actualizarOpcionTexto(id: string, valor: string): void {
    this.opciones.update((ops) => ops.map((o) => (o.id === id ? { ...o, opcion: valor } : o)));
  }

  actualizarOpcionResultado(id: string, valor: string): void {
    this.opciones.update((ops) => ops.map((o) => (o.id === id ? { ...o, resultado: valor } : o)));
  }

  actualizarOpcionImpacto(id: string, impacto: ImpactoTexto): void {
    this.opciones.update((ops) => ops.map((o) => (o.id === id ? { ...o, impacto } : o)));
  }

  /**
   * Importa las partidas financieras desde un Excel y precarga los campos
   * manuales (el docente puede seguir ajustándolos a mano después).
   */
  async onArchivoFinanciero(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) {
      return;
    }

    this.errorImportFinanciero.set(null);
    try {
      const datos = await this.excelCaso.parsearFinanciero(archivo);
      this.financiero.set(datos);
      this.modoFinanciera.set('manual');
    } catch (e) {
      this.errorImportFinanciero.set(
        e instanceof Error ? e.message : 'No se pudo leer el archivo. ¿Es un Excel válido?',
      );
    } finally {
      input.value = '';
    }
  }

  /** Importa filas "Opción"/"Resultado" desde un Excel y reemplaza el catálogo manual. */
  async onArchivoOpciones(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) {
      return;
    }

    this.errorImportOpciones.set(null);
    try {
      const filas = await this.excelCaso.parsearOpciones(archivo);
      this.opciones.set(
        filas.map((f, i) => ({ ...opcionVacia(`op-${i + 1}`), opcion: f.opcion, resultado: f.resultado })),
      );
      this.modoOpciones.set('manual');
    } catch (e) {
      this.errorImportOpciones.set(
        e instanceof Error ? e.message : 'No se pudo leer el archivo. ¿Es un Excel válido?',
      );
    } finally {
      input.value = '';
    }
  }

  // ---------------------------------------------------------------------------
  // Internos
  // ---------------------------------------------------------------------------

  /**
   * Mismas reglas que valida el backend (partidas obligatorias, signo por
   * partida y 400 "El balance no cuadra"), para no llegar al error sin saber
   * por qué. En un caso siguiente solo cuentan las 6 del estado de resultados
   * y no hay cuadre (el balance no lo carga el docente).
   */
  private validarFinanciero(): string | null {
    const partidas = this.financiero();
    const requeridos = new Set(this.camposRequeridos());
    const faltan = camposSinCompletar(partidas).filter((c) => requeridos.has(c));
    if (faltan.length > 0) {
      const nombres = faltan.map((c) => ETIQUETAS_FINANCIERO[c]);
      const lista = nombres.length > 3 ? `${nombres.slice(0, 3).join(', ')} y ${nombres.length - 3} más` : nombres.join(', ');
      const todas = faltan.length === requeridos.size;
      const cuales = !todas ? 'partidas' : this.esPrimerCaso() ? '19 partidas' : '6 partidas del Estado de Resultados';
      return `Completá las ${cuales} de Información Financiera (poné 0 si no aplica). Faltan: ${lista}.`;
    }
    const negativos = camposConSignoInvalido(financieroANumeros(partidas)).filter((c) => requeridos.has(c));
    if (negativos.length > 0) {
      const nombres = negativos.map((c) => ETIQUETAS_FINANCIERO[c]).join(', ');
      return `Estas partidas no pueden ser negativas: ${nombres}.`;
    }
    if (this.esPrimerCaso() && Math.abs(this.resultadoFinanciero().descuadre) >= 0.005) {
      return 'El balance no cuadra: el activo total tiene que ser igual a pasivo total + patrimonio.';
    }
    return null;
  }

  /** Espejo de la validación del backend: un % de impacto no puede ser menor a -100. */
  private validarImpactos(): string | null {
    const errores = this.opciones().flatMap((o, i) =>
      driversConPorcentajeInvalido(impactoANumeros(o.impacto)).map(
        (d) => `Opción ${i + 1}: ${ETIQUETAS_FINANCIERO[d]}`,
      ),
    );
    return errores.length > 0
      ? `Un impacto en porcentaje no puede ser menor a -100 (${errores.join('; ')}).`
      : null;
  }

  private cargarSimulaciones(): void {
    this.errorSimulaciones.set(null);
    this.simulacionService.listar().subscribe({
      next: (lista) => this.simulaciones.set(lista),
      error: (err: ErrorHttp) =>
        this.errorSimulaciones.set(mensaje(err, 'No se pudieron cargar las simulaciones.')),
    });
  }

  private simulacionCreada(sim: Simulacion): void {
    this.guardandoSimulacion.set(false);
    this.creandoSimulacion.set(false);
    this.simulaciones.update((lista) => [...lista.filter((s) => s.id !== sim.id), sim]);
    this.idSimulacion.set(sim.id);
  }

  private cargarCasos(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.casoApi.listar().subscribe({
      next: (lista) => {
        this.casos.set(lista);
        this.cargando.set(false);
      },
      error: (err: ErrorHttp) => {
        this.cargando.set(false);
        this.error.set(mensaje(err, 'No se pudieron cargar los casos.'));
      },
    });
  }

  private resetFormulario(): void {
    this.idSimulacion.set(null);
    this.empresa.set('');
    this.mision.set('');
    this.vision.set('');
    this.tipo.set('Manufactura');
    this.penalizacionMin.set(1);
    this.penalizacionMax.set(3);
    this.fechaVisualizacion.set('');
    this.fechaInicioPartida.set('');
    this.fechaFinPartida.set('');
    this.asignacionEquipos.set('automatica');
    this.modoFinanciera.set('manual');
    this.financiero.set(financieroVacio());
    this.totalesAnteriores.set(null);
    this.modoOpciones.set('manual');
    this.opciones.set([opcionVacia('op-1')]);
    this.errorImportFinanciero.set(null);
    this.errorImportOpciones.set(null);
    this.errorFormulario.set(null);
    this.creandoSimulacion.set(false);
  }

  private cargarFormulario(caso: CasoApi): void {
    this.idSimulacion.set(caso.idSimulacion);
    this.empresa.set(caso.nombre);
    this.mision.set(caso.mision);
    this.vision.set(caso.vision);
    this.tipo.set(caso.tipo);
    this.penalizacionMin.set(caso.penalizacionMin);
    this.penalizacionMax.set(caso.penalizacionMax);
    this.fechaVisualizacion.set(caso.fechaVisualizacion);
    this.fechaInicioPartida.set(caso.fechaInicioPartida);
    this.fechaFinPartida.set(caso.fechaFinPartida);
    this.asignacionEquipos.set(caso.asignacionEquipos);
    this.modoFinanciera.set('manual');
    const partidas = financieroDesdeApi(caso.financiero);
    this.financiero.set(partidas);
    // Sin ninguna partida = caso creado antes del modelo detallado.
    // (Los casos siguientes también pueden traer totales en null: ahí no hay totales viejos que mostrar.)
    const { activoTotal, pasivoTotal, patrimonio, utilidadNeta } = caso.financiero;
    this.totalesAnteriores.set(
      financieroEstaVacio(partidas) && activoTotal != null && pasivoTotal != null && patrimonio != null
        ? { activoTotal, pasivoTotal, patrimonio, utilidadNeta }
        : null,
    );
    this.modoOpciones.set('manual');
    this.opciones.set(
      caso.opciones.length > 0
        ? caso.opciones.map((o) => ({
            id: String(o.id),
            opcion: o.opcion,
            resultado: o.resultado,
            impacto: impactoDesdeApi(o.impacto),
          }))
        : [opcionVacia('op-1')],
    );
    this.errorImportFinanciero.set(null);
    this.errorImportOpciones.set(null);
    this.errorFormulario.set(null);
  }

  /**
   * "5 sept." a partir de una fecha del caso (hora de Bogotá, sin zona); si no
   * se puede interpretar, devuelve el texto tal cual.
   */
  fechaCorta(iso: string): string {
    return formatearFechaBogota(iso, { day: 'numeric', month: 'short' }) ?? iso;
  }
}
