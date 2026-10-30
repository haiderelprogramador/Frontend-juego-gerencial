/**
 * Estado financiero de UNA empresa en un caso, tal como lo calcula el backend
 * (contratos D2 y A/B, oct-2026). Es el mismo shape en todos los lugares
 * donde aparece: `CasoActual.financieroEmpresa`, la historia por empresa
 * (docente y estudiante) y `estados-empresas` del docente.
 */

import { FinancieroCaso } from './caso-api.model';
import { FinancieroEntrada, IndicadoresFinancieros } from './financiero.model';

/** De dónde sale el financiero INICIAL de la empresa: cargado por el docente (primer caso) o heredado del caso anterior. */
export type OrigenFinancieroInicial = 'docente' | 'heredado';

/** De dónde sale el financiero FINAL: la opción que eligió la empresa, o la penalización por no decidir. */
export type OrigenFinancieroFinal = 'decision' | 'penalizacion';

/**
 * Las 19 partidas + los 4 totales, SIEMPRE con valor (nunca `null`). Por eso es
 * un tipo distinto del nullable `FinancieroCasoApi` de los casos siguientes, y
 * no hay que unificarlos. `efectivo` (y por arrastre otras partidas) puede
 * venir NEGATIVO si la empresa acumuló pérdidas: mostrarlo en rojo o con
 * alerta, no como un número normal.
 *
 * `indicadores` (contrato A): los calcula el backend, como fracción con 4
 * decimales (0.1234 = 12,34 %), con las mismas reglas que `calcularFinanciero`
 * (`null` si el denominador es 0; ROE `null` con patrimonio negativo). Hasta
 * que el backend lo despliegue puede no venir: la UI lo trata como opcional.
 *
 * `penalizacionPorcentaje` (doc API 30-oct-2026): el porcentaje sorteado
 * entre `penalizacionMin` y `penalizacionMax` del caso, en porcentaje (5.75 =
 * 5,75 %). Solo trae valor en un final con origen `penalizacion`; si no, `null`.
 */
export type EstadoFinancieroEmpresa<O extends string> = { origen: O; penalizacionPorcentaje: number | null } &
  FinancieroEntrada &
  FinancieroCaso & { indicadores: IndicadoresFinancieros };

/**
 * Un caso en la historia de una empresa (contrato B):
 * GET /docente/empresas/{id}/historia y GET /estudiante/empresas/{id}/historia.
 * La lista viene en orden de partida y solo trae los casos en que la empresa
 * ya tiene estados. Un estado que todavía no existe viene en `null`: el caso
 * en curso trae `final: null` (y el doc no descarta un `inicial: null`).
 */
export interface HistoriaCasoEmpresa {
  idCaso: number;
  nombreCaso: string;
  fechaInicioPartida: string;
  inicial: EstadoFinancieroEmpresa<OrigenFinancieroInicial> | null;
  final: EstadoFinancieroEmpresa<OrigenFinancieroFinal> | null;
}

/**
 * Único punto donde se normaliza `origen`: el doc del 30-oct lo escribe en
 * minúsculas en la tabla y en MAYÚSCULAS en el ejemplo JSON. ngrok lo mandó
 * en minúsculas (30-oct-2026); si algún día llega en mayúsculas, el resto de
 * la app sigue comparando contra `'docente'`, `'penalizacion'`, etc.
 * Lo aplican los servicios que reciben estados (portal del estudiante y
 * empresas del docente), no las pantallas.
 */
export function aEstadoEmpresa<O extends string>(
  estado: EstadoFinancieroEmpresa<O> | null | undefined,
): EstadoFinancieroEmpresa<O> | null {
  if (!estado) {
    return null;
  }
  const origen = typeof estado.origen === 'string' ? (estado.origen.toLowerCase() as O) : estado.origen;
  return { ...estado, origen };
}

export function aHistoriaCasoEmpresa(h: HistoriaCasoEmpresa): HistoriaCasoEmpresa {
  return { ...h, inicial: aEstadoEmpresa(h.inicial), final: aEstadoEmpresa(h.final) };
}

