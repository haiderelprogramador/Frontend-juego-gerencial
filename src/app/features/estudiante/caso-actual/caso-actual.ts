import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

import { Badge } from '../../../shared/components/badge/badge';
import { Kpi } from '../../../shared/components/kpi/kpi';
import {
  OpcionSeleccion,
  TarjetaSeleccion,
} from '../../../shared/components/tarjeta-seleccion/tarjeta-seleccion';

type Fase = 'visualizacion' | 'partida' | 'cierre';
/** Estado visual de la tarjeta "Opciones de decisión" (distinto de `Fase`). */
type EstadoOpciones = 'bloqueado' | 'seleccion' | 'resultado';

interface OpcionCaso {
  id: string;
  /** Texto de la opción, tal como la ve el estudiante (campo "Opción", no "descripción"). */
  opcion: string;
  /** Efecto que se revela solo en la fase "Cierre". */
  resultado: string;
}

const ORDEN_FASES: Fase[] = ['visualizacion', 'partida', 'cierre'];

/**
 * "Caso actual" (Estudiante) — reemplaza a "Toma de Decisiones" (docs/00 🎨
 * Decisión del equipo). Capa visual con datos mock, sin lógica de negocio real.
 *
 * La tarjeta "Opciones de decisión" tiene su propio estado (`EstadoOpciones`),
 * NO igual 1:1 a la fase del caso:
 *  - "visualizacion" -> bloqueado, con cuenta regresiva hasta que el docente abra la partida.
 *  - "partida" y aún sin confirmar -> selección: tarjetas de opción + botón "Confirmar decisión".
 *  - apenas se confirma (aunque el caso siga en fase "partida"), o si el caso ya
 *    está en fase "cierre" -> resultado: se resalta la opción elegida y su efecto,
 *    como retroalimentación inmediata al estudiante (no hay que esperar al cierre
 *    del período para verlo).
 */
@Component({
  selector: 'app-caso-actual',
  imports: [Badge, Kpi, TarjetaSeleccion],
  templateUrl: './caso-actual.html',
  styleUrl: './caso-actual.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CasoActual {
  readonly fase = signal<Fase>('visualizacion');

  readonly fasesOrden: { key: Fase; label: string }[] = [
    { key: 'visualizacion', label: 'Visualización' },
    { key: 'partida', label: 'Partida' },
    { key: 'cierre', label: 'Cierre' },
  ];

  /** 🎨 mock — fechas y cuenta regresiva estáticas, sin lógica real de tiempo. */
  readonly fechas: Record<Fase, string> = {
    visualizacion: '02 sep · 08:00',
    partida: '04 sep · 08:00',
    cierre: '06 sep · 23:59',
  };
  readonly cuenta = { dias: '02', horas: '04', min: '58', seg: '38' };

  readonly empresa = {
    nombre: 'TextilAndes S.A.',
    tipo: 'Manufactura',
    mision: 'Producir textiles de alta calidad con procesos sostenibles para el mercado regional.',
    vision: 'Ser el referente andino en textiles sostenibles para 2030.',
  };

  readonly financiero = {
    activoTotal: '$1.850.000',
    pasivoTotal: '$720.000',
    patrimonio: '$1.130.000',
    utilidadNeta: '$142.000',
  };

  readonly opciones: OpcionCaso[] = [
    {
      id: 'a',
      opcion: 'Ampliar la planta de producción en un 20% con crédito bancario a 3 años.',
      resultado: 'Activo total +$180.000 · Utilidad neta -$12.000 (gasto financiero)',
    },
    {
      id: 'b',
      opcion: 'Mantener la capacidad actual e invertir en eficiencia de procesos.',
      resultado: 'Utilidad neta +$25.000 · Margen bruto +1.2 pp',
    },
    {
      id: 'c',
      opcion: 'No hacer nada este período.',
      resultado: 'Utilidad neta -$8.000 (efecto por defecto del catálogo)',
    },
  ];

  /** Adapta el catálogo a la forma que espera app-tarjeta-seleccion (solo "Opción", sin descripción). */
  readonly opcionesSeleccion = computed<OpcionSeleccion[]>(() =>
    this.opciones.map((o) => ({ valor: o.id, titulo: o.opcion })),
  );

  // 🎨 mock: arranca en la opción "no hacer nada" (docs/02 §1/§5) para que la
  // fase "Cierre" siempre tenga algo que mostrar aunque no se pase por Selección.
  readonly eleccion = signal<string>('c');
  readonly confirmada = signal(false);

  readonly opcionElegida = computed(() => this.opciones.find((o) => o.id === this.eleccion()) ?? null);

  /**
   * El resultado se muestra como retroalimentación en cuanto el estudiante
   * confirma su decisión — no hace falta esperar a que el docente cierre el
   * período. Si el período ya cerró, también se muestra (aunque no se haya
   * confirmado nada: aplica la opción "no hacer nada" por defecto).
   */
  readonly estadoOpciones = computed<EstadoOpciones>(() => {
    if (this.confirmada() || this.fase() === 'cierre') {
      return 'resultado';
    }
    return this.fase() === 'visualizacion' ? 'bloqueado' : 'seleccion';
  });

  confirmarDecision(): void {
    if (this.eleccion()) {
      this.confirmada.set(true);
    }
  }

  esPasada(key: Fase): boolean {
    return ORDEN_FASES.indexOf(key) < ORDEN_FASES.indexOf(this.fase());
  }

  /** 🎨 Ayuda de desarrollo (no es parte del diseño): cambia de fase para validar los 3 estados. */
  irAFase(fase: Fase): void {
    this.fase.set(fase);
    if (fase === 'partida') {
      // Permite previsualizar "Selección" limpia, sin resultado ya confirmado.
      this.confirmada.set(false);
    }
  }
}
