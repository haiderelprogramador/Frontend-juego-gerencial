/**
 * Contrato real del "Portal del estudiante" (API Estratego, 56 endpoints, doc
 * 28-sep-2026), base `/estudiante`.
 */

import { CasoEstudiante } from '../../simulacion/models/caso-api.model';
import { ImpactoOpcion } from '../../simulacion/models/financiero.model';

/** Decisión tomada por la empresa del estudiante en un caso. */
export interface Decision {
  idCaso: number;
  idEmpresa: number;
  idOpcion: number;
  opcion: string;
  resultado: string;
  /** Impacto declarado de la opción ELEGIDA (solo llega después de decidir); `null` si no tenía. */
  impacto: ImpactoOpcion | null;
  /** Nombre o correo de quien decidió (el líder). */
  decididaPor: string;
  fechaDecision: string;
}

/**
 * El caso activo (o el más reciente visible) para la empresa del estudiante
 * autenticado, dentro de una simulación.
 */
export interface CasoActual {
  idSimulacion: number;
  nombreSimulacion: string;
  idEmpresa: number;
  nombreEmpresa: string;
  /** Solo el líder puede decidir por la empresa (POST /estudiante/decision). */
  esLider: boolean;
  /** false si, aun siendo líder, no se cumplen las condiciones para decidir
   * (caso no activo, simulación fuera de PROGRAMADA/EN_CURSO, fuera de fecha). */
  puedeDecidir: boolean;
  caso: CasoEstudiante;
  decision: Decision | null;
}

/** Una simulación en la que participa el estudiante (para GET /estudiante/simulaciones). */
export interface MiSimulacion {
  idSimulacion: number;
  nombreSimulacion: string;
  fechaInicio: string;
  fechaFin: string;
  estado: string;
  idEmpresa: number;
  codigoEmpresa: string;
  nombreEmpresa: string;
  departamento: string;
  esLider: boolean;
}

/**
 * Integrante de la empresa del estudiante.
 * 🔎 INFERENCIA: el doc no detalla el shape de cada fila de `integrantes[]`.
 */
export interface IntegranteEmpresa {
  id: number;
  nombre: string;
  correo: string;
  esLider: boolean;
}

/** Detalle de la empresa del estudiante (GET /estudiante/empresas/{idEmpresa}). */
export interface MiEmpresa {
  id: number;
  idSimulacion: number;
  codigoEmpresa: string;
  nombre: string;
  estrategia: string;
  tipoJugador: string;
  estado: string;
  integrantes: IntegranteEmpresa[];
}
