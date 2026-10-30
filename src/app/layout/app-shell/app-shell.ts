import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthService } from '../../core/services/auth.service';
import { Rol } from '../../core/models/rol.enum';
import { Badge } from '../../shared/components/badge/badge';
import { LiquidGlassDirective } from '../../shared/directives/liquid-glass.directive';

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
 * Layout Liquid Glass con sidebar flotante (inspirado en Apple VisionOS & Flowly).
 * Incorpora indicador elástico deslizante (Sliding Pill Morph) estilo Apple / WhatsApp iOS.
 */
@Component({
  selector: 'app-app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Badge, LiquidGlassDirective],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Contenedor de navegación para calcular la posición de la píldora deslizante */
  readonly navContainer = viewChild<ElementRef<HTMLElement>>('navContainer');
  readonly indicatorTop = signal<number>(0);
  readonly indicatorHeight = signal<number>(40);
  readonly indicatorOpacity = signal<number>(0);
  readonly isMoving = signal<boolean>(false);
  private moveTimer: ReturnType<typeof setTimeout> | null = null;

  /** Estado de colapso de la cápsula flotante del sidebar */
  readonly colapsado = signal(false);

  readonly usuario = this.auth.usuarioActual;
  readonly esDocente = computed(() => this.usuario()?.rol === Rol.DOCENTE);

  readonly primerNombre = computed(() => {
    const completo = this.usuario()?.nombre?.trim();
    if (!completo) return 'Usuario';
    return completo.split(/\s+/)[0];
  });

  constructor() {
    afterNextRender(() => {
      setTimeout(() => this.updateIndicator(undefined, false), 60);
    });

    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        setTimeout(() => this.updateIndicator(undefined, true), 30);
      });

    effect(() => {
      this.colapsado();
      this.updateIndicator(undefined, false);
    });
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateIndicator(undefined, false);
  }

  onLinkClick(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement | null;
    if (target) {
      this.updateIndicator(target, true);
    }
  }

  updateIndicator(targetEl?: HTMLElement, animateLens = true): void {
    const container = this.navContainer()?.nativeElement;
    if (!container) return;

    const el = targetEl ?? (container.querySelector('.sidebar__link.is-active') as HTMLElement | null);
    if (!el) {
      this.indicatorOpacity.set(0);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const top = elRect.top - containerRect.top + container.scrollTop;
    const height = el.offsetHeight || elRect.height;

    // Solo activar la elevación y refracción de lente cuando el usuario cambia de ítem
    if (animateLens && this.indicatorOpacity() > 0 && Math.abs(top - this.indicatorTop()) > 3) {
      this.isMoving.set(true);
      if (this.moveTimer) clearTimeout(this.moveTimer);
      this.moveTimer = setTimeout(() => {
        this.isMoving.set(false);
      }, 480);
    }

    this.indicatorTop.set(top);
    this.indicatorHeight.set(height);
    this.indicatorOpacity.set(1);
  }

  toggleColapso(): void {
    this.colapsado.update((v) => !v);
  }

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
    ];
  });

  salir(): void {
    this.auth.logout();
    void this.router.navigate(['/auth/login']);
  }
}
