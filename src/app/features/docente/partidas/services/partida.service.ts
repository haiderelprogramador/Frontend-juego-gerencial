import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_CONFIG, apiUrl } from '../../../../core/api/api.config';
import {
  ActualizarPartidaRequest,
  CrearPartidaRequest,
  Partida,
  PartidaEquipos,
} from '../models/partida.model';

/**
 * Partidas del docente — cliente de `/api/docente/partidas` (backend rama
 * `develop`, PartidaController). Todas requieren rol DOCENTE.
 *
 * Reglas que aplica el backend (responde 400 con `message` si no se cumplen):
 *  - crear/actualizar: fecha de inicio futura, duración > 0, visualización ≥ inicio.
 *  - actualizar: no en EN_CURSO ni FINALIZADA · eliminar: solo en CONFIGURADA.
 *  - programar: desde CONFIGURADA · iniciar: desde PROGRAMADA y ya llegada la
 *    fecha de inicio · finalizar: desde EN_CURSO (lo hace el docente, docs/08 §4).
 *  - asignar equipos: solo en CONFIGURADA o PROGRAMADA.
 *
 * Solo backend real: todavía no tiene implementación demo ni pantalla propia.
 */
@Injectable({ providedIn: 'root' })
export class PartidaService {
  private readonly http = inject(HttpClient);
  private readonly base = apiUrl(API_CONFIG.endpoints.partidas);

  listar(): Observable<Partida[]> {
    return this.http.get<Partida[]>(this.base);
  }

  obtener(id: number): Observable<Partida> {
    return this.http.get<Partida>(`${this.base}/${id}`);
  }

  crear(req: CrearPartidaRequest): Observable<Partida> {
    return this.http.post<Partida>(this.base, req);
  }

  actualizar(id: number, req: ActualizarPartidaRequest): Observable<Partida> {
    return this.http.put<Partida>(`${this.base}/${id}`, req);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  programar(id: number): Observable<Partida> {
    return this.http.post<Partida>(`${this.base}/${id}/programar`, {});
  }

  iniciar(id: number): Observable<Partida> {
    return this.http.post<Partida>(`${this.base}/${id}/iniciar`, {});
  }

  finalizar(id: number): Observable<Partida> {
    return this.http.post<Partida>(`${this.base}/${id}/finalizar`, {});
  }

  listarEquipos(id: number): Observable<PartidaEquipos> {
    return this.http.get<PartidaEquipos>(`${this.base}/${id}/equipos`);
  }

  /** Agrega equipos a la partida (no reemplaza los que ya tenía). */
  asignarEquipos(id: number, equipoIds: number[]): Observable<PartidaEquipos> {
    return this.http.post<PartidaEquipos>(`${this.base}/${id}/equipos`, { equipoIds });
  }

  quitarEquipo(id: number, equipoId: number): Observable<PartidaEquipos> {
    return this.http.delete<PartidaEquipos>(`${this.base}/${id}/equipos/${equipoId}`);
  }
}

/**
 * Convierte el valor de un `<input type="datetime-local">` ("2026-10-01T08:00")
 * al formato que espera el LocalDateTime de Spring ("2026-10-01T08:00:00").
 */
export function aFechaBackend(valorInput: string): string {
  return valorInput.length === 16 ? `${valorInput}:00` : valorInput;
}
