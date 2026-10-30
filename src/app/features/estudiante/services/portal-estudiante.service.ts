import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { API_CONFIG, apiUrl } from '../../../core/api/api.config';
import { Boletin } from '../../simulacion/models/boletin.model';
import { CasoEstudiante, aCasoEstudiante } from '../../simulacion/models/caso-api.model';
import { aEstadoEmpresa, aHistoriaCasoEmpresa } from '../../simulacion/models/estado-empresa.model';
import { CasoActual, Decision, HistoriaCasoEmpresa, MiEmpresa, MiSimulacion } from '../models/portal-estudiante.model';

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
 * reconstruyen por lista blanca, sin `resultado` ni `impacto`. Y todo estado
 * financiero por empresa, por `aEstadoEmpresa()` (normaliza `origen`).
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
      .pipe(map((res) => (res.body ? aCasoActual(res.body) : null)));
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

  /**
   * Historia financiera de la empresa del estudiante, caso a caso (contrato
   * B). 400 "No perteneces a esta empresa" si `idEmpresa` no es la suya. Ver
   * `API_CONFIG.disponible.historia`.
   */
  historiaEmpresa(idEmpresa: number): Observable<HistoriaCasoEmpresa[]> {
    return this.http
      .get<HistoriaCasoEmpresa[]>(`${apiUrl(API_CONFIG.endpoints.estudianteEmpresas)}/${idEmpresa}/historia`)
      .pipe(map((h) => h.map(aHistoriaCasoEmpresa)));
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

  /** Boletín de un caso visible (D14); `null` si responde 204 (el docente no lo publicó). */
  boletin(idCaso: number): Observable<Boletin | null> {
    return this.http
      .get<Boletin>(`${apiUrl(API_CONFIG.endpoints.estudianteCasos)}/${idCaso}/boletin`, { observe: 'response' })
      .pipe(map((res) => res.body ?? null));
  }
}

/**
 * `financieroEmpresa` siempre viene (doc 30-oct-2026); si un backend viejo no
 * lo mandara, se deja ausente y las pantallas usan su respaldo con `caso.financiero`.
 */
function aCasoActual(dto: CasoActual): CasoActual {
  const fe = dto.financieroEmpresa;
  return {
    ...dto,
    caso: aCasoEstudiante(dto.caso),
    ...(fe ? { financieroEmpresa: { inicial: aEstadoEmpresa(fe.inicial), final: aEstadoEmpresa(fe.final) } } : {}),
  };
}
