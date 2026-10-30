import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { LiquidGlassDirective } from '../../shared/directives/liquid-glass.directive';

/**
 * Layout de autenticación Liquid Glass (estructura split-card con orbes translúcidos).
 * Conserva la navegación entre Iniciar sesión y Registro docente con soporte completo
 * de accesibilidad y reactividad.
 */
@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LiquidGlassDirective],
  templateUrl: './auth-layout.html',
  styleUrl: './auth-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthLayout {
  /** Tres áreas de decisión del simulador */
  readonly areas = [
    { clave: 'comercial', etiqueta: 'Comercial' },
    { clave: 'produccion', etiqueta: 'Producción' },
    { clave: 'administrativa', etiqueta: 'Administrativa' },
  ];
}
