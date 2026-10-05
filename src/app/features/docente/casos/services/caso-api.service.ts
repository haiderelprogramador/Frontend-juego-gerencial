import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_CONFIG, apiUrl } from '../../../../core/api/api.config';
import { CasoApi, CasoRequest, DecisionEmpresa } from '../../../simulacion/models/caso-api.model';

/**
 * Casos del docente — cliente de `/api/docente/casos` (API Estratego, 56
 * endpoints, doc 28-sep-2026). Rol DOCENTE.
 *
 * Reglas que aplica el backend:
 *  - editar (`actualizar`) reemplaza TODO el caso, incluidas las opciones (sus
 *    `id` cambian); solo si la simulación está BORRADOR/PROGRAMADA y el caso
 *    no tiene decisiones.
 *  - `activar` deja un único caso activo por simulación: el que estaba activo
 *    pasa a `borrador`.
 *  - `eliminar` solo si BORRADOR/PROGRAMADA y sin decisiones.
 *
 * Solo backend real (sin rama demo).
 */
@Injectable({ providedIn: 'root' })
export class CasoApiService {
  private readonly http = inject(HttpClient);
  private readonly base = apiUrl(API_CONFIG.endpoints.casos);
  private readonly baseSimulaciones = apiUrl(API_CONFIG.endpoints.simulacionesDocente);

  /** Todos los casos del docente autenticado. */
  listar(): Observable<CasoApi[]> {
    return this.http.get<CasoApi[]>(this.base);
  }

  /** Casos de una simulación puntual. */
  listarPorSimulacion(idSimulacion: number): Observable<CasoApi[]> {
    return this.http.get<CasoApi[]>(`${this.baseSimulaciones}/${idSimulacion}/casos`);
  }

  obtener(id: number): Observable<CasoApi> {
    return this.http.get<CasoApi>(`${this.base}/${id}`);
  }

  /**
   * Crea un caso en estado `borrador` (`req.idSimulacion` dice de cuál).
   * El contrato también documenta `POST /docente/simulaciones/{id}/casos`
   * como ruta alternativa, pero solo esta (`/docente/casos`, con
   * `idSimulacion` en el body) quedó probada en vivo — no se usa la anidada.
   */
  crear(req: CasoRequest): Observable<CasoApi> {
    return this.http.post<CasoApi>(this.base, req);
  }

  /** Reemplaza todo el caso (incluidas las opciones: sus `id` cambian). */
  actualizar(id: number, req: CasoRequest): Observable<CasoApi> {
    return this.http.put<CasoApi>(`${this.base}/${id}`, req);
  }

  /** Pasa el caso a `activo`; el que estaba activo en la misma simulación pasa a `borrador`. */
  activar(id: number): Observable<CasoApi> {
    return this.http.post<CasoApi>(`${this.base}/${id}/activar`, {});
  }

  /** Una fila por empresa de la simulación, con su decisión (si ya la tomó). */
  decisiones(id: number): Observable<DecisionEmpresa[]> {
    return this.http.get<DecisionEmpresa[]>(`${this.base}/${id}/decisiones`);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
