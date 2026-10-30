import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable, Subscription, interval, of } from 'rxjs';
import { catchError, map, shareReplay, switchMap } from 'rxjs/operators';

import { Badge } from '../../../shared/components/badge/badge';
import { Alerta } from '../../../shared/components/alerta/alerta';
import { Kpi } from '../../../shared/components/kpi/kpi';
import {
  OpcionSeleccion,
  TarjetaSeleccion,
} from '../../../shared/components/tarjeta-seleccion/tarjeta-seleccion';
import { Boletin, formatearPorcentajeBoletin, formatearTasaCambio } from '../../simulacion/models/boletin.model';
import { CasoEstudiante } from '../../simulacion/models/caso-api.model';
import { describirImpacto, formatearMoneda } from '../../simulacion/models/financiero.model';
import { AuthService } from '../../../core/services/auth.service';
import { nombreDepartamento } from '../../docente/integrantes/models/integrante.model';
import { CasoActual as CasoActualDto, MiEmpresa, MiSimulacion } from '../models/portal-estudiante.model';
import { PortalEstudianteService } from '../services/portal-estudiante.service';
import { aFechaBogota } from '../../../shared/utils/fecha-bogota';

type Fase = 'visualizacion' | 'partida' | 'cierre';
/** Estado visual de la tarjeta "Opciones de decisión" (distinto de `Fase`). */
type EstadoOpciones = 'bloqueado' | 'seleccion' | 'resultado';
type ErrorHttp = { status?: number; message?: string; error?: { message?: string } };

const ORDEN_FASES: Fase[] = ['visualizacion', 'partida', 'cierre'];

/** Cada cuánto se recalculan fase y cuenta regresiva contra el reloj (ms). */
const INTERVALO_RELOJ_MS = 5000;

// Vive en shared/utils porque Casos (docente) también la usa; se reexporta aquí por compatibilidad.
export { aFechaBogota } from '../../../shared/utils/fecha-bogota';

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
const ESTADOS_SIMULACION: Record<string, string> = {
  BORRADOR: 'borrador',
  PROGRAMADA: 'programada',
  EN_CURSO: 'en curso',
  FINALIZADA: 'finalizada',
};

