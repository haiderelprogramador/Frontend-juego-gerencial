/**
 * Partida (backend rama `develop`, PartidaController / PartidaResponse).
 *
 * Es el "cuándo se juega" de un caso: fechas, duración, estado y equipos
 * asignados. Estados: CONFIGURADA → PROGRAMADA → EN_CURSO → FINALIZADA.
 *
 * ⚠️ `casoId` es numérico en el backend, pero el backend todavía NO tiene la
 * entidad Caso (los casos del frontend viven en `CasoService` con ids tipo
 * "caso-1"). Hasta que exista, el casoId que se mande es solo un número de
 * referencia.
 */
export type EstadoPartida = 'CONFIGURADA' | 'PROGRAMADA' | 'EN_CURSO' | 'FINALIZADA';

export interface Partida {
  id: number;
  casoId: number;
  docenteId: number;
  /** ISO local sin zona, p. ej. "2026-10-01T08:00:00" (LocalDateTime de Java). */
  fechaHoraInicio: string;
  fechaHoraCierre: string;
  duracionMinutos: number;
  fechaVisualizacion: string | null;
  estado: EstadoPartida;
  equipoIds: number[];
}

/** POST /docente/partidas. La fecha de inicio debe ser futura. */
export interface CrearPartidaRequest {
  casoId: number;
  fechaHoraInicio: string;
  duracionMinutos: number;
  fechaVisualizacion?: string | null;
}

/** PUT /docente/partidas/{id} (solo en CONFIGURADA o PROGRAMADA). */
export interface ActualizarPartidaRequest {
  fechaHoraInicio: string;
  duracionMinutos: number;
  fechaVisualizacion?: string | null;
}

/** Respuesta de GET/POST /docente/partidas/{id}/equipos. */
export interface PartidaEquipos {
  partidaId: number;
  equipos: Array<{
    id: number;
    nombre: string;
    docenteId: number;
    liderId: number;
    estudianteIds: number[];
  }>;
}
