/**
 * Modelos de la carga masiva de estudiantes por Excel (docs/03, docs/08 §2).
 *
 * Confirmado con el cliente:
 *  - El docente sube un Excel con el listado de estudiantes.
 *  - De cada fila se extrae, como MÍNIMO: correo, nombre, número de
 *    identificación, edad y género (docs/08 §2).
 *  - El Excel "puede traer más columnas" -> se conservan en `columnasAdicionales`.
 *  - A cada estudiante el BACKEND le genera una contraseña con patrón
 *    USU-<consecutivo>-<numeroIdentificacion>; el estudiante NO la elige y el
 *    FRONTEND NO la genera. El frontend solo la recibe y la muestra en el
 *    resultado (o la simula el mock mientras no haya backend).
 */

/** Fila del Excel ya normalizada (una por estudiante detectado en el archivo). */
export interface FilaEstudianteExcel {
  /** Número de fila en el Excel (1 = primera fila de datos), para reportar errores. */
  fila: number;
  correo: string;
  nombre: string;
  numeroIdentificacion: string;
  edad: string;
  genero: string;
  /**
   * Cualquier otra columna del Excel (encabezado -> valor como texto), además
   * de las 5 mínimas confirmadas (docs/08 §2).
   * TODO: confirmar con el cliente si hay más columnas fijas (¿programa
   * académico? ¿grupo? ¿equipo asignado?) para darles un campo propio en vez
   * de dejarlas en esta bolsa genérica.
   */
  columnasAdicionales: Record<string, string>;
}

/** Estado de validación de una fila antes de confirmar la carga. */
export type EstadoFila = 'ok' | 'error';

/** Fila de la previsualización: datos leídos del Excel + resultado de validación. */
export interface FilaPrevisualizacion {
  fila: number;
  nombre: string;
  correo: string;
  numeroIdentificacion: string;
  edad: string;
  genero: string;
  columnasAdicionales: Record<string, string>;
  estado: EstadoFila;
  /** Motivos por los que la fila no se puede cargar (si estado = 'error'). */
  errores: string[];
}

/**
 * Cuerpo de POST /docente/estudiantes/carga-masiva.
 * El frontend envía SOLO los datos del Excel; el consecutivo y la contraseña
 * los asigna el backend.
 */
export interface CargaMasivaRequest {
  cursoId?: string;
  estudiantes: Array<{
    nombre: string;
    correo: string;
    numeroIdentificacion: string;
    edad: string;
    genero: string;
    columnasAdicionales: Record<string, string>;
  }>;
}

/** Estudiante ya persistido (respuesta del backend / almacén demo). */
export interface EstudianteCargado {
  id: string;
  nombre: string;
  correo: string;
  numeroIdentificacion: string;
  edad: string;
  genero: string;
  contrasenaGenerada: string;
  cargadoEn: string;
  cursoId?: string;
}

/** Respuesta de POST /docente/estudiantes/carga-masiva. */
export interface CargaMasivaResponse {
  creados: EstudianteCargado[];
  /** Filas rechazadas por el backend (p. ej. correo ya existente). */
  errores: Array<{ correo: string; motivo: string }>;
}
