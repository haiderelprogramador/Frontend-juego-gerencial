import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { aFechaBogota } from '../../../../shared/utils/fecha-bogota';
import { CasoApi } from '../../../simulacion/models/caso-api.model';
import { CasoApiService } from './caso-api.service';

/**
 * Confirmación antes de una acción que CIERRA el caso abierto de una
 * simulación. El backend cierra un caso cuando pasa su `fechaFinPartida`,
 * cuando el docente activa otro caso de la misma simulación o cuando finaliza
 * la simulación; al cerrarse, penaliza a las empresas que no decidieron.
 *
 * Antes de preguntar cuenta las empresas pendientes con
 * `GET /docente/casos/{id}/decisiones` (`decidio: false`) para que el docente
 * sepa a cuántas va a penalizar.
 */
@Injectable({ providedIn: 'root' })
export class CierreCasoService {
  private readonly casoApi = inject(CasoApiService);

  /**
   * `accion` completa la frase: "Activar «B»", "Finalizar «Gerencia 2026-2»".
   * Con `abierto` null (no hay caso que cerrar) no pregunta nada: emite true.
   */
  confirmar(accion: string, abierto: CasoApi | null, ahoraMs = Date.now()): Observable<boolean> {
    if (!abierto) {
      return of(true);
    }
    // Si su fecha de fin ya pasó, el backend ya lo cerró (y ya penalizó): no hay nada que advertir.
    const finMs = aFechaBogota(abierto.fechaFinPartida);
    if (Number.isFinite(finMs) && ahoraMs > finMs) {
      return of(window.confirm(`¿${accion}?`));
    }
    return this.casoApi.decisiones(abierto.id).pipe(
      map((filas) => filas.filter((f) => !f.decidio).length as number | null),
      catchError(() => of(null)),
      map((pendientes) => window.confirm(mensajeCierre(accion, abierto.nombre, pendientes))),
    );
  }
}

/** `pendientes` null = no se pudo consultar cuántas empresas faltan. */
export function mensajeCierre(accion: string, casoCerrado: string, pendientes: number | null): string {
  const cierra = `${accion} cierra «${casoCerrado}» ahora mismo.`;
  if (pendientes === null) {
    return `${cierra} No se pudo consultar cuántas empresas faltan por decidir: las que no hayan decidido recibirán la penalización.`;
  }
  if (pendientes === 0) {
    return `${cierra} Todas las empresas ya decidieron. ¿Continuar?`;
  }
  const empresas = pendientes === 1 ? '1 empresa todavía no ha decidido y recibirá' : `${pendientes} empresas todavía no han decidido y recibirán`;
  return `${cierra} ${empresas} la penalización.`;
}
