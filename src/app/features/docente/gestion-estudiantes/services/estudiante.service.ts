import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { delay, map, tap } from 'rxjs/operators';

import { API_CONFIG, apiUrl } from '../../../../core/api/api.config';
import { DemoDb, DemoEstudianteRecord } from '../../../../core/demo/demo-db';
import { Rol } from '../../../../core/models/rol.enum';
import { AuthService } from '../../../../core/services/auth.service';
import {
  CargaMasivaRequest,
  CargaMasivaResponse,
  CargaMasivaResponseApi,
  EstudianteCargado,
} from '../models/estudiante.model';
import { generarContrasena } from './generar-contrasena';

/**
 * Carga masiva y consulta de estudiantes (rol DOCENTE).
 *
 * Contrato de API (backend real, docs/07 §2.2 — opción B, multipart):
 *  - GET  {@link API_CONFIG.endpoints.estudiantes}            -> EstudianteCargado[]
 *  - POST {@link API_CONFIG.endpoints.estudiantesCargaMasiva} multipart/form-data,
 *        campo `archivo` con el .xlsx crudo -> CargaMasivaResponse { creados, errores }
 *        (el backend lo parsea con Apache POI; el front ya NO manda las filas en JSON).
 *
 * En modo demo no hay backend que parsee el archivo, así que el mock sigue
 * usando las filas ya parseadas en el navegador (`CargaMasivaRequest`) para
 * simular la creación (ver `generarContrasena`, que en producción no se usa) y
 * persiste en {@link DemoDb} (localStorage) para que el estudiante pueda
 * iniciar sesión de inmediato.
 *
 * ⚠️ Backend real SIN `GET /docente/estudiantes` todavía
 * (`API_CONFIG.disponible.listarEstudiantes = false`): `listar()` devuelve los
 * estudiantes que el backend creó en las cargas hechas DESDE ESTE NAVEGADOR,
 * guardados con su id real del backend (así se pueden usar para formar equipos).
 */
@Injectable({ providedIn: 'root' })
export class EstudianteService {
  private readonly http = inject(HttpClient);
  private readonly demo = inject(DemoDb);
  private readonly auth = inject(AuthService);

  /** Cantidad de estudiantes ya cargados (dato informativo para el docente). */
  contarExistentes(): number {
    if (!API_CONFIG.demoMode) {
      return this.listaEsLocal() ? this.leerRespaldo().length : 0;
    }
    return this.demo.estudiantes().length;
  }

  listar(): Observable<EstudianteCargado[]> {
    if (!API_CONFIG.demoMode) {
      if (this.listaEsLocal()) {
        return of(this.leerRespaldo());
      }
      return this.http
        .get<EstudianteCargado[]>(apiUrl(API_CONFIG.endpoints.estudiantes))
        .pipe(map((lista) => lista.map((e) => ({ ...e, id: String(e.id) }))));
    }
    return of(this.demo.estudiantes().map((r) => this.aEstudianteCargado(r))).pipe(
      delay(API_CONFIG.demoLatenciaMs),
    );
  }

  /** GET /docente/estudiantes/{id} — un estudiante puntual (sin contraseña). */
  obtener(id: string): Observable<EstudianteCargado> {
    if (!API_CONFIG.demoMode) {
      return this.http
        .get<EstudianteCargado>(`${apiUrl(API_CONFIG.endpoints.estudiantes)}/${id}`)
        .pipe(map((e) => ({ ...e, id: String(e.id) })));
    }
    const encontrado = this.demo.estudiantes().find((r) => r.usuario.id === id);
    if (!encontrado) {
      return throwError(() => ({ status: 404, message: 'Estudiante no encontrado.' })).pipe(
        delay(API_CONFIG.demoLatenciaMs),
      );
    }
    return of(this.aEstudianteCargado(encontrado)).pipe(delay(API_CONFIG.demoLatenciaMs));
  }

