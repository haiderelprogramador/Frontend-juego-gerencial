/**
 * Contrato real de "Casos" (API Estratego, 56 endpoints, doc 28-sep-2026).
 *
 * Distinto de {@link ../models/caso.model.ts} (`Caso`/`CasoFormulario`): ese es
 * el modelo de la capa visual/mock (`CasoService`, financiero en strings de
 * formulario). Este archivo es el DTO tal como lo define el backend real
 * (financiero en números, ids numéricos, opciones con `id`/`orden`). Los
 * nombres de campo se repiten a propósito para que migrar la UI del mock al
 * backend real sea, sobre todo, un cambio de tipos — no de nombres.
 */

import { CampoFinanciero, FinancieroEntrada, ImpactoOpcion } from './financiero.model';

export type EstadoCaso = 'borrador' | 'activo';

/** Asignación de equipos PARA ESTE CASO puntual (no confundir con "Formar equipos"). */
export type AsignacionEquiposCaso = 'manual' | 'automatica';

/** Opción del catálogo tal como se manda al crear/editar un caso. */
export interface OpcionCasoRequest {
  opcion: string;
  resultado: string;
  /**
   * Impacto financiero declarado: solo los drivers con efecto. Se omite si la
   * opción no tiene impacto. Backend responde 400 ante una clave fuera de
   * `DRIVERS_IMPACTO`, un `tipo` distinto de porcentaje/monto o un % < -100.
   */
  impacto?: ImpactoOpcion;
}

/**
 * Opción tal como la devuelve el backend. El `id` cambia cada vez que se edita
 * el caso completo (PUT reemplaza todo, incluidas las opciones).
 */
export interface OpcionCasoApi {
  id: number;
  orden: number;
  opcion: string;
  resultado: string;
  /** Solo los drivers declarados (los demás no vienen); `null` si la opción no tiene impacto. */
  impacto: ImpactoOpcion | null;
}

/**
 * Así ve el estudiante una opción antes de decidir: SIN `resultado` ni
 * `impacto` — el efecto es la sorpresa hasta ese momento. Ver
 * `aOpcionEstudiante()`: el portal arma este objeto por lista blanca, no
 * confía en que el backend no mande los campos de más.
 */
export type OpcionCasoEstudiante = Omit<OpcionCasoApi, 'resultado' | 'impacto'>;

/**
 * Los 4 totales que CALCULA el backend a partir de las 19 partidas. Solo
 * vienen en la respuesta: si se mandan en el request, el backend los ignora.
 */
export interface FinancieroCaso {
  activoTotal: number;
  pasivoTotal: number;
  patrimonio: number;
  utilidadNeta: number;
}

/**
 * `financiero` del request: las 19 partidas, todas obligatorias (backend
 * responde 400 "... es obligatorio" si falta o viene `null` alguna).
 */
export type FinancieroCasoRequest = FinancieroEntrada;

/**
 * `financiero` tal como lo DEVUELVE el backend: los 4 totales calculados + las
 * 19 partidas. Los casos creados antes del modelo detallado traen las 19 en `null`.
 */
export type FinancieroCasoApi = FinancieroCaso & Record<CampoFinanciero, number | null>;

/** Campos comunes a request y respuesta de un caso. */
interface CasoBase {
  /** No se edita: al editar, el select de simulación queda deshabilitado. */
  idSimulacion: number;
  nombre: string;
  tipo: string;
  mision: string;
  vision: string;
  /** Rango (no un valor fijo, docs/02 §6) de penalización por no decidir, en %. */
  penalizacionMin: number;
  penalizacionMax: number;
  /**
   * ⚠️ Bug confirmado en vivo (29-sep-2026): el backend NO convierte fechas
   * con `Z`/offset a hora de Colombia — les quita el sufijo y guarda los
   * mismos dígitos de reloj tal cual, quedando ~5h adelantado (bloquea
   * `POST /estudiante/decision` con "La partida aún no ha iniciado" aunque
   * el caso esté activo). Mandar estas 3 fechas como hora de Bogotá SIN
   * sufijo de zona (ej. "2026-09-29T14:00:00", NO ".toISOString()" ni "...Z").
   * Si el formulario usa un `<input type="datetime-local">` y el docente está
   * físicamente en Colombia, el valor crudo del input ya sirve tal cual — el
   * problema aparece si se lo convierte a UTC (`new Date(...).toISOString()`)
   * antes de mandarlo. Ver `scripts/integration/estratego-api.integration.mjs`
   * (función `bogotaISO`) para la prueba que confirmó esto.
   */
  fechaVisualizacion: string;
  fechaInicioPartida: string;
  fechaFinPartida: string;
  asignacionEquipos: AsignacionEquiposCaso;
}

/** Cuerpo de POST/PUT de un caso (crear y editar usan el mismo shape). */
export interface CasoRequest extends CasoBase {
  financiero: FinancieroCasoRequest;
  opciones: OpcionCasoRequest[];
}

/** Caso tal como lo devuelve el backend al docente (GET/POST/PUT/activar). */
export interface CasoApi extends CasoBase {
  id: number;
  estado: EstadoCaso;
  financiero: FinancieroCasoApi;
  opciones: OpcionCasoApi[];
}

/**
 * Caso tal como lo ve el estudiante: mismos campos que `CasoApi` más
 * `partidaIniciada`/`partidaFinalizada`, y las opciones SIN `resultado` (el
 * efecto se revela recién cuando decide).
 */
export interface CasoEstudiante extends Omit<CasoApi, 'opciones'> {
  partidaIniciada: boolean;
  partidaFinalizada: boolean;
  opciones: OpcionCasoEstudiante[];
}

/**
 * Copia por lista blanca (id, orden, opcion) de una opción que llega al portal
 * del estudiante: aunque el backend mandara `resultado` o `impacto`, no quedan
 * en el estado de la app. Ojo: esto NO los oculta de la pestaña Network del
 * navegador — eso solo lo garantiza el backend no serializándolos.
 */
export function aOpcionEstudiante(o: OpcionCasoEstudiante): OpcionCasoEstudiante {
  return { id: o.id, orden: o.orden, opcion: o.opcion };
}

export function aCasoEstudiante(caso: CasoEstudiante): CasoEstudiante {
  return { ...caso, opciones: (caso.opciones ?? []).map(aOpcionEstudiante) };
}

/** Una fila de GET /docente/casos/{id}/decisiones — el estado de decisión de una empresa. */
export interface DecisionEmpresa {
  idEmpresa: number;
  codigoEmpresa: string;
  nombreEmpresa: string;
  decidio: boolean;
  /** Los siguientes 4 solo tienen valor cuando `decidio` es true. */
  idOpcion: number | null;
  opcion: string | null;
  resultado: string | null;
  decididaPor: string | null;
  fechaDecision: string | null;
}
