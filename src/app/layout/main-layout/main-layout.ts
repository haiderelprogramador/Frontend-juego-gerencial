import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';

/**
 * Estructura visual para las pantallas CON sesión (panel del docente).
 * Barra superior con la marca, navegación de la sección y botón de salir.
 */
@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayout {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly usuario = this.auth.usuarioActual;

  salir(): void {
    this.auth.logout();
    void this.router.navigate(['/auth/login']);
  }
}
