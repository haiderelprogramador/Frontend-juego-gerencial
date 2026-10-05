/**
 * Información financiera detallada del caso: balance + estado de resultados +
 * flujo de efectivo (19 partidas de entrada) y lo que se deriva de ellas.
 *
 * Reglas confirmadas por backend (oct-2026):
 * - El request lleva solo las 19 partidas; activoTotal, pasivoTotal,
 *   patrimonio y utilidadNeta los calcula el backend (vienen solo en la respuesta).
 * - Todas las partidas son >= 0 salvo utilidadesRetenidas y los 3 flujos.
 * - 400 "El balance no cuadra" si activoTotal ≠ pasivoTotal + patrimonio,
 *   con patrimonio = capitalSocial + utilidadesRetenidas + utilidadNeta.
 *
 * Las fórmulas de los subtotales (corriente/no corriente, utilidad bruta,
 * operativa, etc.), de `efectivoFinal` y de los indicadores son cálculos
 * del frontend para mostrar; el backend no los valida.
 */

export const CAMPOS_FINANCIEROS = [
  // Balance — Activo
  'efectivo',
  'cuentasPorCobrar',
  'inventarios',
  'propiedadPlantaEquipo',
  'activosIntangibles',
  // Balance — Pasivo
  'cuentasPorPagar',
  'obligacionesFinancierasCortoPlazo',
  'obligacionesFinancierasLargoPlazo',
  // Balance — Patrimonio
  'capitalSocial',
  'utilidadesRetenidas',
  // Estado de resultados
  'ventasNetas',
  'costoVentas',
  'gastosAdministracion',
  'gastosVentas',
  'gastosFinancieros',
  'impuestoRenta',
  // Flujo de efectivo
  'flujoOperativo',
  'flujoInversion',
  'flujoFinanciacion',
] as const;

export type CampoFinanciero = (typeof CAMPOS_FINANCIEROS)[number];

/** Las únicas partidas que pueden ser negativas (el resto debe ser >= 0). */
export const CAMPOS_ADMITEN_NEGATIVO: ReadonlySet<CampoFinanciero> = new Set<CampoFinanciero>([
  'utilidadesRetenidas',
  'flujoOperativo',
  'flujoInversion',
  'flujoFinanciacion',
]);

/** Las 19 partidas tal como las escribe el docente (texto de formulario). */
export type FinancieroTexto = Record<CampoFinanciero, string>;

/** Las 19 partidas ya convertidas a número. */
export type FinancieroEntrada = Record<CampoFinanciero, number>;

export const ETIQUETAS_FINANCIERO: Record<CampoFinanciero, string> = {
  efectivo: 'Efectivo',
  cuentasPorCobrar: 'Cuentas por cobrar',
  inventarios: 'Inventarios',
  propiedadPlantaEquipo: 'Propiedad, planta y equipo',
  activosIntangibles: 'Activos intangibles',
  cuentasPorPagar: 'Cuentas por pagar',
  obligacionesFinancierasCortoPlazo: 'Obligaciones financieras de corto plazo',
  obligacionesFinancierasLargoPlazo: 'Obligaciones financieras de largo plazo',
  capitalSocial: 'Capital social',
  utilidadesRetenidas: 'Utilidades retenidas',
  ventasNetas: 'Ventas netas',
  costoVentas: 'Costo de ventas',
  gastosAdministracion: 'Gastos de administración',
  gastosVentas: 'Gastos de ventas',
  gastosFinancieros: 'Gastos financieros',
  impuestoRenta: 'Impuesto de renta',
  flujoOperativo: 'Flujo de operación',
  flujoInversion: 'Flujo de inversión',
  flujoFinanciacion: 'Flujo de financiación',
};

export interface TotalesFinancieros {
  activoCorriente: number;
  activoNoCorriente: number;
  activoTotal: number;
  pasivoCorriente: number;
  pasivoNoCorriente: number;
  pasivoTotal: number;
  utilidadBruta: number;
  utilidadOperativa: number;
  utilidadAntesImpuestos: number;
  utilidadNeta: number;
  patrimonio: number;
  efectivoFinal: number;
}

