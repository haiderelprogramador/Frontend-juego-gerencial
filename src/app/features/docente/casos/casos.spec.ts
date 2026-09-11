import { TestBed } from '@angular/core/testing';
import * as XLSX from 'xlsx';

import { Casos } from './casos';

function archivoDesdeFilas(filas: Record<string, unknown>[]): File {
  const hoja = XLSX.utils.json_to_sheet(filas);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Hoja1');
  const buffer = XLSX.write(libro, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new File([buffer], 'prueba.xlsx');
}

function eventoConArchivo(archivo: File): Event {
  const input = document.createElement('input');
  input.type = 'file';
  Object.defineProperty(input, 'files', { value: [archivo] });
  return { target: input } as unknown as Event;
}

describe('Casos', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Casos] }).compileComponents();
  });

  it('arranca en la lista de casos', () => {
    const fixture = TestBed.createComponent(Casos);
    fixture.detectChanges();
    expect(fixture.componentInstance.vista()).toBe('lista');
    expect((fixture.nativeElement as HTMLElement).querySelector('.tabla-casos')).toBeTruthy();
  });

  it('"+ Nuevo caso" abre el formulario en la pestaña Info General', () => {
    const fixture = TestBed.createComponent(Casos);
    fixture.componentInstance.nuevoCaso();
    fixture.detectChanges();
    expect(fixture.componentInstance.vista()).toBe('formulario');
    expect(fixture.componentInstance.tabForm()).toBe('general');
  });

  it('"+ Agregar opción" añade una tarjeta de opción', () => {
    const fixture = TestBed.createComponent(Casos);
    fixture.componentInstance.nuevoCaso();
    fixture.componentInstance.tabForm.set('opciones');
    fixture.detectChanges();

    expect(fixture.componentInstance.opciones()).toHaveLength(1);
    fixture.componentInstance.agregarOpcion();
    fixture.detectChanges();
    expect(fixture.componentInstance.opciones()).toHaveLength(2);
  });

  it('importa el Excel financiero y precarga los campos manuales', async () => {
    const fixture = TestBed.createComponent(Casos);
    const archivo = archivoDesdeFilas([
      { 'Activo total': '1850000', 'Pasivo total': '720000', Patrimonio: '1130000', 'Utilidad neta': '142000' },
    ]);

    await fixture.componentInstance.onArchivoFinanciero(eventoConArchivo(archivo));
    fixture.detectChanges();

    expect(fixture.componentInstance.activoTotal()).toBe('1850000');
    expect(fixture.componentInstance.utilidadNeta()).toBe('142000');
    expect(fixture.componentInstance.modoFinanciera()).toBe('manual');
    expect(fixture.componentInstance.errorImportFinanciero()).toBeNull();
  });

  it('importa el Excel de opciones y reemplaza el catálogo', async () => {
    const fixture = TestBed.createComponent(Casos);
    const archivo = archivoDesdeFilas([
      { Opción: 'Ampliar planta', Resultado: 'Activo +180k' },
      { Opción: 'Mantener capacidad', Resultado: 'Utilidad +25k' },
    ]);

    await fixture.componentInstance.onArchivoOpciones(eventoConArchivo(archivo));
    fixture.detectChanges();

    expect(fixture.componentInstance.opciones()).toHaveLength(2);
    expect(fixture.componentInstance.opciones()[0].opcion).toBe('Ampliar planta');
    expect(fixture.componentInstance.modoOpciones()).toBe('manual');
  });

  it('muestra un error si el Excel no tiene las columnas esperadas', async () => {
    const fixture = TestBed.createComponent(Casos);
    const archivo = archivoDesdeFilas([{ Foo: '1' }]);

    await fixture.componentInstance.onArchivoFinanciero(eventoConArchivo(archivo));
    fixture.detectChanges();

    expect(fixture.componentInstance.errorImportFinanciero()).toBeTruthy();
  });
});
