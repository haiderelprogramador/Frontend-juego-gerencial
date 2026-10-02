import { TestBed } from '@angular/core/testing';

import { FinancieroTexto, financieroVacio } from '../../../simulacion/models/financiero.model';
import { FinancieroCaso } from './financiero-caso';

describe('FinancieroCaso', () => {
  function crear(valores: Partial<FinancieroTexto> = {}) {
    TestBed.configureTestingModule({ imports: [FinancieroCaso] });
    const fixture = TestBed.createComponent(FinancieroCaso);
    fixture.componentRef.setInput('valores', { ...financieroVacio(), ...valores });
    fixture.detectChanges();
    return fixture;
  }

  function texto(fixture: { nativeElement: unknown }): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('vacío: no muestra el aviso de cuadre ni el bloque de totales viejos', () => {
    const fixture = crear();
    expect((fixture.nativeElement as HTMLElement).querySelector('.fin-cuadre')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('.fin-legado')).toBeNull();
  });

  it('muestra en rojo la diferencia mientras el balance no cuadra', () => {
    const fixture = crear({ efectivo: '1000', cuentasPorPagar: '400' });
    const aviso = (fixture.nativeElement as HTMLElement).querySelector('.fin-cuadre')!;
    expect(aviso.classList.contains('fin-cuadre--ok')).toBe(false);
    expect(aviso.textContent).toContain('Diferencia: $600');
    expect(aviso.textContent).toContain('el balance no cuadra');
  });

  it('marca como cuadrado cuando activo = pasivo + patrimonio (con la utilidad neta)', () => {
    const fixture = crear({ efectivo: '1000', cuentasPorPagar: '400', capitalSocial: '500', ventasNetas: '100' });
    const aviso = (fixture.nativeElement as HTMLElement).querySelector('.fin-cuadre')!;
    expect(aviso.classList.contains('fin-cuadre--ok')).toBe(true);
  });

  it('escribir en un campo actualiza el modelo y los totales en vivo', () => {
    const fixture = crear();
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('.fin-fila input')!;
    input.value = '250000';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.componentInstance.valores().efectivo).toBe('250000');
    expect(fixture.componentInstance.totales().activoTotal).toBe(250000);
  });

  it('marca en rojo un negativo en una partida que no lo admite, pero no en un flujo', () => {
    const fixture = crear({ inventarios: '-5', flujoInversion: '-5' });
    expect(fixture.componentInstance.signoInvalido().has('inventarios')).toBe(true);
    expect(fixture.componentInstance.signoInvalido().has('flujoInversion')).toBe(false);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.fin-fila--error')).toHaveLength(1);
    expect(texto(fixture)).toContain('No puede ser negativo.');
  });

  it('muestra los totales del modelo anterior como referencia', () => {
    const fixture = crear();
    fixture.componentRef.setInput('totalesAnteriores', {
      activoTotal: 1850000,
      pasivoTotal: 720000,
      patrimonio: 1130000,
      utilidadNeta: 142000,
    });
    fixture.detectChanges();
    expect(texto(fixture)).toContain('modelo anterior');
    expect(texto(fixture)).toContain('$1.850.000');
    expect(texto(fixture)).not.toContain('null');
  });
});
