import { Injectable } from '@angular/core';

import { Rol } from '../models/rol.enum';
import { Usuario } from '../models/usuario.model';

/**
 * Registro de un docente en el almacén demo. Incluye la contraseña en claro
 * SOLO porque no hay backend: en el sistema real la validación de credenciales
 * ocurre en Spring Boot y el hash nunca llega al navegador.
 */
export interface DemoDocenteRecord {
  usuario: Usuario;
  contrasena: string;
}

/** Registro de un estudiante creado por carga masiva, en el almacén demo. */
export interface DemoEstudianteRecord {
  usuario: Usuario;
  /** Contraseña generada por el sistema (patrón USU-001-<numIdentificacion>). */
  contrasena: string;
  /** Consecutivo usado para generar la contraseña. */
  consecutivo: number;
  /** Edad y género (docs/08 §2: columnas mínimas del Excel, junto a correo/nombre/identificación). */
  edad: string;
  genero: string;
  /** Columnas del Excel que no son correo/nombre/identificación/edad/género. */
  columnasAdicionales: Record<string, string>;
  /** Fecha de carga en ISO 8601. */
  cargadoEn: string;
}

const KEYS = {
  docentes: 'bizsim.demo.docentes',
  estudiantes: 'bizsim.demo.estudiantes',
  sesion: 'bizsim.demo.sesion',
} as const;

/**
 * Único punto de persistencia del MODO DEMO.
 *
 * Guarda en `localStorage` los docentes registrados, los estudiantes cargados y
 * la sesión activa, para que el flujo completo (registro -> login -> carga de
 * estudiantes -> login de estudiante) se pueda probar sin backend.
 *
 * Cuando exista el backend real, esta clase deja de usarse: los servicios
 * pasan a llamar a `HttpClient` (ver `API_CONFIG.demoMode`).
 */
@Injectable({ providedIn: 'root' })
export class DemoDb {
  constructor() {
    this.sembrarDocenteDemoSiHaceFalta();
  }

  // ---------------------------------------------------------------------------
  // Docentes
  // ---------------------------------------------------------------------------

  docentes(): DemoDocenteRecord[] {
    return this.leer<DemoDocenteRecord[]>(KEYS.docentes, []);
  }

  buscarDocentePorCorreo(correo: string): DemoDocenteRecord | undefined {
    const objetivo = correo.trim().toLowerCase();
    return this.docentes().find((d) => d.usuario.correo.toLowerCase() === objetivo);
  }

  agregarDocente(record: DemoDocenteRecord): void {
    const docentes = this.docentes();
    docentes.push(record);
    this.escribir(KEYS.docentes, docentes);
  }

  // ---------------------------------------------------------------------------
  // Estudiantes
  // ---------------------------------------------------------------------------

  estudiantes(): DemoEstudianteRecord[] {
    return this.leer<DemoEstudianteRecord[]>(KEYS.estudiantes, []);
  }

  buscarEstudiantePorCorreo(correo: string): DemoEstudianteRecord | undefined {
    const objetivo = correo.trim().toLowerCase();
    return this.estudiantes().find((e) => e.usuario.correo.toLowerCase() === objetivo);
  }

  /** Agrega estudiantes al almacén demo y devuelve la lista completa resultante. */
  agregarEstudiantes(records: DemoEstudianteRecord[]): DemoEstudianteRecord[] {
    const actuales = this.estudiantes();
    const combinados = [...actuales, ...records];
    this.escribir(KEYS.estudiantes, combinados);
    return combinados;
  }

  // ---------------------------------------------------------------------------
  // Sesión
  // ---------------------------------------------------------------------------

  guardarSesion(sesion: { token: string; usuario: Usuario }): void {
    this.escribir(KEYS.sesion, sesion);
  }

  leerSesion(): { token: string; usuario: Usuario } | null {
    return this.leer<{ token: string; usuario: Usuario } | null>(KEYS.sesion, null);
  }

  borrarSesion(): void {
    localStorage.removeItem(KEYS.sesion);
  }

  // ---------------------------------------------------------------------------
  // Internos
  // ---------------------------------------------------------------------------

  private sembrarDocenteDemoSiHaceFalta(): void {
    if (this.docentes().length > 0) {
      return;
    }
    // Credenciales de cortesía para poder entrar sin registrarse primero.
    this.agregarDocente({
      contrasena: 'demo1234',
      usuario: {
        id: 'doc-demo',
        nombre: 'Docente Demo',
        correo: 'docente@demo.com',
        numeroIdentificacion: '00000000',
        rol: Rol.DOCENTE,
      },
    });
  }

  private leer<T>(key: string, porDefecto: T): T {
    try {
      const crudo = localStorage.getItem(key);
      return crudo ? (JSON.parse(crudo) as T) : porDefecto;
    } catch {
      return porDefecto;
    }
  }

  private escribir(key: string, valor: unknown): void {
    localStorage.setItem(key, JSON.stringify(valor));
  }
}