/** Razones financieras. `null` cuando el denominador es 0 (no se puede calcular). */
export interface IndicadoresFinancieros {
  razonCorriente: number | null;
  pruebaAcida: number | null;
  endeudamiento: number | null;
  margenNeto: number | null;
  roe: number | null;
  roa: number | null;
}

export interface ResultadoFinanciero {
  totales: TotalesFinancieros;
  indicadores: IndicadoresFinancieros;
  /** Activo total − (pasivo total + patrimonio). Distinto de 0 → el backend responde 400. */
  descuadre: number;
}

export function financieroVacio(): FinancieroTexto {
  return Object.fromEntries(CAMPOS_FINANCIEROS.map((c) => [c, ''])) as FinancieroTexto;
}

/**
 * Partidas sin completar. Backend exige las 19 (400 "... es obligatorio"): un
 * campo vacío NO se manda como 0, porque en un caso viejo eso pisaría sus
 * totales con ceros sin que el docente lo note.
 */
export function camposSinCompletar(f: FinancieroTexto): CampoFinanciero[] {
  return CAMPOS_FINANCIEROS.filter((c) => f[c].trim() === '');
}

/** `true` si el docente no escribió nada en ninguna de las 19 partidas. */
export function financieroEstaVacio(f: FinancieroTexto): boolean {
  return CAMPOS_FINANCIEROS.every((c) => f[c].trim() === '');
}

/**
 * Partidas tal como las devuelve el backend → texto de formulario. Los casos
 * creados antes del modelo detallado traen las 19 en `null` (o sin la clave):
 * quedan como campo vacío, nunca como "null".
 */
export function financieroDesdeApi(
  partidas: Partial<Record<CampoFinanciero, number | null>> | null | undefined,
): FinancieroTexto {
  return Object.fromEntries(
    CAMPOS_FINANCIEROS.map((c) => {
      const v = partidas?.[c];
      return [c, v == null ? '' : String(v)];
    }),
  ) as FinancieroTexto;
}

/** "$1.850.000" -> 1850000 (formato latino: "." de miles, "," decimal). Vacío o no numérico -> 0. */
export function aNumero(texto: string): number {
  const limpio = texto.trim().replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(limpio);
  return Number.isFinite(n) ? n : 0;
}

export function financieroANumeros(f: FinancieroTexto): FinancieroEntrada {
  return Object.fromEntries(CAMPOS_FINANCIEROS.map((c) => [c, aNumero(f[c])])) as FinancieroEntrada;
}

/** Partidas con un valor negativo que no admiten negativo (regla de signo del backend). */
export function camposConSignoInvalido(e: FinancieroEntrada): CampoFinanciero[] {
  return CAMPOS_FINANCIEROS.filter((c) => !CAMPOS_ADMITEN_NEGATIVO.has(c) && e[c] < 0);
}

function razon(numerador: number, denominador: number): number | null {
  return denominador === 0 ? null : numerador / denominador;
}

/**
 * Totales, subtotales e indicadores a partir de las 19 partidas. Costos y
 * gastos se escriben en positivo y se restan; los 3 flujos de efectivo llevan
 * su propio signo (ej. comprar maquinaria es un flujo de inversión negativo).
 */
