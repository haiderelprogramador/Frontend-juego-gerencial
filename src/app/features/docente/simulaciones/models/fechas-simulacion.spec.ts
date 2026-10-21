import { describe, expect, it } from 'vitest';

import { hoyEnBogota } from '../../../../shared/utils/fecha-bogota';
import { aInputDia, validarFechasSimulacion } from './fechas-simulacion';

describe('hoyEnBogota', () => {
  it('a las 22:30 de Bogotá sigue siendo ese día, aunque en UTC ya sea el siguiente', () => {
    expect(hoyEnBogota(Date.parse('2026-10-21T22:30:00-05:00'))).toBe('2026-10-21');
    expect(hoyEnBogota(Date.parse('2026-10-21T23:59:59-05:00'))).toBe('2026-10-21');
  });

  it('a medianoche de Bogotá ya es el día siguiente', () => {
    expect(hoyEnBogota(Date.parse('2026-10-22T00:00:00-05:00'))).toBe('2026-10-22');
  });
});

describe('validarFechasSimulacion', () => {
  const HOY = '2026-10-21';

  it('hoy vale como inicio, y el fin puede ser igual al inicio o no venir', () => {
    expect(validarFechasSimulacion('X', HOY, HOY, HOY)).toBeNull();
    expect(validarFechasSimulacion('X', HOY, '', HOY)).toBeNull();
    expect(validarFechasSimulacion('X', '2026-10-22', '2026-11-30', HOY)).toBeNull();
  });

  it('un inicio pasado no vale', () => {
    expect(validarFechasSimulacion('X', '2026-10-20', '', HOY)).toBe('La fecha de inicio no puede ser pasada.');
  });

  it('un fin anterior al inicio no vale', () => {
    expect(validarFechasSimulacion('X', '2026-10-25', '2026-10-24', HOY)).toBe(
      'La fecha de fin no puede ser anterior a la de inicio.',
    );
  });

  it('pide nombre e inicio', () => {
    expect(validarFechasSimulacion('', HOY, '', HOY)).toBe('Poné un nombre y la fecha de inicio.');
    expect(validarFechasSimulacion('X', '', '', HOY)).toBe('Poné un nombre y la fecha de inicio.');
  });

  it('rechaza fechas que no son "YYYY-MM-DD" (por ejemplo, con hora)', () => {
    expect(validarFechasSimulacion('X', '2026-10-21T22:30', '', HOY)).toBe('Revisá las fechas: no son válidas.');
    expect(validarFechasSimulacion('X', HOY, '21/10/2026', HOY)).toBe('Revisá las fechas: no son válidas.');
  });

  it('sin `hoy` explícito usa el día de Bogotá', () => {
    expect(validarFechasSimulacion('X', '2000-01-01', '')).toBe('La fecha de inicio no puede ser pasada.');
    expect(validarFechasSimulacion('X', '2999-01-01', '')).toBeNull();
  });
});

describe('aInputDia', () => {
  it('toma el día de la fecha del backend, o "" si no trae una', () => {
    expect(aInputDia('2026-11-20')).toBe('2026-11-20');
    expect(aInputDia('')).toBe('');
    expect(aInputDia('no-es-fecha')).toBe('');
  });
});
