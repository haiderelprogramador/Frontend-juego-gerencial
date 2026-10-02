import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { FinancieroCaso as TotalesCasoApi } from '../../../simulacion/models/caso-api.model';
import {
  CAMPOS_ADMITEN_NEGATIVO,
  CampoFinanciero,
  ETIQUETAS_FINANCIERO,
  calcularFinanciero,
  camposConSignoInvalido,
  financieroANumeros,
  financieroEstaVacio,
  formatearMoneda,
} from '../../../simulacion/models/financiero.model';

type SubtabFinanciero = 'balance' | 'resultados' | 'flujo';

/** Diferencias menores a medio centavo se consideran redondeo, no descuadre. */
const TOLERANCIA_CUADRE = 0.005;

const formatoRazon = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatoPorcentaje = new Intl.NumberFormat('es-CO', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * Tab "Información Financiera" del formulario de caso: las 19 partidas en
 * sub-pestañas (Balance / Estado de resultados / Flujo de efectivo), los
 * subtotales y los indicadores calculados en vivo, el cuadre del balance
 * (mismo chequeo que hace el backend antes de responder 400) y la regla de
 * signo por partida.
 */
@Component({
  selector: 'app-financiero-caso',
  imports: [NgTemplateOutlet],
  templateUrl: './financiero-caso.html',
  styleUrl: './financiero-caso.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinancieroCaso {
  /** Las 19 partidas como texto de formulario (two-way: `[(valores)]`). */
  readonly valores = model.required<Record<CampoFinanciero, string>>();
  /** Totales de un caso creado con el modelo anterior (sin partidas): solo referencia. */
  readonly totalesAnteriores = input<TotalesCasoApi | null>(null);

  readonly subtab = signal<SubtabFinanciero>('balance');

  readonly etiquetas = ETIQUETAS_FINANCIERO;
  readonly numeros = computed(() => financieroANumeros(this.valores()));
  readonly resultado = computed(() => calcularFinanciero(this.numeros()));
  readonly totales = computed(() => this.resultado().totales);
  readonly indicadores = computed(() => this.resultado().indicadores);
  readonly vacio = computed(() => financieroEstaVacio(this.valores()));
  readonly signoInvalido = computed(() => new Set(camposConSignoInvalido(this.numeros())));
  readonly cuadra = computed(() => Math.abs(this.resultado().descuadre) < TOLERANCIA_CUADRE);

  /** Tipa el contexto de `<ng-template #campo>` (que llega como `any`). */
  clave(c: CampoFinanciero): CampoFinanciero {
    return c;
  }

  actualizar(campo: CampoFinanciero, valor: string): void {
    this.valores.update((v) => ({ ...v, [campo]: valor }));
  }

  admiteNegativo(campo: CampoFinanciero): boolean {
    return CAMPOS_ADMITEN_NEGATIVO.has(campo);
  }

  moneda(n: number): string {
    return formatearMoneda(n);
  }

  razon(n: number | null): string {
    return n === null ? '—' : formatoRazon.format(n);
  }

  porcentaje(n: number | null): string {
    return n === null ? '—' : formatoPorcentaje.format(n);
  }
}
