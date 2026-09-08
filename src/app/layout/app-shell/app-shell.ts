import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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

  /** 🎨 mock: el prototipo muestra "Trimestre 3 · 2026" fijo en la barra. */
  readonly trimestre = signal('Trimestre 3 · 2026');
  readonly temaOscuro = signal(false);

  readonly grupos = computed<GrupoNav[]>(() => {
    if (this.esDocente()) {
      return [
        {
          titulo: 'Administración',
          items: [
            { ruta: '/docente/panel', texto: 'Panel del docente', icono: 'grid' },
            { ruta: '/docente/estudiantes', texto: 'Carga de estudiantes', icono: 'users' },
            { ruta: '/clasificacion', texto: 'Clasificación', icono: 'trophy' },
          ],
        },
        { titulo: 'Sistema', items: [{ ruta: '/design-system', texto: 'Design system', icono: 'sliders' }] },
      ];
    }
    return [
      {
        titulo: 'Mi simulación',
        items: [
          { ruta: '/estudiante/toma-decisiones', texto: 'Toma de decisiones', icono: 'sliders' },
          { ruta: '/estudiante/reportes-financieros', texto: 'Reportes financieros', icono: 'chart' },
          { ruta: '/clasificacion', texto: 'Clasificación', icono: 'trophy' },
        ],
      },
      { titulo: 'Sistema', items: [{ ruta: '/design-system', texto: 'Design system', icono: 'sliders' }] },
    ];
  });

  alternarTema(): void {
    this.temaOscuro.set(!this.temaOscuro());
  }

  salir(): void {
    this.auth.logout();
    void this.router.navigate(['/auth/login']);
  }
}
