/** Contrato real de "Simulaciones" (API Estratego, 56 endpoints), base `/docente/simulaciones`. */

export type EstadoSimulacion = 'BORRADOR' | 'PROGRAMADA' | 'EN_CURSO' | 'FINALIZADA';

/** Cuerpo de POST/PUT de una simulación. */
export interface SimulacionRequest {
  nombre: string;
  fechaInicio: string;
  fechaFin?: string;
}

/** Simulación tal como la devuelve el backend. */
export interface Simulacion {
  id: number;
  idUsuarioCoordinador: number;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  estado: EstadoSimulacion;
}
