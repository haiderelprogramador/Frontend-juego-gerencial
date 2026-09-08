import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Tarjeta de KPI: etiqueta, cifra grande (mono) y variación vs. período anterior.
 * Usada en Reportes financieros (docs/05, 🎨).
 */
@Component({
  selector: 'app-kpi',
  templateUrl: './kpi.html',
  styleUrl: './kpi.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Kpi {
  readonly etiqueta = input.required<string>();
  readonly valor = input.required<string>();
  readonly variacion = input<string>('');
  readonly tendencia = input<'sube' | 'baja' | 'neutro'>('neutro');
}
