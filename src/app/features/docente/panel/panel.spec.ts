import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Panel } from './panel';

describe('Panel', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Panel],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('arranca sin configuración: muestra el checklist y "Sin simulación activa"', () => {
    const fixture = TestBed.createComponent(Panel);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.configuracionCompleta()).toBe(false);
    expect(host.querySelector('.checklist')).toBeTruthy();
    expect(host.querySelector('.entregas__vacio')).toBeTruthy();
    expect(host.textContent).toContain('Sin simulación activa');
    // el paso 4 queda bloqueado hasta completar 1-3
    expect(fixture.componentInstance.pasos()[3].bloqueado).toBe(true);
  });

  it('con configuración completa muestra el bloque de simulación activa', () => {
    const fixture = TestBed.createComponent(Panel);
    fixture.componentInstance.aplicarPreview(true);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.configuracionCompleta()).toBe(true);
    expect(host.querySelector('.checklist')).toBeNull();
    expect(host.querySelector('.periodos__stats')).toBeTruthy();
    expect(host.querySelector('.entregas__list')).toBeTruthy();
    expect(host.textContent).toContain('Simulación activa');
  });

  it('cambia de tab a un placeholder', () => {
    const fixture = TestBed.createComponent(Panel);
    fixture.componentInstance.irA('casos');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.placeholder')).toBeTruthy();
  });
});
