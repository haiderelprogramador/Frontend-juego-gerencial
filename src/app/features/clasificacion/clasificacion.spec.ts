import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { API_CONFIG, apiUrl } from '../../core/api/api.config';
import { DemoDb } from '../../core/demo/demo-db';
import { Rol } from '../../core/models/rol.enum';
import { Clasificacion } from './clasificacion';
import { Clasificacion as ClasificacionDto, FilaClasificacion } from './models/clasificacion.model';

const DOCENTE_SIMS = apiUrl(API_CONFIG.endpoints.simulacionesDocente);
const ESTUDIANTE_SIMS = apiUrl(API_CONFIG.endpoints.estudianteSimulaciones);

function fila(posicion: number, idEmpresa: number, utilidad: number): FilaClasificacion {
  return {
    posicion,
    idEmpresa,
    codigoEmpresa: `EMP-00${idEmpresa}`,
    nombreEmpresa: `Empresa ${idEmpresa}`,
    utilidadAcumulada: utilidad,
    casosSinDecision: 1,
    desglose: [
      {
        idCaso: 7, nombreCaso: 'Caso 1', fechaFinPartida: '2026-10-01T18:00:00', decidio: true,
        idOpcion: 71, opcionElegida: 'Expandir planta', utilidadBase: 100000, penalizacionPorcentaje: null,
        utilidadDelCaso: 190000,
      },
      {
        idCaso: 8, nombreCaso: 'Caso 2', fechaFinPartida: '2026-10-03T18:00:00', decidio: false,
        idOpcion: null, opcionElegida: null, utilidadBase: 100000, penalizacionPorcentaje: 3,
        utilidadDelCaso: 97000,
      },
    ],
  };
}

function respuesta(cambios: Partial<ClasificacionDto> = {}): ClasificacionDto {
  return {
    idSimulacion: 41, nombreSimulacion: 'Sim 41', estadoSimulacion: 'FINALIZADA', definitiva: true,
    casosConsiderados: 2,
    // Empate 1, 1, 3 y en un orden que NO es por utilidad: no se debe reordenar.
    clasificacion: [fila(1, 5, 287000), fila(1, 6, 287000), fila(3, 2, 999999)],
    ...cambios,
  };
}

async function configurar(rol: Rol) {
  new DemoDb().guardarSesion({
    token: 't',
    usuario: { id: '99', nombre: 'X', correo: 'x@uni.edu', numeroIdentificacion: '1', rol },
  });
  await TestBed.configureTestingModule({
    imports: [Clasificacion],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({ simulacion: '41' })) } },
    ],
  }).compileComponents();
  return TestBed.inject(HttpTestingController);
}

describe.runIf(!API_CONFIG.demoMode)('Clasificacion', () => {
  afterEach(() => new DemoDb().borrarSesion());

  describe('docente', () => {
    let http: HttpTestingController;
    beforeEach(async () => (http = await configurar(Rol.DOCENTE)));
    afterEach(() => http.verify());

    function montar(datos: ClasificacionDto) {
      const fixture = TestBed.createComponent(Clasificacion);
      fixture.detectChanges();
      http.expectOne(DOCENTE_SIMS).flush([]);
      http.expectOne(`${DOCENTE_SIMS}/41/clasificacion`).flush(datos);
      fixture.detectChanges();
      return { fixture, host: fixture.nativeElement as HTMLElement };
    }

    it('respeta el orden y las posiciones del backend (empate 1, 1, 3)', () => {
      const { host } = montar(respuesta());
      const posiciones = [...host.querySelectorAll('.tabla > tbody > tr .rank-chip')].map((e) => e.textContent?.trim());
      expect(posiciones).toEqual(['1', '1', '3']);
      expect(host.textContent).toContain('$287.000');
    });

    it('vista previa si definitiva es false', () => {
      const { host } = montar(respuesta({ definitiva: false, estadoSimulacion: 'EN_CURSO' }));
      expect(host.textContent).toContain('Vista previa — la simulación aún no terminó');
    });

    it('el desglose muestra la opción elegida y "No decidió" con su penalización', () => {
      const { fixture, host } = montar(respuesta());
      fixture.componentInstance.alternar(5);
      fixture.detectChanges();
      const desglose = host.querySelector('#desglose-5')!;
      expect(desglose.textContent).toContain('Expandir planta');
      expect(desglose.textContent).toContain('No decidió');
      expect(desglose.textContent).toContain('Penalización 3%');
      expect(desglose.textContent).toContain('$97.000');
      expect(host.querySelector('#desglose-6')).toBeNull();
    });

    it('sin casos considerados: "Todavía no hay resultados", no una tabla en 0', () => {
      const { host } = montar(respuesta({ casosConsiderados: 0, clasificacion: [] }));
      expect(host.textContent).toContain('Todavía no hay resultados');
      expect(host.querySelector('.tabla')).toBeNull();
    });
  });

  describe('estudiante', () => {
    let http: HttpTestingController;
    beforeEach(async () => (http = await configurar(Rol.ESTUDIANTE)));
    afterEach(() => http.verify());

    function montar() {
      const fixture = TestBed.createComponent(Clasificacion);
      fixture.detectChanges();
      // idEmpresa numérico, igual que en la clasificación: se resalta la fila sin comparar string vs number.
      http.expectOne(ESTUDIANTE_SIMS).flush([
        { idSimulacion: 41, nombreSimulacion: 'Sim 41', estado: 'FINALIZADA', idEmpresa: 6 },
      ]);
      return fixture;
    }

    it('usa la ruta del estudiante y resalta su empresa', () => {
      const fixture = montar();
      http.expectOne(`${ESTUDIANTE_SIMS}/41/clasificacion`).flush(respuesta());
      fixture.detectChanges();
      const mia = (fixture.nativeElement as HTMLElement).querySelector('.fila-mia');
      expect(mia?.textContent).toContain('Empresa 6');
      expect(mia?.textContent).toContain('Tu empresa');
    });

    it('400 "estará disponible cuando la simulación finalice" es informativo, no error', () => {
      const fixture = montar();
      http
        .expectOne(`${ESTUDIANTE_SIMS}/41/clasificacion`)
        .flush(
          { message: 'La clasificación estará disponible cuando la simulación finalice' },
          { status: 400, statusText: 'Bad Request' },
        );
      fixture.detectChanges();
      expect(fixture.componentInstance.estado()).toBe('no-disponible');
      expect((fixture.nativeElement as HTMLElement).querySelector('app-alerta')?.textContent).toContain(
        'estará disponible cuando la simulación finalice',
      );
    });

    it('400 "No participas en esta simulación" sí es un error', () => {
      const fixture = montar();
      http
        .expectOne(`${ESTUDIANTE_SIMS}/41/clasificacion`)
        .flush({ message: 'No participas en esta simulación' }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();
      expect(fixture.componentInstance.estado()).toBe('error');
      expect(fixture.componentInstance.mensaje()).toBe('No participas en esta simulación');
    });
  });
});
