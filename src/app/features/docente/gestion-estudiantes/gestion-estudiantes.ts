import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { Alerta } from '../../../shared/components/alerta/alerta';
import { FormarEquipos } from '../equipos/equipos';
import {
  CargaMasivaRequest,
  CargaMasivaResponse,
  EstudianteCargado,
  FilaEstudianteExcel,
  FilaPrevisualizacion,
} from './models/estudiante.model';
import { EstudianteService } from './services/estudiante.service';
import { ExcelEstudiantesService } from './services/excel-estudiantes.service';

type EstadoPantalla = 'inicial' | 'previsualizando' | 'cargando' | 'resultado';
type Seccion = 'estudiantes' | 'equipos';

const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_SOLO_DIGITOS = /^[0-9]+$/;

/**
 * "Equipos y estudiantes" del docente (docs/03, docs/08 §2/§5).
 *
 * Tiene dos secciones, cada una en su propio componente (no se mezclan):
 *  - "Estudiantes": carga masiva por Excel (correo/nombre/identificación/edad/
 *    género — docs/08 §2) + tabla de los ya cargados (`EstudianteService.listar()`).
 *  - "Equipos": formar equipos a partir de esos estudiantes (`<app-formar-equipos>`).
 *    Distinto de la "asignación de equipos" del formulario de un Caso puntual.
 */
@Component({
  selector: 'app-gestion-estudiantes',
  imports: [Alerta, FormarEquipos],
  templateUrl: './gestion-estudiantes.html',
  styleUrl: './gestion-estudiantes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ExcelEstudiantesService],
})
export class GestionEstudiantes {
  private readonly excel = inject(ExcelEstudiantesService);
  private readonly estudiantes = inject(EstudianteService);

  readonly seccion = signal<Seccion>('estudiantes');

  readonly estado = signal<EstadoPantalla>('inicial');
  readonly nombreArchivo = signal<string | null>(null);
  readonly errorArchivo = signal<string | null>(null);
  readonly filas = signal<FilaPrevisualizacion[]>([]);
  readonly resultado = signal<CargaMasivaResponse | null>(null);

  /** Estudiantes ya cargados (solo informativo para el docente). */
  readonly yaCargados = signal<number>(this.estudiantes.contarExistentes());

  /** Listado completo de estudiantes ya cargados, para la tabla persistente. */
  readonly estudiantesCargados = signal<EstudianteCargado[]>([]);
  readonly cargandoListado = signal(false);

  readonly filasValidas = computed(() => this.filas().filter((f) => f.estado === 'ok'));
  readonly totalOk = computed(() => this.filasValidas().length);
  readonly totalError = computed(() => this.filas().length - this.totalOk());

  /** Encabezados extra detectados en el Excel (más allá de las 5 columnas mínimas). */
  readonly columnasExtra = computed<string[]>(() => {
    const claves = new Set<string>();
    for (const fila of this.filas()) {
      Object.keys(fila.columnasAdicionales).forEach((k) => claves.add(k));
    }
    return [...claves];
  });

  constructor() {
    this.cargarListado();
  }

  irA(seccion: Seccion): void {
    this.seccion.set(seccion);
  }

  async onArchivo(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) {
      return;
    }

    this.reiniciar();
    this.nombreArchivo.set(archivo.name);

    let filasCrudas: FilaEstudianteExcel[];
    try {
      filasCrudas = await this.excel.parsear(archivo);
    } catch (e) {
      this.errorArchivo.set(
        e instanceof Error ? e.message : 'No se pudo leer el archivo. ¿Es un Excel válido?',
      );
      input.value = '';
      return;
    }

    this.filas.set(this.construirPrevisualizacion(filasCrudas));
    this.estado.set('previsualizando');
    input.value = '';
  }

  confirmar(): void {
    const validas = this.filasValidas();
    if (validas.length === 0 || this.estado() === 'cargando') {
      return;
    }

    this.estado.set('cargando');

    const req: CargaMasivaRequest = {
      estudiantes: validas.map((f) => ({
        nombre: f.nombre,
        correo: f.correo,
        numeroIdentificacion: f.numeroIdentificacion,
        edad: f.edad,
        genero: f.genero,
        columnasAdicionales: f.columnasAdicionales,
      })),
    };

    this.estudiantes.cargaMasiva(req).subscribe({
      next: (res) => {
        this.resultado.set(res);
        this.yaCargados.update((n) => n + res.creados.length);
        this.estado.set('resultado');
        this.cargarListado();
      },
      error: (err: { message?: string }) => {
        this.errorArchivo.set(err?.message ?? 'No se pudo completar la carga.');
        this.estado.set('previsualizando');
      },
    });
  }

  reiniciar(): void {
    this.estado.set('inicial');
    this.nombreArchivo.set(null);
    this.errorArchivo.set(null);
    this.filas.set([]);
    this.resultado.set(null);
    this.yaCargados.set(this.estudiantes.contarExistentes());
  }

  // ---------------------------------------------------------------------------
  // Internos
  // ---------------------------------------------------------------------------

  private cargarListado(): void {
    this.cargandoListado.set(true);
    this.estudiantes.listar().subscribe((lista) => {
      this.estudiantesCargados.set(lista);
      this.cargandoListado.set(false);
    });
  }

  private construirPrevisualizacion(filas: FilaEstudianteExcel[]): FilaPrevisualizacion[] {
    const correosVistos = new Set<string>();

    return filas.map((fila) => {
      const errores: string[] = [];
      const correo = fila.correo.toLowerCase();

      if (!fila.nombre) {
        errores.push('Falta el nombre.');
      }
      if (!fila.correo) {
        errores.push('Falta el correo.');
      } else if (!RE_CORREO.test(fila.correo)) {
        errores.push('El correo no tiene un formato válido.');
      } else if (correosVistos.has(correo)) {
        errores.push('Correo repetido dentro del archivo.');
      }
      if (!fila.numeroIdentificacion) {
        errores.push('Falta el número de identificación.');
      } else if (!RE_SOLO_DIGITOS.test(fila.numeroIdentificacion)) {
        errores.push('El número de identificación debe contener solo dígitos.');
      }

      if (fila.correo && RE_CORREO.test(fila.correo)) {
        correosVistos.add(correo);
      }

      return {
        fila: fila.fila,
        nombre: fila.nombre,
        correo: fila.correo,
        numeroIdentificacion: fila.numeroIdentificacion,
        edad: fila.edad,
        genero: fila.genero,
        columnasAdicionales: fila.columnasAdicionales,
        estado: errores.length === 0 ? 'ok' : 'error',
        errores,
      };
    });
  }
}
