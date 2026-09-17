import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { EstudianteCargado } from '../gestion-estudiantes/models/estudiante.model';
import { EstudianteService } from '../gestion-estudiantes/services/estudiante.service';
import { EquipoService } from './services/equipo.service';

/**
 * "Formar equipos" (docs/09): crea equipos a partir de los estudiantes ya
 * cargados y les asigna integrantes, manual o automáticamente. Es un
 * componente aparte de `Casos` a propósito — esto es formar los equipos en
 * sí; la "asignación de equipos" dentro de un Caso es otra cosa (cuáles
 * equipos participan en ese caso puntual). Capa mock, sin lógica de negocio.
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

  readonly equipos = this.equipoService.equipos;
  readonly estudiantes = signal<EstudianteCargado[]>([]);
  readonly cargando = signal(false);
  readonly nombreNuevoEquipo = signal('');

  /** Estudiantes cargados que todavía no están en ningún equipo. */
  readonly sinEquipo = computed(() => {
    const asignados = new Set(this.equipos().flatMap((e) => e.estudianteIds));
    return this.estudiantes().filter((e) => !asignados.has(e.id));
  });

  constructor() {
    this.cargando.set(true);
    this.estudianteService.listar().subscribe((lista) => {
      this.estudiantes.set(lista);
      this.cargando.set(false);
    });
  }

  nombrePor(estudianteId: string): string {
    return this.estudiantes().find((e) => e.id === estudianteId)?.nombre ?? estudianteId;
  }

  crearEquipo(): void {
    const nombre = this.nombreNuevoEquipo().trim();
    if (!nombre) {
      return;
    }
    this.equipoService.crear(nombre);
    this.nombreNuevoEquipo.set('');
  }

  eliminarEquipo(id: string): void {
    this.equipoService.eliminar(id);
  }

  asignar(estudianteId: string, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const equipoId = select.value;
    if (!equipoId) {
      return;
    }
    this.equipoService.asignarEstudiante(equipoId, estudianteId);
    select.value = '';
  }

  quitar(equipoId: string, estudianteId: string): void {
    this.equipoService.quitarEstudiante(equipoId, estudianteId);
  }

  asignarAutomatico(): void {
    this.equipoService.asignarAutomaticamente(this.estudiantes().map((e) => e.id));
  }
}
