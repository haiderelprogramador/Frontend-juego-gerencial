import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { API_CONFIG, apiUrl } from '../../../../core/api/api.config';
import { IntegranteService } from './integrante.service';

const URL_EMPRESAS = apiUrl(API_CONFIG.endpoints.empresasDocente);
const URL = `${URL_EMPRESAS}/5/integrantes`;

describe('IntegranteService', () => {
  let service: IntegranteService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(IntegranteService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listar() hace GET a /docente/empresas/{idEmpresa}/integrantes', () => {
    service.listar(5).subscribe();
    http.expectOne({ method: 'GET', url: URL }).flush([]);
  });

  it('agregar() postea {idUsuario, departamento, esLider}', () => {
    service.agregar(5, { idUsuario: 50, departamento: 'GERENCIA_GENERAL', esLider: true }).subscribe();
    const peticion = http.expectOne({ method: 'POST', url: URL });
    expect(peticion.request.body).toEqual({ idUsuario: 50, departamento: 'GERENCIA_GENERAL', esLider: true });
    peticion.flush({});
  });

  it('actualizarDepartamento() hace PUT a /{idUsuario} con {departamento}', () => {
    service.actualizarDepartamento(5, 50, 'OPERACIONES').subscribe();
    const peticion = http.expectOne({ method: 'PUT', url: `${URL}/50` });
    expect(peticion.request.body).toEqual({ departamento: 'OPERACIONES' });
    peticion.flush({});
  });

  it('hacerLider() hace PUT a /{idUsuario}/lider sin cuerpo', () => {
    service.hacerLider(5, 50).subscribe();
    const peticion = http.expectOne({ method: 'PUT', url: `${URL}/50/lider` });
    expect(peticion.request.body).toEqual({});
    peticion.flush({});
  });

  it('eliminar() hace DELETE a /{idUsuario}', () => {
    service.eliminar(5, 50).subscribe();
    http.expectOne({ method: 'DELETE', url: `${URL}/50` }).flush(null);
  });
});
