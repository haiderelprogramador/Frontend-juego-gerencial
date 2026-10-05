/**
 * Contrato de "Clasificación" (API Estratego, confirmado con backend 5-oct-2026):
 *  GET /docente/simulaciones/{id}/clasificacion   (cualquier estado)
 *  GET /estudiante/simulaciones/{id}/clasificacion (solo FINALIZADA; si no, 400)
 *
 * Ojo: todos los ids son NÚMEROS. Otras entidades del frontend usan id string
 * (ej. `Usuario.id`, `EstudianteCargado.id`): nunca compararlas directo.
 */

import { EstadoSimulacion } from '../../docente/simulaciones/models/simulacion.model';

/** Resultado de una empresa en un caso. */
export interface DesgloseCaso {
  idCaso: number;
  nombreCaso: string;
  fechaFinPartida: string;
  decidio: boolean;
  /** `null` si no decidió. */
  idOpcion: number | null;
  opcionElegida: string | null;
  utilidadBase: number;
  /** Solo cuando no decidió: penalización aplicada, en %. */
  penalizacionPorcentaje: number | null;
  utilidadDelCaso: number;
}

export interface FilaClasificacion {
  /** La resuelve el backend, con empates (1, 1, 3): no se recalcula ni se reordena. */
  posicion: number;
  idEmpresa: number;
  codigoEmpresa: string;
  nombreEmpresa: string;
  utilidadAcumulada: number;
  casosSinDecision: number;
  desglose: DesgloseCaso[];
}

export interface Clasificacion {
  idSimulacion: number;
  nombreSimulacion: string;
  estadoSimulacion: EstadoSimulacion;
  /** false = vista previa (la simulación no terminó); solo la ve el docente. */
  definitiva: boolean;
  casosConsiderados: number;
  /** Vacía (no empresas en 0) cuando todavía no hay casos considerados. */
  clasificacion: FilaClasificacion[];
}
