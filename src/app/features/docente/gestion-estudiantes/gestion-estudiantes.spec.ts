import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import * as XLSX from 'xlsx';

import { API_CONFIG, apiUrl } from '../../../core/api/api.config';
import { GestionEstudiantes } from './gestion-estudiantes';

function archivoDesdeFilas(filas: Record<string, unknown>[]): File {
  const hoja = XLSX.utils.json_to_sheet(filas);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Hoja1');
  const buffer = XLSX.write(libro, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new File([buffer], 'estudiantes.xlsx');
}

function eventoConArchivo(archivo: File): Event {
  const input = document.createElement('input');
  input.type = 'file';
  Object.defineProperty(input, 'files', { value: [archivo] });
  return { target: input } as unknown as Event;
}

describe('GestionEstudiantes', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [GestionEstudiantes],
      // Backend simulado: los tests nunca salen a ngrok.
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** El constructor dispara `cargarListado()` (GET /docente/estudiantes) de entrada. */
  function crearFixture() {
    const fixture = TestBed.createComponent(GestionEstudiantes);
    if (API_CONFIG.disponible.listarEstudiantes) {
      http.expectOne(apiUrl(API_CONFIG.endpoints.estudiantes)).flush([]);
    }
    return fixture;
  }

  it('arranca en estado inicial sin filas, en la sección Estudiantes', () => {
    const fixture = crearFixture();
    expect(fixture.componentInstance.estado()).toBe('inicial');
    expect(fixture.componentInstance.filas().length).toBe(0);
    expect(fixture.componentInstance.seccion()).toBe('estudiantes');
  });

  it('la sección "Equipos" muestra <app-formar-equipos>', () => {
    const fixture = crearFixture();
    fixture.componentInstance.irA('equipos');
    fixture.detectChanges();
    // <app-formar-equipos> recién se instancia acá: dispara sus propias
    // llamadas (estudiantes + equipos), reales porque no está mockeada aquí.
    if (API_CONFIG.disponible.listarEstudiantes) {
      http.expectOne({ method: 'GET', url: apiUrl(API_CONFIG.endpoints.estudiantes) }).flush([]);
    }
    http.expectOne({ method: 'GET', url: apiUrl(API_CONFIG.endpoints.equipos) }).flush([]);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-formar-equipos')).toBeTruthy();
  });

  it('lee edad y género del Excel y los conserva en la previsualización', async () => {
    const fixture = crearFixture();
    const archivo = archivoDesdeFilas([
      {
        Correo: 'ana@uni.edu',
        Nombre: 'Ana Pérez',
        'Número de identificación': '1094567890',
        Edad: '20',
        Género: 'Femenino',
      },
    ]);

    await fixture.componentInstance.onArchivo(eventoConArchivo(archivo));
    fixture.detectChanges();

    const fila = fixture.componentInstance.filas()[0];
    expect(fila.estado).toBe('ok');
    expect(fila.edad).toBe('20');
    expect(fila.genero).toBe('Femenino');
  });

  it('confirmar() sube el Excel al backend y agrega los creados a la tabla', async () => {
    const fixture = crearFixture();
    const archivo = archivoDesdeFilas([
      {
        Correo: 'nueva.prueba@uni.edu',
        Nombre: 'Estudiante Prueba',
        'Número de identificación': '1000000001',
        Edad: '21',
        Género: 'M',
      },
    ]);

    await fixture.componentInstance.onArchivo(eventoConArchivo(archivo));
    fixture.componentInstance.confirmar();

    const req = http.expectOne({ method: 'POST', url: apiUrl(API_CONFIG.endpoints.estudiantesCargaMasiva) });
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush({
      creados: [
        {
          id: 77,
          nombre: 'Estudiante Prueba',
          correo: 'nueva.prueba@uni.edu',
          numeroIdentificacion: '1000000001',
          edad: 21,
          genero: 'M',
          rol: 'ESTUDIANTE',
          contrasenaGenerada: 'Usu-001-1000000001!',
        },
      ],
      errores: [],
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.estado()).toBe('resultado');
    expect(fixture.componentInstance.resultado()?.creados[0].id).toBe('77');
    if (API_CONFIG.disponible.listarEstudiantes) {
      http.expectOne(apiUrl(API_CONFIG.endpoints.estudiantes)).flush([]);
    } else {
      // Sin GET en el backend: la tabla sale del respaldo local, con el id real.
      expect(fixture.componentInstance.estudiantesCargados().map((e) => e.id)).toContain('77');
    }
  });
});
