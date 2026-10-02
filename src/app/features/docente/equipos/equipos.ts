import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';

import { EstudianteCargado } from '../gestion-estudiantes/models/estudiante.model';
import { EstudianteService } from '../gestion-estudiantes/services/estudiante.service';
import { EquipoService, MAX_INTEGRANTES } from './services/equipo.service';

type ErrorHttp = { message?: string; error?: { message?: string } };

/**
 * "Formar equipos": crea equipos a partir de los estudiantes ya cargados,
 * conectado al backend real (`/api/docente/equipos`, ver EquipoService).
 *
 * Flujo alineado con el backend: un equipo se crea eligiendo de 1 a 4
 * estudiantes y un líder entre ellos; el nombre ("Equipo N") lo pone el backend.
 * Distinto de la "asignación de equipos" dentro de un Caso/Partida.
 */
@Component({
  selector: 'app-formar-equipos',
  templateUrl: './equipos.html',
  styleUrl: './equipos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormarEquipos {
  private readonly estudianteService = inject(EstudianteService);
  private readonly equipoService = inject(EquipoService);

  readonly max = MAX_INTEGRANTES;
  readonly equipos = this.equipoService.equipos;
  readonly puedeEliminar = this.equipoService.puedeEliminar();
  readonly listaEsLocal = this.estudianteService.listaEsLocal();

  readonly estudiantes = signal<EstudianteCargado[]>([]);
  readonly cargando = signal(false);
  readonly ocupado = signal(false);
  readonly error = signal<string | null>(null);

  /** Estudiantes marcados para el próximo equipo, y quién de ellos es el líder. */
  readonly seleccion = signal<string[]>([]);
  readonly lider = signal<string | null>(null);

  /** Estudiantes cargados que todavía no están en ningún equipo. */
  readonly sinEquipo = computed(() => {
    const asignados = new Set(this.equipos().flatMap((e) => e.estudianteIds));
    return this.estudiantes().filter((e) => !asignados.has(e.id));
  });

  readonly puedeCrear = computed(
    () =>
      !this.ocupado() &&
      this.seleccion().length >= 1 &&
      this.seleccion().length <= MAX_INTEGRANTES &&
      this.lider() !== null,
  );

  constructor() {
    this.cargando.set(true);
    this.estudianteService.listar().subscribe({
      next: (lista) => {
        this.estudiantes.set(lista);
        this.cargando.set(false);
      },
      error: (err: ErrorHttp) => {
        this.cargando.set(false);
        this.error.set(mensaje(err, 'No se pudieron cargar los estudiantes.'));
      },
    });
    this.equipoService.cargar().subscribe({
      error: (err: ErrorHttp) => this.error.set(mensaje(err, 'No se pudieron cargar los equipos.')),
    });
  }

  nombrePor(estudianteId: string): string {
    return this.estudiantes().find((e) => e.id === estudianteId)?.nombre ?? `Estudiante #${estudianteId}`;
  }

  estaSeleccionado(id: string): boolean {
    return this.seleccion().includes(id);
  }

  alternarSeleccion(id: string): void {
    if (this.estaSeleccionado(id)) {
      this.seleccion.update((s) => s.filter((x) => x !== id));
      if (this.lider() === id) {
        this.lider.set(this.seleccion()[0] ?? null);
      }
      return;
    }
    if (this.seleccion().length >= MAX_INTEGRANTES) {
      return;
    }
    this.seleccion.update((s) => [...s, id]);
    if (this.lider() === null) {
      this.lider.set(id);
    }
  }

  crearEquipo(): void {
    const lider = this.lider();
    if (!this.puedeCrear() || lider === null) {
      return;
    }
    this.ejecutar(this.equipoService.crear(this.seleccion(), lider), () => {
      this.seleccion.set([]);
      this.lider.set(null);
    });
  }

  agregar(equipoId: string, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const estudianteId = select.value;
    select.value = '';
    if (estudianteId) {
      this.ejecutar(this.equipoService.agregarEstudiante(equipoId, estudianteId));
    }
  }

  quitar(equipoId: string, estudianteId: string): void {
    this.ejecutar(this.equipoService.quitarEstudiante(equipoId, estudianteId));
  }

  hacerLider(equipoId: string, estudianteId: string): void {
    this.ejecutar(this.equipoService.hacerLider(equipoId, estudianteId));
  }

  eliminarEquipo(id: string): void {
    this.ejecutar(this.equipoService.eliminar(id));
  }

  armarAutomatico(): void {
    this.ejecutar(this.equipoService.armarAutomaticamente(this.sinEquipo().map((e) => e.id)), () => {
      this.seleccion.set([]);
      this.lider.set(null);
    });
  }

  private ejecutar<T>(accion: Observable<T>, alTerminar?: () => void): void {
    this.ocupado.set(true);
    this.error.set(null);
    accion.subscribe({
      next: () => undefined,
      complete: () => {
        this.ocupado.set(false);
        alTerminar?.();
      },
      error: (err: ErrorHttp) => {
        this.ocupado.set(false);
        this.error.set(mensaje(err, 'No se pudo completar la acción.'));
      },
    });
  }
}

/** err.error.message -> respuesta del backend (ApiError); err.message -> validación local. */
function mensaje(err: ErrorHttp, porDefecto: string): string {
  return err?.error?.message ?? err?.message ?? porDefecto;
}
