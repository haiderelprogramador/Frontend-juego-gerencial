import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, concat, of, throwError } from 'rxjs';
import { map, tap, toArray } from 'rxjs/operators';

import { API_CONFIG, apiUrl } from '../../../../core/api/api.config';

/** Equipo tal como lo usa la pantalla (ids como texto, igual que EstudianteCargado). */
export interface Equipo {
  id: string;
  nombre: string;
  liderId: string | null;
  /** ids de `EstudianteCargado` asignados a este equipo. */
  estudianteIds: string[];
}

/** Equipo tal como lo devuelve el backend (EquipoResponse): ids numéricos. */
export interface EquipoApi {
  id: number;
  nombre: string;
  docenteId: number;
  liderId: number;
  estudianteIds: number[];
}

/** Regla del backend (CrearEquipoRequest): entre 1 y 4 estudiantes por equipo. */
export const MAX_INTEGRANTES = 4;

/**
 * "Formar equipos": el docente agrupa a los estudiantes ya cargados.
 *
 * Backend real (rama `develop`, `/api/docente/equipos`):
 *  - GET  -> EquipoApi[]
 *  - POST {estudianteIds, liderId} -> EquipoApi   (el NOMBRE lo pone el backend: "Equipo N")
 *  - PUT  /{id} {estudianteIds, liderId} -> EquipoApi
 *  - DELETE: ⚠️ no existe todavía (`API_CONFIG.disponible.eliminarEquipo`).
 *
 * Mismas reglas que el backend, validadas aquí también para dar el error antes
 * de llamarlo: 1–4 integrantes, el líder es uno de ellos y un estudiante no
 * puede estar en dos equipos.
 *
 * En modo demo (`API_CONFIG.demoMode`) todo vive en memoria.
 */
@Injectable({ providedIn: 'root' })
export class EquipoService {
  private readonly http = inject(HttpClient);

  private readonly _equipos = signal<Equipo[]>([]);
  readonly equipos = this._equipos.asReadonly();

  private contadorDemo = 0;

  /** false mientras el backend no tenga DELETE de equipos. */
  puedeEliminar(): boolean {
    return API_CONFIG.demoMode || API_CONFIG.disponible.eliminarEquipo;
  }

  /** Trae los equipos del docente desde el backend (en demo, devuelve los de memoria). */
  cargar(): Observable<Equipo[]> {
    if (API_CONFIG.demoMode) {
      return of(this._equipos());
    }
    return this.http.get<EquipoApi[]>(apiUrl(API_CONFIG.endpoints.equipos)).pipe(
      map((lista) => lista.map(aEquipo)),
      tap((lista) => this._equipos.set(lista)),
    );
  }

  crear(estudianteIds: string[], liderId: string): Observable<Equipo> {
    const error = this.validar(estudianteIds, liderId, null);
    if (error) {
      return throwError(() => ({ message: error }));
    }

    if (API_CONFIG.demoMode) {
      const nuevo: Equipo = {
        id: `equipo-${Date.now()}-${this.contadorDemo++}`,
        nombre: `Equipo ${this._equipos().length + 1}`,
        liderId,
        estudianteIds: [...estudianteIds],
      };
      this._equipos.update((eq) => [...eq, nuevo]);
      return of(nuevo);
    }

    return this.http
      .post<EquipoApi>(apiUrl(API_CONFIG.endpoints.equipos), aCuerpo(estudianteIds, liderId))
      .pipe(
        map(aEquipo),
        tap((nuevo) => this._equipos.update((eq) => [...eq, nuevo])),
      );
  }

  actualizar(equipoId: string, estudianteIds: string[], liderId: string): Observable<Equipo> {
    const error = this.validar(estudianteIds, liderId, equipoId);
    if (error) {
      return throwError(() => ({ message: error }));
    }

    if (API_CONFIG.demoMode) {
      const actual = this._equipos().find((e) => e.id === equipoId);
      if (!actual) {
        return throwError(() => ({ message: 'Equipo no encontrado.' }));
      }
      const editado: Equipo = { ...actual, liderId, estudianteIds: [...estudianteIds] };
      this.reemplazar(editado);
      return of(editado);
    }

    return this.http
      .put<EquipoApi>(
        `${apiUrl(API_CONFIG.endpoints.equipos)}/${equipoId}`,
        aCuerpo(estudianteIds, liderId),
      )
      .pipe(
        map(aEquipo),
        tap((editado) => this.reemplazar(editado)),
      );
  }

