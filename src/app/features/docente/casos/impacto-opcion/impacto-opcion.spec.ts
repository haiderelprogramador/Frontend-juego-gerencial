import { TestBed } from '@angular/core/testing';

import {
  FinancieroEntrada,
  ImpactoTexto,
  financieroANumeros,
  financieroVacio,
  impactoVacio,
} from '../../../simulacion/models/financiero.model';
import { ImpactoFinancieroOpcion } from './impacto-opcion';

/** Ventas 1.000.000, costo 600.000 → utilidad neta 400.000; efectivo 100.000. */
const BASE: FinancieroEntrada = {
  ...financieroANumeros(financieroVacio()),
  efectivo: 100000,
  ventasNetas: 1000000,
  costoVentas: 600000,
};

describe('ImpactoFinancieroOpcion', () => {
  function crear(impacto: ImpactoTexto = impactoVacio()) {
    TestBed.configureTestingModule({ imports: [ImpactoFinancieroOpcion] });
    const fixture = TestBed.createComponent(ImpactoFinancieroOpcion);
    fixture.componentRef.setInput('impacto', impacto);
    fixture.componentRef.setInput('base', BASE);
    fixture.detectChanges();
    return fixture;
  }

  function el(fixture: { nativeElement: unknown }): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('sin impacto arranca cerrada; con impacto declarado arranca abierta', () => {
    expect(el(crear()).querySelector('.imp-cuerpo')).toBeNull();

    TestBed.resetTestingModule();
    const conImpacto = impactoVacio();
    conImpacto.ventasNetas = { tipo: 'porcentaje', valor: '10' };
    expect(el(crear(conImpacto)).querySelector('.imp-cuerpo')).toBeTruthy();
  });

  it('el toggle solo alterna entre porcentaje y monto', () => {
    const fixture = crear();
    fixture.componentInstance.abierta.set(true);
    fixture.detectChanges();

    const botones = el(fixture).querySelectorAll<HTMLButtonElement>('.imp-fila .imp-tipo button');
    botones[1].click(); // "$" del primer driver (ventas netas)
    fixture.detectChanges();
    expect(fixture.componentInstance.impacto().ventasNetas.tipo).toBe('monto');

    botones[0].click();
    expect(fixture.componentInstance.impacto().ventasNetas.tipo).toBe('porcentaje');
  });

  it('muestra la vista previa en vivo con utilidad neta y efectivo antes/después', () => {
    const fixture = crear();
    fixture.componentInstance.abierta.set(true);
    fixture.detectChanges();
    expect(el(fixture).querySelector('.imp-previa')).toBeNull();

    const input = el(fixture).querySelector<HTMLInputElement>('.imp-fila input')!; // ventas netas
    input.value = '10';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const previa = el(fixture).querySelector('.imp-previa')!.textContent!.replace(/\s+/g, ' ');
    expect(previa).toContain('Utilidad neta pasa de $400.000 a $500.000');
    expect(previa).toContain('Efectivo pasa de $100.000 a $200.000');
  });

  it('marca en rojo un porcentaje menor a -100, pero no un monto', () => {
    const impacto = impactoVacio();
    impacto.ventasNetas = { tipo: 'porcentaje', valor: '-150' };
    impacto.costoVentas = { tipo: 'monto', valor: '-150' };
    const fixture = crear(impacto);

    const filas = el(fixture).querySelectorAll('.imp-fila');
    expect(filas[0].classList.contains('imp-fila--error')).toBe(true);
    expect(filas[1].classList.contains('imp-fila--error')).toBe(false);
    expect(el(fixture).textContent).toContain('no puede ser menor a -100');
  });
});
