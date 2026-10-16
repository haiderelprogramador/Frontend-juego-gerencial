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

  describe.runIf(!API_CONFIG.demoMode)('resumen de la carga masiva', () => {
    // jsdom no implementa URL.createObjectURL / revokeObjectURL: se capturan para leer el CSV.
    const originales = { crear: URL.createObjectURL, liberar: URL.revokeObjectURL };
    let blobs: Blob[];
    let clics: HTMLAnchorElement[];

    beforeEach(() => {
      blobs = [];
      clics = [];
      URL.createObjectURL = vi.fn((b: Blob) => {
        blobs.push(b);
        return 'blob:csv';
      }) as unknown as typeof URL.createObjectURL;
      URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        clics.push(this);
      });
    });

    afterEach(() => {
      URL.createObjectURL = originales.crear;
      URL.revokeObjectURL = originales.liberar;
      vi.restoreAllMocks();
    });

    const estudiante = (id: number, contrasenaGenerada: string | null) => ({
      id, nombre: `Estudiante ${id}`, correo: `e${id}@uni.edu`, numeroIdentificacion: `10${id}`, edad: null, genero: null, contrasenaGenerada,
    });

    /** Sube un Excel de una fila y responde la carga con `respuesta`. */
    async function cargar(respuesta: object) {
      const fixture = TestBed.createComponent(GestionEstudiantes);
      abrirCurso(fixture);
      await fixture.componentInstance.onArchivo(
        eventoConArchivo(
          archivoDesdeFilas([{ Correo: 'a@uni.edu', Nombre: 'A', 'Número de identificación': '1', Edad: '20', Género: 'F' }]),
        ),
      );
      fixture.componentInstance.confirmar();
      http.expectOne(apiUrl(API_CONFIG.endpoints.estudiantesCargaMasiva)).flush(respuesta);
      http.match(apiUrl(API_CONFIG.endpoints.estudiantes)).forEach((r) => r.flush([]));
      fixture.detectChanges();
      return fixture;
    }

    it('con contraseñas (correo apagado): tabla, aviso y "Descargar CSV"', async () => {
      const fixture = await cargar({
        creados: [estudiante(1, 'Usu-001-101!'), estudiante(2, 'Usu-002-102!')],
        vinculados: [estudiante(3, null)],
        errores: [{ fila: 4, correo: 'x@uni.edu', mensaje: 'El correo ya está registrado' }],
      });
      const host = fixture.nativeElement as HTMLElement;
      const resumen = host.querySelector('.resultado-carga')!.textContent!;

      expect(resumen).toContain('2 estudiante(s) creados.');
      expect(resumen).toContain('Copia o descarga estas contraseñas ahora: no se vuelven a mostrar.');
      const filas = [...host.querySelectorAll('.contrasenas tbody tr')].map((tr) =>
        [...tr.querySelectorAll('td')].map((td) => td.textContent!.trim()),
      );
      expect(filas).toEqual([
        ['Estudiante 1', 'e1@uni.edu', 'Usu-001-101!'],
        ['Estudiante 2', 'e2@uni.edu', 'Usu-002-102!'],
      ]);
      expect(resumen).not.toContain('se enviaron al correo');
      // Los vinculados no tienen contraseña nueva: su texto no cambia.
      expect(resumen).toContain('1 estudiante(s) ya tenían cuenta y se agregaron a tu lista.');
      expect(resumen).toContain('Fila 4 · x@uni.edu: El correo ya está registrado');
    });

    it('"Descargar CSV" baja nombre, correo, identificación y contraseña con descargarArchivo', async () => {
      const fixture = await cargar({ creados: [estudiante(1, 'Usu-001-101!')], vinculados: [], errores: [] });
      const boton = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === 'Descargar CSV',
      )!;
      boton.click();

      expect(clics).toHaveLength(1);
      expect(clics[0].download).toMatch(/^contrasenas-estudiantes-\d{4}-\d{2}-\d{2}\.csv$/);
      expect(blobs[0].type).toBe('text/csv;charset=utf-8');
      const texto = await blobs[0].text();
      expect(texto.replace('\uFEFF', '').split('\r\n').slice(0, 2)).toEqual([
        'nombre;correo;identificacion;contrasena',
        'Estudiante 1;e1@uni.edu;101;Usu-001-101!',
      ]);
    });

    it.each([
      ['null', null],
      ['vacía', ''],
    ])('sin contraseñas (%s: el backend las mandó por correo): sin tabla ni botón, y lo avisa', async (_, contrasena) => {
      const fixture = await cargar({ creados: [estudiante(1, contrasena)], vinculados: [], errores: [] });
      const host = fixture.nativeElement as HTMLElement;
      const resumen = host.querySelector('.resultado-carga')!.textContent!;

      expect(resumen).toContain('1 estudiante(s) creados.');
      expect(resumen).toContain('Las contraseñas se enviaron al correo de cada estudiante.');
      expect(host.querySelector('.contrasenas')).toBeNull();
      expect(resumen).not.toContain('Descargar CSV');
      expect(resumen).not.toContain('Copia o descarga');
    });
  });

  describe.runIf(!API_CONFIG.demoMode)('alta manual (POST /docente/estudiantes)', () => {
    const URL_ESTUDIANTES = apiUrl(API_CONFIG.endpoints.estudiantes);

    function llenar(cmp: GestionEstudiantes) {
      cmp.manualNombre.set('Ana Pérez');
      cmp.manualCorreo.set('ana@uni.edu');
      cmp.manualId.set('1094');
    }

    function alta(id: number, contrasenaGenerada: string | null) {
      return { id, nombre: 'Ana Pérez', correo: 'ana@uni.edu', numeroIdentificacion: '1094', edad: null, genero: null, contrasenaGenerada };
    }

    it('201 con contraseña (correo apagado): la muestra con "Copiar", limpia el formulario y refresca la lista', async () => {
      const fixture = TestBed.createComponent(GestionEstudiantes);
      abrirCurso(fixture);
      const cmp = fixture.componentInstance;
      llenar(cmp);
      cmp.agregarManual();
      expect(cmp.agregandoManual()).toBe(true);

      http.expectOne({ method: 'POST', url: URL_ESTUDIANTES }).flush(alta(12, 'Usu-001-1094!'), { status: 201, statusText: 'Created' });
      http.expectOne({ method: 'GET', url: URL_ESTUDIANTES }).flush([alta(12, null)]);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;

      expect(host.textContent).toContain('Se creó la cuenta de Ana Pérez y se agregó a tu lista.');
      expect(host.textContent).not.toContain('se envió a su correo');
      expect(host.querySelector('.contrasena-manual code')?.textContent).toBe('Usu-001-1094!');
      expect(cmp.manualNombre()).toBe('');
      expect(cmp.estudiantesCargados().map((e) => e.id)).toEqual(['12']);

      const escribir = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: escribir }, configurable: true });
      host.querySelector<HTMLButtonElement>('.contrasena-manual button')!.click();
      await vi.waitFor(() => expect(cmp.copiada()).toBe(true));
      fixture.detectChanges();
      expect(escribir).toHaveBeenCalledWith('Usu-001-1094!');
      expect(host.querySelector('.contrasena-manual button')?.textContent?.trim()).toBe('Copiada');
    });

    it('201 sin contraseña (el backend la mandó por correo): sin contraseña ni "Copiar", y lo dice', () => {
      const fixture = TestBed.createComponent(GestionEstudiantes);
      abrirCurso(fixture);
      const cmp = fixture.componentInstance;
      llenar(cmp);
      cmp.agregarManual();
      http.expectOne({ method: 'POST', url: URL_ESTUDIANTES }).flush(alta(12, null), { status: 201, statusText: 'Created' });
      http.expectOne({ method: 'GET', url: URL_ESTUDIANTES }).flush([]);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;

      expect(host.textContent).toContain('Se creó la cuenta de Ana Pérez y se agregó a tu lista. La contraseña se envió a su correo.');
      expect(host.querySelector('.contrasena-manual')).toBeNull();
    });

    it('si el portapapeles falla, pide copiarla a mano', async () => {
      const fixture = TestBed.createComponent(GestionEstudiantes);
      abrirCurso(fixture);
      const cmp = fixture.componentInstance;
      llenar(cmp);
      cmp.agregarManual();
      http.expectOne({ method: 'POST', url: URL_ESTUDIANTES }).flush(alta(12, 'Usu-001-1094!'), { status: 201, statusText: 'Created' });
      http.expectOne({ method: 'GET', url: URL_ESTUDIANTES }).flush([]);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn().mockRejectedValue(new Error('denegado')) },
        configurable: true,
      });

      await cmp.copiarContrasena();
      fixture.detectChanges();
      expect(cmp.copiada()).toBe(false);
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('No se pudo copiar: selecciónala y cópiala a mano.');
    });

    it('200: avisa que ya tenía cuenta y se agregó a la lista', () => {
      const fixture = TestBed.createComponent(GestionEstudiantes);
      abrirCurso(fixture);
      const cmp = fixture.componentInstance;
      llenar(cmp);
      cmp.agregarManual();
      http.expectOne({ method: 'POST', url: URL_ESTUDIANTES }).flush(alta(12, null), { status: 200, statusText: 'OK' });
      http.expectOne({ method: 'GET', url: URL_ESTUDIANTES }).flush([]);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Ana Pérez ya tenía cuenta; se agregó a tu lista.');
      expect((fixture.nativeElement as HTMLElement).querySelector('.contrasena-manual')).toBeNull();
    });

    it('409: muestra el mensaje del backend y conserva lo escrito', () => {
      const fixture = TestBed.createComponent(GestionEstudiantes);
      abrirCurso(fixture);
      const cmp = fixture.componentInstance;
      llenar(cmp);
      cmp.agregarManual();
      http
        .expectOne({ method: 'POST', url: URL_ESTUDIANTES })
        .flush({ message: 'El correo ya pertenece a otro usuario con otra identificación' }, { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain('El correo ya pertenece a otro usuario con otra identificación');
      expect(cmp.manualCorreo()).toBe('ana@uni.edu');
      expect(cmp.agregandoManual()).toBe(false);
      http.expectNone({ method: 'GET', url: URL_ESTUDIANTES });
    });

    it('sin nombre, correo o identificación no llama al backend', () => {
      const fixture = TestBed.createComponent(GestionEstudiantes);
      abrirCurso(fixture);
      const cmp = fixture.componentInstance;
      cmp.manualNombre.set('Ana Pérez');
      cmp.agregarManual();
      expect(cmp.errorManual()).toBe('Completa nombre, correo y número de identificación.');
      http.expectNone({ method: 'POST', url: URL_ESTUDIANTES });
    });
  });
});
