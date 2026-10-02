import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';

import { API_CONFIG, apiUrl } from '../../../core/api/api.config';
import { PortalEstudianteService } from './portal-estudiante.service';

const URL_CASO_ACTUAL = apiUrl(API_CONFIG.endpoints.estudianteCasoActual);
const URL_DECISION = apiUrl(API_CONFIG.endpoints.estudianteDecision);
const URL_SIMULACIONES = apiUrl(API_CONFIG.endpoints.estudianteSimulaciones);
const URL_EMPRESAS = apiUrl(API_CONFIG.endpoints.estudianteEmpresas);
const URL_CASOS = apiUrl(API_CONFIG.endpoints.estudianteCasos);

describe('PortalEstudianteService', () => {
  let service: PortalEstudianteService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PortalEstudianteService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('casoActual() sin idSimulacion no manda el query param', async () => {
    const promesa = firstValueFrom(service.casoActual());
    const peticion = http.expectOne((r) => r.url === URL_CASO_ACTUAL);
    expect(peticion.request.params.has('idSimulacion')).toBe(false);
    peticion.flush({ idSimulacion: 1, caso: { opciones: [] } });
    expect((await promesa)?.idSimulacion).toBe(1);
  });

  it('casoActual() con idSimulacion lo manda como query param', () => {
    service.casoActual(7).subscribe();
    const peticion = http.expectOne((r) => r.url === URL_CASO_ACTUAL);
    expect(peticion.request.params.get('idSimulacion')).toBe('7');
    peticion.flush({ caso: { opciones: [] } });
  });

  it('casoActual() devuelve null en un 204 (sin caso activo visible)', async () => {
    const promesa = firstValueFrom(service.casoActual());
    const peticion = http.expectOne((r) => r.url === URL_CASO_ACTUAL);
    peticion.flush(null, { status: 204, statusText: 'No Content' });
    expect(await promesa).toBeNull();
  });

  /** Lo que mandaría un backend que filtra de más: resultado e impacto dentro de las opciones. */
  const OPCION_CON_EFECTO = {
    id: 10,
    orden: 1,
    opcion: 'Ampliar planta',
    resultado: '+180k',
    impacto: { ventasNetas: { tipo: 'porcentaje', valor: 12 } },
  };

  it('casoActual() descarta resultado e impacto de las opciones (lista blanca)', async () => {
    const promesa = firstValueFrom(service.casoActual());
    http.expectOne((r) => r.url === URL_CASO_ACTUAL).flush({ caso: { id: 1, opciones: [OPCION_CON_EFECTO] } });

    const opcion = (await promesa)!.caso.opciones[0];
    expect(opcion).toEqual({ id: 10, orden: 1, opcion: 'Ampliar planta' });
    expect('impacto' in opcion).toBe(false);
    expect('resultado' in opcion).toBe(false);
  });

  it('obtenerCaso() e historialCasos() también descartan resultado e impacto', async () => {
    const caso = firstValueFrom(service.obtenerCaso(3));
    http.expectOne({ method: 'GET', url: `${URL_CASOS}/3` }).flush({ id: 3, opciones: [OPCION_CON_EFECTO] });
    expect((await caso).opciones[0]).toEqual({ id: 10, orden: 1, opcion: 'Ampliar planta' });

    const historial = firstValueFrom(service.historialCasos(7));
    http
      .expectOne({ method: 'GET', url: `${URL_SIMULACIONES}/7/casos` })
      .flush([{ id: 3, opciones: [OPCION_CON_EFECTO] }]);
    expect((await historial)[0].opciones[0]).toEqual({ id: 10, orden: 1, opcion: 'Ampliar planta' });
  });

  it('decidir() postea {idCaso, idOpcion}', () => {
    service.decidir(1, 2).subscribe();
    const peticion = http.expectOne({ method: 'POST', url: URL_DECISION });
    expect(peticion.request.body).toEqual({ idCaso: 1, idOpcion: 2 });
    peticion.flush({});
  });

  it('misSimulaciones() hace GET a /estudiante/simulaciones', () => {
    service.misSimulaciones().subscribe();
    http.expectOne({ method: 'GET', url: URL_SIMULACIONES }).flush([]);
  });

  it('miEmpresa() hace GET a /estudiante/empresas/{id}', () => {
    service.miEmpresa(5).subscribe();
    http.expectOne({ method: 'GET', url: `${URL_EMPRESAS}/5` }).flush({});
  });

  it('historialCasos() hace GET a /estudiante/simulaciones/{id}/casos', () => {
    service.historialCasos(7).subscribe();
    http.expectOne({ method: 'GET', url: `${URL_SIMULACIONES}/7/casos` }).flush([]);
  });

  it('obtenerCaso() hace GET a /estudiante/casos/{id}', () => {
    service.obtenerCaso(3).subscribe();
    http.expectOne({ method: 'GET', url: `${URL_CASOS}/3` }).flush({});
  });
});
