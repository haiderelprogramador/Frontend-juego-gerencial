import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type TipoAlerta = 'info' | 'exito' | 'error';

/**
 * Mensaje de estado reutilizable (info / éxito / error).
 * Pieza puramente visual: no conoce nada del negocio.
 */
@Component({
  selector: 'app-alerta',
  templateUrl: './alerta.html',
  styleUrl: './alerta.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Alerta {
  readonly tipo = input<TipoAlerta>('info');
  readonly mensaje = input.required<string>();
}
