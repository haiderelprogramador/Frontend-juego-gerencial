import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
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
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Al elegir un curso se pide la lista (dos veces: al abrir y tras `prepararCurso`). */
  function abrirCurso(fixture: ReturnType<typeof TestBed.createComponent<GestionEstudiantes>>) {
    const cmp = fixture.componentInstance;
    cmp.nombreCurso.set('Curso de prueba');
    cmp.crearCurso();
    const curso = cmp.cursos()[0];
    cmp.seleccionarCurso(curso.id);
    if (API_CONFIG.disponible.listarEstudiantes) {
      http.match(apiUrl(API_CONFIG.endpoints.estudiantes)).forEach((r) => r.flush([]));
    }
    fixture.detectChanges();
    return curso;
  }

  it('arranca mostrando el selector de cursos, sin pedir nada al backend', () => {
    const fixture = TestBed.createComponent(GestionEstudiantes);
    fixture.detectChanges();
    expect(fixture.componentInstance.estado()).toBe('inicial');
    expect(fixture.componentInstance.filas().length).toBe(0);
    expect(fixture.componentInstance.cursoActual()).toBeNull();
    http.expectNone(() => true);
  });

  it('al seleccionar un curso abre su espacio de trabajo, sin sección de equipos', () => {
    const fixture = TestBed.createComponent(GestionEstudiantes);
    const curso = abrirCurso(fixture);
    const host = fixture.nativeElement as HTMLElement;
    expect(fixture.componentInstance.cursoActual()?.id).toBe(curso.id);
    expect(host.textContent).not.toContain('Equipos formados');
    expect(host.textContent).not.toContain('Armar equipos');
    expect(host.querySelector('a[href="/docente/empresas"]')).toBeTruthy();
  });

  it('Cursos vive solo en el navegador: crear y eliminar no llaman al backend', () => {
    const fixture = TestBed.createComponent(GestionEstudiantes);
    const cmp = fixture.componentInstance;
    cmp.nombreCurso.set('Gerencia 2026-2');
    cmp.crearCurso();
    expect(cmp.cursos().map((c) => c.nombre)).toEqual(['Gerencia 2026-2']);
    expect(localStorage.length).toBeGreaterThan(0);

    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);
    cmp.eliminarCurso(cmp.cursos()[0]);
    expect(confirmar.mock.calls[0][0]).not.toContain('equipos');
    expect(cmp.cursos()).toEqual([]);
    http.expectNone(() => true);
    confirmar.mockRestore();
  });

  it('lee edad y género del Excel y los conserva en la previsualización', async () => {
    const fixture = TestBed.createComponent(GestionEstudiantes);
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

  it.runIf(!API_CONFIG.demoMode)('confirmar() sube el Excel crudo (multipart) al backend y refresca la tabla', async () => {
    const fixture = TestBed.createComponent(GestionEstudiantes);
    abrirCurso(fixture);
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
    expect((req.request.body as FormData).get('archivo')).toBe(archivo);
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
      http
        .expectOne(apiUrl(API_CONFIG.endpoints.estudiantes))
        .flush([{ id: 77, nombre: 'Estudiante Prueba', correo: 'nueva.prueba@uni.edu' }]);
    }
    expect(fixture.componentInstance.estudiantesCargados().map((e) => e.id)).toContain('77');
  });
});
