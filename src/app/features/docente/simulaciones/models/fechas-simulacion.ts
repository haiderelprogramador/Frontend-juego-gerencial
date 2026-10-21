import { hoyEnBogota } from '../../../../shared/utils/fecha-bogota';

/**
 * Fechas de Simulación: el backend las guarda como día, sin hora
 * ("2026-11-20", confirmado en vivo el 21-oct-2026). Los formularios usan
 * `<input type="date">` y las mandan tal cual: pasarlas por `toISOString()`
 * correría el día en la noche de Bogotá (22:30 del 21 = 03:30Z del 22) y,
 * con el arranque automático, cambiaría cuándo arranca la simulación.
 */
export const SOLO_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Reglas de crear y de editar: nombre e inicio obligatorios, inicio no
 * pasado (hoy sí vale) y fin no anterior al inicio (igual sí). Las fechas
 * "YYYY-MM-DD" se comparan como texto. El backend acepta un inicio pasado
 * (200, probado el 21-oct-2026): solo lo frena esta validación.
 */
export function validarFechasSimulacion(
  nombre: string,
  inicio: string,
  fin: string,
  hoy = hoyEnBogota(),
): string | null {
  if (!nombre || !inicio) {
    return 'Poné un nombre y la fecha de inicio.';
  }
  if (!SOLO_DIA.test(inicio) || (fin && !SOLO_DIA.test(fin))) {
    return 'Revisá las fechas: no son válidas.';
  }
  if (inicio < hoy) {
    return 'La fecha de inicio no puede ser pasada.';
  }
  if (fin && fin < inicio) {
    return 'La fecha de fin no puede ser anterior a la de inicio.';
  }
  return null;
}

/** La fecha de una simulación para `<input type="date">` ("2026-10-25"); '' si no trae una. */
export function aInputDia(fecha: string): string {
  return /^\d{4}-\d{2}-\d{2}/.exec(fecha ?? '')?.[0] ?? '';
}
