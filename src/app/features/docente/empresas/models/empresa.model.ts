/** Contrato real de "Empresas" (API Estratego, 56 endpoints), base `/docente`. */

export type TipoJugadorEmpresa = 'MULTIUSUARIO' | 'MONOUSUARIO';
export type EstadoEmpresa = 'ACTIVA' | 'INACTIVA' | 'CERRADA';

/** Cuerpo de POST/PUT de una empresa. `tipoJugador` por defecto MULTIUSUARIO. */
export interface EmpresaRequest {
  nombre: string;
  estrategia?: string;
  tipoJugador?: TipoJugadorEmpresa;
}

/** Empresa tal como la devuelve el backend. `codigoEmpresa` (EMP-001...) lo
 * genera el backend — nunca se envía. */
export interface Empresa {
  id: number;
  idSimulacion: number;
  codigoEmpresa: string;
  nombre: string;
  estrategia: string;
  tipoJugador: TipoJugadorEmpresa;
  estado: EstadoEmpresa;
}
