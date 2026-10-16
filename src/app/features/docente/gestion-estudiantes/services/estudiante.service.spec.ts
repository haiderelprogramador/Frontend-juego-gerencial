import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';

import { API_CONFIG, apiUrl } from '../../../../core/api/api.config';
import { EstudianteService } from './estudiante.service';

/** Backend real simulado con HttpTestingController (nunca sale a ngrok). */
describe('EstudianteService (backend real)', () => {
  let service: EstudianteService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(EstudianteService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('cargaMasiva() manda el archivo (multipart, campo "archivo") y normaliza la respuesta', async () => {
    const archivo = new File(['x'], 'estudiantes.xlsx');
    const promesa = firstValueFrom(service.cargaMasiva({ estudiantes: [] }, archivo));

    const req = http.expectOne({ method: 'POST', url: apiUrl(API_CONFIG.endpoints.estudiantesCargaMasiva) });
    expect((req.request.body as FormData).get('archivo')).toBe(archivo);
    req.flush({
      creados: [
        {
          id: 5,
          nombre: 'Juan',
          correo: 'juan@uni.edu',
          numeroIdentificacion: '1094567890',
          edad: 22,
          genero: 'M',
          rol: 'ESTUDIANTE',
          contrasenaGenerada: 'Usu-001-1094567890!',
        },
      ],
      errores: [{ fila: 3, correo: 'x@uni.edu', mensaje: 'El correo ya está registrado' }],
    });

    const res = await promesa;
    expect(res.creados[0]).toMatchObject({ id: '5', edad: '22', contrasenaGenerada: 'Usu-001-1094567890!' });
    expect(res.errores[0].mensaje).toBe('El correo ya está registrado');
  });

  it('sin GET en el backend, listar() devuelve los creados en este navegador (sin contraseña)', async () => {
    if (API_CONFIG.demoMode || API_CONFIG.disponible.listarEstudiantes) {
      return;
    }
    const carga = firstValueFrom(service.cargaMasiva({ estudiantes: [] }, new File(['x'], 'e.xlsx')));
    http.expectOne(apiUrl(API_CONFIG.endpoints.estudiantesCargaMasiva)).flush({
      creados: [{ id: 8, nombre: 'Ana', correo: 'ana@uni.edu', numeroIdentificacion: '1', edad: null, genero: null, contrasenaGenerada: 'secreta' }],
      errores: [],
    });
    await carga;

    const lista = await firstValueFrom(service.listar());
    expect(lista.map((e) => e.id)).toEqual(['8']);
    expect(lista[0].contrasenaGenerada).toBe('');
    expect(service.contarExistentes()).toBe(1);
    http.expectNone(apiUrl(API_CONFIG.endpoints.estudiantes));
  });

  it('cargaMasiva() normaliza vinculados[] (ya tenían cuenta: sin contraseña)', async () => {
    const promesa = firstValueFrom(service.cargaMasiva({ estudiantes: [] }, new File(['x'], 'e.xlsx')));
    http.expectOne(apiUrl(API_CONFIG.endpoints.estudiantesCargaMasiva)).flush({
      creados: [],
      vinculados: [
        { id: 9, nombre: 'Luis', correo: 'luis@uni.edu', numeroIdentificacion: '2', edad: 23, genero: 'M', contrasenaGenerada: null },
      ],
      errores: [],
    });
    const res = await promesa;
    expect(res.vinculados).toEqual([
      expect.objectContaining({ id: '9', nombre: 'Luis', edad: '23', contrasenaGenerada: '' }),
    ]);
  });

  it('cargaMasiva() sin vinculados en la respuesta (backend viejo) los deja en []', async () => {
    const promesa = firstValueFrom(service.cargaMasiva({ estudiantes: [] }, new File(['x'], 'e.xlsx')));
    http.expectOne(apiUrl(API_CONFIG.endpoints.estudiantesCargaMasiva)).flush({ creados: [], errores: [] });
    expect((await promesa).vinculados).toEqual([]);
  });

  describe('agregarManual() — POST /docente/estudiantes', () => {
    const URL_ESTUDIANTES = apiUrl(API_CONFIG.endpoints.estudiantes);
    const respuesta = (contrasenaGenerada: string | null) => ({
      id: 12, nombre: 'Ana Pérez', correo: 'ana@uni.edu', numeroIdentificacion: '1094', edad: null, genero: null,
      rol: 'ESTUDIANTE', contrasenaGenerada,
    });

    it('manda nombre, correo e identificación (sin espacios) y un 201 es una cuenta nueva', async () => {
      const promesa = firstValueFrom(service.agregarManual('curso-1', '  Ana Pérez ', ' ana@uni.edu ', ' 1094 '));
      const req = http.expectOne({ method: 'POST', url: URL_ESTUDIANTES });
      expect(req.request.body).toEqual({ nombre: 'Ana Pérez', correo: 'ana@uni.edu', numeroIdentificacion: '1094' });
      req.flush(respuesta('Usu-001-1094!'), { status: 201, statusText: 'Created' });

      const r = await promesa;
      expect(r.vinculado).toBe(false);
      expect(r.estudiante).toMatchObject({ id: '12', nombre: 'Ana Pérez', edad: '', genero: '' });
    });

    it('un 200 es un estudiante que ya tenía cuenta y solo se vinculó', async () => {
      const promesa = firstValueFrom(service.agregarManual('curso-1', 'Ana Pérez', 'ana@uni.edu', '1094'));
      http.expectOne({ method: 'POST', url: URL_ESTUDIANTES }).flush(respuesta(null), { status: 200, statusText: 'OK' });
      const r = await promesa;
      expect(r.vinculado).toBe(true);
      expect(r.estudiante.contrasenaGenerada).toBe('');
    });

    it('un 409 llega como error con el message del backend', async () => {
      const promesa = firstValueFrom(service.agregarManual('curso-1', 'Ana Pérez', 'ana@uni.edu', '1094'));
      http
        .expectOne({ method: 'POST', url: URL_ESTUDIANTES })
        .flush({ message: 'El estudiante ya está en tu lista' }, { status: 409, statusText: 'Conflict' });
      await expect(promesa).rejects.toMatchObject({ status: 409, error: { message: 'El estudiante ya está en tu lista' } });
    });
  });
});
