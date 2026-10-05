import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, map, of } from 'rxjs';

import { Alerta } from '../../../shared/components/alerta/alerta';
import { Badge } from '../../../shared/components/badge/badge';
import { EstudianteCargado } from '../gestion-estudiantes/models/estudiante.model';
import { EstudianteService } from '../gestion-estudiantes/services/estudiante.service';
import { DepartamentoIntegrante, Integrante } from '../integrantes/models/integrante.model';
import { IntegranteService } from '../integrantes/services/integrante.service';
import { EstadoSimulacion, Simulacion, SimulacionRequest } from '../simulaciones/models/simulacion.model';
import { SimulacionService } from '../simulaciones/services/simulacion.service';
import { Empresa, EmpresaRequest, TipoJugadorEmpresa } from './models/empresa.model';
import { EmpresaService } from './services/empresa.service';

type ErrorHttp = { message?: string; error?: { message?: string } };

function mensaje(err: ErrorHttp, porDefecto: string): string {
  return err?.error?.message ?? err?.message ?? porDefecto;
}

/** Estados en los que el backend acepta cambios de empresas e integrantes (400 en los demás). */
const ESTADOS_EDITABLES: readonly EstadoSimulacion[] = ['BORRADOR', 'PROGRAMADA'];

export const ESTADOS_SIMULACION: Record<EstadoSimulacion, string> = {
  BORRADOR: 'borrador',
  PROGRAMADA: 'programada',
  EN_CURSO: 'en curso',
  FINALIZADA: 'finalizada',
};

export const DEPARTAMENTOS: readonly { valor: DepartamentoIntegrante; etiqueta: string }[] = [
  { valor: 'GERENCIA_GENERAL', etiqueta: 'Gerencia general' },
  { valor: 'COMERCIAL', etiqueta: 'Comercial' },
  { valor: 'OPERACIONES', etiqueta: 'Operaciones' },
  { valor: 'ADMINISTRATIVA', etiqueta: 'Administrativa' },
];

interface FormEmpresa {
  nombre: string;
  estrategia: string;
  tipoJugador: TipoJugadorEmpresa;
}

/** Alta de integrante en una empresa. `idUsuario` = id del ESTUDIANTE (valor del `<select>`). */
interface FormIntegrante {
  idUsuario: string;
  departamento: DepartamentoIntegrante;
  esLider: boolean;
}

function formIntegranteVacio(): FormIntegrante {
  return { idUsuario: '', departamento: 'GERENCIA_GENERAL', esLider: false };
}

/**
 * Empresas e integrantes de una simulación — reemplazo de "Formar equipos"
 * (`/docente/equipos`, que sigue activo hasta confirmar esta pantalla).
 *
 * La simulación elegida vive en la URL (`?simulacion=ID`). Conectado al
 * backend real: `EmpresaService`, `IntegranteService` y `SimulacionService`.
 *
 * Reglas que la UI anticipa (el backend igual las aplica con 400):
 *  - Cambios solo con la simulación en BORRADOR/PROGRAMADA.
 *  - Empresa MONOUSUARIO: un solo integrante (queda líder solo).
 *  - Un estudiante, una empresa por simulación: el selector solo ofrece a los
 *    que no están en ninguna empresa de la simulación.
 *  - Un líder por empresa: "Hacer líder" reemplaza al anterior.
 *
 * Ojo: en las rutas de integrantes `{idUsuario}` es el id del ESTUDIANTE
 * (`Integrante.idUsuario`), nunca `Integrante.id`.
 */
