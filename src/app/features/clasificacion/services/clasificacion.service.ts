import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_CONFIG, apiUrl } from '../../../core/api/api.config';
import { Clasificacion } from '../models/clasificacion.model';

/**
 * Clasificación de una simulación — misma respuesta para los dos roles, distinta ruta:
 *  - docente: cualquier estado (`definitiva: false` = vista previa).
 *  - estudiante: solo FINALIZADA. Antes responde 400 "La clasificación estará
 *    disponible cuando la simulación finalice"; 400 "No participas en esta
 *    simulación" si no es suya.
 *
 * Solo backend real (sin rama demo), igual que `PortalEstudianteService`.
 */
@Injectable({ providedIn: 'root' })
export class ClasificacionService {
  private readonly http = inject(HttpClient);

  docente(idSimulacion: number): Observable<Clasificacion> {
    return this.http.get<Clasificacion>(
      `${apiUrl(API_CONFIG.endpoints.simulacionesDocente)}/${idSimulacion}/clasificacion`,
    );
  }

  estudiante(idSimulacion: number): Observable<Clasificacion> {
    return this.http.get<Clasificacion>(
      `${apiUrl(API_CONFIG.endpoints.estudianteSimulaciones)}/${idSimulacion}/clasificacion`,
    );
  }
}
