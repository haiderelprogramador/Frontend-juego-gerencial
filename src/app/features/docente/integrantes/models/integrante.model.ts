/**
 * Contrato real de "Integrantes" (API Estratego, 56 endpoints), base
 * `/docente/empresas/{idEmpresa}/integrantes`.
 */

/** Enum cerrado — confirmado en vivo (29-sep-2026): no es texto libre. */
export type DepartamentoIntegrante = 'GERENCIA_GENERAL' | 'COMERCIAL' | 'OPERACIONES' | 'ADMINISTRATIVA';

/** Etiquetas de los departamentos; las usan Empresas (docente) y "Mi empresa" (estudiante). */
export const DEPARTAMENTOS: readonly { valor: DepartamentoIntegrante; etiqueta: string }[] = [
  { valor: 'GERENCIA_GENERAL', etiqueta: 'Gerencia general' },
  { valor: 'COMERCIAL', etiqueta: 'Comercial' },
  { valor: 'OPERACIONES', etiqueta: 'Operaciones' },
  { valor: 'ADMINISTRATIVA', etiqueta: 'Administrativa' },
];

/** "Gerencia general" para GERENCIA_GENERAL; un valor desconocido se muestra tal cual. */
export function nombreDepartamento(d: string): string {
  return DEPARTAMENTOS.find((x) => x.valor === d)?.etiqueta ?? d;
}

/** Cuerpo de POST para agregar un integrante. `{idUsuario}` es el id del
 * ESTUDIANTE (Usuario), no el id del Integrante. Por defecto GERENCIA_GENERAL. */
export interface AgregarIntegranteRequest {
  idUsuario: number;
  departamento?: DepartamentoIntegrante;
  esLider?: boolean;
}

/** Integrante tal como lo devuelve el backend. */
export interface Integrante {
  id: number;
  idEmpresa: number;
  idUsuario: number;
  nombre: string;
  correo: string;
  numeroIdentificacion: string;
  departamento: DepartamentoIntegrante;
  esLider: boolean;
}
