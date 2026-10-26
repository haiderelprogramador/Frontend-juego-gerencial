import { hoyEnBogota } from '../../../../shared/utils/fecha-bogota';

/**
 * Fechas de Simulación: el backend las guarda como día, sin hora
 * ("2026-11-20", confirmado en vivo el 21-oct-2026). Los formularios usan
 * `<input type="date">` y las mandan tal cual: pasarlas por `toISOString()`
 * correría el día en la noche de Bogotá (22:30 del 21 = 03:30Z del 22) y,
 * con el arranque automático, cambiaría cuándo arranca la simulación.
 */
export const SOLO_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** El error de "inicio pasado": el panel lo muestra debajo del campo, como el 400 del backend. */
export const MENSAJE_INICIO_PASADO = 'La fecha de inicio no puede ser pasada.';

/**
 * Reglas de crear y de editar: nombre e inicio obligatorios, inicio no
 * pasado (hoy sí vale) y fin no anterior al inicio (igual sí). Las fechas
 * "YYYY-MM-DD" se comparan como texto.
 *
 * Al editar, `inicioAnterior` es el que ya tenía la simulación: si no cambió,
 * no se valida como pasado, igual que en el backend (400 en el PUT con un
 * inicio pasado, salvo que sea el mismo que ya tenía; por ejemplo, una
 * BORRADOR vencida a la que solo le cambian el nombre).
 */
export function validarFechasSimulacion(
  nombre: string,
  inicio: string,
  fin: string,
  hoy = hoyEnBogota(),
  inicioAnterior?: string,
): string | null {
  if (!nombre || !inicio) {
    return 'Poné un nombre y la fecha de inicio.';
  }
  if (!SOLO_DIA.test(inicio) || (fin && !SOLO_DIA.test(fin))) {
    return 'Revisá las fechas: no son válidas.';
  }
  if (inicio < hoy && inicio !== inicioAnterior) {
    return MENSAJE_INICIO_PASADO;
  }
  if (fin && fin < inicio) {
    return 'La fecha de fin no puede ser anterior a la de inicio.';
  }
  return null;
}

/** true si `fecha` ("YYYY-MM-DD") ya pasó: antes de hoy en Bogotá. */
export function diaYaPaso(fecha: string, hoy = hoyEnBogota()): boolean {
  return SOLO_DIA.test(fecha) && fecha < hoy;
}

/** La fecha de una simulación para `<input type="date">` ("2026-10-25"); '' si no trae una. */
export function aInputDia(fecha: string): string {
  return /^\d{4}-\d{2}-\d{2}/.exec(fecha ?? '')?.[0] ?? '';
}
