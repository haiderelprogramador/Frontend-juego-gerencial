import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, from, of, switchMap, throwError } from 'rxjs';

import { API_CONFIG, apiUrl } from '../../../../core/api/api.config';
import { nombreDesdeContentDisposition } from '../../../../shared/utils/descarga';
import { Simulacion, SimulacionRequest } from '../models/simulacion.model';

/** Un archivo recibido del backend, listo para descargar. */
export interface ArchivoDescargado {
  nombre: string;
  blob: Blob;
}

const MENSAJE_EXPORTAR = 'No se pudo descargar el Excel de la simulación.';

/**
 * 401 y 403 los responde Spring Security, con el cuerpo vacío o con un texto
 * técnico: se reemplazan siempre por un mensaje para el docente. Hoy el
 * backend responde 403 también sin sesión o con el token vencido (probado en
 * vivo, 16-oct-2026), así que el del 403 cubre los dos casos. El del 401 queda
 * para cuando el backend lo devuelva (ya se le pidió).
 */
const MENSAJES_EXPORTAR_POR_STATUS: Readonly<Record<number, string>> = {
  401: 'Tu sesión venció. Vuelve a iniciar sesión para descargar el archivo.',
  403: 'No tienes permiso para descargar este archivo o tu sesión venció. Vuelve a iniciar sesión e inténtalo de nuevo.',
};

/**
 * Con `responseType: 'blob'`, el cuerpo de un error también llega como Blob:
 * se lee como texto y se toma el `message` estándar del backend (por ejemplo,
 * los 400 "Simulación no encontrada" y "La simulación no pertenece a este
 * docente"). Si no es JSON o no trae `message`, queda el mensaje genérico.
 */
async function mensajeDeErrorBlob(err: HttpErrorResponse): Promise<string> {
  const porStatus = MENSAJES_EXPORTAR_POR_STATUS[err.status];
  if (porStatus) {
    return porStatus;
  }
  const cuerpo: unknown = err.error;
  try {
    const texto = cuerpo instanceof Blob ? await cuerpo.text() : typeof cuerpo === 'string' ? cuerpo : null;
    const json = texto ? JSON.parse(texto) : cuerpo;
    const message = (json as { message?: unknown } | null)?.message;
    return typeof message === 'string' && message.trim() ? message : MENSAJE_EXPORTAR;
  } catch {
    return MENSAJE_EXPORTAR;
  }
}

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

  /**
   * Resultados de la simulación en Excel: hojas Clasificación, Estados por
   * empresa (con indicadores) y Decisiones. El nombre viene en
   * `Content-Disposition` (expuesto por CORS); si no viene, se usa
   * `estratego-simulacion-{id}.xlsx`. Un error se convierte en `Error` con el
   * `message` del backend; una respuesta sin cuerpo (o con un blob vacío) también
   * es un error, para no descargar un .xlsx roto. Ver `API_CONFIG.disponible.exportar`.
   */
  exportar(idSimulacion: number): Observable<ArchivoDescargado> {
    return this.http
      .get(`${this.base}/${idSimulacion}/exportar`, { responseType: 'blob', observe: 'response' })
      .pipe(
        catchError((err: HttpErrorResponse) =>
          from(mensajeDeErrorBlob(err)).pipe(switchMap((msg) => throwError(() => new Error(msg)))),
        ),
        switchMap((res) => {
          if (!res.body || res.body.size === 0) {
            return throwError(() => new Error(MENSAJE_EXPORTAR));
          }
          const nombre =
            nombreDesdeContentDisposition(res.headers.get('Content-Disposition')) ??
            `estratego-simulacion-${idSimulacion}.xlsx`;
          return of({ nombre, blob: res.body });
        }),
      );
  }

  /** Solo si está BORRADOR. */
  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
