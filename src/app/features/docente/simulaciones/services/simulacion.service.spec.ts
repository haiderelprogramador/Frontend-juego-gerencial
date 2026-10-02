import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { API_CONFIG, apiUrl } from '../../../../core/api/api.config';
import { SimulacionRequest } from '../models/simulacion.model';
import { SimulacionService } from './simulacion.service';

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
    service.iniciar(1).subscribe();
    service.finalizar(1).subscribe();
    http.expectOne({ method: 'POST', url: `${URL}/1/programar` }).flush({});
    http.expectOne({ method: 'POST', url: `${URL}/1/iniciar` }).flush({});
    http.expectOne({ method: 'POST', url: `${URL}/1/finalizar` }).flush({});
  });

  it('eliminar() hace DELETE a /{id}', () => {
    service.eliminar(1).subscribe();
    http.expectOne({ method: 'DELETE', url: `${URL}/1` }).flush(null);
  });
});
