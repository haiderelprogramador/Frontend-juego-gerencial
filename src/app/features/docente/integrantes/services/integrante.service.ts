import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_CONFIG, apiUrl } from '../../../../core/api/api.config';
import { AgregarIntegranteRequest, DepartamentoIntegrante, Integrante } from '../models/integrante.model';

/**
 * Integrantes de una empresa — cliente de
 * `/api/docente/empresas/{idEmpresa}/integrantes` (API Estratego, 56
 * endpoints). Rol DOCENTE.
 *
 * `{idUsuario}` en las rutas de actualizar/hacer-líder/eliminar es el id del
 * ESTUDIANTE (Usuario), no el id del Integrante. Todos los cambios exigen
 * que la simulación dueña de la empresa esté en BORRADOR o PROGRAMADA.
 * `hacerLider` deja de ser líder al que lo era antes (uno solo por empresa).
 *
 * Solo backend real (sin rama demo), igual que `CasoApiService`.
 */
@Injectable({ providedIn: 'root' })
export class IntegranteService {
  private readonly http = inject(HttpClient);
  private readonly baseEmpresas = apiUrl(API_CONFIG.endpoints.empresasDocente);

  private base(idEmpresa: number): string {
    return `${this.baseEmpresas}/${idEmpresa}/integrantes`;
  }

  listar(idEmpresa: number): Observable<Integrante[]> {
    return this.http.get<Integrante[]>(this.base(idEmpresa));
  }

  agregar(idEmpresa: number, req: AgregarIntegranteRequest): Observable<Integrante> {
    return this.http.post<Integrante>(this.base(idEmpresa), req);
  }

  actualizarDepartamento(
    idEmpresa: number,
    idUsuario: number,
    departamento: DepartamentoIntegrante,
  ): Observable<Integrante> {
    return this.http.put<Integrante>(`${this.base(idEmpresa)}/${idUsuario}`, { departamento });
  }

  /** El líder anterior de la empresa deja de serlo. */
  hacerLider(idEmpresa: number, idUsuario: number): Observable<Integrante> {
    return this.http.put<Integrante>(`${this.base(idEmpresa)}/${idUsuario}/lider`, {});
  }

  eliminar(idEmpresa: number, idUsuario: number): Observable<void> {
    return this.http.delete<void>(`${this.base(idEmpresa)}/${idUsuario}`);
  }
}