@Component({
  selector: 'app-caso-actual',
  imports: [NgTemplateOutlet, RouterLink, Badge, Alerta, Kpi, TarjetaSeleccion],
  templateUrl: './caso-actual.html',
  styleUrl: './caso-actual.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CasoActual implements OnDestroy {
  private readonly portal = inject(PortalEstudianteService);
  private readonly auth = inject(AuthService);
  private readonly documento = inject(DOCUMENT);

  /** Se pide una sola vez: la usan el selector y la detección del hueco entre casos. */
  private readonly misSimulaciones$ = this.portal.misSimulaciones().pipe(
    catchError(() => of<MiSimulacion[]>([])),
    shareReplay(1),
  );

  /**
   * Simulaciones del estudiante, para el selector. Red de seguridad: sin
   * `idSimulacion`, el backend no siempre elige la simulación esperada
   * (confirmado en vivo, 02-oct-2026: devuelve una FINALIZADA aunque haya
   * otras EN_CURSO con caso activo).
   */
  readonly simulaciones = signal<MiSimulacion[]>([]);
  /** Simulación pedida explícitamente (selector o la recordada); `undefined` = la que elija el backend. */
  private readonly idSolicitada = signal<number | undefined>(undefined);
  /** Lo que muestra el selector: la simulación del caso cargado, o la pedida si no tiene caso (204). */
  readonly idSimulacionMostrada = computed(() => this.datos()?.idSimulacion ?? this.idSolicitada() ?? null);

  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly enviando = signal(false);
  private readonly datos = signal<CasoActualDto | null>(null);
  /** Aviso cuando la decisión no se registró porque el docente cerró el caso mientras tanto. */
  readonly avisoCierre = signal<string | null>(null);
  /**
   * 204 en una simulación que YA tuvo casos visibles: el docente cerró el
   * anterior y el siguiente todavía no se publica. Distinto de "todavía no
   * hay ningún caso".
   */
  readonly entreCasos = signal(false);

  /** El caso activo visible para la empresa del estudiante (o null: sin caso, o todavía cargando). */
  readonly caso = computed<CasoEstudiante | null>(() => this.datos()?.caso ?? null);
  /**
   * Situación financiera con la que arranca la empresa en este caso. Con D2
   * viene en `financieroEmpresa.inicial` (propia de la empresa); mientras el
   * backend no la mande, se usa `caso.financiero` (el campo compartido viejo).
   */
  readonly financieroInicial = computed(() => {
    const d = this.datos();
    if (!d) {
      return null;
    }
    const propio = d.financieroEmpresa?.inicial;
    return propio ?? d.caso.financiero;
  });
  /**
   * Respaldo con `caso.financiero` en un caso que no es el primero: el backend
   * no manda el balance (los totales vienen `null`, porque el balance se
   * hereda por empresa y llega en `financieroEmpresa`, que todavía no está en
   * develop). Se muestra solo la utilidad neta y un aviso, no "—".
   */
  readonly balanceNoDisponible = computed(() => {
    const d = this.datos();
    return !!d && !d.financieroEmpresa?.inicial && d.caso.financiero.activoTotal == null;
  });
  readonly avisoBalance = 'El balance propio de tu empresa todavía no está disponible; aparecerá aquí en cuanto se publique.';
  readonly subtituloFinanciero = computed(() => {
    const origen = this.datos()?.financieroEmpresa?.inicial?.origen;
    if (origen === 'heredado') {
      return 'Heredada de las decisiones anteriores de tu empresa';
    }
    if (origen === 'docente') {
      return 'Balance inicial definido por el docente';
    }
    return 'Situación de arranque del caso';
  });
  /** Contexto del encabezado: en qué simulación y con qué empresa juega el estudiante. */
  readonly contexto = computed(() => {
    const d = this.datos();
    return d ? { simulacion: d.nombreSimulacion, empresa: d.nombreEmpresa } : null;
  });
  /** Boletín del docente para este caso (D14): viene en caso-actual, `null` si no publicó. */
  readonly boletin = computed<Boletin | null>(() => this.datos()?.boletin ?? null);
  readonly esLider = computed(() => this.datos()?.esLider ?? false);
  readonly puedeDecidir = computed(() => this.datos()?.puedeDecidir ?? false);
  readonly decisionActual = computed(() => this.datos()?.decision ?? null);
  /** Impacto financiero de la opción elegida, en líneas legibles (vacío si no tenía). */
  readonly detalleImpacto = computed(() => describirImpacto(this.decisionActual()?.impacto));

  /**
   * "Mi empresa": integrantes de la empresa del estudiante en la simulación
   * mostrada. `null` mientras carga o si el backend no la da (400: la empresa
   * no es suya; cualquier otro error tampoco la muestra, es información de apoyo).
   */
  readonly miEmpresa = signal<MiEmpresa | null>(null);
  /** De qué empresa es `miEmpresa` (o la que se está pidiendo), para no repetir el GET ni aceptar respuestas viejas. */
  private idEmpresaPedida: number | null = null;
  readonly departamento = nombreDepartamento;

  /** Reloj reactivo: se actualiza solo cada `INTERVALO_RELOJ_MS` (ver `ngOnDestroy`). */
  private readonly ahora = signal(Date.now());
  private readonly relojSub: Subscription = interval(INTERVALO_RELOJ_MS).subscribe(() =>
    this.ahora.set(Date.now()),
  );

  /** Se calcula contra las fechas del caso y `partidaFinalizada` — no hay forma de forzarla a mano. */
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
    this.cargar(this.leerSimulacionRecordada());
    // Sin la lista no hay selector (catchError -> []); el resto de la pantalla funciona igual.
    this.misSimulaciones$.subscribe((lista) => {
      this.simulaciones.set(lista);
      // Con 204 no hay `idEmpresa` en caso-actual: sale de esta lista. Si
      // caso-actual todavía no respondió, espera (`mostrar` la pide).
      if (!this.cargando()) {
        this.cargarMiEmpresa();
      }
    });
    this.documento.addEventListener('visibilitychange', this.alVolverVisible);
  }

  elegirSimulacion(id: number): void {
    this.avisoCierre.set(null);
    this.recordarSimulacion(id);
    this.cargar(id);
  }

  /**
   * Al volver a la pestaña se recarga en silencio (sin "Cargando…"): mientras
   * estaba oculta, el docente pudo cerrar el caso o activar el siguiente.
   */
  private readonly alVolverVisible = (): void => {
    if (this.documento.visibilityState !== 'visible' || this.cargando() || this.enviando()) {
      return;
    }
    const idSimulacion = this.datos()?.idSimulacion ?? this.idSolicitada();
    const idCasoAntes = this.caso()?.id;
    this.portal.casoActual(idSimulacion).subscribe({
      next: (dto) => {
        if (dto?.caso.id !== idCasoAntes) {
          this.eleccion.set('');
        }
        this.mostrar(dto, idSimulacion);
      },
      // Un fallo al refrescar no borra lo que ya se veía.
      error: () => undefined,
    });
  };

  readonly porcentaje = formatearPorcentajeBoletin;
  readonly tasaCambio = formatearTasaCambio;

  /** Total financiero con formato de moneda; un 0 se muestra como $0, solo `null` es "—". */
  moneda(valor: number | null | undefined): string {
    return valor == null ? '—' : formatearMoneda(valor);
  }

  estadoLegible(estado: string): string {
    return ESTADOS_SIMULACION[estado] ?? estado.toLowerCase();
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
    this.avisoCierre.set(null);
    this.portal.decidir(c.id, idOpcion).subscribe({
      next: () => {
        this.enviando.set(false);
        this.eleccion.set('');
        this.cargar(idSimulacion);
      },
      error: (err: ErrorHttp) => {
        this.enviando.set(false);
        if (err?.status !== 400) {
          this.error.set(mensaje(err, 'No se pudo registrar la decisión.'));
          return;
        }
        // Lo más probable: el docente cerró el caso (activó el siguiente o
        // finalizó la simulación) mientras el estudiante elegía. Se recarga la
        // misma simulación para no dejar la pantalla en el caso viejo. Si al
        // recargar el caso sigue abierto, el 400 era por otra cosa: se muestra.
        const motivo = mensaje(err, 'No se pudo registrar la decisión.');
        this.eleccion.set('');
        this.cargar(idSimulacion, (dto) => {
          const sigueAbierto = dto?.caso.id === c.id && calcularFase(dto.caso, Date.now()) === 'partida';
          if (sigueAbierto) {
            this.error.set(motivo);
          } else {
            this.avisoCierre.set('El docente cerró este caso antes de que se registrara la decisión.');
          }
        });
      },
    });
  }

  esPasada(key: Fase): boolean {
    return ORDEN_FASES.indexOf(key) < ORDEN_FASES.indexOf(this.fase());
  }

  ngOnDestroy(): void {
    this.relojSub.unsubscribe();
    this.documento.removeEventListener('visibilitychange', this.alVolverVisible);
  }

  /** `alCargar` corre después de mostrar la respuesta (sirve para decidir qué aviso dar). */
  private cargar(idSimulacion?: number, alCargar?: (dto: CasoActualDto | null) => void): void {
    this.cargando.set(true);
    this.error.set(null);
    this.idSolicitada.set(idSimulacion);
    this.portal.casoActual(idSimulacion).subscribe({
      next: (dto) => {
        this.mostrar(dto, idSimulacion);
        this.cargando.set(false);
        alCargar?.(dto);
      },
      error: (err: ErrorHttp) => {
        // La simulación recordada ya no es válida (ej. el estudiante salió de
        // esa empresa): se olvida y se vuelve a la que elija el backend.
        if (idSimulacion !== undefined && idSimulacion === this.leerSimulacionRecordada()) {
          this.olvidarSimulacion();
          this.cargar();
          return;
        }
        this.cargando.set(false);
        this.error.set(mensaje(err, 'No se pudo cargar el caso actual.'));
      },
    });
  }

  /** Muestra la respuesta de caso-actual; con 204, averigua si es el hueco entre dos casos. */
  private mostrar(dto: CasoActualDto | null, idSimulacion: number | undefined): void {
    this.datos.set(dto);
    this.entreCasos.set(false);
    this.cargarMiEmpresa();
    if (dto) {
      return;
    }
    this.simulacionYaTuvoCasos(idSimulacion).subscribe((tuvo) => {
      // Si mientras tanto llegó un caso, ya no aplica.
      if (!this.datos()) {
        this.entreCasos.set(tuvo);
      }
    });
  }

  /**
   * Empresa del estudiante en la simulación mostrada: la de caso-actual o,
   * sin caso (204), la de `misSimulaciones` (la pedida, o la más reciente si
   * eligió el backend). Solo pide de nuevo si cambió la empresa.
   */
  private cargarMiEmpresa(): void {
    const idSimulacion = this.idSolicitada();
    const idEmpresa =
      this.datos()?.idEmpresa ??
      (idSimulacion !== undefined
        ? this.simulaciones().find((s) => s.idSimulacion === idSimulacion)?.idEmpresa
        : this.simulaciones()[0]?.idEmpresa) ??
      null;
    if (idEmpresa === this.idEmpresaPedida) {
      return;
    }
    this.idEmpresaPedida = idEmpresa;
    this.miEmpresa.set(null);
    if (idEmpresa === null) {
      return;
    }
    this.portal.miEmpresa(idEmpresa).subscribe({
      next: (empresa) => {
        if (idEmpresa === this.idEmpresaPedida) {
          this.miEmpresa.set(empresa);
        }
      },
      // 400 (no es su empresa) u otro error: la tarjeta no se muestra.
      error: () => undefined,
    });
  }

  /** Sin `idSimulacion` (eligió el backend) se mira la más reciente del estudiante. */
  private simulacionYaTuvoCasos(idSimulacion: number | undefined): Observable<boolean> {
    const id$ =
      idSimulacion !== undefined
        ? of(idSimulacion)
        : this.misSimulaciones$.pipe(map((lista) => lista[0]?.idSimulacion));
    return id$.pipe(
      switchMap((id) => (id === undefined ? of([]) : this.portal.historialCasos(id))),
      map((casos) => casos.length > 0),
      catchError(() => of(false)),
    );
  }

  private claveSimulacion(): string | null {
    const id = this.auth.usuarioActual()?.id;
    return id ? `portal-estudiante.simulacion.${id}` : null;
  }

  private leerSimulacionRecordada(): number | undefined {
    const clave = this.claveSimulacion();
    try {
      const valor = clave ? Number(localStorage.getItem(clave)) : NaN;
      return Number.isInteger(valor) && valor > 0 ? valor : undefined;
    } catch {
      return undefined;
    }
  }

  private recordarSimulacion(id: number): void {
    const clave = this.claveSimulacion();
    try {
      if (clave) localStorage.setItem(clave, String(id));
    } catch {
      // Sin storage (modo privado, bloqueado): el selector igual funciona en esta visita.
    }
  }

  private olvidarSimulacion(): void {
    const clave = this.claveSimulacion();
    try {
      if (clave) localStorage.removeItem(clave);
    } catch {
      // idem
    }
  }

  private formatearFecha(valor: string | undefined): string | null {
    return valor ? valor.replace('T', ' · ') : null;
  }
}

/**
 * Fase de un caso según la hora actual: antes de `fechaInicioPartida` está en
 * "visualizacion", entre inicio y `fechaFinPartida` está en "partida", después
 * en "cierre". Si una fecha no es válida, se ignora esa frontera en vez de romper.
 *
 * `partidaFinalizada` manda sobre las fechas: el backend también cierra el
 * caso antes de tiempo (el docente activó otro caso o finalizó la
 * simulación), y entonces es "cierre" aunque `fechaFinPartida` no haya llegado.
 */
export function calcularFase(caso: CasoEstudiante, ahoraMs: number): Fase {
  if (caso.partidaFinalizada) {
    return 'cierre';
  }
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
