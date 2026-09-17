import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { FormarEquipos } from './equipos';
import { EquipoService } from './services/equipo.service';

describe('FormarEquipos', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [FormarEquipos],
      providers: [provideHttpClient()],
    }).compileComponents();
  });

  it('crea un equipo y aparece en la lista', () => {
    const fixture = TestBed.createComponent(FormarEquipos);
    fixture.detectChanges();

    fixture.componentInstance.nombreNuevoEquipo.set('Equipo Cóndor');
    fixture.componentInstance.crearEquipo();
    fixture.detectChanges();

    expect(fixture.componentInstance.equipos()).toHaveLength(1);
    expect(fixture.componentInstance.equipos()[0].nombre).toBe('Equipo Cóndor');
    expect(fixture.componentInstance.nombreNuevoEquipo()).toBe('');
  });

  it('no crea un equipo con nombre vacío', () => {
    const fixture = TestBed.createComponent(FormarEquipos);
    fixture.detectChanges();
    fixture.componentInstance.crearEquipo();
    expect(fixture.componentInstance.equipos()).toHaveLength(0);
  });

  it('quitar() saca a un estudiante del equipo (vuelve a "sin equipo")', () => {
    const fixture = TestBed.createComponent(FormarEquipos);
    fixture.detectChanges();

    fixture.componentInstance.nombreNuevoEquipo.set('Equipo A');
    fixture.componentInstance.crearEquipo();
    const equipo = fixture.componentInstance.equipos()[0];

    TestBed.inject(EquipoService).asignarEstudiante(equipo.id, 'est-1');
    fixture.detectChanges();
    expect(fixture.componentInstance.equipos()[0].estudianteIds).toContain('est-1');

    fixture.componentInstance.quitar(equipo.id, 'est-1');
    fixture.detectChanges();
    expect(fixture.componentInstance.equipos()[0].estudianteIds).not.toContain('est-1');
  });
});