export function calcularFinanciero(e: FinancieroEntrada): ResultadoFinanciero {
  const activoCorriente = e.efectivo + e.cuentasPorCobrar + e.inventarios;
  const activoNoCorriente = e.propiedadPlantaEquipo + e.activosIntangibles;
  const activoTotal = activoCorriente + activoNoCorriente;

  const pasivoCorriente = e.cuentasPorPagar + e.obligacionesFinancierasCortoPlazo;
  const pasivoNoCorriente = e.obligacionesFinancierasLargoPlazo;
  const pasivoTotal = pasivoCorriente + pasivoNoCorriente;

  const utilidadBruta = e.ventasNetas - e.costoVentas;
  const utilidadOperativa = utilidadBruta - e.gastosAdministracion - e.gastosVentas;
  const utilidadAntesImpuestos = utilidadOperativa - e.gastosFinancieros;
  const utilidadNeta = utilidadAntesImpuestos - e.impuestoRenta;

  const patrimonio = e.capitalSocial + e.utilidadesRetenidas + utilidadNeta;

  const efectivoFinal = e.efectivo + e.flujoOperativo + e.flujoInversion + e.flujoFinanciacion;

  return {
    totales: {
      activoCorriente,
      activoNoCorriente,
      activoTotal,
      pasivoCorriente,
      pasivoNoCorriente,
      pasivoTotal,
      utilidadBruta,
      utilidadOperativa,
      utilidadAntesImpuestos,
      utilidadNeta,
      patrimonio,
      efectivoFinal,
    },
    indicadores: {
      razonCorriente: razon(activoCorriente, pasivoCorriente),
      pruebaAcida: razon(activoCorriente - e.inventarios, pasivoCorriente),
      endeudamiento: razon(pasivoTotal, activoTotal),
      margenNeto: razon(utilidadNeta, e.ventasNetas),
      roe: razon(utilidadNeta, patrimonio),
      roa: razon(utilidadNeta, activoTotal),
    },
    descuadre: activoTotal - (pasivoTotal + patrimonio),
  };
}

// ---------------------------------------------------------------------------
// Impacto financiero declarado de una opción del caso
// ---------------------------------------------------------------------------

/** Partidas del estado de resultados que una opción puede mover. */
export const DRIVERS_IMPACTO = [
  'ventasNetas',
  'costoVentas',
  'gastosAdministracion',
  'gastosVentas',
  'gastosFinancieros',
  'impuestoRenta',
] as const satisfies readonly CampoFinanciero[];

export type DriverImpacto = (typeof DRIVERS_IMPACTO)[number];

/** 'porcentaje' = % del valor base del caso; 'monto' = suma/resta fija. Ningún otro valor es válido. */
export type TipoImpacto = 'porcentaje' | 'monto';

export const TIPOS_IMPACTO: readonly TipoImpacto[] = ['porcentaje', 'monto'];

/** Un porcentaje menor a -100 dejaría la partida en negativo: el backend lo rechaza. */
export const PORCENTAJE_MINIMO = -100;

export interface ImpactoDriver {
  tipo: TipoImpacto;
  valor: number;
}

/**
 * Impacto tal como lo declara el docente: solo los drivers que tocó. Un
 * driver ausente no tiene efecto. Objeto con clave por rubro, no lista
 * (contrato 5-oct-2026).
 */
export type ImpactoOpcion = Partial<Record<DriverImpacto, ImpactoDriver>>;

/** Un driver en el formulario: `valor` vacío = el docente no lo tocó. */
export interface ImpactoDriverTexto {
  tipo: TipoImpacto;
  valor: string;
}

export type ImpactoTexto = Record<DriverImpacto, ImpactoDriverTexto>;

export function impactoVacio(): ImpactoTexto {
  return Object.fromEntries(
    DRIVERS_IMPACTO.map((d) => [d, { tipo: 'porcentaje', valor: '' }]),
  ) as ImpactoTexto;
}

export function esTipoImpacto(valor: unknown): valor is TipoImpacto {
  return TIPOS_IMPACTO.includes(valor as TipoImpacto);
}

/** Formulario -> impacto declarado: solo los drivers con valor escrito. */
export function impactoANumeros(texto: ImpactoTexto): ImpactoOpcion {
  const impacto: ImpactoOpcion = {};
  for (const d of DRIVERS_IMPACTO) {
    const { tipo, valor } = texto[d];
    if (valor.trim() !== '') {
      impacto[d] = { tipo, valor: aNumero(valor) };
    }
  }
  return impacto;
}

/** Impacto que devuelve el backend -> formulario. Un tipo desconocido no se carga. */
export function impactoDesdeApi(impacto: ImpactoOpcion | null | undefined): ImpactoTexto {
  const texto = impactoVacio();
  for (const d of DRIVERS_IMPACTO) {
    const driver = impacto?.[d];
    if (driver && esTipoImpacto(driver.tipo) && driver.valor != null) {
      texto[d] = { tipo: driver.tipo, valor: String(driver.valor) };
    }
  }
  return texto;
}

