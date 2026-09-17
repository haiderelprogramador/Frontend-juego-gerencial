import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import * as XLSX from 'xlsx';

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
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [GestionEstudiantes],
      providers: [provideHttpClient()],
    }).compileComponents();
  });

  it('arranca en estado inicial sin filas, en la sección Estudiantes', () => {
    const fixture = TestBed.createComponent(GestionEstudiantes);
    expect(fixture.componentInstance.estado()).toBe('inicial');
    expect(fixture.componentInstance.filas().length).toBe(0);
    expect(fixture.componentInstance.seccion()).toBe('estudiantes');
  });

  it('la sección "Equipos" muestra <app-formar-equipos>', () => {
    const fixture = TestBed.createComponent(GestionEstudiantes);
    fixture.componentInstance.irA('equipos');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-formar-equipos')).toBeTruthy();
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

  it('confirmar() carga los estudiantes y actualiza la tabla de "ya cargados"', async () => {
    const fixture = TestBed.createComponent(GestionEstudiantes);
    const archivo = archivoDesdeFilas([
      {
        Correo: 'nueva.prueba@uni.edu',
        Nombre: 'Estudiante Prueba',
        'Número de identificación': '1000000001',
        Edad: '21',
        Género: 'Masculino',
      },
    ]);

    await fixture.componentInstance.onArchivo(eventoConArchivo(archivo));
    fixture.componentInstance.confirmar();

    // Dos llamadas encadenadas con demoLatenciaMs simulado (cargaMasiva + el
    // listar() posterior que refresca la tabla) — esperamos a que ambas resuelvan.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    fixture.detectChanges();

    expect(fixture.componentInstance.estado()).toBe('resultado');
    expect(
      fixture.componentInstance.estudiantesCargados().some((e) => e.correo === 'nueva.prueba@uni.edu'),
    ).toBe(true);
  });
});
