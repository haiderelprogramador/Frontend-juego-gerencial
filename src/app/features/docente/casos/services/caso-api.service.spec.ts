import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { API_CONFIG, apiUrl } from '../../../../core/api/api.config';
import { CasoRequest } from '../../../simulacion/models/caso-api.model';
import { financieroANumeros, financieroVacio } from '../../../simulacion/models/financiero.model';
import { CasoApiService } from './caso-api.service';

const URL = apiUrl(API_CONFIG.endpoints.casos);
const URL_SIMULACIONES = apiUrl(API_CONFIG.endpoints.simulacionesDocente);

function casoRequest(): CasoRequest {
  return {
    idSimulacion: 7,
    nombre: 'TextilAndes S.A.',
    tipo: 'Manufactura',
    mision: 'Producir textiles de alta calidad.',
    vision: 'Ser el referente andino en textiles sostenibles.',
    financiero: { ...financieroANumeros(financieroVacio()), efectivo: 1000, capitalSocial: 1000 },
    penalizacionMin: 1,
    penalizacionMax: 3,
    fechaVisualizacion: '2026-10-01T08:00:00',
    fechaInicioPartida: '2026-10-03T08:00:00',
    fechaFinPartida: '2026-10-05T23:59:00',
    asignacionEquipos: 'automatica',
    opciones: [{ opcion: 'Ampliar planta', resultado: 'Activo total +180000' }],
  };
}

describe('CasoApiService', () => {
  let service: CasoApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CasoApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listar() hace GET a /docente/casos', () => {
    service.listar().subscribe();
    http.expectOne({ method: 'GET', url: URL }).flush([]);
  });

  it('listarPorSimulacion() hace GET a la ruta anidada', () => {
    service.listarPorSimulacion(7).subscribe();
    http.expectOne({ method: 'GET', url: `${URL_SIMULACIONES}/7/casos` }).flush([]);
  });

  it('crear() postea a /docente/casos con idSimulacion en el body', () => {
    const req = casoRequest();
    service.crear(req).subscribe();
    const peticion = http.expectOne({ method: 'POST', url: URL });
    expect(peticion.request.body).toEqual(req);
    peticion.flush({ ...req, id: 1, estado: 'borrador', opciones: [] });
  });

  it('actualizar() hace PUT al caso', () => {
    const req = casoRequest();
    service.actualizar(1, req).subscribe();
    const peticion = http.expectOne({ method: 'PUT', url: `${URL}/1` });
    expect(peticion.request.body).toEqual(req);
    peticion.flush({ ...req, id: 1, estado: 'borrador', opciones: [] });
  });

  it('activar() postea sin cuerpo a /activar', () => {
    service.activar(1).subscribe();
    const peticion = http.expectOne({ method: 'POST', url: `${URL}/1/activar` });
    expect(peticion.request.body).toEqual({});
    peticion.flush({});
  });

  it('decisiones() hace GET a /decisiones', () => {
    service.decisiones(1).subscribe();
    http.expectOne({ method: 'GET', url: `${URL}/1/decisiones` }).flush([]);
  });

  it('eliminar() hace DELETE al caso', () => {
    service.eliminar(1).subscribe();
    http.expectOne({ method: 'DELETE', url: `${URL}/1` }).flush(null);
  });
});
