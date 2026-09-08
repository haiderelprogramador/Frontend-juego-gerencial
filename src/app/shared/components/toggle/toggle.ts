import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

/**
 * Interruptor on/off del design system (docs/05, 🎨).
 * Uso: <app-toggle [(valor)]="activo" etiqueta="Recibiendo decisiones" />
 */
@Component({
  selector: 'app-toggle',
  templateUrl: './toggle.html',
  styleUrl: './toggle.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Toggle {
  readonly valor = model<boolean>(false);
  readonly etiqueta = input<string>('');
  readonly disabled = input<boolean>(false);

  protected alternar(): void {
    if (!this.disabled()) {
      this.valor.set(!this.valor());
    }
  }
}
