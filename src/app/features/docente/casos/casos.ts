import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { Badge } from '../../../shared/components/badge/badge';
import { Alerta } from '../../../shared/components/alerta/alerta';
import { ExcelCasoService } from './services/excel-caso.service';

type VistaCasos = 'lista' | 'formulario';
type TabFormulario = 'general' | 'financiera' | 'opciones';
type ModoDatos = 'manual' | 'excel';

interface CasoResumen {
  id: string;
  nombre: string;
  tipo: string;
  estado: 'activo' | 'borrador';
}

interface OpcionCatalogo {
  id: string;
  opcion: string;
  resultado: string;
}

/**
 * Panel del docente → tab "Casos" (docs/00 🎨 Decisión del equipo: el caso lo
 * configura el docente en el sistema, no hay documento externo — docs/08 §7).
 * Capa visual con datos mock; sin lógica de negocio ni persistencia real.
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

  readonly vista = signal<VistaCasos>('lista');
  readonly tabForm = signal<TabFormulario>('general');

  readonly casos = signal<CasoResumen[]>([
    { id: '1', nombre: 'Expansión regional', tipo: 'Manufactura', estado: 'activo' },
    { id: '2', nombre: 'Crisis de proveedores', tipo: 'Retail', estado: 'borrador' },
  ]);

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
  readonly opciones = signal<OpcionCatalogo[]>([{ id: 'op-1', opcion: '', resultado: '' }]);
  readonly errorImportOpciones = signal<string | null>(null);

  nuevoCaso(): void {
    this.vista.set('formulario');
    this.tabForm.set('general');
  }

  editarCaso(): void {
    this.vista.set('formulario');
    this.tabForm.set('general');
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
}
