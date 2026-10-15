import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';

import { Alerta } from '../../../../shared/components/alerta/alerta';
import {
  Boletin,
  BoletinRequest,
  CampoBoletin,
  NOTA_BOLETIN_MAX,
  RANGO_INFLACION,
  RANGO_TASA_INTERES,
} from '../../../simulacion/models/boletin.model';
import { CasoApiService } from '../services/caso-api.service';

/** Un 400 del backend trae, además de `message`, el detalle por campo en `errores[]`. */
type ErrorHttp = {
  message?: string;
  error?: { message?: string; errores?: { campo?: string; mensaje?: string }[] };
};

type ErroresCampo = Partial<Record<CampoBoletin, string>>;

const CAMPOS_BOLETIN: readonly CampoBoletin[] = ['inflacion', 'tasaInteres', 'tasaCambio', 'nota'];

function mensaje(err: ErrorHttp, porDefecto: string): string {
  return err?.error?.message ?? err?.message ?? porDefecto;
}

/**
 * Los `errores[]` de un 400 que corresponden a un campo del formulario. Se
 * toma el último segmento de `campo` por si llega con prefijo ("boletin.nota").
 */
function erroresDelBackend(err: ErrorHttp): ErroresCampo {
  const errores: ErroresCampo = {};
  for (const e of err?.error?.errores ?? []) {
    const campo = e.campo?.split('.').pop() as CampoBoletin | undefined;
    if (campo && CAMPOS_BOLETIN.includes(campo) && e.mensaje) {
      errores[campo] = e.mensaje;
    }
  }
  return errores;
}

