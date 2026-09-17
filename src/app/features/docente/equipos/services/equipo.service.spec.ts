import { TestBed } from '@angular/core/testing';

import { EquipoService } from './equipo.service';

describe('EquipoService', () => {
  let service: EquipoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EquipoService);
  });

  it('arranca sin equipos', () => {
    expect(service.equipos()).toHaveLength(0);
  });

  it('crear() agrega un equipo vacío', () => {
    const equipo = service.crear('Equipo Cóndor');
    expect(service.equipos()).toHaveLength(1);
    expect(equipo.estudianteIds).toHaveLength(0);
  });

  it('asignarEstudiante() lo agrega, y lo saca de cualquier otro equipo antes', () => {
    const a = service.crear('Equipo A');
    const b = service.crear('Equipo B');

    service.asignarEstudiante(a.id, 'est-1');
    expect(service.equipos().find((e) => e.id === a.id)?.estudianteIds).toContain('est-1');

    service.asignarEstudiante(b.id, 'est-1');
    expect(service.equipos().find((e) => e.id === a.id)?.estudianteIds).not.toContain('est-1');
    expect(service.equipos().find((e) => e.id === b.id)?.estudianteIds).toContain('est-1');
  });

  it('quitarEstudiante() lo remueve del equipo', () => {
    const a = service.crear('Equipo A');
    service.asignarEstudiante(a.id, 'est-1');
    service.quitarEstudiante(a.id, 'est-1');
    expect(service.equipos().find((e) => e.id === a.id)?.estudianteIds).toHaveLength(0);
  });

  it('eliminar() quita el equipo de la lista', () => {
    const a = service.crear('Equipo A');
    service.eliminar(a.id);
    expect(service.equipos()).toHaveLength(0);
  });

  it('asignarAutomaticamente() reparte a todos los estudiantes sin equipo entre los equipos existentes', () => {
    service.crear('Equipo A');
    service.crear('Equipo B');

    service.asignarAutomaticamente(['est-1', 'est-2', 'est-3', 'est-4']);

    const total = service.equipos().reduce((acc, e) => acc + e.estudianteIds.length, 0);
    expect(total).toBe(4);
  });

  it('asignarAutomaticamente() no toca a un estudiante que ya tiene equipo', () => {
    const a = service.crear('Equipo A');
    service.crear('Equipo B');
    service.asignarEstudiante(a.id, 'est-1');

    service.asignarAutomaticamente(['est-1', 'est-2']);

    expect(service.equipos().find((e) => e.id === a.id)?.estudianteIds).toContain('est-1');
    const total = service.equipos().reduce((acc, e) => acc + e.estudianteIds.length, 0);
    expect(total).toBe(2);
  });
});