@Component({
  selector: 'app-empresas',
  imports: [Alerta, Badge],
  templateUrl: './empresas.html',
  styleUrl: './empresas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Empresas {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly simulacionService = inject(SimulacionService);
  private readonly empresaService = inject(EmpresaService);
  private readonly integranteService = inject(IntegranteService);
  private readonly estudianteService = inject(EstudianteService);

  readonly departamentos = DEPARTAMENTOS;
  readonly estadosSimulacion = ESTADOS_SIMULACION;

  // -- Simulación -------------------------------------------------------------
  readonly simulaciones = signal<Simulacion[]>([]);
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
  readonly simulacion = computed(() => this.simulaciones().find((s) => s.id === this.idSimulacion()) ?? null);
  /** Solo en BORRADOR/PROGRAMADA se puede crear/editar/borrar empresas e integrantes. */
  readonly editable = computed(() => {
    const s = this.simulacion();
    return s !== null && ESTADOS_EDITABLES.includes(s.estado);
  });

  // -- Alta rápida de simulación (mismo flujo que en Casos) -------------------
  readonly creandoSimulacion = signal(false);
  readonly guardandoSimulacion = signal(false);
  readonly errorNuevaSimulacion = signal<string | null>(null);
  readonly nuevaSimNombre = signal('');
  readonly nuevaSimInicio = signal('');
  readonly nuevaSimFin = signal('');

  // -- Empresas e integrantes --------------------------------------------------
  readonly empresas = signal<Empresa[]>([]);
  /** Integrantes por id de empresa. */
  readonly integrantes = signal<Record<number, Integrante[]>>({});
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly ocupado = signal(false);

  readonly estudiantes = signal<EstudianteCargado[]>([]);
  readonly errorEstudiantes = signal<string | null>(null);
  /** Ids de ESTUDIANTE que ya están en alguna empresa de esta simulación. */
  readonly asignados = computed(
    () => new Set(Object.values(this.integrantes()).flatMap((lista) => lista.map((i) => i.idUsuario))),
  );
  /** Estudiantes que se pueden agregar: los que no están en ninguna empresa de la simulación. */
  readonly disponibles = computed(() => this.estudiantes().filter((e) => !this.asignados().has(Number(e.id))));

  /** Formulario de empresa: `null` cerrado; `editandoEmpresaId` null = crear. */
  readonly formEmpresa = signal<FormEmpresa | null>(null);
  readonly editandoEmpresaId = signal<number | null>(null);
  readonly errorEmpresa = signal<string | null>(null);
  readonly confirmandoEliminar = signal<number | null>(null);

  readonly formsIntegrante = signal<Record<number, FormIntegrante>>({});
  /** Error de una acción dentro de una tarjeta, por id de empresa. */
  readonly erroresEmpresa = signal<Record<number, string>>({});

  constructor() {
    this.cargarSimulaciones();
    this.estudianteService.listar().subscribe({
      next: (lista) => this.estudiantes.set(lista),
      error: (err: ErrorHttp) =>
        this.errorEstudiantes.set(mensaje(err, 'No se pudieron cargar los estudiantes.')),
    });

    effect(() => {
      const id = this.idSimulacion();
      untracked(() => this.cargarEmpresas(id));
    });
  }

  // ---------------------------------------------------------------------------
  // Simulación
  // ---------------------------------------------------------------------------

  elegirSimulacion(valor: string): void {
    const id = Number(valor);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { simulacion: id > 0 ? id : null },
      queryParamsHandling: 'merge',
    });
  }

  abrirNuevaSimulacion(): void {
    this.nuevaSimNombre.set('');
    this.nuevaSimInicio.set('');
    this.nuevaSimFin.set('');
    this.errorNuevaSimulacion.set(null);
    this.creandoSimulacion.set(true);
  }

  /** Crea y programa (BORRADOR -> PROGRAMADA) de una vez, igual que en Casos. */
  crearSimulacion(): void {
    if (this.guardandoSimulacion()) {
      return;
    }
    const nombre = this.nuevaSimNombre().trim();
    const inicio = this.nuevaSimInicio();
    const fin = this.nuevaSimFin();
    if (!nombre || !inicio) {
      this.errorNuevaSimulacion.set('Poné un nombre y la fecha de inicio.');
      return;
    }
    if (new Date(inicio).getTime() < Date.now()) {
      this.errorNuevaSimulacion.set('La fecha de inicio no puede ser pasada.');
      return;
    }
    if (fin && new Date(fin) < new Date(inicio)) {
      this.errorNuevaSimulacion.set('La fecha de fin no puede ser anterior a la de inicio.');
      return;
    }
    // Las fechas de Simulación sí se convierten bien desde UTC (ver
    // scripts/integration: el bug de zona horaria es solo de las fechas de Caso).
    const req: SimulacionRequest = {
      nombre,
      fechaInicio: new Date(inicio).toISOString(),
      ...(fin ? { fechaFin: new Date(fin).toISOString() } : {}),
    };

    this.errorNuevaSimulacion.set(null);
    this.guardandoSimulacion.set(true);
    this.simulacionService.crear(req).subscribe({
      next: (creada) =>
        this.simulacionService.programar(creada.id).subscribe({
          next: (programada) => this.simulacionCreada(programada),
          // Quedó en BORRADOR: igual sirve para armar empresas.
          error: () => this.simulacionCreada(creada),
        }),
      error: (err: ErrorHttp) => {
        this.guardandoSimulacion.set(false);
        this.errorNuevaSimulacion.set(mensaje(err, 'No se pudo crear la simulación.'));
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Empresas
  // ---------------------------------------------------------------------------

  nuevaEmpresa(): void {
    this.editandoEmpresaId.set(null);
    this.errorEmpresa.set(null);
    this.formEmpresa.set({ nombre: '', estrategia: '', tipoJugador: 'MULTIUSUARIO' });
  }

  editarEmpresa(e: Empresa): void {
    this.editandoEmpresaId.set(e.id);
    this.errorEmpresa.set(null);
    this.formEmpresa.set({ nombre: e.nombre, estrategia: e.estrategia ?? '', tipoJugador: e.tipoJugador });
  }

  cancelarEmpresa(): void {
    this.formEmpresa.set(null);
    this.editandoEmpresaId.set(null);
  }

  actualizarFormEmpresa(cambios: Partial<FormEmpresa>): void {
    this.formEmpresa.update((f) => (f ? { ...f, ...cambios } : f));
  }

  guardarEmpresa(): void {
    const f = this.formEmpresa();
    const idSim = this.idSimulacion();
    if (!f || idSim === null || this.ocupado()) {
      return;
    }
    if (!f.nombre.trim()) {
      this.errorEmpresa.set('Poné un nombre para la empresa.');
      return;
    }
    // `codigoEmpresa` nunca se envía: lo genera el backend (EMP-001, EMP-002...).
    const req: EmpresaRequest = {
      nombre: f.nombre.trim(),
      tipoJugador: f.tipoJugador,
      ...(f.estrategia.trim() ? { estrategia: f.estrategia.trim() } : {}),
    };
    const idEdicion = this.editandoEmpresaId();
    const peticion =
      idEdicion === null ? this.empresaService.crear(idSim, req) : this.empresaService.actualizar(idEdicion, req);

    this.ocupado.set(true);
    this.errorEmpresa.set(null);
    peticion.subscribe({
      next: (empresa) => {
        this.ocupado.set(false);
        this.cancelarEmpresa();
        this.empresas.update((lista) =>
          idEdicion === null ? [...lista, empresa] : lista.map((e) => (e.id === empresa.id ? empresa : e)),
        );
        if (idEdicion === null) {
          this.integrantes.update((m) => ({ ...m, [empresa.id]: [] }));
        }
      },
      error: (err: ErrorHttp) => {
        this.ocupado.set(false);
        this.errorEmpresa.set(mensaje(err, 'No se pudo guardar la empresa.'));
      },
    });
  }

  eliminarEmpresa(id: number): void {
    if (this.ocupado()) {
      return;
    }
    this.ocupado.set(true);
    this.empresaService.eliminar(id).subscribe({
      next: () => {
        this.ocupado.set(false);
        this.confirmandoEliminar.set(null);
        this.empresas.update((lista) => lista.filter((e) => e.id !== id));
        // El backend borra los integrantes en cascada: quedan libres para otra empresa.
        this.integrantes.update((m) => {
          const { [id]: _, ...resto } = m;
          return resto;
        });
      },
      error: (err: ErrorHttp) => {
        this.ocupado.set(false);
        this.confirmandoEliminar.set(null);
        this.marcarError(id, mensaje(err, 'No se pudo eliminar la empresa.'));
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Integrantes
  // ---------------------------------------------------------------------------

  integrantesDe(idEmpresa: number): Integrante[] {
    return this.integrantes()[idEmpresa] ?? [];
  }

  /** MONOUSUARIO con su único integrante ya asignado: no admite otro (backend: 400). */
  monousuarioCompleta(e: Empresa): boolean {
    return e.tipoJugador === 'MONOUSUARIO' && this.integrantesDe(e.id).length >= 1;
  }

  /** Con integrantes pero sin líder (ej. se quitó al líder): nadie puede decidir en el portal. */
  sinLider(idEmpresa: number): boolean {
    const lista = this.integrantesDe(idEmpresa);
    return lista.length > 0 && !lista.some((i) => i.esLider);
  }

  puedeAgregar(e: Empresa): boolean {
    return this.editable() && !this.monousuarioCompleta(e);
  }

  formIntegrante(idEmpresa: number): FormIntegrante {
    return this.formsIntegrante()[idEmpresa] ?? formIntegranteVacio();
  }

  actualizarFormIntegrante(idEmpresa: number, cambios: Partial<FormIntegrante>): void {
    this.formsIntegrante.update((m) => ({ ...m, [idEmpresa]: { ...this.formIntegrante(idEmpresa), ...cambios } }));
  }

  agregarIntegrante(e: Empresa): void {
    const f = this.formIntegrante(e.id);
    const idUsuario = Number(f.idUsuario);
    if (!idUsuario || !this.puedeAgregar(e) || this.ocupado()) {
      return;
    }
    this.ocupar(e.id);
    this.integranteService
      .agregar(e.id, {
        idUsuario,
        departamento: f.departamento,
        // En MONOUSUARIO el único integrante queda líder solo.
        ...(e.tipoJugador === 'MULTIUSUARIO' && f.esLider ? { esLider: true } : {}),
      })
      .subscribe({
        next: () => {
          this.formsIntegrante.update((m) => ({ ...m, [e.id]: formIntegranteVacio() }));
          this.recargarIntegrantes(e.id);
        },
        error: (err: ErrorHttp) => this.fallo(e.id, err, 'No se pudo agregar el integrante.'),
      });
  }

  cambiarDepartamento(idEmpresa: number, i: Integrante, departamento: string): void {
    this.ocupar(idEmpresa);
    this.integranteService
      .actualizarDepartamento(idEmpresa, i.idUsuario, departamento as DepartamentoIntegrante)
      .subscribe({
        next: () => this.recargarIntegrantes(idEmpresa),
        error: (err: ErrorHttp) => {
          this.fallo(idEmpresa, err, 'No se pudo cambiar el departamento.');
          this.recargarIntegrantes(idEmpresa);
        },
      });
  }

  /** Reemplaza al líder actual: recarga la empresa entera porque cambian dos filas. */
  hacerLider(idEmpresa: number, i: Integrante): void {
    this.ocupar(idEmpresa);
    this.integranteService.hacerLider(idEmpresa, i.idUsuario).subscribe({
      next: () => this.recargarIntegrantes(idEmpresa),
      error: (err: ErrorHttp) => this.fallo(idEmpresa, err, 'No se pudo asignar el líder.'),
    });
  }

  quitarIntegrante(idEmpresa: number, i: Integrante): void {
    this.ocupar(idEmpresa);
    this.integranteService.eliminar(idEmpresa, i.idUsuario).subscribe({
      next: () => this.recargarIntegrantes(idEmpresa),
      error: (err: ErrorHttp) => this.fallo(idEmpresa, err, 'No se pudo quitar el integrante.'),
    });
  }

  nombreDepartamento(d: DepartamentoIntegrante): string {
    return DEPARTAMENTOS.find((x) => x.valor === d)?.etiqueta ?? d;
  }

  // ---------------------------------------------------------------------------
  // Internos
  // ---------------------------------------------------------------------------

  private cargarSimulaciones(): void {
    this.errorSimulaciones.set(null);
    this.simulacionService.listar().subscribe({
      next: (lista) => this.simulaciones.set(lista),
      error: (err: ErrorHttp) =>
        this.errorSimulaciones.set(mensaje(err, 'No se pudieron cargar las simulaciones.')),
    });
  }

  private simulacionCreada(sim: Simulacion): void {
    this.guardandoSimulacion.set(false);
    this.creandoSimulacion.set(false);
    this.simulaciones.update((lista) => [...lista.filter((s) => s.id !== sim.id), sim]);
    this.elegirSimulacion(String(sim.id));
  }

  private cargarEmpresas(idSimulacion: number | null): void {
    this.empresas.set([]);
    this.integrantes.set({});
    this.erroresEmpresa.set({});
    this.formsIntegrante.set({});
    this.cancelarEmpresa();
    this.error.set(null);
    if (idSimulacion === null) {
      this.cargando.set(false);
      return;
    }
    this.cargando.set(true);
    this.empresaService.listarPorSimulacion(idSimulacion).subscribe({
      next: (empresas) => {
        const integrantes$ = empresas.length
          ? forkJoin(empresas.map((e) => this.integranteService.listar(e.id)))
          : of([] as Integrante[][]);
        integrantes$.subscribe({
          next: (listas) => {
            // Si mientras tanto se eligió otra simulación, esta respuesta ya no aplica.
            if (this.idSimulacion() !== idSimulacion) {
              return;
            }
            this.empresas.set(empresas);
            this.integrantes.set(Object.fromEntries(empresas.map((e, i) => [e.id, listas[i]])));
            this.cargando.set(false);
          },
          error: (err: ErrorHttp) => this.falloCarga(idSimulacion, err),
        });
      },
      error: (err: ErrorHttp) => this.falloCarga(idSimulacion, err),
    });
  }

  private falloCarga(idSimulacion: number, err: ErrorHttp): void {
    if (this.idSimulacion() === idSimulacion) {
      this.cargando.set(false);
      this.error.set(mensaje(err, 'No se pudieron cargar las empresas.'));
    }
  }

  private recargarIntegrantes(idEmpresa: number): void {
    this.integranteService.listar(idEmpresa).subscribe({
      next: (lista) => {
        this.integrantes.update((m) => ({ ...m, [idEmpresa]: lista }));
        this.ocupado.set(false);
      },
      error: (err: ErrorHttp) => this.fallo(idEmpresa, err, 'No se pudieron recargar los integrantes.'),
    });
  }

  private ocupar(idEmpresa: number): void {
    this.ocupado.set(true);
    this.marcarError(idEmpresa, null);
  }

  private fallo(idEmpresa: number, err: ErrorHttp, porDefecto: string): void {
    this.ocupado.set(false);
    this.marcarError(idEmpresa, mensaje(err, porDefecto));
  }

  private marcarError(idEmpresa: number, msg: string | null): void {
    this.erroresEmpresa.update((m) => {
      const { [idEmpresa]: _, ...resto } = m;
      return msg ? { ...resto, [idEmpresa]: msg } : resto;
    });
  }
}
