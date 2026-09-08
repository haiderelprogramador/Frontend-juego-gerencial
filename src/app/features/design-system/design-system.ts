import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { Badge } from '../../shared/components/badge/badge';
import { Slider } from '../../shared/components/slider/slider';
import { Toggle } from '../../shared/components/toggle/toggle';
import {
  OpcionSeleccion,
  TarjetaSeleccion,
} from '../../shared/components/tarjeta-seleccion/tarjeta-seleccion';

/**
 * Página viva del design system (docs/05, 🎨): tokens de color, tipografía,
 * botones, badges y controles interactivos.
 */
@Component({
  selector: 'app-design-system',
  imports: [Badge, Slider, Toggle, TarjetaSeleccion],
  templateUrl: './design-system.html',
  styleUrl: './design-system.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignSystem {
  readonly colores = [
    { nombre: 'Primary', varName: '--bs-primary' },
    { nombre: 'Foreground', varName: '--bs-foreground' },
    { nombre: 'Muted', varName: '--bs-muted' },
    { nombre: 'Success', varName: '--bs-success' },
    { nombre: 'Warning', varName: '--bs-warning' },
    { nombre: 'Danger', varName: '--bs-danger' },
    { nombre: 'Comercial', varName: '--bs-comercial' },
    { nombre: 'Producción', varName: '--bs-produccion' },
    { nombre: 'Administrativa', varName: '--bs-administrativa' },
  ];

  readonly toggleDemo = signal(true);
  readonly sliderDemo = signal(50);
  readonly seleccionDemo = signal('a');
  readonly opciones: OpcionSeleccion[] = [
    { valor: 'a', titulo: 'Opción A', descripcion: 'Descripción breve' },
    { valor: 'b', titulo: 'Opción B', descripcion: 'Descripción breve' },
    { valor: 'c', titulo: 'Opción C', descripcion: 'Descripción breve' },
  ];
}
