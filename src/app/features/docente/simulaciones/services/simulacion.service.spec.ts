import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';

import { API_CONFIG, apiUrl } from '../../../../core/api/api.config';
import { SimulacionRequest } from '../models/simulacion.model';
import { ArchivoDescargado, SimulacionService } from './simulacion.service';

const URL = apiUrl(API_CONFIG.endpoints.simulacionesDocente);

function simulacionRequest(): SimulacionRequest {
  return { nombre: 'Simulación 2026-2', fechaInicio: '2026-10-01T08:00:00', fechaFin: '2026-12-01T23:59:00' };
}

describe('SimulacionService', () => {
  let service: SimulacionService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SimulacionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listar() hace GET a /docente/simulaciones', () => {
    service.listar().subscribe();
    http.expectOne({ method: 'GET', url: URL }).flush([]);
  });

  it('obtener() hace GET a /{id}', () => {
    service.obtener(1).subscribe();
    http.expectOne({ method: 'GET', url: `${URL}/1` }).flush({});
  });

  it('crear() hace POST con el cuerpo que espera el backend', () => {
    const req = simulacionRequest();
    service.crear(req).subscribe();
    const peticion = http.expectOne({ method: 'POST', url: URL });
    expect(peticion.request.body).toEqual(req);
    peticion.flush({ ...req, id: 1, idUsuarioCoordinador: 9, estado: 'BORRADOR' });
  });

  it('actualizar() hace PUT a /{id}', () => {
    const req = simulacionRequest();
    service.actualizar(1, req).subscribe();
    const peticion = http.expectOne({ method: 'PUT', url: `${URL}/1` });
    expect(peticion.request.body).toEqual(req);
    peticion.flush({ ...req, id: 1, idUsuarioCoordinador: 9, estado: 'BORRADOR' });
  });

  it('las transiciones de estado postean sin cuerpo a su ruta', () => {
    service.programar(1).subscribe();
    service.desprogramar(1).subscribe();
    service.iniciar(1).subscribe();
    service.finalizar(1).subscribe();
    http.expectOne({ method: 'POST', url: `${URL}/1/programar` }).flush({});
    http.expectOne({ method: 'POST', url: `${URL}/1/desprogramar` }).flush({});
    http.expectOne({ method: 'POST', url: `${URL}/1/iniciar` }).flush({});
    http.expectOne({ method: 'POST', url: `${URL}/1/finalizar` }).flush({});
  });

  describe('exportar()', () => {
    const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    it('pide /{id}/exportar como blob y toma el nombre del Content-Disposition', async () => {
      const promesa = firstValueFrom(service.exportar(12));
      const peticion = http.expectOne({ method: 'GET', url: `${URL}/12/exportar` });
      expect(peticion.request.responseType).toBe('blob');
      const blob = new Blob(['xlsx'], { type: XLSX });
      peticion.flush(blob, {
        headers: { 'Content-Disposition': 'attachment; filename="estratego-simulacion-12.xlsx"', 'Content-Type': XLSX },
      });

      const archivo: ArchivoDescargado = await promesa;
      expect(archivo.nombre).toBe('estratego-simulacion-12.xlsx');
      expect(archivo.blob).toBe(blob);
    });

    it('sin Content-Disposition usa estratego-simulacion-{id}.xlsx', async () => {
      const promesa = firstValueFrom(service.exportar(7));
      http.expectOne(`${URL}/7/exportar`).flush(new Blob(['xlsx'], { type: XLSX }));
      expect((await promesa).nombre).toBe('estratego-simulacion-7.xlsx');
    });

    it('una respuesta sin cuerpo o con un blob vacío es un error (no se descarga un .xlsx roto)', async () => {
      const vacio = firstValueFrom(service.exportar(7));
      http.expectOne(`${URL}/7/exportar`).flush(new Blob([], { type: XLSX }));
      await expect(vacio).rejects.toThrow('No se pudo descargar el Excel de la simulación.');

      const sinCuerpo = firstValueFrom(service.exportar(8));
      http.expectOne(`${URL}/8/exportar`).flush(null);
      await expect(sinCuerpo).rejects.toThrow('No se pudo descargar el Excel de la simulación.');
    });

    it('un error (cuerpo Blob con JSON) se convierte en Error con el message del backend', async () => {
      const promesa = firstValueFrom(service.exportar(7));
      http
        .expectOne(`${URL}/7/exportar`)
        .flush(new Blob([JSON.stringify({ message: 'Simulación no encontrada' })], { type: 'application/json' }), {
          status: 404,
          statusText: 'Not Found',
        });
      await expect(promesa).rejects.toThrow('Simulación no encontrada');
    });

    it.each([
      ['Simulación no encontrada'],
      ['La simulación no pertenece a este docente'],
    ])('un 400 muestra el message del backend: %s', async (msg) => {
      const promesa = firstValueFrom(service.exportar(7));
      http
        .expectOne(`${URL}/7/exportar`)
        .flush(new Blob([JSON.stringify({ status: 400, message: msg })]), { status: 400, statusText: 'Bad Request' });
      await expect(promesa).rejects.toThrow(msg);
    });

    it('un 401 (sesión vencida, cuerpo vacío) pide volver a iniciar sesión', async () => {
      const promesa = firstValueFrom(service.exportar(7));
      http.expectOne(`${URL}/7/exportar`).flush(new Blob([]), { status: 401, statusText: 'Unauthorized' });
      await expect(promesa).rejects.toThrow('Tu sesión venció. Vuelve a iniciar sesión para descargar el archivo.');
    });

    it('un 403 (sin permiso o sesión vencida: el backend no distingue) da un mensaje que cubre los dos casos', async () => {
      const promesa = firstValueFrom(service.exportar(7));
      http
        .expectOne(`${URL}/7/exportar`)
        .flush(new Blob([JSON.stringify({ status: 403, error: 'Forbidden', message: 'Access Denied' })]), {
          status: 403,
          statusText: 'Forbidden',
        });
      await expect(promesa).rejects.toThrow(
        'No tienes permiso para descargar este archivo o tu sesión venció. Vuelve a iniciar sesión e inténtalo de nuevo.',
      );
    });

    it('si el cuerpo del error no es JSON (o no trae message), da un mensaje genérico', async () => {
      const promesa = firstValueFrom(service.exportar(7));
      http
        .expectOne(`${URL}/7/exportar`)
        .flush(new Blob(['<html>502</html>'], { type: 'text/html' }), { status: 502, statusText: 'Bad Gateway' });
      await expect(promesa).rejects.toThrow('No se pudo descargar el Excel de la simulación.');

      const otra = firstValueFrom(service.exportar(8));
      http
        .expectOne(`${URL}/8/exportar`)
        .flush(new Blob([JSON.stringify({ error: 'x' })]), { status: 500, statusText: 'Server Error' });
      await expect(otra).rejects.toThrow('No se pudo descargar el Excel de la simulación.');
    });
  });

  it('eliminar() hace DELETE a /{id}', () => {
    service.eliminar(1).subscribe();
    http.expectOne({ method: 'DELETE', url: `${URL}/1` }).flush(null);
  });
});
