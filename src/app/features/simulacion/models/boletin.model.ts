/**
 * Boletín del caso (contrato D14, oct-2026): los factores de entorno que el
 * docente publica para un caso y que las empresas ven en su portal. Es solo
 * informativo: no entra en el cálculo financiero.
 *
 *  - Docente: PUT/GET/DELETE `/docente/casos/{id}/boletin`.
 *  - Estudiante: GET `/estudiante/casos/{id}/boletin`, y además viene en
 *    `CasoActual.boletin`.
 *  - Los GET responden 204 (sin cuerpo) si el caso no tiene boletín: el
 *    frontend lo representa como `null`.
 */

/** Largo máximo de `nota` que acepta el backend. */
export const NOTA_BOLETIN_MAX = 2000;

/**
 * Rangos del contrato (inclusive), en porcentaje. Fuera de ellos el backend
 * responde 400 con `errores[].campo`. La tasa de cambio solo tiene que ser
 * mayor que 0 (sin tope).
 */
export const RANGO_INFLACION = { min: -100, max: 1000 } as const;
export const RANGO_TASA_INTERES = { min: 0, max: 1000 } as const;

/** Campos del boletín que el backend puede señalar en `errores[].campo`. */
export type CampoBoletin = 'inflacion' | 'tasaInteres' | 'tasaCambio' | 'nota';

/** Cuerpo del PUT: crea el boletín o reemplaza el que había. */
export interface BoletinRequest {
  /** En porcentaje: 5.2 = 5,2 %. */
  inflacion: number;
  /** En porcentaje: 5.2 = 5,2 %. */
  tasaInteres: number;
  /** Pesos colombianos por dólar (COP/USD). */
  tasaCambio: number;
  /** Hasta `NOTA_BOLETIN_MAX` caracteres; se omite si el docente no escribió nada. */
  nota?: string;
}

/** Boletín tal como lo devuelve el backend (al docente y al estudiante). */
export interface Boletin extends Omit<BoletinRequest, 'nota'> {
  idCaso: number;
  /** El contrato no dice si una nota vacía llega como `null` o no llega: se aceptan las dos. */
  nota?: string | null;
  publicadoEn: string;
  actualizadoEn: string;
}

const formatoPorcentaje = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
const formatoCop = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** "5,2 %" a partir de 5.2 (el backend ya lo manda en porcentaje, no como fracción). */
export function formatearPorcentajeBoletin(valor: number): string {
  return `${formatoPorcentaje.format(valor)} %`;
}

/** "$4.150,50 COP/USD". */
export function formatearTasaCambio(valor: number): string {
  return `$${formatoCop.format(valor)} COP/USD`;
}
