import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';

import { API_CONFIG, apiUrl } from '../../../../core/api/api.config';
import { EmpresaRequest } from '../models/empresa.model';
import { EmpresaService } from './empresa.service';

const URL_SIMULACIONES = apiUrl(API_CONFIG.endpoints.simulacionesDocente);
const URL_EMPRESAS = apiUrl(API_CONFIG.endpoints.empresasDocente);

function empresaRequest(): EmpresaRequest {
  return { nombre: 'TextilAndes S.A.', tipoJugador: 'MULTIUSUARIO' };
}

describe('EmpresaService', () => {
  let service: EmpresaService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(EmpresaService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listarPorSimulacion() hace GET a la ruta anidada', () => {
    service.listarPorSimulacion(7).subscribe();
    http.expectOne({ method: 'GET', url: `${URL_SIMULACIONES}/7/empresas` }).flush([]);
  });

  it('crear() postea a la ruta anidada con el cuerpo que espera el backend (sin codigoEmpresa)', () => {
    const req = empresaRequest();
    service.crear(7, req).subscribe();
    const peticion = http.expectOne({ method: 'POST', url: `${URL_SIMULACIONES}/7/empresas` });
    expect(peticion.request.body).toEqual(req);
    peticion.flush({ ...req, id: 1, idSimulacion: 7, codigoEmpresa: 'EMP-001', estrategia: '', estado: 'ACTIVA' });
  });

  it('obtener() hace GET a /docente/empresas/{id}', () => {
    service.obtener(1).subscribe();
    http.expectOne({ method: 'GET', url: `${URL_EMPRESAS}/1` }).flush({});
  });

  it('actualizar() hace PUT a /docente/empresas/{id}', () => {
    const req = empresaRequest();
    service.actualizar(1, req).subscribe();
    const peticion = http.expectOne({ method: 'PUT', url: `${URL_EMPRESAS}/1` });
    expect(peticion.request.body).toEqual(req);
    peticion.flush({});
  });

  it('eliminar() hace DELETE a /docente/empresas/{id}', () => {
    service.eliminar(1).subscribe();
    http.expectOne({ method: 'DELETE', url: `${URL_EMPRESAS}/1` }).flush(null);
  });

  it('historia() hace GET a /docente/empresas/{id}/historia', () => {
    service.historia(4).subscribe();
    http.expectOne({ method: 'GET', url: `${URL_EMPRESAS}/4/historia` }).flush([]);
  });

  it('historia() normaliza origen a minúsculas y respeta estados en null', async () => {
    const promesa = firstValueFrom(service.historia(4));
    http.expectOne({ method: 'GET', url: `${URL_EMPRESAS}/4/historia` }).flush([
      { idCaso: 1, nombreCaso: 'C1', fechaInicioPartida: '2026-10-01T08:00:00', inicial: { origen: 'HEREDADO' }, final: { origen: 'PENALIZACION', penalizacionPorcentaje: 2.5 } },
      { idCaso: 2, nombreCaso: 'C2', fechaInicioPartida: '2026-10-02T08:00:00', inicial: null, final: null },
    ]);
    const h = await promesa;
    expect(h[0].inicial?.origen).toBe('heredado');
    expect(h[0].final?.origen).toBe('penalizacion');
    expect(h[0].final?.penalizacionPorcentaje).toBe(2.5);
    expect(h[1].inicial).toBeNull();
  });
});
