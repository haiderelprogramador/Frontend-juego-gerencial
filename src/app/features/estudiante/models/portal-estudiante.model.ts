/**
 * Contrato real del "Portal del estudiante" (API Estratego, 56 endpoints, doc
 * 28-sep-2026), base `/estudiante`.
 */

import { Boletin } from '../../simulacion/models/boletin.model';
import { CasoEstudiante } from '../../simulacion/models/caso-api.model';
import {
  EstadoFinancieroEmpresa,
  OrigenFinancieroFinal,
  OrigenFinancieroInicial,
} from '../../simulacion/models/estado-empresa.model';
import { ImpactoOpcion } from '../../simulacion/models/financiero.model';
import { DepartamentoIntegrante } from '../../docente/integrantes/models/integrante.model';

// El estado por empresa también lo usa el docente (historia, estados-empresas): vive en simulacion/models.
export type {
  EstadoFinancieroEmpresa,
  HistoriaCasoEmpresa,
  OrigenFinancieroFinal,
  OrigenFinancieroInicial,
} from '../../simulacion/models/estado-empresa.model';

/** `financieroEmpresa` de GET /estudiante/caso-actual (contrato D2, oct-2026). */
export interface FinancieroEmpresa {
  inicial: EstadoFinancieroEmpresa<OrigenFinancieroInicial>;
  /** Misma forma que `inicial` (confirmado con backend), solo cambia `origen`. `null` hasta que el caso cierra. */
  final: EstadoFinancieroEmpresa<OrigenFinancieroFinal> | null;
}

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
  /**
   * Financiero de la empresa del estudiante en este caso (inicial y final).
   * Reemplaza a `caso.financiero`, que es el compartido viejo y se retira en
   * una segunda fase. No quitar el manejo de `caso.financiero` todavía.
   */
  financieroEmpresa: FinancieroEmpresa;
  /** Solo el líder puede decidir por la empresa (POST /estudiante/decision). */
  esLider: boolean;
  /** false si, aun siendo líder, no se cumplen las condiciones para decidir
   * (caso no activo, simulación fuera de PROGRAMADA/EN_CURSO, fuera de fecha). */
  puedeDecidir: boolean;
  caso: CasoEstudiante;
  decision: Decision | null;
  /**
   * Boletín del caso (D14): factores de entorno publicados por el docente.
   * `null` si no publicó ninguno. El backend todavía no manda el campo (está
   * "en camino", oct-2026): `undefined` (no vino) NO es lo mismo que `null`
   * (vino vacío). Sin el campo, el portal lo pide a
   * GET /estudiante/casos/{id}/boletin; cuando llegue, deja de pedirlo solo.
   */
  boletin?: Boletin | null;
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
 * Integrante de la empresa del estudiante (confirmado en vivo, 21-oct-2026:
 * `idUsuario`, no `id`; `departamento` con el mismo enum que en
 * `/docente/empresas/{id}/integrantes`).
 */
export interface IntegranteEmpresa {
  idUsuario: number;
  nombre: string;
  correo: string;
  departamento: DepartamentoIntegrante;
  esLider: boolean;
}

/** Detalle de la empresa del estudiante (GET /estudiante/empresas/{idEmpresa}). */
export interface MiEmpresa {
  id: number;
  idSimulacion: number;
  codigoEmpresa: string;
  nombre: string;
  estrategia: string | null;
  tipoJugador: string;
  estado: string;
  integrantes: IntegranteEmpresa[];
}
