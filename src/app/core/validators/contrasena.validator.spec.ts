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

  it('arma un mensaje con lo que falta, no uno genérico', () => {
    expect(mensajeErrorContrasena(validar('claveSegura'))).toBe('Debe tener un número, un símbolo.');
    expect(mensajeErrorContrasena({ required: true })).toBe('Escribe una contraseña.');
    expect(mensajeErrorContrasena(null)).toBeNull();
  });
});
