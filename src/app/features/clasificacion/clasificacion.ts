import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import { Rol } from '../../core/models/rol.enum';
import { AuthService } from '../../core/services/auth.service';
import { Alerta } from '../../shared/components/alerta/alerta';
import { Badge } from '../../shared/components/badge/badge';
import { SimulacionService } from '../docente/simulaciones/services/simulacion.service';
import { PortalEstudianteService } from '../estudiante/services/portal-estudiante.service';
import { formatearMoneda } from '../simulacion/models/financiero.model';
import { Clasificacion as ClasificacionDto } from './models/clasificacion.model';
import { ClasificacionService } from './services/clasificacion.service';

/** Opción del selector, igual para los dos roles. Ids numéricos (como en el backend). */
interface OpcionSimulacion {
  id: number;
  nombre: string;
  estado: string;
  /** Solo estudiante: su empresa en esa simulación, para resaltar su fila. */
  idEmpresa?: number;
}

type Estado = 'sin-simulacion' | 'cargando' | 'ok' | 'no-disponible' | 'error';

const ESTADOS_SIMULACION: Record<string, string> = {
  BORRADOR: 'borrador',
  PROGRAMADA: 'programada',
  EN_CURSO: 'en curso',
  FINALIZADA: 'finalizada',
};

/** El 400 esperado del portal del estudiante antes de que termine la simulación. */
const AUN_NO_DISPONIBLE = /disponible cuando la simulaci[oó]n finalice/i;

/**
 * Clasificación de una simulación (`/clasificacion?simulacion=ID`). Un solo
 * componente para los dos roles, conectado al backend real
 * (`ClasificacionService`):
 *  - Docente: cualquier estado; si `definitiva` es false, badge de vista previa.
 *  - Estudiante: solo FINALIZADA. El 400 "estará disponible cuando la
 *    simulación finalice" es un estado esperado (info), no un error; cualquier
 *    otro error (ej. "No participas en esta simulación") sí se muestra como error.
 *
 * El orden y la `posicion` (con empates 1, 1, 3) vienen resueltos del backend:
 * no se reordena ni se recalcula nada.
 */
@Component({
  selector: 'app-clasificacion',
  imports: [Alerta, Badge],
  templateUrl: './clasificacion.html',
  styleUrl: './clasificacion.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Clasificacion {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly clasificacionService = inject(ClasificacionService);
  private readonly simulacionService = inject(SimulacionService);
  private readonly portal = inject(PortalEstudianteService);

  readonly esDocente = computed(() => this.auth.usuarioActual()?.rol === Rol.DOCENTE);
  readonly simulaciones = signal<OpcionSimulacion[]>([]);
  readonly errorSimulaciones = signal<string | null>(null);

  readonly idSimulacion = toSignal(
    this.route.queryParamMap.pipe(
      map((p) => {
        const id = Number(p.get('simulacion'));
        return Number.isInteger(id) && id > 0 ? id : null;
      }),
    ),
    { initialValue: null },
  );

  readonly estado = signal<Estado>('sin-simulacion');
  readonly datos = signal<ClasificacionDto | null>(null);
  readonly mensaje = signal<string | null>(null);
  /** Filas abiertas (por `idEmpresa`). */
  readonly expandidas = signal<ReadonlySet<number>>(new Set());

  /** Empresa del estudiante en la simulación elegida (número, igual que `FilaClasificacion.idEmpresa`). */
  readonly miIdEmpresa = computed(
    () => this.simulaciones().find((s) => s.id === this.idSimulacion())?.idEmpresa ?? null,
  );
  readonly sinResultados = computed(() => {
    const d = this.datos();
    return d !== null && (d.casosConsiderados === 0 || d.clasificacion.length === 0);
  });

  constructor() {
    this.cargarSimulaciones();
    effect(() => {
      const id = this.idSimulacion();
      untracked(() => this.cargar(id));
    });
  }

  elegirSimulacion(valor: string): void {
    const id = Number(valor);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { simulacion: id > 0 ? id : null },
      queryParamsHandling: 'merge',
    });
  }

  estadoLegible(estado: string): string {
    return ESTADOS_SIMULACION[estado] ?? estado.toLowerCase();
  }

  alternar(idEmpresa: number): void {
    this.expandidas.update((s) => {
      const nuevo = new Set(s);
      if (!nuevo.delete(idEmpresa)) {
        nuevo.add(idEmpresa);
      }
      return nuevo;
    });
  }

  moneda(valor: number | null | undefined): string {
    return valor == null ? '—' : formatearMoneda(valor);
  }

  fecha(valor: string | null | undefined): string {
    return valor ? valor.slice(0, 16).replace('T', ' · ') : '—';
  }

  private cargarSimulaciones(): void {
    if (this.esDocente()) {
      this.simulacionService.listar().subscribe({
        next: (lista) => this.simulaciones.set(lista.map((s) => ({ id: s.id, nombre: s.nombre, estado: s.estado }))),
        error: (err: HttpErrorResponse) =>
          this.errorSimulaciones.set(err?.error?.message ?? 'No se pudieron cargar las simulaciones.'),
      });
    } else {
      this.portal.misSimulaciones().subscribe({
        next: (lista) =>
          this.simulaciones.set(
            lista.map((s) => ({
              id: Number(s.idSimulacion),
              nombre: s.nombreSimulacion,
              estado: s.estado,
              idEmpresa: Number(s.idEmpresa),
            })),
          ),
        error: (err: HttpErrorResponse) =>
          this.errorSimulaciones.set(err?.error?.message ?? 'No se pudieron cargar tus simulaciones.'),
      });
    }
  }

  private cargar(idSimulacion: number | null): void {
    this.datos.set(null);
    this.mensaje.set(null);
    this.expandidas.set(new Set());
    if (idSimulacion === null) {
      this.estado.set('sin-simulacion');
      return;
    }
    this.estado.set('cargando');
    const peticion = this.esDocente()
      ? this.clasificacionService.docente(idSimulacion)
      : this.clasificacionService.estudiante(idSimulacion);
    peticion.subscribe({
      next: (datos) => {
        if (this.idSimulacion() !== idSimulacion) {
          return;
        }
        this.datos.set(datos);
        this.estado.set('ok');
      },
      error: (err: HttpErrorResponse) => {
        if (this.idSimulacion() !== idSimulacion) {
          return;
        }
        const msg: string | undefined = err?.error?.message;
        const esperado = !this.esDocente() && err?.status === 400 && !!msg && AUN_NO_DISPONIBLE.test(msg);
        this.mensaje.set(msg ?? 'No se pudo cargar la clasificación.');
        this.estado.set(esperado ? 'no-disponible' : 'error');
      },
    });
  }
}
