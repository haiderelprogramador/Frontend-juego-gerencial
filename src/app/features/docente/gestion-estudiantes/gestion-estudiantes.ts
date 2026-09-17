import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { Curso } from '../../../core/models/curso.model';
import { CursoService } from '../../../core/services/curso.service';
import { Alerta } from '../../../shared/components/alerta/alerta';
import { Equipo, EquipoService } from '../equipos/services/equipo.service';
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
  imports: [Alerta],
  templateUrl: './gestion-estudiantes.html',
  styleUrl: './gestion-estudiantes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ExcelEstudiantesService],
})
export class GestionEstudiantes {
  private readonly excel = inject(ExcelEstudiantesService);
  private readonly estudiantes = inject(EstudianteService);
  private readonly cursosService = inject(CursoService);
  private readonly equipoService = inject(EquipoService);

  readonly cursos = this.cursosService.cursos;
  readonly cursoSeleccionado = signal<string | null>(null);
  readonly cursoActual = computed<Curso | null>(() => {
    const id = this.cursoSeleccionado();
    return id ? (this.cursos().find((curso) => curso.id === id) ?? null) : null;
  });

  readonly estado = signal<EstadoPantalla>('inicial');
  readonly nombreArchivo = signal<string | null>(null);
  readonly errorArchivo = signal<string | null>(null);
  readonly filas = signal<FilaPrevisualizacion[]>([]);
  readonly resultado = signal<CargaMasivaResponse | null>(null);

  /** Estudiantes ya cargados (solo informativo para el docente). */
  readonly yaCargados = signal(0);

