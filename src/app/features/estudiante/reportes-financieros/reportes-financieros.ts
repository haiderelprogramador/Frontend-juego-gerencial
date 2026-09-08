import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

import { Badge } from '../../../shared/components/badge/badge';
import { Kpi } from '../../../shared/components/kpi/kpi';

interface PuntoTrimestre {
  etiqueta: string;
  ingresos: number;
  costos: number;
}
interface LineaResultado {
  concepto: string;
  monto: string;
  negativo?: boolean;
  total?: boolean;
}

/**
 * Reportes financieros del estudiante (docs/05, 🎨). Datos mock, sin cálculo real.
 */
@Component({
  selector: 'app-reportes-financieros',
  imports: [Badge, Kpi],
  templateUrl: './reportes-financieros.html',
  styleUrl: './reportes-financieros.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportesFinancieros {
  readonly serie = signal<PuntoTrimestre[]>([
    { etiqueta: 'T4 25', ingresos: 812, costos: 560 },
    { etiqueta: 'T1 26', ingresos: 905, costos: 602 },
    { etiqueta: 'T2 26', ingresos: 976, costos: 631 },
    { etiqueta: 'T3 26', ingresos: 1058, costos: 640 },
  ]);

  readonly maxSerie = computed(() =>
    Math.max(...this.serie().flatMap((p) => [p.ingresos, p.costos])),
  );

  readonly resultado: LineaResultado[] = [
    { concepto: 'Ventas netas', monto: '$1.058.300' },
    { concepto: 'Costo de ventas', monto: '-$640.200', negativo: true },
    { concepto: 'Utilidad bruta', monto: '$418.100', total: true },
    { concepto: 'Gastos comerciales', monto: '-$112.400', negativo: true },
    { concepto: 'Gastos administrativos', monto: '-$68.900', negativo: true },
    { concepto: 'Inversión I+D', monto: '-$37.000', negativo: true },
    { concepto: 'Utilidad operativa', monto: '$199.800', total: true },
  ];

  /** Altura en % para las barras del mini-gráfico. */
  altura(valor: number): number {
    return Math.round((valor / this.maxSerie()) * 100);
  }
}