  eliminar(equipoId: string): Observable<void> {
    if (!this.puedeEliminar()) {
      return throwError(() => ({ message: 'El backend todavía no permite eliminar equipos.' }));
    }
    const quitarLocal = () => this._equipos.update((eq) => eq.filter((e) => e.id !== equipoId));
    if (API_CONFIG.demoMode) {
      quitarLocal();
      return of(undefined);
    }
    return this.http
      .delete<void>(`${apiUrl(API_CONFIG.endpoints.equipos)}/${equipoId}`)
      .pipe(tap(quitarLocal));
  }

  // -- Atajos sobre `actualizar()` (el backend solo tiene PUT del equipo completo) --

  agregarEstudiante(equipoId: string, estudianteId: string): Observable<Equipo> {
    const eq = this.buscar(equipoId);
    if (!eq) return throwError(() => ({ message: 'Equipo no encontrado.' }));
    return this.actualizar(equipoId, [...eq.estudianteIds, estudianteId], eq.liderId ?? estudianteId);
  }

  /** Si se quita al líder, el primer integrante que queda pasa a ser líder. */
  quitarEstudiante(equipoId: string, estudianteId: string): Observable<Equipo> {
    const eq = this.buscar(equipoId);
    if (!eq) return throwError(() => ({ message: 'Equipo no encontrado.' }));
    const quedan = eq.estudianteIds.filter((id) => id !== estudianteId);
    const lider = eq.liderId === estudianteId ? (quedan[0] ?? '') : (eq.liderId ?? quedan[0] ?? '');
    return this.actualizar(equipoId, quedan, lider);
  }

  hacerLider(equipoId: string, estudianteId: string): Observable<Equipo> {
    const eq = this.buscar(equipoId);
    if (!eq) return throwError(() => ({ message: 'Equipo no encontrado.' }));
    return this.actualizar(equipoId, eq.estudianteIds, estudianteId);
  }

  /**
   * 🎨 "Armar automáticamente": reparte a los estudiantes sin equipo en equipos
   * NUEVOS de hasta 4 (el primero de cada grupo queda como líder), en orden
   * aleatorio. No es una regla del cliente — solo una ayuda para el docente.
   */
  armarAutomaticamente(estudianteIdsSinEquipo: string[]): Observable<Equipo[]> {
    const pendientes = [...estudianteIdsSinEquipo];
    for (let i = pendientes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pendientes[i], pendientes[j]] = [pendientes[j], pendientes[i]];
    }
    const grupos: string[][] = [];
    for (let i = 0; i < pendientes.length; i += MAX_INTEGRANTES) {
      grupos.push(pendientes.slice(i, i + MAX_INTEGRANTES));
    }
    if (grupos.length === 0) {
      return of([]);
    }
    // Uno tras otro (concat), para que el backend numere "Equipo N" en orden.
    return concat(...grupos.map((g) => this.crear(g, g[0]))).pipe(toArray());
  }

  // ---------------------------------------------------------------------------
  // Internos
  // ---------------------------------------------------------------------------

  private buscar(equipoId: string): Equipo | undefined {
    return this._equipos().find((e) => e.id === equipoId);
  }

  private reemplazar(editado: Equipo): void {
    this._equipos.update((eq) => eq.map((e) => (e.id === editado.id ? editado : e)));
  }

  /** Devuelve el mensaje de error, o null si es válido. */
  private validar(estudianteIds: string[], liderId: string, equipoIdExcluir: string | null): string | null {
    if (estudianteIds.length < 1 || estudianteIds.length > MAX_INTEGRANTES) {
      return `El equipo debe tener entre 1 y ${MAX_INTEGRANTES} estudiantes.`;
    }
    if (new Set(estudianteIds).size !== estudianteIds.length) {
      return 'No se pueden repetir estudiantes en el equipo.';
    }
    if (!liderId || !estudianteIds.includes(liderId)) {
      return 'El líder debe ser uno de los integrantes del equipo.';
    }
    for (const otro of this._equipos()) {
      if (otro.id === equipoIdExcluir) continue;
      const repetido = estudianteIds.find((id) => otro.estudianteIds.includes(id));
      if (repetido) {
        return `Un estudiante ya está en ${otro.nombre}.`;
      }
    }
    return null;
  }
}

function aEquipo(api: EquipoApi): Equipo {
  return {
    id: String(api.id),
    nombre: api.nombre,
    liderId: api.liderId === null || api.liderId === undefined ? null : String(api.liderId),
    estudianteIds: (api.estudianteIds ?? []).map(String),
  };
}

/** El backend espera ids numéricos. */
function aCuerpo(estudianteIds: string[], liderId: string): { estudianteIds: number[]; liderId: number } {
  return { estudianteIds: estudianteIds.map(Number), liderId: Number(liderId) };
}
