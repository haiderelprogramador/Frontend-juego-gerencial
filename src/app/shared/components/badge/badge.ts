import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type BadgeVariante =
  | 'estudiante'
  | 'docente'
  | 'periodo-abierto'
  | 'simulacion-activa'
  | 'pendiente'
  | 'cerrado'
  | 'trimestre'
  | 'muted'
  | 'neutro'
  | 'exito'
  | 'peligro';

/**
 * Etiqueta/pill del design system (docs/05, 🎨).
 * Variantes: Estudiante, Docente, Periodo abierto, Simulación activa,
 * Pendiente, Cerrado, Trimestre N, y Muted (gris) para estados neutrales
 * tipo "Configuración pendiente" / "Sin simulación activa".
 */
@Component({
  selector: 'app-badge',
  templateUrl: './badge.html',
  styleUrl: './badge.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Badge {
  readonly variante = input<BadgeVariante>('neutro');
  /** Muestra un punto a la izquierda (estado "vivo"). */
  readonly punto = input<boolean>(false);

  protected readonly clase = computed(() => `badge badge--${this.variante()}`);
}
