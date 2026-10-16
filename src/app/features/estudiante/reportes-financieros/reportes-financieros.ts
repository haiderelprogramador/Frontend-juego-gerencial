import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import { API_CONFIG } from '../../../core/api/api.config';
import { Alerta } from '../../../shared/components/alerta/alerta';
import { Badge } from '../../../shared/components/badge/badge';
import { Kpi } from '../../../shared/components/kpi/kpi';
import {
  CAMPOS_ESTADO_RESULTADOS,
  ETIQUETAS_FINANCIERO,
  FinancieroEntrada,
  IndicadoresFinancieros,
  formatearMoneda,
} from '../../simulacion/models/financiero.model';
import {
  CasoActual,
  EstadoFinancieroEmpresa,
  FinancieroEmpresa,
  HistoriaCasoEmpresa,
  MiSimulacion,
} from '../models/portal-estudiante.model';
import { PortalEstudianteService } from '../services/portal-estudiante.service';
import { EvolucionEmpresa } from './evolucion-empresa/evolucion-empresa';

/** Una línea del balance: su valor inicial y, si el caso cerró, el final. */
interface LineaBalance {
  etiqueta: string;
  inicial: number | null;
  final: number | null;
  total?: boolean;
}

/** Una cifra del balance con su valor inicial y, si el caso ya cerró, el final. */
interface Cifra {
  etiqueta: string;
  inicial: number | null;
  final: number | null;
  /** Para el pasivo, subir no es buena noticia: se muestra sin color. */
  sinColor?: boolean;
}

/** Un indicador, inicio vs. cierre. Razón corriente y prueba ácida son razones; el resto, porcentajes. */
interface LineaIndicador {
  etiqueta: string;
  formato: 'razon' | 'porcentaje';
  inicial: number | null;
  final: number | null;
}

const INDICADORES: readonly {
  clave: keyof IndicadoresFinancieros;
  etiqueta: string;
  formato: LineaIndicador['formato'];
}[] = [
  { clave: 'razonCorriente', etiqueta: 'Razón corriente', formato: 'razon' },
  { clave: 'pruebaAcida', etiqueta: 'Prueba ácida', formato: 'razon' },
  { clave: 'endeudamiento', etiqueta: 'Endeudamiento', formato: 'porcentaje' },
  { clave: 'margenNeto', etiqueta: 'Margen neto', formato: 'porcentaje' },
  { clave: 'roe', etiqueta: 'ROE', formato: 'porcentaje' },
  { clave: 'roa', etiqueta: 'ROA', formato: 'porcentaje' },
];

