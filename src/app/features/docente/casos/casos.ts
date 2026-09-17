import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { Badge } from '../../../shared/components/badge/badge';
import { Alerta } from '../../../shared/components/alerta/alerta';
import { ExcelCasoService } from './services/excel-caso.service';
import { Caso, CasoFormulario, OpcionCaso } from '../../simulacion/models/caso.model';
import { CasoService } from '../../simulacion/services/caso.service';

type VistaCasos = 'lista' | 'formulario';
type TabFormulario = 'general' | 'financiera' | 'opciones';
type ModoDatos = 'manual' | 'excel';

/**
 * Panel del docente → tab "Casos" (docs/00 🎨 Decisión del equipo: el caso lo
 * configura el docente en el sistema, no hay documento externo — docs/08 §7).
 *
 * Los casos viven en `CasoService` (providedIn: 'root'), el mismo servicio que
 * lee "Caso actual" del Estudiante — lo que se crea/edita/activa aquí se
 * refleja allá de inmediato. Capa visual/mock; sin lógica de negocio real.
 */
@Component({
  selector: 'app-casos',
  imports: [Badge, Alerta],
  templateUrl: './casos.html',
  styleUrl: './casos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ExcelCasoService],
})
export class Casos {
  private readonly excelCaso = inject(ExcelCasoService);
  private readonly casoService = inject(CasoService);

  readonly casos = this.casoService.casos;

  readonly vista = signal<VistaCasos>('lista');
  readonly tabForm = signal<TabFormulario>('general');
  /** `null` = creando un caso nuevo; con valor = editando ese caso existente. */
  readonly casoEnEdicionId = signal<string | null>(null);

  // -- Info general --
  readonly empresa = signal('');
  readonly mision = signal('');
  readonly vision = signal('');
  readonly tipo = signal('Manufactura');
  readonly penalizacionMin = signal(1);
  readonly penalizacionMax = signal(3);
  readonly fechaVisualizacion = signal('');
  readonly fechaInicioPartida = signal('');
  readonly fechaFinPartida = signal('');
  readonly asignacionEquipos = signal<'manual' | 'automatica'>('automatica');

  // -- Información financiera --
  readonly modoFinanciera = signal<ModoDatos>('manual');
  readonly activoTotal = signal('');
  readonly pasivoTotal = signal('');
  readonly patrimonio = signal('');
  readonly utilidadNeta = signal('');
  readonly errorImportFinanciero = signal<string | null>(null);

  // -- Opciones --
  readonly modoOpciones = signal<ModoDatos>('manual');
  readonly opciones = signal<OpcionCaso[]>([{ id: 'op-1', opcion: '', resultado: '' }]);
  readonly errorImportOpciones = signal<string | null>(null);

  nuevoCaso(): void {
    this.casoEnEdicionId.set(null);
    this.resetFormulario();
    this.vista.set('formulario');
    this.tabForm.set('general');
  }

  editarCaso(id: string): void {
    const caso = this.casoService.obtener(id);
    if (!caso) {
      return;
    }
    this.casoEnEdicionId.set(id);
    this.cargarFormulario(caso);
    this.vista.set('formulario');
    this.tabForm.set('general');
  }

  /** Marca el caso como activo — el que verán los estudiantes en "Caso actual". */
  activarCaso(id: string): void {
    this.casoService.activar(id);
  }

  guardarCaso(): void {
    const idEnEdicion = this.casoEnEdicionId();
    // Conserva el estado (activo/borrador) que ya tenía si se está editando;
    // un caso nuevo nace en borrador (se activa aparte, con "Activar").
    const estado = idEnEdicion ? (this.casoService.obtener(idEnEdicion)?.estado ?? 'borrador') : 'borrador';

    const datos: CasoFormulario = {
      nombre: this.empresa().trim() || 'Caso sin nombre',
      tipo: this.tipo(),
      estado,
      mision: this.mision(),
      vision: this.vision(),
      penalizacionMin: this.penalizacionMin(),
      penalizacionMax: this.penalizacionMax(),
      fechaVisualizacion: this.fechaVisualizacion(),
      fechaInicioPartida: this.fechaInicioPartida(),
      fechaFinPartida: this.fechaFinPartida(),
      asignacionEquipos: this.asignacionEquipos(),
      financiero: {
        activoTotal: this.activoTotal(),
        pasivoTotal: this.pasivoTotal(),
        patrimonio: this.patrimonio(),
        utilidadNeta: this.utilidadNeta(),
      },
      opciones: this.opciones().filter((o) => o.opcion.trim() !== ''),
    };

    if (idEnEdicion) {
      this.casoService.actualizar(idEnEdicion, datos);
    } else {
      this.casoService.crear(datos);
    }
    this.volverALista();
  }

  volverALista(): void {
    this.vista.set('lista');
  }

  agregarOpcion(): void {
    const n = this.opciones().length + 1;
    this.opciones.update((ops) => [...ops, { id: `op-${n}`, opcion: '', resultado: '' }]);
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

  /**
   * Importa Activo/Pasivo/Patrimonio/Utilidad neta desde un Excel y precarga
   * los campos manuales (el docente puede seguir ajustándolos a mano después).
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
      this.activoTotal.set(datos.activoTotal);
      this.pasivoTotal.set(datos.pasivoTotal);
      this.patrimonio.set(datos.patrimonio);
      this.utilidadNeta.set(datos.utilidadNeta);
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
      this.opciones.set(filas.map((f, i) => ({ id: `op-${i + 1}`, opcion: f.opcion, resultado: f.resultado })));
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

  private resetFormulario(): void {
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
    this.activoTotal.set('');
    this.pasivoTotal.set('');
    this.patrimonio.set('');
    this.utilidadNeta.set('');
    this.modoOpciones.set('manual');
    this.opciones.set([{ id: 'op-1', opcion: '', resultado: '' }]);
    this.errorImportFinanciero.set(null);
    this.errorImportOpciones.set(null);
  }

  private cargarFormulario(caso: Caso): void {
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
    this.activoTotal.set(caso.financiero.activoTotal);
    this.pasivoTotal.set(caso.financiero.pasivoTotal);
    this.patrimonio.set(caso.financiero.patrimonio);
    this.utilidadNeta.set(caso.financiero.utilidadNeta);
    this.modoOpciones.set('manual');
    this.opciones.set(
      caso.opciones.length > 0 ? caso.opciones : [{ id: 'op-1', opcion: '', resultado: '' }],
    );
    this.errorImportFinanciero.set(null);
    this.errorImportOpciones.set(null);
  }
}
