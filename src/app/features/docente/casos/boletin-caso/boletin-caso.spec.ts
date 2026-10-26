import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { API_CONFIG, apiUrl } from '../../../../core/api/api.config';
import { Boletin, NOTA_BOLETIN_MAX } from '../../../simulacion/models/boletin.model';
import { BoletinCaso } from './boletin-caso';

const URL_BOLETIN = `${apiUrl(API_CONFIG.endpoints.casos)}/7/boletin`;

function boletin(overrides: Partial<Boletin> = {}): Boletin {
  return {
    idCaso: 7,
    inflacion: 5.2,
    tasaInteres: 9.75,
    tasaCambio: 4150,
    nota: 'El dólar viene subiendo.',
    publicadoEn: '2026-10-15T09:00:00',
    actualizadoEn: '2026-10-15T09:00:00',
    ...overrides,
  };
}

describe('BoletinCaso', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BoletinCaso],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  /** Al recibir `idCaso`, el componente pide GET /docente/casos/{id}/boletin. */
  function crearFixture(respuesta: Boletin | null) {
    const fixture = TestBed.createComponent(BoletinCaso);
    fixture.componentRef.setInput('idCaso', 7);
    fixture.componentRef.setInput('nombreCaso', 'Expansión regional');
    fixture.detectChanges();
    const peticion = http.expectOne({ method: 'GET', url: URL_BOLETIN });
    if (respuesta) {
      peticion.flush(respuesta);
    } else {
      peticion.flush(null, { status: 204, statusText: 'No Content' });
    }
    fixture.detectChanges();
    return fixture;
  }

  it('sin boletín (204) muestra el formulario vacío y "Publicar boletín"', () => {
    const fixture = crearFixture(null);
    const host = fixture.nativeElement as HTMLElement;
    expect(fixture.componentInstance.boletin()).toBeNull();
    expect(host.textContent).toContain('todavía no tiene boletín');
    expect(host.textContent).toContain('Publicar boletín');
    expect(host.textContent).not.toContain('Eliminar boletín');
  });

  it('con boletín llena el formulario y ofrece actualizar y eliminar', () => {
    const fixture = crearFixture(boletin());
    const cmp = fixture.componentInstance;
    const host = fixture.nativeElement as HTMLElement;
    expect(cmp.inflacion()).toBe('5.2');
    expect(cmp.tasaInteres()).toBe('9.75');
    expect(cmp.tasaCambio()).toBe('4150');
    expect(cmp.nota()).toBe('El dólar viene subiendo.');
    expect(host.textContent).toContain('Actualizar boletín');
    expect(host.textContent).toContain('Eliminar boletín');
  });

  it('publicar() manda los números (acepta coma decimal) y omite la nota vacía', () => {
    const fixture = crearFixture(null);
    const cmp = fixture.componentInstance;
    cmp.inflacion.set('5,2');
    cmp.tasaInteres.set('9.75');
    cmp.tasaCambio.set('4150');
    cmp.nota.set('   ');
    cmp.publicar();

    const peticion = http.expectOne({ method: 'PUT', url: URL_BOLETIN });
    expect(peticion.request.body).toEqual({ inflacion: 5.2, tasaInteres: 9.75, tasaCambio: 4150 });
    peticion.flush(boletin({ nota: null }));
    fixture.detectChanges();

    expect(cmp.boletin()?.idCaso).toBe(7);
    expect(cmp.aviso()).toBe('Boletín publicado.');
  });

  it('publicar() manda la nota sin espacios de más cuando la hay', () => {
    const fixture = crearFixture(boletin());
    const cmp = fixture.componentInstance;
    cmp.nota.set('  Sube la tasa.  ');
    cmp.publicar();

    const peticion = http.expectOne({ method: 'PUT', url: URL_BOLETIN });
    expect(peticion.request.body.nota).toBe('Sube la tasa.');
    peticion.flush(boletin({ nota: 'Sube la tasa.', actualizadoEn: '2026-10-16T10:00:00' }));
    expect(cmp.aviso()).toBe('Boletín actualizado.');
  });

  /** Llena el formulario con valores válidos (más los que se pasen) y aplica los cambios. */
  function llenar(cmp: BoletinCaso, valores: Partial<Record<'inflacion' | 'tasaInteres' | 'tasaCambio' | 'nota', string>> = {}) {
    const v = { inflacion: '5', tasaInteres: '9', tasaCambio: '4000', nota: '', ...valores };
    cmp.inflacion.set(v.inflacion);
    cmp.tasaInteres.set(v.tasaInteres);
    cmp.tasaCambio.set(v.tasaCambio);
    cmp.nota.set(v.nota);
  }

  /** Texto del error que se muestra debajo del control `name`. */
  function errorDelCampo(host: HTMLElement, name: string): string | null {
    const control = host.querySelector(`[name="${name}"]`);
    return control?.closest('.field')?.querySelector('.field__error')?.textContent?.trim() ?? null;
  }

  it('no publica si falta un número y marca el campo', () => {
    const fixture = crearFixture(null);
    const cmp = fixture.componentInstance;
    llenar(cmp, { tasaInteres: '' });
    cmp.publicar();
    fixture.detectChanges();
    expect(errorDelCampo(fixture.nativeElement, 'tasaInteres')).toBe('Escribe un número.');
    expect(cmp.error()).toContain('Revisa');
    http.expectNone({ method: 'PUT', url: URL_BOLETIN });
  });

  it.each([
    ['inflacion', '-100.01', 'entre -100 y 1000'],
    ['inflacion', '1000.5', 'entre -100 y 1000'],
    ['tasaInteres', '-0.5', 'entre 0 y 1000'],
    ['tasaInteres', '1001', 'entre 0 y 1000'],
    ['tasaCambio', '0', 'mayor que 0'],
    ['tasaCambio', '-10', 'mayor que 0'],
  ] as const)('rechaza %s = %s fuera del rango del contrato', (campo, valor, texto) => {
    const fixture = crearFixture(null);
    const cmp = fixture.componentInstance;
    llenar(cmp, { [campo]: valor });
    cmp.publicar();
    expect(cmp.erroresCampo()[campo]).toContain(texto);
    expect(Object.keys(cmp.erroresCampo())).toEqual([campo]);
    http.expectNone({ method: 'PUT', url: URL_BOLETIN });
  });

  it('acepta los extremos de los rangos (-100 y 1000 de inflación, 0 y 1000 de tasa de interés)', () => {
    const fixture = crearFixture(null);
    const cmp = fixture.componentInstance;
    llenar(cmp, { inflacion: '-100', tasaInteres: '0' });
    cmp.publicar();
    http.expectOne({ method: 'PUT', url: URL_BOLETIN }).flush(boletin());

    llenar(cmp, { inflacion: '1000', tasaInteres: '1000' });
    cmp.publicar();
    const peticion = http.expectOne({ method: 'PUT', url: URL_BOLETIN });
    expect(peticion.request.body).toMatchObject({ inflacion: 1000, tasaInteres: 1000 });
    peticion.flush(boletin());
  });

  it(`no publica una nota de más de ${NOTA_BOLETIN_MAX} caracteres`, () => {
    const fixture = crearFixture(null);
    const cmp = fixture.componentInstance;
    llenar(cmp, { nota: 'x'.repeat(NOTA_BOLETIN_MAX + 1) });
    cmp.publicar();
    expect(cmp.erroresCampo().nota).toContain(String(NOTA_BOLETIN_MAX));
    http.expectNone({ method: 'PUT', url: URL_BOLETIN });
  });

  it('un 400 con errores[].campo muestra cada mensaje debajo de su campo', () => {
    const fixture = crearFixture(null);
    const cmp = fixture.componentInstance;
    llenar(cmp, { nota: 'Algo' });
    cmp.publicar();
    http.expectOne({ method: 'PUT', url: URL_BOLETIN }).flush(
      {
        message: 'Datos inválidos',
        errores: [
          { campo: 'inflacion', mensaje: 'La inflación debe estar entre -100 y 1000' },
          { campo: 'tasaInteres', mensaje: 'La tasa de interés no puede ser negativa' },
          { campo: 'tasaCambio', mensaje: 'La tasa de cambio debe ser mayor que 0' },
          { campo: 'nota', mensaje: 'La nota no puede superar 2000 caracteres' },
        ],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(cmp.error()).toBe('Datos inválidos');
    expect(errorDelCampo(host, 'inflacion')).toBe('La inflación debe estar entre -100 y 1000');
    expect(errorDelCampo(host, 'tasaInteres')).toBe('La tasa de interés no puede ser negativa');
    expect(errorDelCampo(host, 'tasaCambio')).toBe('La tasa de cambio debe ser mayor que 0');
    expect(errorDelCampo(host, 'nota')).toBe('La nota no puede superar 2000 caracteres');
    expect(host.querySelector('[name="inflacion"]')?.classList.contains('is-invalid')).toBe(true);

    // Al corregir un campo, su error se va y los demás quedan.
    cmp.editar('inflacion', '6');
    fixture.detectChanges();
    expect(errorDelCampo(host, 'inflacion')).toBeNull();
    expect(errorDelCampo(host, 'nota')).toBe('La nota no puede superar 2000 caracteres');
  });

  it('muestra el mensaje del backend si el PUT falla', () => {
    const fixture = crearFixture(null);
    const cmp = fixture.componentInstance;
    llenar(cmp);
    cmp.publicar();
    http
      .expectOne({ method: 'PUT', url: URL_BOLETIN })
      .flush({ message: 'El caso no existe' }, { status: 400, statusText: 'Bad Request' });
    expect(cmp.error()).toBe('El caso no existe');
    expect(cmp.guardando()).toBe(false);
  });

  it('eliminar() pide confirmación y, si se acepta, hace DELETE y vacía el formulario', () => {
    const fixture = crearFixture(boletin());
    const cmp = fixture.componentInstance;
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    cmp.eliminar();

    http.expectOne({ method: 'DELETE', url: URL_BOLETIN }).flush(null);
    expect(cmp.boletin()).toBeNull();
    expect(cmp.inflacion()).toBe('');
    expect(cmp.aviso()).toBe('Boletín eliminado.');
  });

  it('eliminar() no hace nada si el docente cancela la confirmación', () => {
    const fixture = crearFixture(boletin());
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    fixture.componentInstance.eliminar();
    http.expectNone({ method: 'DELETE', url: URL_BOLETIN });
    expect(fixture.componentInstance.boletin()).not.toBeNull();
  });

  it('avisa si el caso tiene boletín al cargarlo, al publicarlo y al eliminarlo (para la lista de Casos)', () => {
    const fixture = TestBed.createComponent(BoletinCaso);
    const emitidos: boolean[] = [];
    fixture.componentInstance.tieneBoletin.subscribe((v) => emitidos.push(v));
    fixture.componentRef.setInput('idCaso', 7);
    fixture.detectChanges();
    http.expectOne({ method: 'GET', url: URL_BOLETIN }).flush(null, { status: 204, statusText: 'No Content' });
    expect(emitidos).toEqual([false]);

    const cmp = fixture.componentInstance;
    llenar(cmp);
    cmp.publicar();
    http.expectOne({ method: 'PUT', url: URL_BOLETIN }).flush(boletin());
    expect(emitidos).toEqual([false, true]);

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    cmp.eliminar();
    http.expectOne({ method: 'DELETE', url: URL_BOLETIN }).flush(null, { status: 204, statusText: 'No Content' });
    expect(emitidos).toEqual([false, true, false]);
  });

  it('si la simulación ya terminó y la lista no lo sabía, el 400 del PUT se muestra y no cambia el indicador', () => {
    const fixture = crearFixture(boletin());
    const cmp = fixture.componentInstance;
    const emitidos: boolean[] = [];
    cmp.tieneBoletin.subscribe((v) => emitidos.push(v));
    llenar(cmp);
    cmp.publicar();
    http
      .expectOne({ method: 'PUT', url: URL_BOLETIN })
      .flush({ message: 'La simulación está finalizada', status: 400 }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('La simulación está finalizada');
    expect(emitidos).toEqual([]);
  });

  it('el 400 del DELETE (simulación FINALIZADA) muestra el message del backend y conserva el boletín', () => {
    const fixture = crearFixture(boletin());
    const cmp = fixture.componentInstance;
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    cmp.eliminar();
    http
      .expectOne({ method: 'DELETE', url: URL_BOLETIN })
      .flush({ message: 'La simulación está finalizada', status: 400 }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect(cmp.error()).toBe('La simulación está finalizada');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('La simulación está finalizada');
    expect(cmp.boletin()).not.toBeNull();
    expect(cmp.guardando()).toBe(false);
  });

  describe('simulación FINALIZADA (solo lectura)', () => {
    function crearSoloLectura(respuesta: Boletin | null) {
      const fixture = TestBed.createComponent(BoletinCaso);
      fixture.componentRef.setInput('idCaso', 7);
      fixture.componentRef.setInput('soloLectura', true);
      fixture.detectChanges();
      const peticion = http.expectOne({ method: 'GET', url: URL_BOLETIN });
      if (respuesta) {
        peticion.flush(respuesta);
      } else {
        peticion.flush(null, { status: 204, statusText: 'No Content' });
      }
      fixture.detectChanges();
      return fixture;
    }

    it('muestra el boletín con los campos deshabilitados, sin publicar ni eliminar, y avisa que terminó', () => {
      const fixture = crearSoloLectura(boletin());
      const host = fixture.nativeElement as HTMLElement;

      expect(host.textContent).toContain('La simulación terminó');
      const controles = host.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea');
      expect(controles).toHaveLength(4);
      controles.forEach((c) => expect(c.disabled).toBe(true));
      expect((host.querySelector('[name="inflacion"]') as HTMLInputElement).value).toBe('5.2');
      expect(host.textContent).not.toContain('Actualizar boletín');
      expect(host.textContent).not.toContain('Publicar boletín');
      expect(host.textContent).not.toContain('Eliminar boletín');
    });

    it('publicar() y eliminar() no llaman al backend', () => {
      const fixture = crearSoloLectura(boletin());
      const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);
      fixture.componentInstance.publicar();
      fixture.componentInstance.eliminar();
      http.expectNone({ method: 'PUT', url: URL_BOLETIN });
      http.expectNone({ method: 'DELETE', url: URL_BOLETIN });
      expect(confirmar).not.toHaveBeenCalled();
    });

    it('sin boletín dice que el caso no tuvo uno', () => {
      const fixture = crearSoloLectura(null);
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Este caso no tuvo boletín.');
    });
  });
});
