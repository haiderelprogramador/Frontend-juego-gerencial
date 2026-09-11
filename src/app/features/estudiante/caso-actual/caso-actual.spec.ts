import { TestBed } from '@angular/core/testing';

import { CasoActual } from './caso-actual';

describe('CasoActual', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CasoActual] }).compileComponents();
  });

  it('arranca en fase "visualización" con las opciones bloqueadas', () => {
    const fixture = TestBed.createComponent(CasoActual);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(fixture.componentInstance.fase()).toBe('visualizacion');
    expect(host.querySelectorAll('.bloqueada')).toHaveLength(3);
  });

  it('en fase "partida" permite elegir una opción y confirmar', () => {
    const fixture = TestBed.createComponent(CasoActual);
    fixture.componentInstance.irAFase('partida');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const radios = host.querySelectorAll('input[type=radio]');
    expect(radios).toHaveLength(3);

    (radios[0] as HTMLInputElement).dispatchEvent(new Event('change'));
    fixture.detectChanges();
    fixture.componentInstance.confirmarDecision();
    fixture.detectChanges();

    expect(fixture.componentInstance.confirmada()).toBe(true);
  });

  it('muestra el resultado como retroalimentación apenas se confirma (sin esperar al cierre)', () => {
    const fixture = TestBed.createComponent(CasoActual);
    fixture.componentInstance.irAFase('partida');
    fixture.detectChanges();
    expect(fixture.componentInstance.estadoOpciones()).toBe('seleccion');

    fixture.componentInstance.confirmarDecision();
    fixture.detectChanges();

    expect(fixture.componentInstance.fase()).toBe('partida'); // el caso NO cerró
    expect(fixture.componentInstance.estadoOpciones()).toBe('resultado');
    expect((fixture.nativeElement as HTMLElement).querySelector('app-kpi')).toBeTruthy();
  });

  it('en fase "cierre" muestra el resultado de la opción elegida', () => {
    const fixture = TestBed.createComponent(CasoActual);
    fixture.componentInstance.irAFase('cierre');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('.revisada')).toHaveLength(3);
    expect(host.querySelector('app-kpi')).toBeTruthy();
  });
});
