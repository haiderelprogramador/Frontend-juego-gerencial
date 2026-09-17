import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { Badge } from '../../../shared/components/badge/badge';
import { Kpi } from '../../../shared/components/kpi/kpi';
import {
  OpcionSeleccion,
  TarjetaSeleccion,
} from '../../../shared/components/tarjeta-seleccion/tarjeta-seleccion';
import { CasoService } from '../../simulacion/services/caso.service';

type Fase = 'visualizacion' | 'partida' | 'cierre';
/** Estado visual de la tarjeta "Opciones de decisión" (distinto de `Fase`). */
type EstadoOpciones = 'bloqueado' | 'seleccion' | 'resultado';

const ORDEN_FASES: Fase[] = ['visualizacion', 'partida', 'cierre'];

/**
 * "Caso actual" (Estudiante) — reemplaza a "Toma de Decisiones" (docs/00 🎨
 * Decisión del equipo). Lee el caso activo de `CasoService` (el mismo que
 * edita el Docente en Panel → Casos) para que ambas pantallas compartan datos
 * en vez de tener cada una su propio mock. Capa visual, sin lógica de negocio.
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
  private readonly casoService = inject(CasoService);

  /** El caso activo configurado por el docente (docs/08 §7). */
  readonly caso = this.casoService.casoActivo;

  readonly fase = signal<Fase>('visualizacion');

  readonly fasesOrden: { key: Fase; label: string }[] = [
    { key: 'visualizacion', label: 'Visualización' },
    { key: 'partida', label: 'Partida' },
    { key: 'cierre', label: 'Cierre' },
  ];

  // 🎨 mock: cuenta regresiva estática, sin lógica real de tiempo.
  readonly cuenta = { dias: '02', horas: '04', min: '58', seg: '38' };

  /**
   * Fechas del stepper: si el docente las configuró en el caso (Info General),
   * se muestran tal cual; si no, un valor de ejemplo para que el stepper no
   * quede vacío en la demo.
   */
  readonly fechas = computed<Record<Fase, string>>(() => {
    const c = this.caso();
    return {
      visualizacion: this.formatearFecha(c?.fechaVisualizacion) ?? '02 sep · 08:00',
      partida: this.formatearFecha(c?.fechaInicioPartida) ?? '04 sep · 08:00',
      cierre: this.formatearFecha(c?.fechaFinPartida) ?? '06 sep · 23:59',
    };
  });

  /** Opciones del caso activo, adaptadas a lo que espera app-tarjeta-seleccion (solo "Opción"). */
  readonly opcionesSeleccion = computed<OpcionSeleccion[]>(() =>
    (this.caso()?.opciones ?? []).map((o) => ({ valor: o.id, titulo: o.opcion })),
  );

  // 🎨 mock: arranca en la última opción del catálogo — por convención del
  // caso sembrado es "no hacer nada" (docs/02 §1/§5) — para que la fase
  // "Cierre" siempre tenga algo que mostrar aunque no se pase por Selección.
  readonly eleccion = signal<string>(this.opcionPorDefecto());
  readonly confirmada = signal(false);

  readonly opcionElegida = computed(
    () => this.caso()?.opciones.find((o) => o.id === this.eleccion()) ?? null,
  );

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

  private opcionPorDefecto(): string {
    const opciones = this.caso()?.opciones ?? [];
    return opciones.length > 0 ? opciones[opciones.length - 1].id : '';
  }

  private formatearFecha(valor: string | undefined): string | null {
    return valor ? valor.replace('T', ' · ') : null;
  }
}
