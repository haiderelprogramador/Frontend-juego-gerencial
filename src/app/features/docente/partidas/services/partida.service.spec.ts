import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { API_CONFIG, apiUrl } from '../../../../core/api/api.config';
import { PartidaService, aFechaBackend } from './partida.service';

const URL = apiUrl(API_CONFIG.endpoints.partidas);

describe('PartidaService', () => {
  let service: PartidaService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PartidaService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('crear() hace POST con el cuerpo que espera el backend', () => {
    service
      .crear({ casoId: 1, fechaHoraInicio: '2026-10-01T08:00:00', duracionMinutos: 90 })
      .subscribe();
    const req = http.expectOne({ method: 'POST', url: URL });
    expect(req.request.body).toEqual({ casoId: 1, fechaHoraInicio: '2026-10-01T08:00:00', duracionMinutos: 90 });
    req.flush({});
  });

  it('las transiciones de estado llaman a su ruta', () => {
    service.programar(3).subscribe();
    service.iniciar(3).subscribe();
    service.finalizar(3).subscribe();
    http.expectOne({ method: 'POST', url: `${URL}/3/programar` }).flush({});
    http.expectOne({ method: 'POST', url: `${URL}/3/iniciar` }).flush({});
    http.expectOne({ method: 'POST', url: `${URL}/3/finalizar` }).flush({});
  });

  it('asignar y quitar equipos', () => {
    service.asignarEquipos(3, [1, 2]).subscribe();
    const req = http.expectOne({ method: 'POST', url: `${URL}/3/equipos` });
    expect(req.request.body).toEqual({ equipoIds: [1, 2] });
    req.flush({ partidaId: 3, equipos: [] });

    service.quitarEquipo(3, 2).subscribe();
    http.expectOne({ method: 'DELETE', url: `${URL}/3/equipos/2` }).flush({ partidaId: 3, equipos: [] });
  });

  it('aFechaBackend() agrega los segundos que pide LocalDateTime', () => {
    expect(aFechaBackend('2026-10-01T08:00')).toBe('2026-10-01T08:00:00');
    expect(aFechaBackend('2026-10-01T08:00:00')).toBe('2026-10-01T08:00:00');
  });
});
