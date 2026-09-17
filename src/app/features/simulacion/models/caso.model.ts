/**
 * Modelo de "Caso" compartido entre el Panel del Docente (features/docente/casos)
 * y "Caso actual" del Estudiante (features/estudiante/caso-actual).
 *
 * ✅ Confirmado (docs/08 §7): no hay documento de "caso de negocio" externo — el
 * docente lo configura directamente en el sistema. Este modelo agrupa lo que ya
 * se le pedía al formulario de creación: Info General, Información Financiera
 * y el catálogo de Opciones de ese caso puntual.
 */

/** Una opción del catálogo de decisiones de un caso (campo "Opción", no "descripción"). */
export interface OpcionCaso {
  id: string;
  opcion: string;
  /** Efecto de elegir esta opción; se le revela al estudiante como retroalimentación. */
  resultado: string;
}

export interface InfoFinancieraCaso {
  activoTotal: string;
  pasivoTotal: string;
  patrimonio: string;
  utilidadNeta: string;
}

export interface Caso {
  id: string;
  /** Nombre de la empresa del caso (docs/08 §5: viene predefinido, no lo elige el equipo). */
  nombre: string;
  tipo: string;
  estado: 'activo' | 'borrador';
  mision: string;
  vision: string;
  /** Rango (no un valor fijo, docs/02 §6) de penalización por no decidir, en %. */
  penalizacionMin: number;
  penalizacionMax: number;
  fechaVisualizacion: string;
  fechaInicioPartida: string;
  fechaFinPartida: string;
  /** Asignación de equipos PARA ESTE CASO puntual — no confundir con "Formar equipos". */
  asignacionEquipos: 'manual' | 'automatica';
  financiero: InfoFinancieraCaso;
  opciones: OpcionCaso[];
}

/** Datos editables de un caso (todo menos el id) — lo que produce el formulario. */
export type CasoFormulario = Omit<Caso, 'id'>;
