import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RETRASO_LIBERAR_URL_MS, descargarArchivo, nombreDesdeContentDisposition } from './descarga';

describe('descargarArchivo', () => {
  // jsdom no implementa URL.createObjectURL / revokeObjectURL.
  const originales = { crear: URL.createObjectURL, liberar: URL.revokeObjectURL };
  let crear: ReturnType<typeof vi.fn>;
  let liberar: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    crear = vi.fn(() => 'blob:fake-url');
    liberar = vi.fn();
    URL.createObjectURL = crear as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = liberar as unknown as typeof URL.revokeObjectURL;
  });

  afterEach(() => {
    URL.createObjectURL = originales.crear;
    URL.revokeObjectURL = originales.liberar;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('hace clic en un enlace temporal con el nombre del archivo, lo quita y libera la URL un segundo después', () => {
    vi.useFakeTimers();
    const clics: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clics.push(this);
    });
    const blob = new Blob(['x']);

    descargarArchivo(blob, 'estratego-simulacion-7.xlsx');

    expect(crear).toHaveBeenCalledWith(blob);
    expect(clics).toHaveLength(1);
    expect(clics[0].download).toBe('estratego-simulacion-7.xlsx');
    expect(clics[0].getAttribute('href')).toBe('blob:fake-url');
    expect(document.body.contains(clics[0])).toBe(false);
    // Liberarla en el mismo momento hace que Firefox y Safari a veces cancelen la descarga.
    expect(liberar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(RETRASO_LIBERAR_URL_MS - 1);
    expect(liberar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(liberar).toHaveBeenCalledWith('blob:fake-url');
  });

  it('si el clic falla, libera la URL de inmediato (y una sola vez)', () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(() => descargarArchivo(new Blob(['x']), 'a.xlsx')).toThrow('bloqueado');
    expect(liberar).toHaveBeenCalledWith('blob:fake-url');
    expect(document.querySelector('a[download]')).toBeNull();
    vi.advanceTimersByTime(RETRASO_LIBERAR_URL_MS);
    expect(liberar).toHaveBeenCalledTimes(1);
  });
});

describe('nombreDesdeContentDisposition', () => {
  it.each([
    ['attachment; filename="estratego-simulacion-12.xlsx"', 'estratego-simulacion-12.xlsx'],
    ['attachment; filename=estratego-simulacion-12.xlsx', 'estratego-simulacion-12.xlsx'],
    [`attachment; filename="x.xlsx"; filename*=UTF-8''Simulaci%C3%B3n%2012.xlsx`, 'Simulación 12.xlsx'],
  ])('%s -> %s', (header, nombre) => {
    expect(nombreDesdeContentDisposition(header)).toBe(nombre);
  });

  it('sin header o sin nombre devuelve null', () => {
    expect(nombreDesdeContentDisposition(null)).toBeNull();
    expect(nombreDesdeContentDisposition('attachment')).toBeNull();
  });
});