/** Mismo formato que los indicadores del formulario de casos (financiero-caso). */
const formatoRazon = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatoPorcentaje = new Intl.NumberFormat('es-CO', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

interface LineaResultado {
  concepto: string;
  monto: number | null;
  negativo?: boolean;
  total?: boolean;
}

/** Lo que el estado inicial y el final tienen en común (19 partidas + 4 totales). */
type EstadoFinanciero = EstadoFinancieroEmpresa<string>;

/**
 * Reportes financieros del estudiante.
 *
 * Se construye sobre `/estudiante/caso-actual`: la situación con la que arranca
 * la empresa en el caso (`financieroEmpresa.inicial`) y, cuando el caso cierra,
 * el resultado (`financieroEmpresa.final`). Mientras el backend no mande
 * `financieroEmpresa` (D2, segunda parte), se usa `caso.financiero`, el campo
 * compartido anterior, solo como estado inicial.
 *
 * Indicadores (contrato A): salen de `financieroEmpresa.*.indicadores`, que
 * calcula el backend; sin ellos la sección no se muestra. Evolución caso a
 * caso (contrato B): `GET /estudiante/empresas/{id}/historia`, detrás de
 * `API_CONFIG.disponible.historia`.
 */
@Component({
  selector: 'app-reportes-financieros',
  imports: [Alerta, Badge, Kpi, EvolucionEmpresa],
  templateUrl: './reportes-financieros.html',
  styleUrl: './reportes-financieros.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportesFinancieros {
  private readonly portal = inject(PortalEstudianteService);

  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  private readonly datos = signal<CasoActual | null>(null);

  /** Historia por empresa (contrato B): hasta que esté en develop no se pide. */
  readonly historiaDisponible = signal<boolean>(API_CONFIG.disponible.historia);
  readonly historia = signal<HistoriaCasoEmpresa[] | null>(null);
  readonly errorHistoria = signal<string | null>(null);
  /**
   * Con caso-actual en 204 (hueco entre casos: el anterior cerró y el
   * siguiente no se publicó) y la historia activa, la pantalla muestra el
   * último caso de la historia. Esta es la simulación de la que sale.
   */
  private readonly simulacionRespaldo = signal<MiSimulacion | null>(null);
  /** Último caso de la historia, solo cuando se usa como respaldo del 204. */
  private readonly ultimoDeHistoria = computed<HistoriaCasoEmpresa | null>(() =>
    this.datos() || !this.simulacionRespaldo() ? null : (this.historia()?.at(-1) ?? null),
  );

  readonly contexto = computed(() => {
    const d = this.datos();
    if (d) {
      return { simulacion: d.nombreSimulacion, empresa: d.nombreEmpresa, caso: d.caso.nombre };
    }
    const sim = this.simulacionRespaldo();
    const ultimo = this.ultimoDeHistoria();
    return sim && ultimo
      ? { simulacion: sim.nombreSimulacion, empresa: sim.nombreEmpresa, caso: ultimo.nombreCaso }
      : null;
  });

  private readonly financiero = computed<FinancieroEmpresa | null>(() => {
    const d = this.datos();
    if (!d) {
      const ultimo = this.ultimoDeHistoria();
      return ultimo ? { inicial: ultimo.inicial, final: ultimo.final } : null;
    }
    if (d.financieroEmpresa?.inicial) {
      return d.financieroEmpresa;
    }
    // Transición: el backend todavía manda solo el financiero compartido del caso.
    const f = d.caso.financiero as unknown as EstadoFinanciero;
    return { inicial: { ...f, origen: 'docente' }, final: null };
  });

  /**
   * Respaldo con `caso.financiero` en un caso que no es el primero: los totales
   * del balance vienen `null` (el balance por empresa llega en
   * `financieroEmpresa`, que todavía no está en develop). Entonces se muestra
   * solo la utilidad neta, un aviso y no la tabla del balance.
   */
  readonly balanceNoDisponible = computed(() => {
    const d = this.datos();
    return !!d && !d.financieroEmpresa?.inicial && d.caso.financiero.activoTotal == null;
  });
  readonly avisoBalance = 'El balance propio de tu empresa todavía no está disponible; aparecerá aquí en cuanto se publique.';

  /** true si lo que se ve sale de la historia (caso-actual en 204), no del caso actual. */
  readonly esRespaldo = computed(() => this.ultimoDeHistoria() !== null);

  readonly inicial = computed<EstadoFinanciero | null>(() => this.financiero()?.inicial ?? null);
  readonly final = computed<EstadoFinanciero | null>(() => this.financiero()?.final ?? null);
  readonly cerrado = computed(() => this.final() !== null);

  readonly origenLegible = computed(() => {
    const origen = this.inicial()?.origen;
    if (origen === 'heredado') {
      return 'Balance heredado de los casos anteriores de tu empresa';
    }
    return 'Balance inicial definido por el docente';
  });

  readonly resultadoLegible = computed(() => {
    const origen = this.final()?.origen;
    if (origen === 'penalizacion') {
      return 'Tu empresa no decidió a tiempo: el resultado incluye la penalización del caso.';
    }
    if (origen === 'decision') {
      return 'Resultado de la decisión que tomó tu empresa.';
    }
    return null;
  });

  /** Los 4 totales del balance, inicial vs. final. */
  readonly cifras = computed<Cifra[]>(() => {
    const i = this.inicial();
    const f = this.final();
    const cifra = (
      etiqueta: string,
      campo: 'activoTotal' | 'pasivoTotal' | 'patrimonio' | 'utilidadNeta',
      sinColor = false,
    ): Cifra => ({
      etiqueta,
      inicial: i?.[campo] ?? null,
      final: f?.[campo] ?? null,
      sinColor,
    });
    const todas = [
      cifra('Activo total', 'activoTotal'),
      cifra('Pasivo total', 'pasivoTotal', true),
      cifra('Patrimonio', 'patrimonio'),
      cifra('Utilidad neta', 'utilidadNeta'),
    ];
    // Sin balance propio todavía: los tres totales del balance serían "—".
    return this.balanceNoDisponible() ? todas.filter((c) => c.etiqueta === 'Utilidad neta') : todas;
  });

  /**
   * Balance detallado: activos, pasivos y patrimonio con sus partidas, y el
   * valor al cierre cuando existe. El patrimonio incluye la utilidad del
   * ejercicio, igual que la convención del motor de cálculo del backend.
   */
  readonly balance = computed<LineaBalance[]>(() => {
    const i = this.inicial();
    if (!i) {
      return [];
    }
    const f = this.final();
    const ini = i as unknown as FinancieroEntrada;
    const fin = (f ?? null) as unknown as FinancieroEntrada | null;
    const linea = (campo: keyof FinancieroEntrada): LineaBalance => ({
      etiqueta: ETIQUETAS_FINANCIERO[campo],
      inicial: ini[campo] ?? null,
      final: fin ? fin[campo] ?? null : null,
      total: false,
    });
    const total = (etiqueta: string, campo: 'activoTotal' | 'pasivoTotal' | 'patrimonio'): LineaBalance => ({
      etiqueta,
      inicial: i[campo] ?? null,
      final: f?.[campo] ?? null,
      total: true,
    });
    return [
      linea('efectivo'),
      linea('cuentasPorCobrar'),
      linea('inventarios'),
      linea('propiedadPlantaEquipo'),
      linea('activosIntangibles'),
      total('Activo total', 'activoTotal'),
      linea('cuentasPorPagar'),
      linea('obligacionesFinancierasCortoPlazo'),
      linea('obligacionesFinancierasLargoPlazo'),
      total('Pasivo total', 'pasivoTotal'),
      linea('capitalSocial'),
      linea('utilidadesRetenidas'),
      total('Patrimonio', 'patrimonio'),
    ];
  });

  /** Estado de resultados (las 6 partidas reales + subtotales derivados). */
  readonly estadoResultados = computed<LineaResultado[]>(() => {
    const base = this.final() ?? this.inicial();
    if (!base) {
      return [];
    }
    const e = base as unknown as FinancieroEntrada;
    const utilidadBruta = e.ventasNetas - e.costoVentas;
    const utilidadOperativa = utilidadBruta - e.gastosAdministracion - e.gastosVentas;
    const utilidadAntesImpuestos = utilidadOperativa - e.gastosFinancieros;
    const lineas: LineaResultado[] = [
      { concepto: ETIQUETAS_FINANCIERO.ventasNetas, monto: e.ventasNetas },
      { concepto: ETIQUETAS_FINANCIERO.costoVentas, monto: e.costoVentas, negativo: true },
      { concepto: 'Utilidad bruta', monto: utilidadBruta, total: true },
      { concepto: ETIQUETAS_FINANCIERO.gastosAdministracion, monto: e.gastosAdministracion, negativo: true },
      { concepto: ETIQUETAS_FINANCIERO.gastosVentas, monto: e.gastosVentas, negativo: true },
      { concepto: 'Utilidad operativa', monto: utilidadOperativa, total: true },
      { concepto: ETIQUETAS_FINANCIERO.gastosFinancieros, monto: e.gastosFinancieros, negativo: true },
      { concepto: 'Utilidad antes de impuestos', monto: utilidadAntesImpuestos, total: true },
      { concepto: ETIQUETAS_FINANCIERO.impuestoRenta, monto: e.impuestoRenta, negativo: true },
      { concepto: 'Utilidad neta', monto: base.utilidadNeta, total: true },
    ];
    // Si alguna de las 6 partidas no vino, no se inventan subtotales.
    const faltan = CAMPOS_ESTADO_RESULTADOS.some((c) => typeof e[c] !== 'number');
    return faltan ? lineas.filter((l) => !l.total) : lineas;
  });

  /**
   * Indicadores (contrato A), inicio vs. cierre. Vacío mientras el backend no
   * mande `indicadores` en `financieroEmpresa` (y siempre con el respaldo de
   * `caso.financiero`, que no los trae): entonces la sección no se muestra.
   */
  readonly indicadores = computed<LineaIndicador[]>(() => {
    const ini = this.inicial()?.indicadores;
    if (!ini) {
      return [];
    }
    const fin = this.final()?.indicadores ?? null;
    return INDICADORES.map((i) => ({
      etiqueta: i.etiqueta,
      formato: i.formato,
      inicial: ini[i.clave] ?? null,
      final: fin ? (fin[i.clave] ?? null) : null,
    }));
  });

  constructor() {
    this.portal.casoActual().subscribe({
      next: (datos) => {
        this.datos.set(datos);
        if (!this.historiaDisponible()) {
          this.cargando.set(false);
        } else if (datos) {
          this.cargando.set(false);
          this.cargarHistoria(datos.idEmpresa);
        } else {
          this.cargarRespaldoDeHistoria();
        }
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(err?.error?.message ?? 'No se pudo cargar la información financiera.');
        this.cargando.set(false);
      },
    });
  }

  indicador(l: LineaIndicador, valor: number | null): string {
    if (valor == null) {
      return '—';
    }
    return l.formato === 'razon' ? formatoRazon.format(valor) : formatoPorcentaje.format(valor);
  }

  private cargarHistoria(idEmpresa: number, alTerminar?: () => void): void {
    this.portal.historiaEmpresa(idEmpresa).subscribe({
      next: (h) => {
        this.historia.set(h);
        alTerminar?.();
      },
      error: (err: HttpErrorResponse) => {
        this.errorHistoria.set(err?.error?.message ?? 'No se pudo cargar la evolución de tu empresa.');
        alTerminar?.();
      },
    });
  }

  /**
   * caso-actual respondió 204: sin caso no hay `idEmpresa`, así que sale de la
   * simulación más reciente del estudiante. Si tampoco hay simulación o
   * historia, queda el estado vacío de siempre.
   */
  private cargarRespaldoDeHistoria(): void {
    const terminar = () => this.cargando.set(false);
    this.portal.misSimulaciones().subscribe({
      next: (lista) => {
        const sim = lista[0];
        if (!sim) {
          terminar();
          return;
        }
        this.simulacionRespaldo.set(sim);
        this.cargarHistoria(Number(sim.idEmpresa), terminar);
      },
      error: terminar,
    });
  }

  moneda(valor: number | null | undefined): string {
    return valor == null ? '—' : formatearMoneda(valor);
  }

  /** Variación final vs. inicial, como texto para el KPI ("+$6.200" / "−3,5 %"). */
  variacion(c: Cifra): string {
    if (c.inicial == null || c.final == null) {
      return '';
    }
    const delta = c.final - c.inicial;
    if (delta === 0) {
      return 'Sin cambio';
    }
    const signo = delta > 0 ? '+' : '−';
    return `${signo}${formatearMoneda(Math.abs(delta))} vs. inicio`;
  }

  tendencia(c: Cifra): 'sube' | 'baja' | 'neutro' {
    if (c.sinColor || c.inicial == null || c.final == null || c.final === c.inicial) {
      return 'neutro';
    }
    return c.final > c.inicial ? 'sube' : 'baja';
  }
}