export function impactoEstaVacio(texto: ImpactoTexto): boolean {
  return DRIVERS_IMPACTO.every((d) => texto[d].valor.trim() === '');
}

/** Drivers en porcentaje con valor < -100 (mismo chequeo que el backend). */
export function driversConPorcentajeInvalido(impacto: ImpactoOpcion): DriverImpacto[] {
  return DRIVERS_IMPACTO.filter((d) => {
    const driver = impacto[d];
    return driver?.tipo === 'porcentaje' && driver.valor < PORCENTAJE_MINIMO;
  });
}

/** Partidas base con cada driver movido: `base ± valor` (monto) o `base × (1 ± valor/100)` (porcentaje). */
export function aplicarImpacto(base: FinancieroEntrada, impacto: ImpactoOpcion): FinancieroEntrada {
  const resultado = { ...base };
  for (const d of DRIVERS_IMPACTO) {
    const driver = impacto[d];
    if (driver) {
      resultado[d] =
        driver.tipo === 'porcentaje' ? base[d] * (1 + driver.valor / 100) : base[d] + driver.valor;
    }
  }
  return resultado;
}

export interface PreviaImpacto {
  utilidadNetaAntes: number;
  utilidadNetaDespues: number;
  patrimonioAntes: number;
  patrimonioDespues: number;
  efectivoAntes: number;
  efectivoDespues: number;
}

/**
 * Vista previa (no se guarda) de qué pasaría con el caso si se elige la opción:
 *   utilidadNeta' = mismas fórmulas de `calcularFinanciero` sobre los drivers'
 *   patrimonio'   = capitalSocial + utilidadesRetenidas + utilidadNeta'
 *   efectivo'     = efectivo + (utilidadNeta' − utilidadNeta)
 * Como activo (efectivo) y patrimonio se mueven lo mismo, el balance sigue cuadrando.
 */
export function previsualizarImpacto(base: FinancieroEntrada, impacto: ImpactoOpcion): PreviaImpacto {
  const antes = calcularFinanciero(base).totales;
  const despues = calcularFinanciero(aplicarImpacto(base, impacto)).totales;
  const delta = despues.utilidadNeta - antes.utilidadNeta;
  return {
    utilidadNetaAntes: antes.utilidadNeta,
    utilidadNetaDespues: despues.utilidadNeta,
    patrimonioAntes: antes.patrimonio,
    patrimonioDespues: despues.patrimonio,
    efectivoAntes: base.efectivo,
    efectivoDespues: base.efectivo + delta,
  };
}

const FORMATO_MONEDA = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });

/** 1850000 -> "$1.850.000"; -80000 -> "−$80.000". */
export function formatearMoneda(n: number): string {
  return n < 0 ? `−$${FORMATO_MONEDA.format(-n)}` : `$${FORMATO_MONEDA.format(n)}`;
}

const FORMATO_PORCENTAJE_IMPACTO = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });

export interface LineaImpacto {
  etiqueta: string;
  /** "+10%", "−5%", "+$50.000", "−$30.000". */
  valor: string;
}

/** Impacto declarado -> líneas legibles, solo de los drivers con valor, en el orden de `DRIVERS_IMPACTO`. */
export function describirImpacto(impacto: ImpactoOpcion | null | undefined): LineaImpacto[] {
  if (!impacto) {
    return [];
  }
  return DRIVERS_IMPACTO.flatMap((d) => {
    const driver = impacto[d];
    if (!driver || !esTipoImpacto(driver.tipo) || driver.valor == null) {
      return [];
    }
    const signo = driver.valor < 0 ? '−' : '+';
    const absoluto = Math.abs(driver.valor);
    const valor =
      driver.tipo === 'porcentaje'
        ? `${signo}${FORMATO_PORCENTAJE_IMPACTO.format(absoluto)}%`
        : `${signo}${formatearMoneda(absoluto)}`;
    return [{ etiqueta: ETIQUETAS_FINANCIERO[d], valor }];
  });
}
