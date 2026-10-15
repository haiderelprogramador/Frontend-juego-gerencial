import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/**
 * Layout de autenticación a dos columnas (docs/05, 🎨):
 * panel izquierdo oscuro con el copy y las tres áreas de decisión, panel
 * derecho claro con las tabs "Iniciar sesión" / "Registrarse" y la ruta hija.
 */
@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './auth-layout.html',
  styleUrl: './auth-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthLayout {
  /** Las tres áreas de decisión del simulador (mismos colores que los tokens --bs-*). */
  readonly areas = [
    { clave: 'comercial', etiqueta: 'Comercial' },
    { clave: 'produccion', etiqueta: 'Producción' },
    { clave: 'administrativa', etiqueta: 'Administrativa' },
  ];
}
