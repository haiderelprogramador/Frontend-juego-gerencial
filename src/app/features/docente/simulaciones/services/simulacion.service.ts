import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_CONFIG, apiUrl } from '../../../../core/api/api.config';
import { Simulacion, SimulacionRequest } from '../models/simulacion.model';

/**
 * Simulaciones del docente — cliente de `/api/docente/simulaciones` (API
 * Estratego, 56 endpoints). Rol DOCENTE.
 *
 * Transiciones de estado: `BORRADOR -> (programar) -> PROGRAMADA ->
 * (iniciar) -> EN_CURSO -> (finalizar) -> FINALIZADA`, y `desprogramar`
 * (PROGRAMADA -> BORRADOR). El backend las automatiza (oct-2026): PROGRAMADA
 * arranca sola en `fechaInicio` (si no está lista, arranca un minuto después
 * de que el docente la corrija) y EN_CURSO termina al final del día de
 * `fechaFin`. `iniciar` es idempotente. `actualizar` y `eliminar` solo
 * aplican en BORRADOR/PROGRAMADA (`eliminar` solo en BORRADOR).
 *
 * Solo backend real (sin rama demo), igual que `CasoApiService`.
 */
@Injectable({ providedIn: 'root' })
export class SimulacionService {
  private readonly http = inject(HttpClient);
  private readonly base = apiUrl(API_CONFIG.endpoints.simulacionesDocente);

  listar(): Observable<Simulacion[]> {
    return this.http.get<Simulacion[]>(this.base);
  }

  obtener(id: number): Observable<Simulacion> {
    return this.http.get<Simulacion>(`${this.base}/${id}`);
  }

  crear(req: SimulacionRequest): Observable<Simulacion> {
    return this.http.post<Simulacion>(this.base, req);
  }

  /** Reemplaza nombre/fechas. Solo si está BORRADOR o PROGRAMADA. */
  actualizar(id: number, req: SimulacionRequest): Observable<Simulacion> {
    return this.http.put<Simulacion>(`${this.base}/${id}`, req);
  }

  /** BORRADOR -> PROGRAMADA. */
  programar(id: number): Observable<Simulacion> {
    return this.http.post<Simulacion>(`${this.base}/${id}/programar`, {});
  }

  /**
   * PROGRAMADA -> BORRADOR: la forma de frenar el arranque automático. 400
   * "Solo se puede desprogramar una simulación PROGRAMADA" o "La simulación
   * ya tiene decisiones de empresas; no se puede desprogramar". No hace falta
   * para corregir: en PROGRAMADA todavía se pueden editar casos y empresas.
   */
  desprogramar(id: number): Observable<Simulacion> {
    return this.http.post<Simulacion>(`${this.base}/${id}/desprogramar`, {});
  }

  /** PROGRAMADA -> EN_CURSO. 400 si `fechaInicio` todavía no llegó. */
  iniciar(id: number): Observable<Simulacion> {
    return this.http.post<Simulacion>(`${this.base}/${id}/iniciar`, {});
  }

  /** EN_CURSO -> FINALIZADA. */
  finalizar(id: number): Observable<Simulacion> {
    return this.http.post<Simulacion>(`${this.base}/${id}/finalizar`, {});
  }

  /** Solo si está BORRADOR. */
  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
