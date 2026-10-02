import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';

import { API_CONFIG, apiUrl } from '../../../core/api/api.config';
import { EstudianteCargado } from '../gestion-estudiantes/models/estudiante.model';
import { EstudianteService } from '../gestion-estudiantes/services/estudiante.service';
import { FormarEquipos } from './equipos';

const URL = apiUrl(API_CONFIG.endpoints.equipos);

function estudiante(id: string, nombre: string): EstudianteCargado {
  return {
    id,
    nombre,
    correo: `${id}@uni.edu`,
    numeroIdentificacion: id,
    edad: '20',
    genero: 'F',
    contrasenaGenerada: '',
    cargadoEn: '',
  };
}

describe('FormarEquipos', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormarEquipos],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: EstudianteService,
          useValue: {
            listar: () => of([estudiante('10', 'Ana'), estudiante('11', 'Luis'), estudiante('12', 'Sara')]),
            listaEsLocal: () => false,
          },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function crear() {
    const fixture = TestBed.createComponent(FormarEquipos);
    fixture.detectChanges();
    http.expectOne({ method: 'GET', url: URL }).flush([]);
    fixture.detectChanges();
    return fixture;
  }

  it('muestra a los estudiantes sin equipo', () => {
    const fixture = crear();
    expect(fixture.componentInstance.sinEquipo().map((e) => e.nombre)).toEqual(['Ana', 'Luis', 'Sara']);
  });

  it('el primer marcado queda como líder y crea el equipo en el backend', () => {
    const fixture = crear();
    const c = fixture.componentInstance;

    c.alternarSeleccion('10');
    c.alternarSeleccion('11');
    expect(c.lider()).toBe('10');
    c.lider.set('11');

    c.crearEquipo();
    const req = http.expectOne({ method: 'POST', url: URL });
    expect(req.request.body).toEqual({ estudianteIds: [10, 11], liderId: 11 });
    req.flush({ id: 1, nombre: 'Equipo 1', docenteId: 9, liderId: 11, estudianteIds: [10, 11] });
    fixture.detectChanges();

    expect(c.equipos()).toHaveLength(1);
    expect(c.sinEquipo().map((e) => e.nombre)).toEqual(['Sara']);
    expect(c.seleccion()).toEqual([]);
  });

  it('muestra el mensaje de error que devuelve el backend', () => {
    const fixture = crear();
    const c = fixture.componentInstance;
    c.alternarSeleccion('10');
    c.crearEquipo();

    http
      .expectOne({ method: 'POST', url: URL })
      .flush({ message: 'El estudiante 10 ya está en el equipo Equipo 1' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect(c.error()).toBe('El estudiante 10 ya está en el equipo Equipo 1');
    expect(c.ocupado()).toBe(false);
  });

  it('no deja marcar más de 4 estudiantes', () => {
    const fixture = crear();
    const c = fixture.componentInstance;
    ['1', '2', '3', '4', '5'].forEach((id) => c.alternarSeleccion(id));
    expect(c.seleccion()).toHaveLength(4);
  });
});
