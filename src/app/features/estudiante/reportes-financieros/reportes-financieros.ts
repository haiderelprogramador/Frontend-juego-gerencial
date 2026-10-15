import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import { Alerta } from '../../../shared/components/alerta/alerta';
import { Badge } from '../../../shared/components/badge/badge';
import { Kpi } from '../../../shared/components/kpi/kpi';
import {
  CAMPOS_ESTADO_RESULTADOS,
  ETIQUETAS_FINANCIERO,
  FinancieroEntrada,
  formatearMoneda,
} from '../../simulacion/models/financiero.model';
import { CasoActual, EstadoFinancieroEmpresa, FinancieroEmpresa } from '../models/portal-estudiante.model';
import { PortalEstudianteService } from '../services/portal-estudiante.service';

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
 * Pendiente de backend: la evolución caso a caso (historia por empresa) y los
 * indicadores calculados por el servidor; cuando existan, esta pantalla los
 * muestra sin cambiar su estructura.
 */
@Component({
  selector: 'app-reportes-financieros',
  imports: [Alerta, Badge, Kpi],
  templateUrl: './reportes-financieros.html',
  styleUrl: './reportes-financieros.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportesFinancieros {
  private readonly portal = inject(PortalEstudianteService);

  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  private readonly datos = signal<CasoActual | null>(null);

  readonly contexto = computed(() => {
    const d = this.datos();
    return d
      ? { simulacion: d.nombreSimulacion, empresa: d.nombreEmpresa, caso: d.caso.nombre }
      : null;
  });

  private readonly financiero = computed<FinancieroEmpresa | null>(() => {
    const d = this.datos();
    if (!d) {
      return null;
    }
    if (d.financieroEmpresa?.inicial) {
      return d.financieroEmpresa;
    }
    // Transición: el backend todavía manda solo el financiero compartido del caso.
    const f = d.caso.financiero as unknown as EstadoFinanciero;
    return { inicial: { ...f, origen: 'docente' }, final: null };
  });

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
    return [
      cifra('Activo total', 'activoTotal'),
      cifra('Pasivo total', 'pasivoTotal', true),
      cifra('Patrimonio', 'patrimonio'),
      cifra('Utilidad neta', 'utilidadNeta'),
    ];
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

  constructor() {
    this.portal.casoActual().subscribe({
      next: (datos) => {
        this.datos.set(datos);
        this.cargando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(err?.error?.message ?? 'No se pudo cargar la información financiera.');
        this.cargando.set(false);
      },
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
