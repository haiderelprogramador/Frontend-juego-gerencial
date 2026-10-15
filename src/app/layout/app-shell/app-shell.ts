import { ChangeDetectionStrategy, Component, computed, inject, isDevMode } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { Rol } from '../../core/models/rol.enum';
import { Badge } from '../../shared/components/badge/badge';

interface ItemNav {
  ruta: string;
  texto: string;
  icono: string;
}
interface GrupoNav {
  titulo: string;
  items: ItemNav[];
}

/**
 * Layout con sidebar oscuro para las pantallas con sesión (docs/05, 🎨).
 * La navegación cambia según el rol; Clasificación y Design system las ven
 * ambos roles.
 */
@Component({
  selector: 'app-app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Badge],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly usuario = this.auth.usuarioActual;
  readonly esDocente = computed(() => this.usuario()?.rol === Rol.DOCENTE);

  /**
   * La guía visual (/design-system) es una referencia interna del equipo: se
   * lista en la navegación solo en desarrollo. La ruta sigue existiendo.
   */
  private readonly grupoSistema: GrupoNav[] = isDevMode()
    ? [{ titulo: 'Sistema', items: [{ ruta: '/design-system', texto: 'Design system', icono: 'sliders' }] }]
    : [];

  readonly grupos = computed<GrupoNav[]>(() => {
    if (this.esDocente()) {
      return [
        {
          titulo: 'Administración',
          items: [
            { ruta: '/docente/panel', texto: 'Panel del docente', icono: 'grid' },
            { ruta: '/docente/estudiantes', texto: 'Estudiantes', icono: 'users' },
            { ruta: '/docente/empresas', texto: 'Empresas', icono: 'building' },
            { ruta: '/clasificacion', texto: 'Clasificación', icono: 'trophy' },
          ],
        },
        ...this.grupoSistema,
      ];
    }
    return [
      {
        titulo: 'Mi simulación',
        items: [
          { ruta: '/estudiante/caso-actual', texto: 'Caso actual', icono: 'file' },
          { ruta: '/estudiante/reportes-financieros', texto: 'Reportes financieros', icono: 'chart' },
          { ruta: '/clasificacion', texto: 'Clasificación', icono: 'trophy' },
        ],
      },
      ...this.grupoSistema,
    ];
  });

  salir(): void {
    this.auth.logout();
    void this.router.navigate(['/auth/login']);
  }
}
