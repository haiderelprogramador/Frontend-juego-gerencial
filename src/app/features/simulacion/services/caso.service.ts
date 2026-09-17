import { Injectable, computed, signal } from '@angular/core';

import { Caso, CasoFormulario } from '../models/caso.model';

/**
 * Casos de la simulación, en memoria y compartidos por toda la app
 * (`providedIn: 'root'` — regla 6, docs/06): tanto el Panel del Docente
 * (features/docente/casos) como "Caso actual" del Estudiante
 * (features/estudiante/caso-actual) leen de aquí, para que lo que el docente
 * configura se refleje del lado del estudiante sin datos sueltos por pantalla.
 *
 * Capa mock: el estado vive en un signal, se pierde al recargar. Cuando exista
 * el backend, este servicio pasa a llamar `HttpClient` igual que
 * `AuthService`/`EstudianteService`, sin cambiar cómo lo consumen los
 * componentes.
 */
@Injectable({ providedIn: 'root' })
export class CasoService {
  private readonly _casos = signal<Caso[]>([
    {
      id: 'caso-1',
      nombre: 'TextilAndes S.A.',
      tipo: 'Manufactura',
      estado: 'activo',
      mision: 'Producir textiles de alta calidad con procesos sostenibles para el mercado regional.',
      vision: 'Ser el referente andino en textiles sostenibles para 2030.',
      penalizacionMin: 1,
      penalizacionMax: 3,
      fechaVisualizacion: '',
      fechaInicioPartida: '',
      fechaFinPartida: '',
      asignacionEquipos: 'automatica',
      financiero: {
        activoTotal: '$1.850.000',
        pasivoTotal: '$720.000',
        patrimonio: '$1.130.000',
        utilidadNeta: '$142.000',
      },
      opciones: [
        {
          id: 'op-1',
          opcion: 'Ampliar la planta de producción en un 20% con crédito bancario a 3 años.',
          resultado: 'Activo total +$180.000 · Utilidad neta -$12.000 (gasto financiero)',
        },
        {
          id: 'op-2',
          opcion: 'Mantener la capacidad actual e invertir en eficiencia de procesos.',
          resultado: 'Utilidad neta +$25.000 · Margen bruto +1.2 pp',
        },
        {
          id: 'op-3',
          opcion: 'No hacer nada este período.',
          resultado: 'Utilidad neta -$8.000 (efecto por defecto del catálogo)',
        },
      ],
    },
    {
      id: 'caso-2',
      nombre: 'Crisis de proveedores',
      tipo: 'Retail',
      estado: 'borrador',
      mision: '',
      vision: '',
      penalizacionMin: 1,
      penalizacionMax: 3,
      fechaVisualizacion: '',
      fechaInicioPartida: '',
      fechaFinPartida: '',
      asignacionEquipos: 'automatica',
      financiero: { activoTotal: '', pasivoTotal: '', patrimonio: '', utilidadNeta: '' },
      opciones: [],
    },
  ]);

  readonly casos = this._casos.asReadonly();

  /** 🎨 mock: el caso que ve el estudiante es el que está marcado "activo". */
  readonly casoActivo = computed(() => this._casos().find((c) => c.estado === 'activo') ?? null);

  /** Contador para que dos casos creados en el mismo milisegundo no choquen de id. */
  private contador = 0;

  obtener(id: string): Caso | undefined {
    return this._casos().find((c) => c.id === id);
  }

  crear(datos: CasoFormulario): Caso {
    const nuevo: Caso = { ...datos, id: `caso-${Date.now()}-${this.contador++}` };
    this._casos.update((cs) => [...cs, nuevo]);
    return nuevo;
  }

  actualizar(id: string, datos: CasoFormulario): void {
    this._casos.update((cs) => cs.map((c) => (c.id === id ? { ...datos, id } : c)));
  }

  /** Marca un caso como el activo (el único que ve el estudiante) y desactiva los demás. */
  activar(id: string): void {
    this._casos.update((cs) =>
      cs.map((c) => ({ ...c, estado: c.id === id ? 'activo' : ('borrador' as const) })),
    );
  }
}
