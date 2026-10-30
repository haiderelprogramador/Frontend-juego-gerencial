import { Injectable, signal } from '@angular/core';

/**
 * Mantiene en memoria (durante la sesión activa) la última simulación
 * seleccionada por el docente o el estudiante para evitar pedirla de nuevo
 * en cada pantalla cuando la URL no trae `?simulacion=` explícito.
 */
@Injectable({ providedIn: 'root' })
export class SimulacionContextService {
  readonly idSimulacionActiva = signal<number | null>(null);

  recordar(id: number | null): void {
    this.idSimulacionActiva.set(id);
  }
}