  cargaMasiva(req: CargaMasivaRequest, archivo: File): Observable<CargaMasivaResponse> {
    if (!API_CONFIG.demoMode) {
      const formData = new FormData();
      formData.append('archivo', archivo);
      // No seteamos Content-Type a mano: HttpClient arma el boundary multipart
      // correcto a partir del FormData.
      return this.http
        .post<CargaMasivaResponseApi>(apiUrl(API_CONFIG.endpoints.estudiantesCargaMasiva), formData)
        .pipe(
          map((res) => this.normalizarRespuesta(res)),
          tap((res) => this.agregarAlRespaldo(res.creados)),
        );
    }

    // --- Implementación DEMO -------------------------------------------------
    if (req.estudiantes.length === 0) {
      return throwError(() => ({ status: 400, message: 'No hay estudiantes para cargar.' })).pipe(
        delay(API_CONFIG.demoLatenciaMs),
      );
    }

    const yaRegistrados = new Set(
      this.demo.estudiantes().map((r) => r.usuario.correo.toLowerCase()),
    );
    // El backend real llevaría este consecutivo; el mock lo continúa desde los
    // estudiantes ya cargados. TODO: confirmar con el cliente el alcance del
    // consecutivo (global / por curso / por docente / por carga).
    let consecutivo = this.demo.estudiantes().length;

    const nuevos: DemoEstudianteRecord[] = [];
    const errores: CargaMasivaResponse['errores'] = [];
    const ahora = new Date().toISOString();

    for (const e of req.estudiantes) {
      const correo = e.correo.toLowerCase();
      if (yaRegistrados.has(correo)) {
        errores.push({ correo: e.correo, mensaje: 'Ya existe un estudiante con ese correo.' });
        continue;
      }
      yaRegistrados.add(correo);
      consecutivo += 1;
      nuevos.push({
        usuario: {
          id: `est-${e.numeroIdentificacion}-${consecutivo}`,
          nombre: e.nombre,
          correo,
          numeroIdentificacion: e.numeroIdentificacion,
          rol: Rol.ESTUDIANTE,
        },
        // Contraseña generada por el "backend" (simulada por el mock).
        contrasena: generarContrasena(consecutivo, e.numeroIdentificacion),
        consecutivo,
        edad: e.edad,
        genero: e.genero,
        columnasAdicionales: e.columnasAdicionales,
        cargadoEn: ahora,
      });
    }

    if (nuevos.length > 0) {
      this.demo.agregarEstudiantes(nuevos);
    }

    const respuesta: CargaMasivaResponse = {
      creados: nuevos.map((r) => this.aEstudianteCargado(r)),
      errores,
    };
    return of(respuesta).pipe(delay(API_CONFIG.demoLatenciaMs));
  }

  /**
   * true si `listar()` viene del respaldo local de este navegador y no del
   * backend (backend real sin GET /docente/estudiantes todavía).
   */
  listaEsLocal(): boolean {
    return !API_CONFIG.demoMode && !API_CONFIG.disponible.listarEstudiantes;
  }

  /** El backend devuelve `id` y `edad` como número (o null): se normalizan a texto. */
  private normalizarRespuesta(res: CargaMasivaResponseApi): CargaMasivaResponse {
    const ahora = new Date().toISOString();
    return {
      creados: (res.creados ?? []).map((c) => ({
        id: String(c.id),
        nombre: c.nombre,
        correo: c.correo,
        numeroIdentificacion: c.numeroIdentificacion,
        edad: c.edad === null || c.edad === undefined ? '' : String(c.edad),
        genero: c.genero ?? '',
        contrasenaGenerada: c.contrasenaGenerada ?? '',
        cargadoEn: c.cargadoEn ?? ahora,
      })),
      errores: res.errores ?? [],
    };
  }

  /** Una lista por docente, por si varios comparten el mismo navegador. */
  private claveRespaldo(): string {
    return `estratego.estudiantesBackend.${this.auth.usuarioActual()?.id ?? 'anonimo'}`;
  }

  private leerRespaldo(): EstudianteCargado[] {
    try {
      const crudo = localStorage.getItem(this.claveRespaldo());
      return crudo ? (JSON.parse(crudo) as EstudianteCargado[]) : [];
    } catch {
      return [];
    }
  }

  private agregarAlRespaldo(creados: EstudianteCargado[]): void {
    if (!this.listaEsLocal() || creados.length === 0) {
      return;
    }
    // La contraseña NO se guarda en el navegador: solo se muestra una vez.
    const porId = new Map(this.leerRespaldo().map((e) => [e.id, e]));
    creados.forEach((c) => porId.set(c.id, { ...c, contrasenaGenerada: '' }));
    try {
      localStorage.setItem(this.claveRespaldo(), JSON.stringify([...porId.values()]));
    } catch {
      // Sin almacenamiento disponible: la lista local simplemente no persiste.
    }
  }

  private aEstudianteCargado(r: DemoEstudianteRecord): EstudianteCargado {
    return {
      id: r.usuario.id,
      nombre: r.usuario.nombre,
      correo: r.usuario.correo,
      numeroIdentificacion: r.usuario.numeroIdentificacion,
      edad: r.edad,
      genero: r.genero,
      contrasenaGenerada: r.contrasena,
      cargadoEn: r.cargadoEn,
    };
  }
}
