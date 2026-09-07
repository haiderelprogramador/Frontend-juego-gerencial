import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { GestionEstudiantes } from './gestion-estudiantes';

describe('GestionEstudiantes', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GestionEstudiantes],
      providers: [provideHttpClient()],
    }).compileComponents();
  });

  it('arranca en estado inicial sin filas', () => {
    const fixture = TestBed.createComponent(GestionEstudiantes);
    expect(fixture.componentInstance.estado()).toBe('inicial');
    expect(fixture.componentInstance.filas().length).toBe(0);
  });
});
