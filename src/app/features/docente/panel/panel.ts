import { ChangeDetectionStrategy, Component, computed, inject, isDevMode, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { Alerta } from '../../../shared/components/alerta/alerta';
import { Badge } from '../../../shared/components/badge/badge';
import { Toggle } from '../../../shared/components/toggle/toggle';
import { CasoApi, DecisionEmpresa } from '../../simulacion/models/caso-api.model';
import { Casos } from '../casos/casos';
import { CasoApiService } from '../casos/services/caso-api.service';
import { CierreCasoService } from '../casos/services/cierre-caso.service';
import { EstadoSimulacion, Simulacion } from '../simulaciones/models/simulacion.model';
import { SimulacionService } from '../simulaciones/services/simulacion.service';

type TabPanel = 'periodos' | 'equipos' | 'casos' | 'parametros';

type ErrorHttp = {
  message?: string;
  error?: { message?: string; errores?: { campo?: string; mensaje?: string }[] };
};

/** Error de /programar: el mensaje general y, si vienen, los motivos por los que la simulación no está lista. */
interface ErrorProgramar {
  mensaje: string;
  detalle: string[];
}

/** Un caso activo con su simulación, para el selector de "Entregas por empresa" y "Finalizar simulación". */
interface CasoEntregas {
  id: number;
  nombre: string;
  simulacion: string;
  idSimulacion: number;
  /** `null` si no se pudo cargar la lista de simulaciones. */
  estadoSimulacion: EstadoSimulacion | null;
  /** El caso tal cual vino del backend: lo necesita la confirmación de cierre (fecha de fin). */
  caso: CasoApi;
}

/**
 * Orden de los casos activos en "Entregas por empresa": primero el de la
 * simulación en curso, que es el que el docente está siguiendo.
 */
const PRIORIDAD_ESTADO: Record<EstadoSimulacion, number> = {
  EN_CURSO: 0,
  PROGRAMADA: 1,
  BORRADOR: 2,
  FINALIZADA: 3,
};

function mensaje(err: ErrorHttp, porDefecto: string): string {
  return err?.error?.message ?? err?.message ?? porDefecto;
}

const formatoFechaLarga = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const formatoFecha = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

interface PasoConfig {
  n: number;
  titulo: string;
  descripcion: string;
  enlaceTexto: string;
  /** Ruta externa (routerLink) o tab interno al que lleva la acción del paso. */
  ruta?: string;
  tab?: TabPanel;
  completado: boolean;
  /** El paso 4 se habilita solo cuando 1-3 están completos. */
  bloqueado: boolean;
}

/**
 * Panel del docente (docs/05, 🎨) con tabs internos.
 *
 * La pestaña "Control de periodos" tiene DOS estados condicionales sobre la
 * misma tarjeta, no dos pantallas: los renderiza `configuracionCompleta`
 * (computado a partir de datos mock: estudiantes cargados + equipos formados +
 * caso activo).
 *
 * Datos mock, salvo "Entregas por empresa" y "Finalizar simulación":
 *  - Entregas sale del backend (`GET /docente/casos/{id}/decisiones` del caso
 *    activo), con una fila por empresa de la simulación y `decidio`.
 *  - "Finalizar simulación" actúa sobre la simulación de ese mismo caso, solo
 *    si está EN_CURSO: finalizar cierra el caso abierto y el backend penaliza
 *    a las empresas que no decidieron, así que antes se confirma con
 *    `CierreCasoService` (cuántas faltan).
 * El resto de "Control de periodos" (tiempo restante, pasos, recordatorio)
 * sigue siendo mock.
 */
@Component({
  selector: 'app-panel',
  imports: [NgTemplateOutlet, RouterLink, Alerta, Badge, Toggle, Casos],
  templateUrl: './panel.html',
  styleUrl: './panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Panel {
  private readonly casoApi = inject(CasoApiService);
  private readonly simulacionService = inject(SimulacionService);
  private readonly cierreCaso = inject(CierreCasoService);

  /** La barra de vista previa de estados es una ayuda de desarrollo. */
  readonly esDev = isDevMode();
  readonly tab = signal<TabPanel>('periodos');
  readonly recibiendo = signal(false);

  // -- Estado de configuración (mock). Por defecto: sin configurar. --
  readonly estudiantesCargados = signal(0);
  readonly equiposFormados = signal(0);
  readonly casoActivo = signal<string | null>(null);

  readonly configuracionCompleta = computed(
    () =>
      this.estudiantesCargados() > 0 &&
      this.equiposFormados() > 0 &&
      this.casoActivo() !== null,
  );

  readonly pasos = computed<PasoConfig[]>(() => {
    const p1 = this.estudiantesCargados() > 0;
    const p2 = this.equiposFormados() > 0;
    const p3 = this.casoActivo() !== null;
    return [
      {
        n: 1,
        titulo: 'Cargar estudiantes',
        descripcion: 'Sube el listado de tu curso vía Excel',
        enlaceTexto: 'Ir a Carga de estudiantes',
        ruta: '/docente/estudiantes',
        completado: p1,
        bloqueado: false,
      },
      {
        n: 2,
        titulo: 'Armar empresas',
        descripcion: 'Crea las empresas de la simulación y asigna sus integrantes',
        enlaceTexto: 'Ir a Empresas',
        ruta: '/docente/empresas',
        completado: p2,
        bloqueado: false,
      },
      {
        n: 3,
        titulo: 'Seleccionar el caso activo',
        descripcion: 'Elige el caso de negocio que van a trabajar',
        enlaceTexto: 'Ir a Casos',
        tab: 'casos',
        completado: p3,
        bloqueado: false,
      },
      {
        // Real (backend): programa una simulación en BORRADOR. No depende de
        // los pasos 1-3, que siguen siendo mock: si no, nunca se habilitaría.
        n: 4,
        titulo: 'Programar la simulación',
        descripcion: 'Arranca sola en su fecha de inicio; desde ahí no se pueden cambiar empresas ni casos',
        enlaceTexto: 'Programar',
        tab: 'periodos',
        completado: false,
        bloqueado: false,
      },
    ];
  });

  readonly primerPasoPendiente = computed(
    () => this.pasos().find((p) => !p.completado && !p.bloqueado) ?? this.pasos()[0],
  );

  // -- Entregas por empresa (backend real) --
  /** Casos activos del docente (uno por simulación como máximo), el de la simulación en curso primero. */
  readonly casosActivos = signal<CasoEntregas[]>([]);
  readonly idCasoEntregas = signal<number | null>(null);
  readonly casoEntregas = computed(
    () => this.casosActivos().find((c) => c.id === this.idCasoEntregas()) ?? null,
  );
  readonly entregas = signal<DecisionEmpresa[]>([]);
  readonly cargandoEntregas = signal(true);
  readonly errorEntregas = signal<string | null>(null);
  readonly entregasEnviadas = computed(() => this.entregas().filter((e) => e.decidio).length);

  // -- Programar simulación (backend real, paso 4) --
  readonly simulaciones = signal<Simulacion[]>([]);
  readonly borradores = computed(() => this.simulaciones().filter((s) => s.estado === 'BORRADOR'));
  readonly idSimulacionProgramar = signal<number | null>(null);
  /** La elegida en el selector o, si no hay elección, la primera en BORRADOR. */
  readonly simulacionProgramar = computed<Simulacion | null>(
    () => this.borradores().find((s) => s.id === this.idSimulacionProgramar()) ?? this.borradores()[0] ?? null,
  );
  readonly programando = signal(false);
  readonly errorProgramar = signal<ErrorProgramar | null>(null);
  readonly avisoProgramar = signal<string | null>(null);

  // -- Finalizar simulación (backend real) --
  /** Solo con la simulación del caso de "Entregas" EN_CURSO (el backend responde 400 en otro estado). */
  readonly puedeFinalizar = computed(() => this.casoEntregas()?.estadoSimulacion === 'EN_CURSO');
  readonly finalizando = signal(false);
  readonly errorFinalizar = signal<string | null>(null);
  readonly avisoFinalizar = signal<string | null>(null);

  constructor() {
    this.cargarCasosActivos();
  }

  /** Cambia el caso del que se muestran las entregas (cuando hay más de una simulación con caso activo). */
  elegirCasoEntregas(id: number): void {
    if (id === this.idCasoEntregas()) {
      return;
    }
    this.idCasoEntregas.set(id);
    this.cargarEntregas(id);
  }

  /**
   * EN_CURSO -> FINALIZADA. Cierra el caso abierto de la simulación (el de
   * "Entregas") y el backend penaliza a las empresas que no decidieron: antes
   * se confirma diciendo cuántas son. Al terminar se recarga el panel.
   */
  finalizarSimulacion(): void {
    const actual = this.casoEntregas();
    if (!actual || !this.puedeFinalizar() || this.finalizando()) {
      return;
    }
    this.errorFinalizar.set(null);
    this.avisoFinalizar.set(null);
    this.finalizando.set(true);
    this.cierreCaso.confirmar(`Finalizar «${actual.simulacion}»`, actual.caso).subscribe((confirmado) => {
      if (!confirmado) {
        this.finalizando.set(false);
        return;
      }
      this.simulacionService.finalizar(actual.idSimulacion).subscribe({
        next: () => {
          this.finalizando.set(false);
          this.avisoFinalizar.set(`La simulación «${actual.simulacion}» quedó finalizada.`);
          this.cargarCasosActivos();
        },
        error: (err: ErrorHttp) => {
          this.finalizando.set(false);
          this.errorFinalizar.set(mensaje(err, 'No se pudo finalizar la simulación.'));
        },
      });
    });
  }

  /**
   * BORRADOR -> PROGRAMADA. Con el arranque automático, la simulación pasa sola
   * a EN_CURSO en su `fechaInicio` y desde ahí no se pueden cambiar empresas ni
   * casos: por eso se confirma antes. Si el backend responde que no está lista,
   * se muestran sus motivos (`errores[]`).
   */
  programarSimulacion(): void {
    const sim = this.simulacionProgramar();
    if (!sim || this.programando()) {
      return;
    }
    if (!window.confirm(mensajeProgramar(sim))) {
      return;
    }
    this.errorProgramar.set(null);
    this.avisoProgramar.set(null);
    this.programando.set(true);
    this.simulacionService.programar(sim.id).subscribe({
      next: () => {
        this.programando.set(false);
        this.idSimulacionProgramar.set(null);
        this.avisoProgramar.set(`«${sim.nombre}» quedó programada: arranca sola en su fecha de inicio.`);
        this.cargarCasosActivos();
      },
      error: (err: ErrorHttp) => {
        this.programando.set(false);
        this.errorProgramar.set({
          mensaje: mensaje(err, 'No se pudo programar la simulación.'),
          detalle: (err?.error?.errores ?? []).map((e) => e.mensaje ?? '').filter((m) => m !== ''),
        });
      },
    });
  }

  fechaEntrega(iso: string | null): string {
    if (!iso) {
      return '';
    }
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : formatoFecha.format(d);
  }

  irA(tab: TabPanel): void {
    this.tab.set(tab);
  }

  irAPaso(paso: PasoConfig): void {
    if (paso.bloqueado) {
      return;
    }
    if (paso.tab) {
      this.tab.set(paso.tab);
    }
  }

  private cargarCasosActivos(): void {
    this.cargandoEntregas.set(true);
    this.errorEntregas.set(null);
    forkJoin({
      casos: this.casoApi.listar(),
      // Sin simulaciones igual se puede mostrar el caso: solo se pierden el nombre y el orden.
      simulaciones: this.simulacionService.listar().pipe(catchError(() => of<Simulacion[]>([]))),
    }).subscribe({
      next: ({ casos, simulaciones }) => {
        this.simulaciones.set(simulaciones);
        const activos = this.ordenarActivos(casos, simulaciones);
        this.casosActivos.set(activos);
        const primero = activos[0]?.id ?? null;
        this.idCasoEntregas.set(primero);
        if (primero == null) {
          this.entregas.set([]);
          this.cargandoEntregas.set(false);
        } else {
          this.cargarEntregas(primero);
        }
      },
      error: (err: ErrorHttp) => {
        this.cargandoEntregas.set(false);
        this.errorEntregas.set(mensaje(err, 'No se pudieron cargar los casos.'));
      },
    });
  }

  private ordenarActivos(casos: CasoApi[], simulaciones: Simulacion[]): CasoEntregas[] {
    const simPorId = new Map(simulaciones.map((s) => [s.id, s]));
    const prioridad = (c: CasoApi) => {
      const estado = simPorId.get(c.idSimulacion)?.estado;
      return estado ? PRIORIDAD_ESTADO[estado] : PRIORIDAD_ESTADO.BORRADOR;
    };
    return casos
      .filter((c) => c.estado === 'activo')
      .sort((a, b) => prioridad(a) - prioridad(b))
      .map((c) => ({
        id: c.id,
        nombre: c.nombre,
        simulacion: simPorId.get(c.idSimulacion)?.nombre ?? `Simulación #${c.idSimulacion}`,
        idSimulacion: c.idSimulacion,
        estadoSimulacion: simPorId.get(c.idSimulacion)?.estado ?? null,
        caso: c,
      }));
  }

  private cargarEntregas(idCaso: number): void {
    this.cargandoEntregas.set(true);
    this.errorEntregas.set(null);
    this.casoApi.decisiones(idCaso).subscribe({
      next: (filas) => {
        // Si el docente cambió de caso mientras cargaba, esta respuesta ya no aplica.
        if (idCaso !== this.idCasoEntregas()) {
          return;
        }
        this.entregas.set(filas);
        this.cargandoEntregas.set(false);
      },
      error: (err: ErrorHttp) => {
        if (idCaso !== this.idCasoEntregas()) {
          return;
        }
        this.entregas.set([]);
        this.cargandoEntregas.set(false);
        this.errorEntregas.set(mensaje(err, 'No se pudieron cargar las entregas.'));
      },
    });
  }

  /**
   * 🎨 Ayuda de desarrollo (no es parte del diseño): alterna los datos mock
   * entre "sin configurar" y "simulación activa" para validar ambos estados.
   */
  aplicarPreview(completa: boolean): void {
    if (completa) {
      this.estudiantesCargados.set(32);
      this.equiposFormados.set(5);
      this.casoActivo.set('Expansión regional');
      this.recibiendo.set(true);
    } else {
      this.estudiantesCargados.set(0);
      this.equiposFormados.set(0);
      this.casoActivo.set(null);
      this.recibiendo.set(false);
    }
  }
}

/** Texto de la confirmación de "Programar": que arranca sola y que después ya no se puede cambiar. */
export function mensajeProgramar(sim: Simulacion): string {
  const inicio = new Date(sim.fechaInicio);
  const cuando = Number.isNaN(inicio.getTime()) ? 'en su fecha de inicio' : `el ${formatoFechaLarga.format(inicio)}`;
  return (
    `¿Programar «${sim.nombre}»? La simulación arranca sola ${cuando} y, ` +
    'desde ese momento, ya no se pueden cambiar sus empresas ni sus casos.'
  );
}
