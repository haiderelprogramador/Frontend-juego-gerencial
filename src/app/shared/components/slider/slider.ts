import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

/**
 * Control deslizante con valor numérico visible (docs/05, 🎨).
 * Uso: <app-slider [(valor)]="pct" [min]="0" [max]="100" sufijo="%" etiqueta="Uso de capacidad" />
 */
@Component({
  selector: 'app-slider',
  templateUrl: './slider.html',
  styleUrl: './slider.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Slider {
  readonly valor = model<number>(0);
  readonly min = input<number>(0);
  readonly max = input<number>(100);
  readonly step = input<number>(1);
  readonly etiqueta = input<string>('');
  readonly prefijo = input<string>('');
  readonly sufijo = input<string>('');
  readonly color = input<'primary' | 'comercial' | 'produccion' | 'administrativa'>('primary');

  protected readonly valorTexto = computed(
    () => `${this.prefijo()}${this.valor().toLocaleString('es-CO')}${this.sufijo()}`,
  );
  protected readonly porcentaje = computed(() => {
    const rango = this.max() - this.min();
    return rango <= 0 ? 0 : ((this.valor() - this.min()) / rango) * 100;
  });

  protected onInput(event: Event): void {
    this.valor.set(Number((event.target as HTMLInputElement).value));
  }
}
