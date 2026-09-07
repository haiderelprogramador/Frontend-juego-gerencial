import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';

/**
 * Página de inicio del panel del docente. Punto de entrada a las secciones
 * del docente (por ahora solo la carga masiva de estudiantes).
 */
@Component({
  selector: 'app-panel',
  imports: [RouterLink],
  templateUrl: './panel.html',
  styleUrl: './panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Panel {
  private readonly auth = inject(AuthService);
  readonly usuario = this.auth.usuarioActual;
}
