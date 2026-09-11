import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';

export interface FinancieroExcel {
  activoTotal: string;
  pasivoTotal: string;
  patrimonio: string;
  utilidadNeta: string;
}

export interface OpcionExcelFila {
  opcion: string;
  resultado: string;
}

type AliasMap = Record<string, string[]>;

/**
 * Lee en el navegador (xlsx/SheetJS) los Excel de configuración de un Caso:
 * información financiera inicial y catálogo de opciones ("Opción"/"Resultado").
 *
 * Mismo patrón que `excel-estudiantes.service.ts` (docs/06 regla 8): el backend
 * todavía no existe, pero esto ya funciona contra archivos reales — no es un
 * mock. Encabezados tolerantes a variantes/tildes, igual que en esa carga.
 */
@Injectable()
export class ExcelCasoService {
  private readonly ALIAS_FINANCIERO: AliasMap = {
    activoTotal: ['activo total', 'activo', 'total activo'],
    pasivoTotal: ['pasivo total', 'pasivo', 'total pasivo'],
    patrimonio: ['patrimonio', 'patrimonio neto'],
    utilidadNeta: ['utilidad neta', 'utilidad', 'utilidad del periodo'],
  };

  private readonly ALIAS_OPCION: AliasMap = {
    opcion: ['opcion', 'decision', 'opcion de decision', 'texto de la opcion'],
    resultado: ['resultado', 'efecto'],
  };

  /** Espera una fila con Activo total / Pasivo total / Patrimonio / Utilidad neta. */
  async parsearFinanciero(archivo: File): Promise<FinancieroExcel> {
    const filas = await this.leerFilas(archivo);
    if (filas.length === 0) {
      throw new Error('El archivo no tiene filas de datos.');
    }

    const fila = filas[0];
    const mapa = this.mapearColumnas(Object.keys(fila), this.ALIAS_FINANCIERO);

    const resultado: FinancieroExcel = {
      activoTotal: this.obtener(fila, mapa, 'activoTotal'),
      pasivoTotal: this.obtener(fila, mapa, 'pasivoTotal'),
      patrimonio: this.obtener(fila, mapa, 'patrimonio'),
      utilidadNeta: this.obtener(fila, mapa, 'utilidadNeta'),
    };

    if (!resultado.activoTotal && !resultado.pasivoTotal && !resultado.patrimonio && !resultado.utilidadNeta) {
      throw new Error(
        'No se reconoció ninguna columna esperada (Activo total, Pasivo total, Patrimonio, Utilidad neta).',
      );
    }
    return resultado;
  }

  /** Espera filas con columnas "Opción" y "Resultado". */
  async parsearOpciones(archivo: File): Promise<OpcionExcelFila[]> {
    const filas = await this.leerFilas(archivo);
    if (filas.length === 0) {
      throw new Error('El archivo no tiene filas de datos.');
    }

    const mapa = this.mapearColumnas(Object.keys(filas[0]), this.ALIAS_OPCION);
    if (!mapa['opcion']) {
      throw new Error('No se reconoció la columna "Opción" en el encabezado.');
    }

    const opciones = filas
      .map((fila) => ({
        opcion: this.obtener(fila, mapa, 'opcion'),
        resultado: this.obtener(fila, mapa, 'resultado'),
      }))
      .filter((f) => f.opcion !== '');

    if (opciones.length === 0) {
      throw new Error('No se encontraron filas con la columna "Opción" llena.');
    }
    return opciones;
  }

  // ---------------------------------------------------------------------------
  // Internos
  // ---------------------------------------------------------------------------

  private async leerFilas(archivo: File): Promise<Record<string, unknown>[]> {
    const buffer = await archivo.arrayBuffer();
    const libro = XLSX.read(buffer, { type: 'array' });

    const primeraHoja = libro.SheetNames[0];
    if (!primeraHoja) {
      throw new Error('El archivo no tiene ninguna hoja de cálculo.');
    }

    return XLSX.utils.sheet_to_json<Record<string, unknown>>(libro.Sheets[primeraHoja], {
      defval: '',
      raw: false,
    });
  }

  private mapearColumnas(encabezados: string[], alias: AliasMap): Record<string, string> {
    const mapa: Record<string, string> = {};
    for (const encabezado of encabezados) {
      const normalizado = this.normalizarTexto(encabezado);
      for (const campo of Object.keys(alias)) {
        if (!mapa[campo] && alias[campo].includes(normalizado)) {
          mapa[campo] = encabezado;
        }
      }
    }
    return mapa;
  }

  private obtener(fila: Record<string, unknown>, mapa: Record<string, string>, campo: string): string {
    const columna = mapa[campo];
    return columna ? this.aTexto(fila[columna]).trim() : '';
  }

  private normalizarTexto(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[._-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private aTexto(valor: unknown): string {
    if (valor === null || valor === undefined) {
      return '';
    }
    return String(valor);
  }
}
