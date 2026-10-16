import { describe, expect, it } from 'vitest';

import { conContrasena, csvContrasenas } from './contrasenas-csv';
import { EstudianteCargado } from './models/estudiante.model';

function est(id: string, nombre: string, contrasenaGenerada: string): EstudianteCargado {
  return {
    id,
    nombre,
    correo: `${id}@uni.test`,
    numeroIdentificacion: `10${id}`,
    edad: '',
    genero: '',
    contrasenaGenerada,
    cargadoEn: '',
  };
}

describe('contrasenas-csv', () => {
  it('conContrasena deja solo los que trajeron contraseña (vacía = se mandó por correo)', () => {
    expect(conContrasena([est('1', 'Ana', 'Usu-1'), est('2', 'Luis', '')]).map((e) => e.id)).toEqual(['1']);
  });

  it('arma el CSV con BOM, separador ";" (Excel en español), encabezado y \\r\\n', () => {
    const csv = csvContrasenas([est('1', 'Ana Pérez', 'Usu-001-101!'), est('2', 'Luis', 'Usu-002-102!')]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.slice(1).split('\r\n')).toEqual([
      'nombre;correo;identificacion;contrasena',
      'Ana Pérez;1@uni.test;101;Usu-001-101!',
      'Luis;2@uni.test;102;Usu-002-102!',
      '',
    ]);
  });

  it('pone entre comillas los campos con ";", comillas o saltos de línea', () => {
    const csv = csvContrasenas([est('1', 'Gómez; Luis', 'a"b')]);
    expect(csv.slice(1).split('\r\n')[1]).toBe('"Gómez; Luis";1@uni.test;101;"a""b"');
  });
});
