import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { Badge } from '../../../shared/components/badge/badge';
import { Slider } from '../../../shared/components/slider/slider';
import { Toggle } from '../../../shared/components/toggle/toggle';
import {
  OpcionSeleccion,
  TarjetaSeleccion,
} from '../../../shared/components/tarjeta-seleccion/tarjeta-seleccion';

/**
 * Pantalla "Toma de decisiones" del estudiante (docs/05, 🎨).
 * Solo capa visual: todos los valores son mock locales, sin lógica de negocio
 * ni persistencia. Reglas confirmadas (docs/02/03) se aplicarán al conectar
 * datos reales — p. ej. quién cierra el período sigue siendo pregunta abierta
 * (docs/05).
 */
@Component({
  selector: 'app-toma-decisiones',
  imports: [Badge, Slider, Toggle, TarjetaSeleccion],
  templateUrl: './toma-decisiones.html',
  styleUrl: './toma-decisiones.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TomaDecisiones {
  readonly progreso = signal(62); // 🎨 mock
  readonly cierraEn = signal('2 días 14 h');

  // -- Comercial --
  readonly preciosOpciones: OpcionSeleccion[] = [
    { valor: 'penetracion', titulo: 'Penetración', descripcion: 'Precios bajos para ganar cuota rápido' },
    { valor: 'valor', titulo: 'Valor', descripcion: 'Equilibrio entre margen y volumen' },
    { valor: 'premium', titulo: 'Premium', descripcion: 'Precios altos, foco en margen' },
  ];
  readonly precios = signal('valor');
  readonly publicidad = signal(45000);
  readonly investigacion = signal(30000);

  // -- Producción --
  readonly inventarioOpciones: OpcionSeleccion[] = [
    { valor: 'jit', titulo: 'Justo a tiempo', descripcion: 'Mínimo stock, mayor riesgo de quiebre' },
    { valor: 'balanceado', titulo: 'Balanceado', descripcion: 'Balance óptimo costo/disponibilidad' },
    { valor: 'colchon', titulo: 'Colchón amplio', descripcion: 'Alta disponibilidad, más costo de bodega' },
  ];
  readonly inventario = signal('balanceado');
  readonly capacidad = signal(78);
  readonly calidadReforzada = signal(true);

  // -- Administrativa --
  readonly contrataciones = signal(12);
  readonly capacitacion = signal(true);
  readonly dividendoOpciones: OpcionSeleccion[] = [
    { valor: 'reinvertir', titulo: 'Reinvertir 100%', descripcion: 'Máximo capital para crecer' },
    { valor: 'mixto', titulo: 'Mixto 50/50', descripcion: 'Reparte y reinvierte' },
    { valor: 'repartir', titulo: 'Repartir 100%', descripcion: 'Prioriza retorno a accionistas' },
  ];
  readonly dividendos = signal('reinvertir');
}
