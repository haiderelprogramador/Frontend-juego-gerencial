import { FormControl } from '@angular/forms';

import { contrasenaSegura, mensajeErrorContrasena, reglasContrasenaFaltantes } from './contrasena.validator';

describe('contrasenaSegura', () => {
  const validar = (valor: string) => contrasenaSegura()(new FormControl(valor));

  it('acepta una contraseña que cumple las 5 reglas', () => {
    expect(validar('claveSegura1!')).toBeNull();
  });

  it('no da error con el campo vacío (eso es de Validators.required)', () => {
    expect(validar('')).toBeNull();
  });

  it('lista cada regla que falta', () => {
    expect(reglasContrasenaFaltantes('abc')).toEqual([
      'mínimo 8 caracteres',
      'una mayúscula',
      'un número',
      'un símbolo',
    ]);
    expect(reglasContrasenaFaltantes('CLAVESEGURA1!')).toEqual(['una minúscula']);
  });

  it('rechaza más de 72 caracteres', () => {
    expect(reglasContrasenaFaltantes('Aa1!' + 'x'.repeat(69))).toEqual(['máximo 72 caracteres']);
    expect(reglasContrasenaFaltantes('Aa1!' + 'x'.repeat(68))).toEqual([]);
  });

  it('el espacio no cuenta como símbolo', () => {
    expect(reglasContrasenaFaltantes('clave Segura1')).toEqual(['un símbolo']);
  });

  it('"ñ" y vocales con tilde son letras, no símbolos (igual que \\p{L} del backend)', () => {
    expect(reglasContrasenaFaltantes('Contraseña1')).toEqual(['un símbolo']);
    expect(reglasContrasenaFaltantes('Canción123')).toEqual(['un símbolo']);
    expect(reglasContrasenaFaltantes('Contraseña1!')).toEqual([]);
  });

  it('las letras con tilde o "Ñ" no cuentan como mayúscula/minúscula ([A-Z]/[a-z] ASCII)', () => {
    expect(reglasContrasenaFaltantes('ÑANDÚ123!')).toEqual(['una minúscula']);
    expect(reglasContrasenaFaltantes('éáíóú123!')).toEqual(['una mayúscula', 'una minúscula']);
  });

  it('coincide con el regex exacto del backend en casos borde', () => {
    // El regex del backend, con \s acotado al espacio ASCII de Java.
    const backend = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\p{L}\p{N} \t\n\x0B\f\r]).{8,72}$/u;
    const casos = [
      'Contraseña1', 'Contraseña1!', 'Canción123', 'Clave 123a', 'Clave 123a', 'Clave_123a',
      'Clave٣123a', 'Abc1!', 'Aa1!' + 'x'.repeat(68), 'Aa1!' + 'x'.repeat(69), 'ÑANDÚ123!', 'Clave€123a',
    ];
    for (const c of casos) {
      expect(reglasContrasenaFaltantes(c).length === 0, c).toBe(backend.test(c));
    }
  });

  it('arma un mensaje con lo que falta, no uno genérico', () => {
    expect(mensajeErrorContrasena(validar('claveSegura'))).toBe('Debe tener un número, un símbolo.');
    expect(mensajeErrorContrasena({ required: true })).toBe('Escribe una contraseña.');
    expect(mensajeErrorContrasena(null)).toBeNull();
  });
});
