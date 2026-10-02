import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { Subscription, interval } from 'rxjs';

import { Badge } from '../../../shared/components/badge/badge';
import { Alerta } from '../../../shared/components/alerta/alerta';
import { Kpi } from '../../../shared/components/kpi/kpi';
import {
  OpcionSeleccion,
  TarjetaSeleccion,
} from '../../../shared/components/tarjeta-seleccion/tarjeta-seleccion';
import { CasoEstudiante } from '../../simulacion/models/caso-api.model';
import { CasoActual as CasoActualDto } from '../models/portal-estudiante.model';
import { PortalEstudianteService } from '../services/portal-estudiante.service';

type Fase = 'visualizacion' | 'partida' | 'cierre';
/** Estado visual de la tarjeta "Opciones de decisión" (distinto de `Fase`). */
type EstadoOpciones = 'bloqueado' | 'seleccion' | 'resultado';
type ErrorHttp = { message?: string; error?: { message?: string } };

const ORDEN_FASES: Fase[] = ['visualizacion', 'partida', 'cierre'];

/** Cada cuánto se recalculan fase y cuenta regresiva contra el reloj (ms). */
const INTERVALO_RELOJ_MS = 5000;

/**
 * El backend manda `fechaVisualizacion`/`fechaInicioPartida`/`fechaFinPartida`
 * ya en hora de Colombia pero SIN sufijo de zona (ej. "2026-09-29T14:00:00").
 * `new Date(...)`/`Date.parse(...)` interpretarían eso como hora LOCAL DEL
 * NAVEGADOR, no de Bogotá — si alguien abre la app desde otro huso horario,
 * la comparación contra "ahora" queda corrida. Colombia no tiene horario de
 * verano, así que el offset es siempre fijo: -05:00.
 */
const OFFSET_BOGOTA = '-05:00';
const TIENE_ZONA_HORARIA = /[Zz]$|[+-]\d{2}:?\d{2}$/;

/** Parsea una fecha del backend como hora de Bogotá si no trae ya su propia zona. */
export function aFechaBogota(fecha: string | undefined): number {
  if (!fecha) {
    return NaN;
  }
  return Date.parse(TIENE_ZONA_HORARIA.test(fecha) ? fecha : `${fecha}${OFFSET_BOGOTA}`);
}

function mensaje(err: ErrorHttp, porDefecto: string): string {
  return err?.error?.message ?? err?.message ?? porDefecto;
}

/**
 * "Caso actual" (Estudiante) — reemplaza a "Toma de Decisiones" (docs/00 🎨
 * Decisión del equipo). Conectado al backend real: `PortalEstudianteService`
 * (`/api/estudiante/caso-actual` y `/api/estudiante/decision`).
 *
 * La tarjeta "Opciones de decisión" tiene su propio estado (`EstadoOpciones`),
 * NO igual 1:1 a la fase del caso:
 *  - "visualizacion" -> bloqueado, con cuenta regresiva hasta que abra la partida.
 *  - "partida", sin decisión y `puedeDecidir` -> selección: tarjetas de opción +
 *    botón "Confirmar decisión".
 *  - "partida" sin decisión pero SIN `puedeDecidir` (no es el líder) -> bloqueado,
 *    sin cuenta regresiva, con un mensaje distinto.
 *  - ya hay `decision`, o la fase es "cierre" -> resultado: `decision.resultado`
 *    es la ÚNICA fuente del efecto — las opciones (`CasoEstudiante`) nunca
 *    traen `resultado`, es la sorpresa hasta decidir.
 *
 * La fase se calcula sola comparando la hora actual contra
 * `fechaInicioPartida`/`fechaFinPartida` del caso — no hay forma de cambiarla
 * a mano. Un `interval` de RxJS recalcula cada `INTERVALO_RELOJ_MS` para que,
 * si el estudiante deja la pantalla abierta, pase de fase sola cuando
 * corresponda (sin recargar la página).
 */
