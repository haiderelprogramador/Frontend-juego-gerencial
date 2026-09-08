import { TestBed } from '@angular/core/testing';

import { TarjetaSeleccion } from './tarjeta-seleccion';

describe('TarjetaSeleccion', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TarjetaSeleccion] }).compileComponents();
  });

  it('renderiza las opciones y cambia el valor al elegir una', () => {
    const fixture = TestBed.createComponent(TarjetaSeleccion);
    fixture.componentRef.setInput('opciones', [
      { valor: 'a', titulo: 'A' },
      { valor: 'b', titulo: 'B' },
    ]);
    fixture.detectChanges();

    const radios = (fixture.nativeElement as HTMLElement).querySelectorAll('input[type=radio]');
    expect(radios).toHaveLength(2);

    (radios[1] as HTMLInputElement).dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(fixture.componentInstance.valor()).toBe('b');
  });
});
