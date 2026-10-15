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
 */
export type EstadoFinancieroEmpresa<O extends string> = { origen: O } & FinancieroEntrada &
  FinancieroCaso & { indicadores: IndicadoresFinancieros };

/**
 * Un caso en la historia de una empresa (contrato B):
 * GET /docente/empresas/{id}/historia y GET /estudiante/empresas/{id}/historia.
 * La lista viene ordenada por caso; el caso en curso trae `final: null` y los
 * casos en que la empresa no participó no aparecen.
 */
export interface HistoriaCasoEmpresa {
  idCaso: number;
  nombreCaso: string;
  fechaInicioPartida: string;
  inicial: EstadoFinancieroEmpresa<OrigenFinancieroInicial>;
  final: EstadoFinancieroEmpresa<OrigenFinancieroFinal> | null;
}
