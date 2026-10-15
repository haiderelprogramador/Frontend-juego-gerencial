import { describe, expect, it } from 'vitest';

import { marcasEje } from './evolucion-empresa';

describe('marcasEje', () => {
  it('siempre incluye el 0 y cubre el rango con pasos "lindos"', () => {
    expect(marcasEje(150000, 900000)).toEqual([0, 250000, 500000, 750000, 1000000]);
  });

  it('con valores negativos (pérdidas) baja de 0', () => {
    const m = marcasEje(-40000, 900000);
    expect(m[0]).toBeLessThanOrEqual(-40000);
    expect(m).toContain(0);
    expect(m[m.length - 1]).toBeGreaterThanOrEqual(900000);
  });

  it('con todo en 0 no divide por 0', () => {
    expect(marcasEje(0, 0)).toEqual([0, 1]);
  });
});
