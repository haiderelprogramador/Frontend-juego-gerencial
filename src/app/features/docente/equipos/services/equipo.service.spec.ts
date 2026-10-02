import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';

import { API_CONFIG, apiUrl } from '../../../../core/api/api.config';
import { EquipoApi, EquipoService } from './equipo.service';

const URL = apiUrl(API_CONFIG.endpoints.equipos);

function equipoApi(id: number, estudianteIds: number[], liderId = estudianteIds[0]): EquipoApi {
  return { id, nombre: `Equipo ${id}`, docenteId: 9, liderId, estudianteIds };
}

/** Backend real simulado con HttpTestingController (nunca sale a ngrok). */
describe('EquipoService (backend real)', () => {
  let service: EquipoService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(EquipoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('cargar() hace GET y convierte los ids numéricos a texto', async () => {
    const promesa = firstValueFrom(service.cargar());
    http.expectOne({ method: 'GET', url: URL }).flush([equipoApi(1, [10, 11], 11)]);

    const lista = await promesa;
    expect(lista[0]).toEqual({ id: '1', nombre: 'Equipo 1', liderId: '11', estudianteIds: ['10', '11'] });
    expect(service.equipos()).toHaveLength(1);
  });

  it('crear() hace POST con ids numéricos y agrega el equipo que devuelve el backend', async () => {
    const promesa = firstValueFrom(service.crear(['10', '11'], '11'));
    const req = http.expectOne({ method: 'POST', url: URL });
    expect(req.request.body).toEqual({ estudianteIds: [10, 11], liderId: 11 });
    req.flush(equipoApi(5, [10, 11], 11));

    const equipo = await promesa;
    expect(equipo.nombre).toBe('Equipo 5');
    expect(service.equipos().map((e) => e.id)).toEqual(['5']);
  });

  it('no llama al backend si el líder no es integrante o hay más de 4', async () => {
    await expect(firstValueFrom(service.crear(['10'], '99'))).rejects.toMatchObject({
      message: expect.stringContaining('líder'),
    });
    await expect(firstValueFrom(service.crear(['1', '2', '3', '4', '5'], '1'))).rejects.toMatchObject({
      message: expect.stringContaining('entre 1 y 4'),
    });
    http.expectNone(URL);
  });

  it('no deja poner en un equipo a alguien que ya está en otro', async () => {
    const carga = firstValueFrom(service.cargar());
    http.expectOne(URL).flush([equipoApi(1, [10])]);
    await carga;

    await expect(firstValueFrom(service.crear(['10', '12'], '12'))).rejects.toMatchObject({
      message: expect.stringContaining('Equipo 1'),
    });
    http.expectNone(URL);
  });

  it('quitarEstudiante() hace PUT y, si sale el líder, el siguiente pasa a ser líder', async () => {
    const carga = firstValueFrom(service.cargar());
    http.expectOne(URL).flush([equipoApi(1, [10, 11], 10)]);
    await carga;

    const promesa = firstValueFrom(service.quitarEstudiante('1', '10'));
    const req = http.expectOne({ method: 'PUT', url: `${URL}/1` });
    expect(req.request.body).toEqual({ estudianteIds: [11], liderId: 11 });
    req.flush(equipoApi(1, [11], 11));

    await promesa;
    expect(service.equipos()[0].estudianteIds).toEqual(['11']);
  });

  it('armarAutomaticamente() crea equipos de hasta 4, uno tras otro', async () => {
    const promesa = firstValueFrom(service.armarAutomaticamente(['1', '2', '3', '4', '5']));

    const primero = http.expectOne({ method: 'POST', url: URL });
    expect(primero.request.body.estudianteIds).toHaveLength(4);
    primero.flush(equipoApi(1, primero.request.body.estudianteIds));

    const segundo = http.expectOne({ method: 'POST', url: URL });
    expect(segundo.request.body.estudianteIds).toHaveLength(1);
    segundo.flush(equipoApi(2, segundo.request.body.estudianteIds));

    expect(await promesa).toHaveLength(2);
  });

  it('eliminar() no llama al backend mientras no exista DELETE', async () => {
    expect(service.puedeEliminar()).toBe(API_CONFIG.demoMode || API_CONFIG.disponible.eliminarEquipo);
    if (!service.puedeEliminar()) {
      await expect(firstValueFrom(service.eliminar('1'))).rejects.toBeTruthy();
      http.expectNone(`${URL}/1`);
    }
  });
});
