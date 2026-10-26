import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { aFechaBogota, formatearFechaBogota, hoyEnBogota } from './fecha-bogota';

/** Las pruebas corren en Node: cambiar `TZ` en caliente cambia la zona horaria de Date e Intl. Sin @types/node. */
const entorno = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;

const HORA: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };

describe('formatearFechaBogota', () => {
  it('formatea un LocalDateTime del backend (sin zona) como hora de Bogotá, con los 7 decimales que manda', () => {
    expect(formatearFechaBogota('2026-10-26T16:17:18.7279025', HORA)).toBe(formatearFechaBogota('2026-10-26T16:17:18-05:00', HORA));
    expect(formatearFechaBogota('2026-10-26T16:17:18.7279025', HORA)).toContain('16:17');
    expect(formatearFechaBogota('2026-10-26T16:17:18.7279025', HORA)).toContain('26');
  });

  it('si el texto trae su zona la respeta (Z = 5 horas más que Bogotá)', () => {
    expect(formatearFechaBogota('2026-10-26T21:17:18Z', HORA)).toContain('16:17');
  });

  it('null si no es una fecha', () => {
    expect(formatearFechaBogota('', HORA)).toBeNull();
    expect(formatearFechaBogota(null, HORA)).toBeNull();
    expect(formatearFechaBogota('no-es-fecha', HORA)).toBeNull();
  });

  describe('con el navegador en otra zona horaria', () => {
    let tzOriginal: string | undefined;
    beforeEach(() => (tzOriginal = entorno['TZ']));
    afterEach(() => {
      if (tzOriginal === undefined) {
        delete entorno['TZ'];
      } else {
        entorno['TZ'] = tzOriginal;
      }
    });

    it('en Tokio muestra la misma hora y el mismo día de Bogotá', () => {
      entorno['TZ'] = 'Asia/Tokyo';
      // El navegador de verdad está en Tokio: leer el texto como hora local da otro instante.
      expect(new Date('2026-10-26T23:30:00').getTime()).not.toBe(aFechaBogota('2026-10-26T23:30:00'));

      const texto = formatearFechaBogota('2026-10-26T23:30:00', HORA)!;
      expect(texto).toContain('23:30');
      expect(texto).toContain('26');
    });

    it('en Nueva York, una hora que allá no existe por el cambio de horario no se corre', () => {
      entorno['TZ'] = 'America/New_York';
      // 8-mar-2026 02:30 no existe en Nueva York (de 02:00 salta a 03:00): new Date(texto) la corre una hora.
      const ingenuo = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
        new Date('2026-03-08T02:30:00'),
      );
      expect(ingenuo).toBe('03:30');

      expect(formatearFechaBogota('2026-03-08T02:30:00', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })).toBe('02:30');
    });
  });
});

describe('hoyEnBogota', () => {
  it('a las 22:30 de Bogotá sigue siendo ese día, aunque en UTC ya sea el siguiente', () => {
    expect(hoyEnBogota(Date.parse('2026-10-21T22:30:00-05:00'))).toBe('2026-10-21');
  });
});