  /** Listado completo de estudiantes ya cargados, para la tabla persistente. */
  readonly estudiantesCargados = signal<EstudianteCargado[]>([]);
  readonly cargandoListado = signal(false);
  readonly nombreCurso = signal('');
  readonly nombreNuevoEquipo = signal('');
  readonly tamanoEquipo = signal(4);
  readonly estudiantesSeleccionados = signal<string[]>([]);
  readonly menuCursoAbierto = signal<string | null>(null);
  readonly equipos = signal<Equipo[]>([]);
  readonly mensajeEquipo = signal<string | null>(null);
  readonly sinEquipo = computed(() => {
    const asignados = new Set(this.equipos().flatMap((equipo) => equipo.estudianteIds));
    return this.estudiantesCargados().filter((estudiante) => !asignados.has(estudiante.id));
  });

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
    // La pantalla inicia deliberadamente en el selector de cursos.
  }

  crearCurso(): void {
    const nombre = this.nombreCurso().trim();
    if (!nombre) {
      this.errorArchivo.set('Escribe un nombre para crear el curso.');
      return;
    }
    this.cursosService.crearCurso(nombre);
    this.nombreCurso.set('');
    this.errorArchivo.set(null);
  }

  alternarMenuCurso(cursoId: string): void {
    this.menuCursoAbierto.update((abierto) => (abierto === cursoId ? null : cursoId));
  }

  modificarNombreCurso(curso: Curso): void {
    const nombre = window.prompt('Nuevo nombre del curso:', curso.nombre)?.trim();
    if (!nombre) {
      return;
    }

    this.cursosService.modificarNombre(curso.id, nombre);
    this.menuCursoAbierto.set(null);
  }

  eliminarCurso(curso: Curso): void {
    const confirmado = window.confirm(
      `¿Eliminar "${curso.nombre}"? También se eliminarán sus estudiantes y equipos.`,
    );
    if (!confirmado) {
      return;
    }

    this.estudiantes.eliminarPorCurso(curso.id);
    this.equipoService.eliminarPorCurso(curso.id);
    this.cursosService.eliminarCurso(curso.id);
    this.menuCursoAbierto.set(null);

    if (this.cursoSeleccionado() === curso.id) {
      this.volverACursos();
    }
  }

  seleccionarCurso(cursoId: string): void {
    this.cursoSeleccionado.set(cursoId);
    this.equipoService.asignarEquiposSinCurso(cursoId);
    this.refrescarEquipos();
    this.reiniciar();
    this.cargarListado();
    this.estudiantes.prepararCurso(cursoId).subscribe(() => this.cargarListado());
  }

  volverACursos(): void {
    this.cursoSeleccionado.set(null);
    this.estudiantesCargados.set([]);
    this.estudiantesSeleccionados.set([]);
    this.equipos.set([]);
    this.mensajeEquipo.set(null);
    this.errorArchivo.set(null);
    this.reiniciar();
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
      cursoId: this.cursoSeleccionado() ?? undefined,
      estudiantes: validas.map((f) => ({
        nombre: f.nombre,
        correo: f.correo,
        numeroIdentificacion: f.numeroIdentificacion,
        edad: f.edad,
        genero: f.genero,
        columnasAdicionales: f.columnasAdicionales,
      })),
    };

    this.estudiantes.cargaMasiva(req, this.cursoSeleccionado() ?? undefined).subscribe({
      next: (res) => {
        this.resultado.set(res);
        this.yaCargados.set(
          this.estudiantes.contarExistentes(this.cursoSeleccionado() ?? undefined),
        );
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
    this.yaCargados.set(this.estudiantes.contarExistentes(this.cursoSeleccionado() ?? undefined));
  }

  // ---------------------------------------------------------------------------
  // Internos
  // ---------------------------------------------------------------------------

  private cargarListado(): void {
    this.cargandoListado.set(true);
    this.estudiantes.listar(this.cursoSeleccionado() ?? undefined).subscribe((lista) => {
      this.estudiantesCargados.set(lista);
      this.yaCargados.set(lista.length);
      this.cargandoListado.set(false);
    });
  }

  agregarManual(nombre: string, correo: string, identificacion: string): void {
    const cursoId = this.cursoSeleccionado();
    if (!cursoId || !nombre.trim() || !correo.trim() || !identificacion.trim()) {
      this.errorArchivo.set('Completa nombre, correo y número de identificación.');
      return;
    }
    this.estudiantes.agregarManual(cursoId, nombre, correo, identificacion);
    this.cargarListado();
  }

  crearEquipo(): void {
    const cursoId = this.cursoSeleccionado();
    const nombre = this.nombreNuevoEquipo().trim();
    const integrantes = this.estudiantesSeleccionados();

    if (!cursoId || !nombre || integrantes.length === 0) {
      this.errorArchivo.set(
        'Selecciona al menos un estudiante y escribe un nombre para crear el equipo.',
      );
      return;
    }

    this.equipoService.crearConIntegrantes(nombre, cursoId, integrantes);
    this.nombreNuevoEquipo.set('');
    this.estudiantesSeleccionados.set([]);
    this.errorArchivo.set(null);
    this.mensajeEquipo.set(`Equipo "${nombre}" creado con ${integrantes.length} integrante(s).`);
    this.refrescarEquipos();
  }

  alternarEstudiante(estudianteId: string): void {
    const seleccionados = this.estudiantesSeleccionados();
    this.estudiantesSeleccionados.set(
      seleccionados.includes(estudianteId)
        ? seleccionados.filter((id) => id !== estudianteId)
        : [...seleccionados, estudianteId],
    );
  }

  formarEquiposAutomaticamente(): void {
    const cursoId = this.cursoSeleccionado();
    const estudiantes = this.estudiantesCargados();
    const tamano = Math.max(2, Math.min(10, Number(this.tamanoEquipo()) || 4));

    if (!cursoId || estudiantes.length === 0) {
      this.errorArchivo.set('Necesitas estudiantes cargados para formar equipos.');
      return;
    }

    if (this.equipos().length === 0) {
      const cantidad = Math.ceil(estudiantes.length / tamano);
      for (let indice = 0; indice < cantidad; indice += 1) {
        this.equipoService.crear(`Equipo ${indice + 1}`, cursoId);
      }
    }

    this.equipoService.asignarAutomaticamente(
      estudiantes.map((estudiante) => estudiante.id),
      cursoId,
    );
    this.errorArchivo.set(null);
    this.mensajeEquipo.set('Los estudiantes fueron distribuidos en los equipos.');
    this.refrescarEquipos();
  }

  quitar(equipoId: string, estudianteId: string): void {
    this.equipoService.quitarEstudiante(equipoId, estudianteId);
    this.refrescarEquipos();
  }

  eliminarEquipo(equipoId: string): void {
    this.equipoService.eliminar(equipoId);
    this.refrescarEquipos();
  }

  nombrePor(estudianteId: string): string {
    return (
      this.estudiantesCargados().find((estudiante) => estudiante.id === estudianteId)?.nombre ??
      estudianteId
    );
  }

  private refrescarEquipos(): void {
    const cursoId = this.cursoSeleccionado();
    this.equipos.set(cursoId ? this.equipoService.listarPorCurso(cursoId) : []);
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
