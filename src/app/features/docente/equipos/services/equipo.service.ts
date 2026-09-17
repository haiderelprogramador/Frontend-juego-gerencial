import { Injectable, signal } from '@angular/core';

export interface Equipo {
  id: string;
  nombre: string;
  /** ids de `EstudianteCargado` asignados a este equipo. */
  estudianteIds: string[];
}

/**
 * "Formar equipos" (docs/09): el docente agrupa a los estudiantes ya cargados
 * en equipos, manualmente o con asignación automática. Distinto de la
 * "asignación de equipos" del formulario de un Caso (esa es cuáles equipos
 * participan en ESE caso puntual; esta es la existencia de los equipos en sí).
 *
 * `providedIn: 'root'` (regla 6, docs/06): estado en memoria compartido por
 * toda la app — cuando exista backend, este servicio pasa a llamar
 * `HttpClient` sin que cambie cómo lo consumen los componentes.
 */
@Injectable({ providedIn: 'root' })
export class EquipoService {
  private readonly _equipos = signal<Equipo[]>([]);
  readonly equipos = this._equipos.asReadonly();

  /** Contador para que dos equipos creados en el mismo milisegundo no choquen de id. */
  private contador = 0;

  crear(nombre: string): Equipo {
    const nuevo: Equipo = { id: `equipo-${Date.now()}-${this.contador++}`, nombre, estudianteIds: [] };
    this._equipos.update((eq) => [...eq, nuevo]);
    return nuevo;
  }

  eliminar(id: string): void {
    this._equipos.update((eq) => eq.filter((e) => e.id !== id));
  }

  /** Asigna un estudiante a un equipo (lo saca de cualquier otro equipo primero). */
  asignarEstudiante(equipoId: string, estudianteId: string): void {
    this._equipos.update((eq) =>
      eq.map((e) => ({
        ...e,
        estudianteIds:
          e.id === equipoId
            ? e.estudianteIds.includes(estudianteId)
              ? e.estudianteIds
              : [...e.estudianteIds, estudianteId]
            : e.estudianteIds.filter((id) => id !== estudianteId),
      })),
    );
  }

  quitarEstudiante(equipoId: string, estudianteId: string): void {
    this._equipos.update((eq) =>
      eq.map((e) =>
        e.id === equipoId ? { ...e, estudianteIds: e.estudianteIds.filter((id) => id !== estudianteId) } : e,
      ),
    );
  }

  /**
   * 🎨 Mock de "asignación automática" (docs/09: manual o automática).
   * Reparte los estudiantes sin equipo entre los equipos ya creados, en un
   * orden aleatorio simple (round-robin) — no es una regla de negocio real.
   */
  asignarAutomaticamente(estudianteIds: string[]): void {
    const equipos = this._equipos();
    if (equipos.length === 0) {
      return;
    }

    const yaAsignados = new Set(equipos.flatMap((e) => e.estudianteIds));
    const pendientes = estudianteIds.filter((id) => !yaAsignados.has(id));

    for (let i = pendientes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pendientes[i], pendientes[j]] = [pendientes[j], pendientes[i]];
    }

    pendientes.forEach((estudianteId, indice) => {
      const equipo = equipos[indice % equipos.length];
      this.asignarEstudiante(equipo.id, estudianteId);
    });
  }
}
