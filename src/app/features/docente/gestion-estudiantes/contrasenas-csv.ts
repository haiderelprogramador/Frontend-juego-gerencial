import { EstudianteCargado } from './models/estudiante.model';

/**
 * Separador `;`: Excel en español (Colombia) usa `;` como separador de listas
 * y abre un CSV con comas todo en una sola columna (probado con Excel local).
 */
const SEPARADOR = ';';

/** Estudiantes que llegaron con contraseña generada (vacía o null = el backend la mandó por correo). */
export function conContrasena(estudiantes: readonly EstudianteCargado[]): EstudianteCargado[] {
  return estudiantes.filter((e) => !!e.contrasenaGenerada);
}

/** Un campo CSV: entre comillas si trae el separador, comillas o salto de línea. */
function campo(valor: string): string {
  return /[";\r\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

/**
 * CSV con nombre, correo, identificación y contraseña de los estudiantes
 * recién creados. Lleva BOM UTF-8 para que Excel muestre bien las tildes, y
 * `\r\n` entre filas.
 */
export function csvContrasenas(estudiantes: readonly EstudianteCargado[]): string {
  const filas = [
    ['nombre', 'correo', 'identificacion', 'contrasena'],
    ...estudiantes.map((e) => [e.nombre, e.correo, e.numeroIdentificacion, e.contrasenaGenerada]),
  ];
  return '﻿' + filas.map((f) => f.map(campo).join(SEPARADOR)).join('\r\n') + '\r\n';
}
