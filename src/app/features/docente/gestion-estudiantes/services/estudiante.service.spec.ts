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
});