@Component({
  selector: 'app-caso-actual',
  imports: [Badge, Alerta, Kpi, TarjetaSeleccion],
  templateUrl: './caso-actual.html',
  styleUrl: './caso-actual.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CasoActual implements OnDestroy {
  private readonly portal = inject(PortalEstudianteService);

  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly enviando = signal(false);
  private readonly datos = signal<CasoActualDto | null>(null);

  /** El caso activo visible para la empresa del estudiante (o null: sin caso, o todavía cargando). */
  readonly caso = computed<CasoEstudiante | null>(() => this.datos()?.caso ?? null);
  readonly esLider = computed(() => this.datos()?.esLider ?? false);
  readonly puedeDecidir = computed(() => this.datos()?.puedeDecidir ?? false);
  readonly decisionActual = computed(() => this.datos()?.decision ?? null);

  /** Reloj reactivo: se actualiza solo cada `INTERVALO_RELOJ_MS` (ver `ngOnDestroy`). */
  private readonly ahora = signal(Date.now());
  private readonly relojSub: Subscription = interval(INTERVALO_RELOJ_MS).subscribe(() =>
    this.ahora.set(Date.now()),
  );

  /** Se calcula solo contra las fechas del caso — no hay forma de forzarla a mano. */
  readonly fase = computed<Fase>(() => {
    const c = this.caso();
    return c ? calcularFase(c, this.ahora()) : 'visualizacion';
  });

  readonly fasesOrden: { key: Fase; label: string }[] = [
    { key: 'visualizacion', label: 'Visualización' },
    { key: 'partida', label: 'Partida' },
    { key: 'cierre', label: 'Cierre' },
  ];

  /** Cuenta regresiva hasta el inicio de la partida (solo aplica en fase "visualizacion"). */
  readonly cuenta = computed(() => {
    const c = this.caso();
    if (!c) {
      return { dias: '00', horas: '00', min: '00', seg: '00' };
    }
    return formatearCuenta(aFechaBogota(c.fechaInicioPartida) - this.ahora());
  });

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
    (this.caso()?.opciones ?? []).map((o) => ({ valor: String(o.id), titulo: o.opcion })),
  );

  /** Selección en curso (antes de confirmar) — vacía por defecto, nunca se auto-elige. */
  readonly eleccion = signal<string>('');

  readonly idOpcionElegida = computed(() => this.decisionActual()?.idOpcion ?? null);

  /**
   * "bloqueado" cubre dos motivos distintos: la partida no abrió todavía
   * (con cuenta regresiva), o el estudiante no es el líder de su empresa
   * (sin cuenta regresiva — `soloBloqueadoPorFecha` distingue cuál mostrar).
   */
  readonly estadoOpciones = computed<EstadoOpciones>(() => {
    if (this.decisionActual() || this.fase() === 'cierre') {
      return 'resultado';
    }
    if (this.fase() === 'visualizacion' || !this.puedeDecidir()) {
      return 'bloqueado';
    }
    return 'seleccion';
  });

  /** Distingue, dentro de "bloqueado", si es por fecha (con cuenta regresiva) o por rol. */
  readonly bloqueadoPorFecha = computed(() => this.fase() === 'visualizacion');

  constructor() {
    this.cargar();
  }

  confirmarDecision(): void {
    const c = this.caso();
    const idOpcion = Number(this.eleccion());
    if (!c || !idOpcion || this.enviando()) {
      return;
    }
    this.enviando.set(true);
    this.error.set(null);
    // Recargar la MISMA simulación: sin `idSimulacion`, el backend elige otra
    // (confirmado en vivo, 02-oct-2026: tras decidir, salta a otra simulación
    // del estudiante con caso pendiente) y el resultado no se vería nunca.
    const idSimulacion = this.datos()?.idSimulacion;
    this.portal.decidir(c.id, idOpcion).subscribe({
      next: () => {
        this.enviando.set(false);
        this.eleccion.set('');
        this.cargar(idSimulacion);
      },
      error: (err: ErrorHttp) => {
        this.enviando.set(false);
        this.error.set(mensaje(err, 'No se pudo registrar la decisión.'));
      },
    });
  }

  esPasada(key: Fase): boolean {
    return ORDEN_FASES.indexOf(key) < ORDEN_FASES.indexOf(this.fase());
  }

  ngOnDestroy(): void {
    this.relojSub.unsubscribe();
  }

  private cargar(idSimulacion?: number): void {
    this.cargando.set(true);
    this.error.set(null);
    this.portal.casoActual(idSimulacion).subscribe({
      next: (dto) => {
        this.datos.set(dto);
        this.cargando.set(false);
      },
      error: (err: ErrorHttp) => {
        this.cargando.set(false);
        this.error.set(mensaje(err, 'No se pudo cargar el caso actual.'));
      },
    });
  }

  private formatearFecha(valor: string | undefined): string | null {
    return valor ? valor.replace('T', ' · ') : null;
  }
}

/**
 * Fase de un caso según la hora actual: antes de `fechaInicioPartida` está en
 * "visualizacion", entre inicio y `fechaFinPartida` está en "partida", después
 * en "cierre". Si una fecha no es válida, se ignora esa frontera en vez de romper.
 */
export function calcularFase(caso: CasoEstudiante, ahoraMs: number): Fase {
  const inicioMs = aFechaBogota(caso.fechaInicioPartida);
  const finMs = aFechaBogota(caso.fechaFinPartida);
  if (Number.isFinite(inicioMs) && ahoraMs < inicioMs) {
    return 'visualizacion';
  }
  if (Number.isFinite(finMs) && ahoraMs > finMs) {
    return 'cierre';
  }
  return 'partida';
}

/** Formatea milisegundos restantes como {dias, horas, min, seg} con ceros a la izquierda. */
export function formatearCuenta(restanteMs: number): {
  dias: string;
  horas: string;
  min: string;
  seg: string;
} {
  if (!Number.isFinite(restanteMs) || restanteMs <= 0) {
    return { dias: '00', horas: '00', min: '00', seg: '00' };
  }
  const totalSeg = Math.floor(restanteMs / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    dias: pad(Math.floor(totalSeg / 86400)),
    horas: pad(Math.floor((totalSeg % 86400) / 3600)),
    min: pad(Math.floor((totalSeg % 3600) / 60)),
    seg: pad(totalSeg % 60),
  };
}