/** Acepta "5,2" y "5.2": el docente puede escribir con coma decimal. */
function aNumero(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.');
  if (limpio === '') {
    return null;
  }
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

function errorRango(valor: number | null, rango: { min: number; max: number }): string | null {
  if (valor == null) {
    return 'Escribe un número.';
  }
  if (valor < rango.min || valor > rango.max) {
    return `Tiene que estar entre ${rango.min} y ${rango.max}.`;
  }
  return null;
}

const formatoFecha = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Boletín de un caso (D14): el docente publica los factores de entorno
 * (inflación, tasa de interés, tasa de cambio y una nota opcional) que las
 * empresas ven en su portal. Un caso tiene a lo sumo un boletín: publicar de
 * nuevo lo reemplaza (PUT).
 *
 * Con la simulación FINALIZADA el backend no deja editarlo (400), así que se
 * abre de solo lectura (`soloLectura`).
 */
@Component({
  selector: 'app-boletin-caso',
  imports: [Alerta],
  templateUrl: './boletin-caso.html',
  styleUrl: './boletin-caso.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoletinCaso {
  private readonly casoApi = inject(CasoApiService);

  readonly idCaso = input.required<number>();
  readonly nombreCaso = input('');
  /** true con la simulación FINALIZADA: se ve el boletín, pero no se publica ni se elimina. */
  readonly soloLectura = input(false);
  readonly volver = output<void>();

  readonly notaMax = NOTA_BOLETIN_MAX;
  readonly rangoInflacion = RANGO_INFLACION;
  readonly rangoTasaInteres = RANGO_TASA_INTERES;

  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  /** Error de cada campo: de la validación local o de `errores[].campo` de un 400. */
  readonly erroresCampo = signal<ErroresCampo>({});
  /** El boletín publicado; `null` si el caso todavía no tiene. */
  readonly boletin = signal<Boletin | null>(null);

  readonly inflacion = signal('');
  readonly tasaInteres = signal('');
  readonly tasaCambio = signal('');
  readonly nota = signal('');

  readonly caracteresNota = computed(() => this.nota().length);

  constructor() {
    effect(() => {
      const id = this.idCaso();
      untracked(() => this.cargar(id));
    });
  }

  /** Al corregir un campo, su error deja de aplicar. */
  editar(campo: CampoBoletin, valor: string): void {
    this[campo].set(valor);
    if (this.erroresCampo()[campo]) {
      this.erroresCampo.update(({ [campo]: _, ...resto }) => resto);
    }
  }

  publicar(): void {
    if (this.guardando() || this.soloLectura()) {
      return;
    }
    const inflacion = aNumero(this.inflacion());
    const tasaInteres = aNumero(this.tasaInteres());
    const tasaCambio = aNumero(this.tasaCambio());
    const nota = this.nota().trim();

    const errores: ErroresCampo = {};
    const eInflacion = errorRango(inflacion, RANGO_INFLACION);
    const eTasaInteres = errorRango(tasaInteres, RANGO_TASA_INTERES);
    if (eInflacion) {
      errores.inflacion = eInflacion;
    }
    if (eTasaInteres) {
      errores.tasaInteres = eTasaInteres;
    }
    if (tasaCambio == null) {
      errores.tasaCambio = 'Escribe un número.';
    } else if (tasaCambio <= 0) {
      errores.tasaCambio = 'Tiene que ser mayor que 0.';
    }
    if (nota.length > NOTA_BOLETIN_MAX) {
      errores.nota = `Máximo ${NOTA_BOLETIN_MAX} caracteres.`;
    }
    this.erroresCampo.set(errores);
    this.aviso.set(null);
    if (Object.keys(errores).length > 0) {
      this.error.set('Revisa los campos marcados.');
      return;
    }

    const req: BoletinRequest = {
      inflacion: inflacion!,
      tasaInteres: tasaInteres!,
      tasaCambio: tasaCambio!,
      ...(nota ? { nota } : {}),
    };
    const eraNuevo = this.boletin() === null;
    this.error.set(null);
    this.guardando.set(true);
    this.casoApi.publicarBoletin(this.idCaso(), req).subscribe({
      next: (b) => {
        this.guardando.set(false);
        this.llenar(b);
        this.aviso.set(eraNuevo ? 'Boletín publicado.' : 'Boletín actualizado.');
      },
      error: (err: ErrorHttp) => {
        this.guardando.set(false);
        this.erroresCampo.set(erroresDelBackend(err));
        this.error.set(mensaje(err, 'No se pudo publicar el boletín.'));
      },
    });
  }

  eliminar(): void {
    if (this.guardando() || this.soloLectura() || !this.boletin()) {
      return;
    }
    if (!window.confirm('¿Eliminar el boletín de este caso? Las empresas dejarán de verlo.')) {
      return;
    }
    this.error.set(null);
    this.aviso.set(null);
    this.guardando.set(true);
    this.casoApi.eliminarBoletin(this.idCaso()).subscribe({
      next: () => {
        this.guardando.set(false);
        this.llenar(null);
        this.aviso.set('Boletín eliminado.');
      },
      error: (err: ErrorHttp) => {
        this.guardando.set(false);
        this.error.set(mensaje(err, 'No se pudo eliminar el boletín.'));
      },
    });
  }

  fecha(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : formatoFecha.format(d);
  }

  private cargar(id: number): void {
    this.cargando.set(true);
    this.error.set(null);
    this.aviso.set(null);
    this.casoApi.obtenerBoletin(id).subscribe({
      next: (b) => {
        this.llenar(b);
        this.cargando.set(false);
      },
      error: (err: ErrorHttp) => {
        this.cargando.set(false);
        this.error.set(mensaje(err, 'No se pudo cargar el boletín.'));
      },
    });
  }

  private llenar(b: Boletin | null): void {
    this.boletin.set(b);
    this.erroresCampo.set({});
    this.inflacion.set(b ? String(b.inflacion) : '');
    this.tasaInteres.set(b ? String(b.tasaInteres) : '');
    this.tasaCambio.set(b ? String(b.tasaCambio) : '');
    this.nota.set(b?.nota ?? '');
  }
}
