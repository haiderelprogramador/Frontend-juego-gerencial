import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { Alerta } from '../../../shared/components/alerta/alerta';
import {
  CargaMasivaRequest,
  CargaMasivaResponse,
  FilaEstudianteExcel,
  FilaPrevisualizacion,
} from './models/estudiante.model';
import { EstudianteService } from './services/estudiante.service';
import { ExcelEstudiantesService } from './services/excel-estudiantes.service';

type EstadoPantalla = 'inicial' | 'previsualizando' | 'cargando' | 'resultado';

const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_SOLO_DIGITOS = /^[0-9]+$/;

/**
 * Carga masiva de estudiantes por Excel (docs/03).
 *
 * Flujo: elegir archivo -> xlsx lo lee en el navegador -> se valida cada fila ->
 * se muestra la PREVISUALIZACIÓN -> el docente confirma -> `EstudianteService`
 * envía solo los datos del Excel; el backend (o el mock) asigna consecutivo y
 * contraseña (USU-###-<identificación>) y los devuelve en el resultado.
 */
@Component({
  selector: 'app-gestion-estudiantes',
  imports: [Alerta],
  templateUrl: './gestion-estudiantes.html',
  styleUrl: './gestion-estudiantes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ExcelEstudiantesService],
})
export class GestionEstudiantes {
  private readonly excel = inject(ExcelEstudiantesService);
  private readonly estudiantes = inject(EstudianteService);

  readonly estado = signal<EstadoPantalla>('inicial');
  readonly nombreArchivo = signal<string | null>(null);
  readonly errorArchivo = signal<string | null>(null);
  readonly filas = signal<FilaPrevisualizacion[]>([]);
  readonly resultado = signal<CargaMasivaResponse | null>(null);

  /** Estudiantes ya cargados (solo informativo para el docente). */
  readonly yaCargados = signal<number>(this.estudiantes.contarExistentes());

  readonly filasValidas = computed(() => this.filas().filter((f) => f.estado === 'ok'));
  readonly totalOk = computed(() => this.filasValidas().length);
  readonly totalError = computed(() => this.filas().length - this.totalOk());

  /** Encabezados extra detectados en el Excel (más allá de correo/nombre/identificación). */
  readonly columnasExtra = computed<string[]>(() => {
    const claves = new Set<string>();
    for (const fila of this.filas()) {
      Object.keys(fila.columnasAdicionales).forEach((k) => claves.add(k));
    }
    return [...claves];
  });

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
        columnasAdicionales: f.columnasAdicionales,
      })),
    };

    this.estudiantes.cargaMasiva(req).subscribe({
      next: (res) => {
        this.resultado.set(res);
        this.yaCargados.update((n) => n + res.creados.length);
        this.estado.set('resultado');
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
        columnasAdicionales: fila.columnasAdicionales,
        estado: errores.length === 0 ? 'ok' : 'error',
        errores,
      };
    });
  }
}
