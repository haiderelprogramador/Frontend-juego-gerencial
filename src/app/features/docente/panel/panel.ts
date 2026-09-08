import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Badge } from '../../../shared/components/badge/badge';
import { Toggle } from '../../../shared/components/toggle/toggle';

type TabPanel = 'periodos' | 'equipos' | 'casos' | 'parametros';

interface EntregaEquipo {
  equipo: string;
  enviado: boolean;
}

/**
 * Panel del docente (docs/05, 🎨) con tabs internos. La vista "Control de
 * periodos" es la única detallada en el prototipo; el resto son placeholders.
 * Datos mock. Ojo (docs/05): "quién cierra el período" es pregunta abierta —
 * aquí el botón existe solo como UI.
 */
@Component({
  selector: 'app-panel',
  imports: [RouterLink, Badge, Toggle],
  templateUrl: './panel.html',
  styleUrl: './panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Panel {
  readonly tab = signal<TabPanel>('periodos');
  readonly recibiendo = signal(true);

  readonly entregas = signal<EntregaEquipo[]>([
    { equipo: 'Andina Corp.', enviado: true },
    { equipo: 'NovaTech S.A.', enviado: true },
    { equipo: 'Grupo Meridian', enviado: true },
    { equipo: 'Equipo Cóndor', enviado: false },
    { equipo: 'Vértice Ltda.', enviado: false },
  ]);

  irA(tab: TabPanel): void {
    this.tab.set(tab);
  }
}
