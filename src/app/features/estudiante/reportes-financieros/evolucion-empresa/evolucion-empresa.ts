import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import { formatearMoneda } from '../../../simulacion/models/financiero.model';
import { HistoriaCasoEmpresa } from '../../../simulacion/models/estado-empresa.model';

type ClaveSerie = 'utilidadNeta' | 'efectivo' | 'patrimonio';

interface Serie {
  clave: ClaveSerie;
  etiqueta: string;
  /** Posición fija en la paleta categórica (no cambia con los datos). */
  slot: 1 | 2 | 3;
}

/** Orden fijo: el color sigue a la serie, no a su posición en los datos. */
const SERIES: readonly Serie[] = [
  { clave: 'utilidadNeta', etiqueta: 'Utilidad neta', slot: 1 },
  { clave: 'efectivo', etiqueta: 'Efectivo', slot: 2 },
  { clave: 'patrimonio', etiqueta: 'Patrimonio', slot: 3 },
];

/** Geometría del SVG (coordenadas del viewBox; el SVG escala al ancho de la tarjeta). */
const ANCHO = 640;
const ALTO = 240;
const MARGEN = { arriba: 12, derecha: 96, abajo: 30, izquierda: 64 };
/** Por debajo de esta separación vertical las etiquetas al final de cada línea se pisarían. */
const SEPARACION_MIN_ETIQUETAS = 14;

const formatoEje = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 });

/** Marcas "lindas" del eje Y (1, 2, 2.5 o 5 × 10^n) que cubren [min, max] e incluyen el 0. */
export function marcasEje(min: number, max: number, cantidad = 4): number[] {
  const lo = Math.min(0, min);
  const hi = Math.max(0, max);
  if (lo === hi) {
    return [0, 1];
  }
  const crudo = (hi - lo) / cantidad;
  const potencia = 10 ** Math.floor(Math.log10(crudo));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= crudo) ?? 10 * potencia;
  const marcas: number[] = [];
  for (let v = Math.floor(lo / paso) * paso; v <= hi + paso / 2; v += paso) {
    marcas.push(Math.round(v / paso) * paso);
    if (marcas[marcas.length - 1] >= hi) {
      break;
    }
  }
  return marcas;
}

/**
 * Evolución de la empresa caso a caso: utilidad neta, efectivo y patrimonio
 * AL CIERRE de cada caso (solo los casos cerrados: el en curso no tiene
 * `final`). Gráfico de líneas con un solo eje (las tres series son pesos),
 * leyenda, etiqueta al final de cada línea cuando no se pisan, tooltip por
 * caso y la misma información en tabla debajo.
 */
@Component({
  selector: 'app-evolucion-empresa',
  templateUrl: './evolucion-empresa.html',
  styleUrl: './evolucion-empresa.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EvolucionEmpresa {
  readonly historia = input.required<HistoriaCasoEmpresa[]>();

  readonly series = SERIES;
  readonly ancho = ANCHO;
  readonly alto = ALTO;
  readonly margen = MARGEN;

  /** Caso bajo el cursor (índice en `puntos`), o null. */
  readonly activo = signal<number | null>(null);

  /** Un punto por caso cerrado, en el orden en que llegan (el backend ya los ordena por caso). */
  readonly puntos = computed(() =>
    this.historia()
      .filter((h) => h.final !== null)
      .map((h) => ({
        idCaso: h.idCaso,
        caso: h.nombreCaso,
        utilidadNeta: h.final!.utilidadNeta,
        efectivo: h.final!.efectivo,
        patrimonio: h.final!.patrimonio,
      })),
  );

  /** Con un solo caso cerrado no hay evolución que dibujar: queda solo la tabla. */
  readonly hayGrafico = computed(() => this.puntos().length >= 2);

  readonly marcas = computed(() => {
    const valores = this.puntos().flatMap((p) => SERIES.map((s) => p[s.clave]));
    return marcasEje(Math.min(...valores), Math.max(...valores));
  });

  private readonly anchoPlot = ANCHO - MARGEN.izquierda - MARGEN.derecha;
  private readonly altoPlot = ALTO - MARGEN.arriba - MARGEN.abajo;

  x(i: number): number {
    const n = this.puntos().length;
    return MARGEN.izquierda + (n <= 1 ? this.anchoPlot / 2 : (i / (n - 1)) * this.anchoPlot);
  }

  y(valor: number): number {
    const m = this.marcas();
    const lo = m[0];
    const hi = m[m.length - 1];
    return MARGEN.arriba + (1 - (valor - lo) / (hi - lo)) * this.altoPlot;
  }

  readonly lineas = computed(() =>
    SERIES.map((s) => ({
      ...s,
      d: this.puntos()
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${this.x(i).toFixed(1)},${this.y(p[s.clave]).toFixed(1)}`)
        .join(' '),
    })),
  );

  /**
   * Etiquetas al final de cada línea. Si dos quedan a menos de
   * `SEPARACION_MIN_ETIQUETAS`, no se muestran (moverlas las despegaría de su
   * línea): la leyenda y el tooltip ya identifican cada serie.
   */
  readonly etiquetasFinales = computed(() => {
    const ultimo = this.puntos().at(-1);
    if (!ultimo) {
      return [];
    }
    const etiquetas = SERIES.map((s) => ({ ...s, y: this.y(ultimo[s.clave]), valor: ultimo[s.clave] }));
    const ys = etiquetas.map((e) => e.y).sort((a, b) => a - b);
    const sePisan = ys.some((y, i) => i > 0 && y - ys[i - 1] < SEPARACION_MIN_ETIQUETAS);
    return sePisan ? [] : etiquetas;
  });

  /** Ancho de la franja sensible de cada caso (más grande que el punto). */
  readonly anchoFranja = computed(() => {
    const n = this.puntos().length;
    return n <= 1 ? this.anchoPlot : this.anchoPlot / (n - 1);
  });

  /** Posición horizontal del cursor, en % del ancho: el tooltip se ancla a su costado. */
  posicionTooltip(i: number): number {
    return (this.x(i) / ANCHO) * 100;
  }

  /** En la mitad derecha el tooltip va a la izquierda del cursor, para no salirse ni tapar el punto activo. */
  tooltipALaIzquierda(i: number): boolean {
    return this.posicionTooltip(i) > 50;
  }

  eje(valor: number): string {
    if (valor === 0) {
      return '0';
    }
    // Igual que formatearMoneda: "−$500 k", no "$-500 k".
    return valor < 0 ? `−$${formatoEje.format(-valor)}` : `$${formatoEje.format(valor)}`;
  }

  moneda(valor: number): string {
    return formatearMoneda(valor);
  }
}
