import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { API_CONFIG, apiUrl } from '../../../core/api/api.config';
import { CasoEstudiante, aCasoEstudiante } from '../../simulacion/models/caso-api.model';
import { CasoActual, Decision, MiEmpresa, MiSimulacion } from '../models/portal-estudiante.model';

/**
 * Portal del estudiante — cliente de `/api/estudiante/*` (API Estratego, 57
 * endpoints, doc 28-sep-2026). Rol ESTUDIANTE.
 *
 * Regla clave de `decidir()`: la decisión la toma EL LÍDER por toda la
 * empresa, una sola vez por empresa y caso, solo con el caso activo, la
 * simulación PROGRAMADA/EN_CURSO y dentro de [fechaInicioPartida,
 * fechaFinPartida]. Es permanente: no se puede cambiar ni borrar.
 *
 * Visibilidad (contrato "API Estratego — Endpoints para frontend", 5-oct-2026,
 * pág. 10): un caso aparece desde `fechaVisualizacion` y nunca con la
 * simulación en BORRADOR; sus opciones, desde `fechaInicioPartida`. La aplica
 * el backend; la UI además bloquea las opciones antes de `fechaInicioPartida`.
 *
 * Solo backend real (sin rama demo), igual que `CasoApiService`.
 *
 * Todo caso que entra por aquí pasa por `aCasoEstudiante()`: las opciones se
 * reconstruyen por lista blanca, sin `resultado` ni `impacto`.
 */
@Injectable({ providedIn: 'root' })
export class PortalEstudianteService {
  private readonly http = inject(HttpClient);

  /**
   * El caso visible para la empresa del estudiante. Sin `idSimulacion`, el
   * backend elige (contrato 5-oct-2026): (1) partida en curso — si hay varias,
   * la de la simulación más reciente; (2) el próximo caso por empezar; (3) el
   * caso terminado más reciente. `null` si responde 204 (nada aplica).
   */
  casoActual(idSimulacion?: number): Observable<CasoActual | null> {
    let params = new HttpParams();
    if (idSimulacion != null) {
      params = params.set('idSimulacion', idSimulacion);
    }
    return this.http
      .get<CasoActual>(apiUrl(API_CONFIG.endpoints.estudianteCasoActual), {
        params,
        observe: 'response',
      })
      .pipe(map((res) => (res.body ? { ...res.body, caso: aCasoEstudiante(res.body.caso) } : null)));
  }

  /** Solo el líder puede llamarlo; es permanente (no hay editar/borrar). */
  decidir(idCaso: number, idOpcion: number): Observable<Decision> {
    return this.http.post<Decision>(apiUrl(API_CONFIG.endpoints.estudianteDecision), {
      idCaso,
      idOpcion,
    });
  }

  /** Simulaciones del estudiante, la más reciente primero. */
  misSimulaciones(): Observable<MiSimulacion[]> {
    return this.http.get<MiSimulacion[]>(apiUrl(API_CONFIG.endpoints.estudianteSimulaciones));
  }

  /** 400 si la empresa no pertenece al estudiante autenticado. */
  miEmpresa(idEmpresa: number): Observable<MiEmpresa> {
    return this.http.get<MiEmpresa>(`${apiUrl(API_CONFIG.endpoints.estudianteEmpresas)}/${idEmpresa}`);
  }

  /** Historial de casos visibles de una simulación (opciones sin `resultado`). */
  historialCasos(idSimulacion: number): Observable<CasoEstudiante[]> {
    return this.http
      .get<CasoEstudiante[]>(`${apiUrl(API_CONFIG.endpoints.estudianteSimulaciones)}/${idSimulacion}/casos`)
      .pipe(map((casos) => casos.map(aCasoEstudiante)));
  }

  /** 400 si el caso todavía no es visible para el estudiante. */
  obtenerCaso(id: number): Observable<CasoEstudiante> {
    return this.http
      .get<CasoEstudiante>(`${apiUrl(API_CONFIG.endpoints.estudianteCasos)}/${id}`)
      .pipe(map(aCasoEstudiante));
  }
}
