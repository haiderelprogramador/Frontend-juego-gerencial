import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';

import { FilaEstudianteExcel } from '../models/estudiante.model';

/**
 * Lee y normaliza el Excel de estudiantes en el navegador con xlsx (SheetJS).
 *
 * No hace validación de negocio ni genera contraseñas: solo convierte el
 * archivo en filas `{ correo, nombre, numeroIdentificacion, columnasAdicionales }`.
 * La validación y la previsualización de credenciales las arma el componente
 * de gestión de estudiantes.
 */
@Injectable()
export class ExcelEstudiantesService {
  /**
   * Encabezados aceptados para cada campo mínimo (se comparan normalizados:
   * sin tildes, en minúsculas y sin espacios de sobra).
   *
   * TODO: confirmar con el cliente los nombres EXACTOS de las columnas del
   * Excel real. Esta lista es una cobertura razonable, no una especificación.
   */
  private readonly ALIAS = {
    correo: ['correo', 'correo electronico', 'email', 'e mail', 'mail'],
    nombre: ['nombre', 'nombres', 'nombre completo', 'nombre del estudiante', 'estudiante'],
    numeroIdentificacion: [
      'numero de identificacion',
      'numero identificacion',
      'no identificacion',
      'nro identificacion',
      'identificacion',
      'documento',
      'numero de documento',
      'cedula',
      'cc',
      'dni',
    ],
  };

  /** Lee el archivo y devuelve las filas de estudiantes ya normalizadas. */
  async parsear(archivo: File): Promise<FilaEstudianteExcel[]> {
    const buffer = await archivo.arrayBuffer();
    const libro = XLSX.read(buffer, { type: 'array' });

    // TODO: confirmar con el cliente si el Excel de estudiantes puede traer
    // varias hojas y cuál se debe usar. Por ahora se toma la primera.
    const primeraHoja = libro.SheetNames[0];
    if (!primeraHoja) {
      throw new Error('El archivo no tiene ninguna hoja de cálculo.');
    }

    const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(libro.Sheets[primeraHoja], {
      defval: '',
      raw: false, // fuerza texto: los números de identificación no pierden ceros
    });

    if (filas.length === 0) {
      throw new Error('La primera hoja del archivo no tiene filas de datos.');
    }

    const mapaColumnas = this.mapearColumnas(Object.keys(filas[0]));

    return filas.map((filaCruda, indice) => this.normalizarFila(filaCruda, mapaColumnas, indice + 1));
  }

  // ---------------------------------------------------------------------------
  // Internos
  // ---------------------------------------------------------------------------

  /** Relaciona cada campo mínimo con el nombre real de columna encontrado. */
  private mapearColumnas(encabezados: string[]): {
    correo?: string;
    nombre?: string;
    numeroIdentificacion?: string;
  } {
    const mapa: { correo?: string; nombre?: string; numeroIdentificacion?: string } = {};

    for (const encabezado of encabezados) {
      const normalizado = this.normalizarTexto(encabezado);
      if (!mapa.correo && this.ALIAS.correo.includes(normalizado)) {
        mapa.correo = encabezado;
      } else if (!mapa.nombre && this.ALIAS.nombre.includes(normalizado)) {
        mapa.nombre = encabezado;
      } else if (
        !mapa.numeroIdentificacion &&
        this.ALIAS.numeroIdentificacion.includes(normalizado)
      ) {
        mapa.numeroIdentificacion = encabezado;
      }
    }

    return mapa;
  }

  private normalizarFila(
    filaCruda: Record<string, unknown>,
    mapa: { correo?: string; nombre?: string; numeroIdentificacion?: string },
    numeroFila: number,
  ): FilaEstudianteExcel {
    const usadas = new Set(
      [mapa.correo, mapa.nombre, mapa.numeroIdentificacion].filter(
        (c): c is string => c !== undefined,
      ),
    );

    const columnasAdicionales: Record<string, string> = {};
    for (const [clave, valor] of Object.entries(filaCruda)) {
      if (!usadas.has(clave)) {
        columnasAdicionales[clave] = this.aTexto(valor);
      }
    }

    return {
      fila: numeroFila,
      correo: mapa.correo ? this.aTexto(filaCruda[mapa.correo]).trim() : '',
      nombre: mapa.nombre ? this.aTexto(filaCruda[mapa.nombre]).trim() : '',
      numeroIdentificacion: mapa.numeroIdentificacion
        ? this.aTexto(filaCruda[mapa.numeroIdentificacion]).trim()
        : '',
      columnasAdicionales,
    };
  }

  /** minúsculas, sin tildes (marcas combinantes U+0300–U+036F) y sin separadores. */
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
