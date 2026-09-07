import { formatearConsecutivo, generarContrasena } from './generar-contrasena';

describe('generarContrasena', () => {
  it('formatea el consecutivo con 3 dígitos', () => {
    expect(formatearConsecutivo(1)).toBe('001');
    expect(formatearConsecutivo(42)).toBe('042');
    expect(formatearConsecutivo(500)).toBe('500');
  });

  it('sigue el patrón USU-<consecutivo>-<identificacion>', () => {
    expect(generarContrasena(1, '1094567890')).toBe('USU-001-1094567890');
  });

  it('quita espacios del número de identificación', () => {
    expect(generarContrasena(7, '10 945 678')).toBe('USU-007-10945678');
  });
});
