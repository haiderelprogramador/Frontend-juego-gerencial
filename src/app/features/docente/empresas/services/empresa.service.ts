import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_CONFIG, apiUrl } from '../../../../core/api/api.config';
import { Empresa, EmpresaRequest } from '../models/empresa.model';

/**
 * Empresas del docente — cliente de `/api/docente/empresas` y
 * `/api/docente/simulaciones/{id}/empresas` (API Estratego, 56 endpoints).
 * Rol DOCENTE.
 *
 * Todos los cambios (crear/actualizar/eliminar) exigen que la simulación
 * dueña esté en BORRADOR o PROGRAMADA. `eliminar` borra los integrantes de
 * la empresa en cascada.
 *
 * Solo backend real (sin rama demo), igual que `CasoApiService`.
 */
@Injectable({ providedIn: 'root' })
export class EmpresaService {
  private readonly http = inject(HttpClient);
  private readonly baseSimulaciones = apiUrl(API_CONFIG.endpoints.simulacionesDocente);
  private readonly baseEmpresas = apiUrl(API_CONFIG.endpoints.empresasDocente);

  listarPorSimulacion(idSimulacion: number): Observable<Empresa[]> {
    return this.http.get<Empresa[]>(`${this.baseSimulaciones}/${idSimulacion}/empresas`);
  }

  crear(idSimulacion: number, req: EmpresaRequest): Observable<Empresa> {
    return this.http.post<Empresa>(`${this.baseSimulaciones}/${idSimulacion}/empresas`, req);
  }

  obtener(id: number): Observable<Empresa> {
    return this.http.get<Empresa>(`${this.baseEmpresas}/${id}`);
  }

  actualizar(id: number, req: EmpresaRequest): Observable<Empresa> {
    return this.http.put<Empresa>(`${this.baseEmpresas}/${id}`, req);
  }

  /** Borra la empresa y sus integrantes en cascada. Solo BORRADOR/PROGRAMADA. */
  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseEmpresas}/${id}`);
  }
}
