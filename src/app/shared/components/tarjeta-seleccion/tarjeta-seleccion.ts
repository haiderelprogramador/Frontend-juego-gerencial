import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export interface OpcionSeleccion {
  valor: string;
  titulo: string;
  descripcion?: string;
}

/**
 * Grupo de tarjetas de selección segmentada (radio con título + descripción),
 * tipo "Opción A / B / C" del design system (docs/05, 🎨).
 * Uso: <app-tarjeta-seleccion [opciones]="ops" [(valor)]="elegido" color="produccion" />
 */
@Component({
  selector: 'app-tarjeta-seleccion',
  templateUrl: './tarjeta-seleccion.html',
  styleUrl: './tarjeta-seleccion.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TarjetaSeleccion {
  readonly opciones = input.required<OpcionSeleccion[]>();
  readonly valor = model<string>('');
  readonly color = input<'primary' | 'comercial' | 'produccion' | 'administrativa'>('primary');
  /** Nombre del grupo de radios; por defecto uno aleatorio estable. */
  readonly nombre = input<string>(`sel-${Math.random().toString(36).slice(2, 8)}`);

  protected elegir(valor: string): void {
    this.valor.set(valor);
  }
}
