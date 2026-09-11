import * as XLSX from 'xlsx';

import { ExcelCasoService } from './excel-caso.service';

function archivoDesdeFilas(filas: Record<string, unknown>[]): File {
  const hoja = XLSX.utils.json_to_sheet(filas);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Hoja1');
  const buffer = XLSX.write(libro, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new File([buffer], 'prueba.xlsx');
}

describe('ExcelCasoService', () => {
  let service: ExcelCasoService;

  beforeEach(() => {
    service = new ExcelCasoService();
  });

  it('parsea la información financiera con encabezados reales', async () => {
    const archivo = archivoDesdeFilas([
      { 'Activo total': '1850000', 'Pasivo total': '720000', Patrimonio: '1130000', 'Utilidad neta': '142000' },
    ]);

    const resultado = await service.parsearFinanciero(archivo);

    expect(resultado).toEqual({
      activoTotal: '1850000',
      pasivoTotal: '720000',
      patrimonio: '1130000',
      utilidadNeta: '142000',
    });
  });

  it('rechaza un Excel de financiero sin columnas reconocibles', async () => {
    const archivo = archivoDesdeFilas([{ Foo: '1', Bar: '2' }]);
    await expect(service.parsearFinanciero(archivo)).rejects.toThrow();
  });

  it('parsea varias filas de opciones con las columnas "Opción" y "Resultado"', async () => {
    const archivo = archivoDesdeFilas([
      { Opción: 'Ampliar planta', Resultado: 'Activo +180k' },
      { Opción: 'Mantener capacidad', Resultado: 'Utilidad +25k' },
      { Opción: '', Resultado: 'fila vacía, se descarta' },
    ]);

    const opciones = await service.parsearOpciones(archivo);

    expect(opciones).toEqual([
      { opcion: 'Ampliar planta', resultado: 'Activo +180k' },
      { opcion: 'Mantener capacidad', resultado: 'Utilidad +25k' },
    ]);
  });

  it('rechaza un Excel de opciones sin columna "Opción"', async () => {
    const archivo = archivoDesdeFilas([{ Texto: 'algo', Efecto: 'otro' }]);
    await expect(service.parsearOpciones(archivo)).rejects.toThrow();
  });
});
