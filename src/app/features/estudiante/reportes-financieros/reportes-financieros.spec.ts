import { TestBed } from '@angular/core/testing';

import { ReportesFinancieros } from './reportes-financieros';

describe('ReportesFinancieros', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ReportesFinancieros] }).compileComponents();
  });

  it('muestra 4 KPIs y la tabla de estado de resultados', () => {
    const fixture = TestBed.createComponent(ReportesFinancieros);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('app-kpi')).toHaveLength(4);
    expect(host.querySelectorAll('.estado__row').length).toBeGreaterThan(4);
  });
});
