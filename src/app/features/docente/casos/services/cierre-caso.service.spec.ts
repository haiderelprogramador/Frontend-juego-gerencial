import { describe, expect, it } from 'vitest';

import { mensajeCierre } from './cierre-caso.service';

describe('mensajeCierre', () => {
  it('con pendientes dice cuántas empresas recibirán la penalización (plural y singular)', () => {
    expect(mensajeCierre('Activar «B»', 'A', 3)).toBe(
      'Activar «B» cierra «A» ahora mismo. 3 empresas todavía no han decidido y recibirán la penalización.',
    );
    expect(mensajeCierre('Finalizar «Gerencia 2026-2»', 'A', 1)).toBe(
      'Finalizar «Gerencia 2026-2» cierra «A» ahora mismo. 1 empresa todavía no ha decidido y recibirá la penalización.',
    );
  });

  it('sin pendientes es una confirmación simple', () => {
    expect(mensajeCierre('Activar «B»', 'A', 0)).toBe(
      'Activar «B» cierra «A» ahora mismo. Todas las empresas ya decidieron. ¿Continuar?',
    );
  });
});
