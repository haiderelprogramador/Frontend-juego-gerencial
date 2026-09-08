import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/**
 * Layout de autenticación a dos columnas (docs/05, 🎨):
 * panel izquierdo oscuro con copy de marketing + stats, panel derecho claro
 * con las tabs "Iniciar sesión" / "Registrarse" y la ruta hija.
 */
@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './auth-layout.html',
  styleUrl: './auth-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthLayout {
  /** 🎨 mock — stats de la columna izquierda del prototipo. */
  readonly stats = [
    { valor: '3', etiqueta: 'áreas de decisión' },
    { valor: '48', etiqueta: 'equipos activos' },
    { valor: '12', etiqueta: 'trimestres' },
  ];
}
