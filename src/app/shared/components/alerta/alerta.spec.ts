import { TestBed } from '@angular/core/testing';

import { Alerta } from './alerta';

describe('Alerta', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Alerta] }).compileComponents();
  });

  it('muestra el mensaje recibido', () => {
    const fixture = TestBed.createComponent(Alerta);
    fixture.componentRef.setInput('mensaje', 'Algo salió mal');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Algo salió mal');
  });
});
