import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

import { Badge } from '../../shared/components/badge/badge';

interface FilaEquipo {
  posicion: number;
  equipo: string;
  integrantes: number;
  tendencia: number; // + sube, - baja, 0 igual
  ingresos: string;
  margen: string;
  puntaje: number;
  esMio?: boolean;
}

/**
 * Clasificación / leaderboard (docs/05, 🎨). Vista compartida por estudiante y
 * docente — vive en su propia feature, no se duplica. Datos mock.
 */
@Component({
  selector: 'app-clasificacion',
  imports: [Badge],
  templateUrl: './clasificacion.html',
  styleUrl: './clasificacion.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Clasificacion {
  readonly vacio = signal(false);

  readonly equipos = signal<FilaEquipo[]>([
    { posicion: 1, equipo: 'Andina Corp.', integrantes: 4, tendencia: 2, ingresos: '$1284k', margen: '22.4%', puntaje: 942 },
    { posicion: 2, equipo: 'NovaTech S.A.', integrantes: 4, tendencia: 1, ingresos: '$1198k', margen: '21.1%', puntaje: 918 },
    { posicion: 3, equipo: 'Grupo Meridian', integrantes: 3, tendencia: -2, ingresos: '$1112k', margen: '19.8%', puntaje: 887 },
    { posicion: 4, equipo: 'Equipo Cóndor', integrantes: 4, tendencia: 0, ingresos: '$1058k', margen: '18.9%', puntaje: 861, esMio: true },
    { posicion: 5, equipo: 'Vértice Ltda.', integrantes: 3, tendencia: 3, ingresos: '$986k', margen: '17.2%', puntaje: 824 },
    { posicion: 6, equipo: 'Delta Industrias', integrantes: 4, tendencia: -1, ingresos: '$922k', margen: '15.6%', puntaje: 798 },
    { posicion: 7, equipo: 'Horizonte S.A.S', integrantes: 3, tendencia: -2, ingresos: '$849k', margen: '13.4%', puntaje: 742 },
  ]);

  readonly podio = computed(() => {
    const [uno, dos, tres] = this.equipos();
    return [dos, uno, tres]; // orden visual: 2 - 1 - 3
  });

  alternarVacio(): void {
    this.vacio.set(!this.vacio());
  }
}
