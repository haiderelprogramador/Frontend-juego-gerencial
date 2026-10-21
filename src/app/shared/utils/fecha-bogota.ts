/**
 * Fechas del backend en hora de Colombia.
 *
 * El backend manda `fechaVisualizacion`/`fechaInicioPartida`/`fechaFinPartida`
 * ya en hora de Colombia pero SIN sufijo de zona (ej. "2026-09-29T14:00:00").
 * `new Date(...)`/`Date.parse(...)` interpretarían eso como hora LOCAL DEL
 * NAVEGADOR, no de Bogotá — si alguien abre la app desde otro huso horario,
 * la comparación contra "ahora" queda corrida. Colombia no tiene horario de
 * verano, así que el offset es siempre fijo: -05:00.
 */
const OFFSET_BOGOTA = '-05:00';
const TIENE_ZONA_HORARIA = /[Zz]$|[+-]\d{2}:?\d{2}$/;

/** Parsea una fecha del backend como hora de Bogotá si no trae ya su propia zona. */
export function aFechaBogota(fecha: string | undefined): number {
  if (!fecha) {
    return NaN;
  }
  return Date.parse(TIENE_ZONA_HORARIA.test(fecha) ? fecha : `${fecha}${OFFSET_BOGOTA}`);
}

/** Hoy en Bogotá, "YYYY-MM-DD" (a las 22:30 del 21 sigue siendo el 21, aunque en UTC ya sea el 22). */
export function hoyEnBogota(ahoraMs = Date.now()): string {
  return new Date(ahoraMs - 5 * 3_600_000).toISOString().slice(0, 10);
}
