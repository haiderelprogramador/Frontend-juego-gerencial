import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';

import { Badge } from '../../../shared/components/badge/badge';
import { Alerta } from '../../../shared/components/alerta/alerta';
import { ExcelCasoService } from './services/excel-caso.service';
import {
  AsignacionEquiposCaso,
  CasoApi,
  CasoRequest,
  FinancieroCaso as FinancieroCasoTotales,
} from '../../simulacion/models/caso-api.model';
import {
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
  impactoANumeros,
  impactoDesdeApi,
  impactoVacio,
} from '../../simulacion/models/financiero.model';
import { FinancieroCaso } from './financiero-caso/financiero-caso';
import { ImpactoFinancieroOpcion } from './impacto-opcion/impacto-opcion';
import { CasoApiService } from './services/caso-api.service';
import { Simulacion, SimulacionRequest } from '../simulaciones/models/simulacion.model';
import { SimulacionService } from '../simulaciones/services/simulacion.service';

type VistaCasos = 'lista' | 'formulario';
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
  imports: [Badge, Alerta, FinancieroCaso, ImpactoFinancieroOpcion],
  templateUrl: './casos.html',
  styleUrl: './casos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ExcelCasoService],
})
export class Casos {
  private readonly excelCaso = inject(ExcelCasoService);
  private readonly casoApi = inject(CasoApiService);
  private readonly simulacionService = inject(SimulacionService);

  readonly casos = signal<CasoApi[]>([]);
  readonly simulaciones = signal<Simulacion[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
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
  readonly tabForm = signal<TabFormulario>('general');
  /** `null` = creando un caso nuevo; con valor = editando ese caso existente. */
  readonly casoEnEdicionId = signal<number | null>(null);

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
  /** Partidas del caso en número: base de los totales y de la vista previa de impacto de cada opción. */
  readonly baseFinanciera = computed(() => financieroANumeros(this.financiero()));
  readonly financieroSinDatos = computed(() => financieroEstaVacio(this.financiero()));
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
   * Crea la simulación y la programa de una vez (BORRADOR -> PROGRAMADA): no
   * hay otra pantalla que llame a `/programar`, y sin eso nunca se podría
   * iniciar. Al terminar la deja seleccionada en el formulario del caso.
   */
  crearSimulacion(): void {
    if (this.guardandoSimulacion()) {
      return;
    }
    const nombre = this.nuevaSimNombre().trim();
    const inicio = this.nuevaSimInicio();
    const fin = this.nuevaSimFin();
    if (!nombre || !inicio) {
      this.errorNuevaSimulacion.set('Poné un nombre y la fecha de inicio.');
      return;
    }
    if (fin && new Date(fin) <= new Date(inicio)) {
      this.errorNuevaSimulacion.set('La fecha de fin tiene que ser posterior a la de inicio.');
      return;
    }

    // Las fechas de Simulación sí se convierten bien desde UTC (ver
    // scripts/integration: el bug de zona horaria es solo de las fechas de Caso).
    const req: SimulacionRequest = {
      nombre,
      fechaInicio: new Date(inicio).toISOString(),
      ...(fin ? { fechaFin: new Date(fin).toISOString() } : {}),
    };

    this.errorNuevaSimulacion.set(null);
    this.guardandoSimulacion.set(true);
    this.simulacionService.crear(req).subscribe({
      next: (creada) =>
        this.simulacionService.programar(creada.id).subscribe({
          next: (programada) => this.simulacionCreada(programada),
          error: (err: ErrorHttp) => {
            // Quedó creada en BORRADOR: igual sirve para cargarle casos.
            this.simulacionCreada(creada);
            this.errorFormulario.set(
              mensaje(err, 'La simulación se creó, pero no se pudo programar.') +
                ' Quedó en borrador.',
            );
          },
        }),
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

  /** Marca el caso como activo — el que verán los estudiantes en "Caso actual". */
  activarCaso(id: number): void {
    this.error.set(null);
    this.casoApi.activar(id).subscribe({
      next: () => this.cargarCasos(),
      error: (err: ErrorHttp) => this.error.set(mensaje(err, 'No se pudo activar el caso.')),
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
      // Las 19 partidas; los 4 totales los calcula el backend.
      financiero: this.baseFinanciera(),
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
   * Mismas reglas que valida el backend (19 partidas obligatorias, signo por
   * partida y 400 "El balance no cuadra"), para no llegar al error sin saber
   * por qué.
   */
  private validarFinanciero(): string | null {
    const partidas = this.financiero();
    const faltan = camposSinCompletar(partidas);
    if (faltan.length > 0) {
      const nombres = faltan.map((c) => ETIQUETAS_FINANCIERO[c]);
      const lista = nombres.length > 3 ? `${nombres.slice(0, 3).join(', ')} y ${nombres.length - 3} más` : nombres.join(', ');
      return `Completá las ${faltan.length === 19 ? '19 partidas' : 'partidas'} de Información Financiera (poné 0 si no aplica). Faltan: ${lista}.`;
    }
    const negativos = camposConSignoInvalido(financieroANumeros(partidas));
    if (negativos.length > 0) {
      const nombres = negativos.map((c) => ETIQUETAS_FINANCIERO[c]).join(', ');
      return `Estas partidas no pueden ser negativas: ${nombres}.`;
    }
    if (Math.abs(this.resultadoFinanciero().descuadre) >= 0.005) {
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
    const { activoTotal, pasivoTotal, patrimonio, utilidadNeta } = caso.financiero;
    this.totalesAnteriores.set(
      financieroEstaVacio(partidas) ? { activoTotal, pasivoTotal, patrimonio, utilidadNeta } : null,
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
}
