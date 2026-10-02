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

  it('parsea las partidas financieras por etiqueta, nombre de campo o variante', async () => {
    const archivo = archivoDesdeFilas([
      {
        Efectivo: '200000',
        'Cuentas por cobrar': '150000',
        'Propiedad, planta y equipo': '900000',
        ventasNetas: '1200000',
        'Flujo de Inversión': '-80000',
      },
    ]);

    const resultado = await service.parsearFinanciero(archivo);

    expect(resultado.efectivo).toBe('200000');
    expect(resultado.cuentasPorCobrar).toBe('150000');
    expect(resultado.propiedadPlantaEquipo).toBe('900000');
    expect(resultado.ventasNetas).toBe('1200000');
    expect(resultado.flujoInversion).toBe('-80000');
    // Las columnas que no vienen quedan vacías, no "undefined".
    expect(resultado.inventarios).toBe('');
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
