import { TestBed } from '@angular/core/testing';

import { Kpi } from './kpi';

describe('Kpi', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Kpi] }).compileComponents();
  });

  it('muestra etiqueta, valor y variación', () => {
    const fixture = TestBed.createComponent(Kpi);
    fixture.componentRef.setInput('etiqueta', 'Ingresos');
    fixture.componentRef.setInput('valor', '$1,000');
    fixture.componentRef.setInput('variacion', '+5%');
    fixture.componentRef.setInput('tendencia', 'sube');
    fixture.detectChanges();
    const txt = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(txt).toContain('Ingresos');
    expect(txt).toContain('$1,000');
    expect(txt).toContain('+5%');
  });
});
