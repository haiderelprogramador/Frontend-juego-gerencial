import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';

import { API_CONFIG, apiUrl } from '../../../../core/api/api.config';
import { DemoDb, DemoEstudianteRecord } from '../../../../core/demo/demo-db';
import { Rol } from '../../../../core/models/rol.enum';
import {
  CargaMasivaRequest,
  CargaMasivaResponse,
  EstudianteCargado,
} from '../models/estudiante.model';
import { generarContrasena } from './generar-contrasena';

/**
 * Carga masiva y consulta de estudiantes (rol DOCENTE).
 *
 * Contrato de API (Spring Boot, aún no implementado):
 *  - GET  {@link API_CONFIG.endpoints.estudiantes}            -> EstudianteCargado[]
 *  - POST {@link API_CONFIG.endpoints.estudiantesCargaMasiva} body CargaMasivaRequest
 *        -> CargaMasivaResponse { creados, errores }
 *
 * El frontend envía SOLO los datos del Excel. La asignación del consecutivo y la
 * generación de la contraseña (patrón USU-###-<identificación>) son
 * responsabilidad del BACKEND; aquí el MOCK las simula (ver `generarContrasena`,
 * que en producción no se usaría) y persiste en {@link DemoDb} (localStorage)
 * para que el estudiante pueda iniciar sesión de inmediato. La firma pública no
 * cambia cuando llegue el backend real.
 */
@Injectable({ providedIn: 'root' })
export class EstudianteService {
  private readonly http = inject(HttpClient);
  private readonly demo = inject(DemoDb);

  /** Cantidad de estudiantes ya cargados (dato informativo para el docente). */
  contarExistentes(): number {
    if (!API_CONFIG.demoMode) {
      // Con backend real esto se resolvería con una llamada GET (listar()).
      return 0;
    }
    return this.demo.estudiantes().length;
  }

  listar(): Observable<EstudianteCargado[]> {
    if (!API_CONFIG.demoMode) {
      return this.http.get<EstudianteCargado[]>(apiUrl(API_CONFIG.endpoints.estudiantes));
    }
    return of(this.demo.estudiantes().map((r) => this.aEstudianteCargado(r))).pipe(
      delay(API_CONFIG.demoLatenciaMs),
    );
  }

  cargaMasiva(req: CargaMasivaRequest): Observable<CargaMasivaResponse> {
    if (!API_CONFIG.demoMode) {
      return this.http.post<CargaMasivaResponse>(
        apiUrl(API_CONFIG.endpoints.estudiantesCargaMasiva),
        req,
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
        errores.push({ correo: e.correo, motivo: 'Ya existe un estudiante con ese correo.' });
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
