import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Badge } from '../../../shared/components/badge/badge';
import { Toggle } from '../../../shared/components/toggle/toggle';

type TabPanel = 'periodos' | 'equipos' | 'casos' | 'parametros';

interface EntregaEquipo {
  equipo: string;
  enviado: boolean;
}

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
 * Datos mock. Ojo (docs/05): "quién cierra el período" es pregunta abierta —
 * los botones existen solo como UI.
 */
@Component({
  selector: 'app-panel',
  imports: [RouterLink, Badge, Toggle],
  templateUrl: './panel.html',
  styleUrl: './panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Panel {
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
        titulo: 'Formar equipos',
        descripcion: 'Agrupa a los estudiantes cargados en equipos',
        enlaceTexto: 'Ir a Equipos y estudiantes',
        tab: 'equipos',
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
        n: 4,
        titulo: 'Configurar y abrir el período',
        descripcion: 'Define la fecha de cierre y ábrelo a los equipos',
        enlaceTexto: 'Se habilita al completar lo anterior',
        tab: 'periodos',
        completado: false,
        bloqueado: !(p1 && p2 && p3),
      },
    ];
  });

  readonly primerPasoPendiente = computed(
    () => this.pasos().find((p) => !p.completado && !p.bloqueado) ?? this.pasos()[0],
  );

  readonly entregas = signal<EntregaEquipo[]>([
    { equipo: 'Andina Corp.', enviado: true },
    { equipo: 'NovaTech S.A.', enviado: true },
    { equipo: 'Grupo Meridian', enviado: true },
    { equipo: 'Equipo Cóndor', enviado: false },
    { equipo: 'Vértice Ltda.', enviado: false },
  ]);
  readonly entregasEnviadas = computed(() => this.entregas().filter((e) => e.enviado).length);

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
