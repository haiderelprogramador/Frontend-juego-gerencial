import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { API_CONFIG, apiUrl } from '../../../core/api/api.config';
import { Integrante } from '../integrantes/models/integrante.model';
import { Empresa } from './models/empresa.model';
import { Empresas } from './empresas';

const SIMS = apiUrl(API_CONFIG.endpoints.simulacionesDocente);
const EMPRESAS = apiUrl(API_CONFIG.endpoints.empresasDocente);
const ESTUDIANTES = apiUrl(API_CONFIG.endpoints.estudiantes);

function empresa(id: number, tipoJugador: Empresa['tipoJugador'] = 'MULTIUSUARIO'): Empresa {
  return { id, idSimulacion: 1, codigoEmpresa: `EMP-00${id}`, nombre: `Empresa ${id}`, estrategia: '', tipoJugador, estado: 'ACTIVA' };
}

/** `id` (del Integrante) a propósito distinto de `idUsuario` (del estudiante). */
function integrante(idEmpresa: number, idUsuario: number, esLider = false): Integrante {
  return {
    id: 900 + idUsuario,
    idEmpresa,
    idUsuario,
    nombre: `Estudiante ${idUsuario}`,
    correo: `e${idUsuario}@uni.edu`,
    numeroIdentificacion: String(idUsuario),
    departamento: 'GERENCIA_GENERAL',
    esLider,
  };
}

describe.runIf(!API_CONFIG.demoMode && API_CONFIG.disponible.listarEstudiantes)('Empresas', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Empresas],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({ simulacion: '1' })) } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Simulación 1 (PROGRAMADA) con EMP-001 multiusuario (estudiante 10) y EMP-002 monousuario (estudiante 20). */
  function montar() {
    const fixture = TestBed.createComponent(Empresas);
    fixture.detectChanges();
    http.expectOne(SIMS).flush([
      { id: 1, idUsuarioCoordinador: 9, nombre: 'Sim', fechaInicio: '', fechaFin: '', estado: 'PROGRAMADA' },
    ]);
    http.expectOne(ESTUDIANTES).flush([10, 20, 30].map((id) => ({ id, nombre: `Estudiante ${id}` })));
    http.expectOne(`${SIMS}/1/empresas`).flush([empresa(1), empresa(2, 'MONOUSUARIO')]);
    http.expectOne(`${EMPRESAS}/1/integrantes`).flush([integrante(1, 10, true)]);
    http.expectOne(`${EMPRESAS}/2/integrantes`).flush([integrante(2, 20, true)]);
    fixture.detectChanges();
    return fixture;
  }

  it('carga las empresas e integrantes de la simulación de la URL', () => {
    const cmp = montar().componentInstance;
    expect(cmp.empresas().map((e) => e.codigoEmpresa)).toEqual(['EMP-001', 'EMP-002']);
    expect(cmp.editable()).toBe(true);
  });

  it('solo ofrece estudiantes que no están en ninguna empresa de la simulación', () => {
    const cmp = montar().componentInstance;
    expect(cmp.disponibles().map((e) => e.id)).toEqual(['30']);
  });

  it('MONOUSUARIO con su integrante no permite agregar otro (sin formulario en la tarjeta)', () => {
    const fixture = montar();
    const cmp = fixture.componentInstance;
    expect(cmp.puedeAgregar(cmp.empresas()[0])).toBe(true);
    expect(cmp.puedeAgregar(cmp.empresas()[1])).toBe(false);
    const tarjetas = (fixture.nativeElement as HTMLElement).querySelectorAll('.empresa');
    expect(tarjetas[0].querySelector('.agregar')).not.toBeNull();
    expect(tarjetas[1].querySelector('.agregar')).toBeNull();
    expect(tarjetas[1].textContent).toContain('ya tiene su único integrante');
  });

  it('crear empresa no manda codigoEmpresa y por defecto es MULTIUSUARIO', () => {
    const cmp = montar().componentInstance;
    cmp.nuevaEmpresa();
    cmp.actualizarFormEmpresa({ nombre: '  Cóndor  ' });
    cmp.guardarEmpresa();
    const req = http.expectOne({ method: 'POST', url: `${SIMS}/1/empresas` });
    expect(req.request.body).toEqual({ nombre: 'Cóndor', tipoJugador: 'MULTIUSUARIO' });
    req.flush(empresa(3));
    expect(cmp.empresas().length).toBe(3);
  });

  it('agregar integrante manda el id del ESTUDIANTE como número', () => {
    const cmp = montar().componentInstance;
    cmp.actualizarFormIntegrante(1, { idUsuario: '30', departamento: 'COMERCIAL', esLider: true });
    cmp.agregarIntegrante(cmp.empresas()[0]);
    const req = http.expectOne({ method: 'POST', url: `${EMPRESAS}/1/integrantes` });
    expect(req.request.body).toEqual({ idUsuario: 30, departamento: 'COMERCIAL', esLider: true });
    req.flush(integrante(1, 30, true));
    http.expectOne(`${EMPRESAS}/1/integrantes`).flush([integrante(1, 10), integrante(1, 30, true)]);
    expect(cmp.disponibles()).toEqual([]);
  });

  it('hacer líder y quitar usan idUsuario (estudiante), no el id del integrante', () => {
    const cmp = montar().componentInstance;
    const ana = integrante(1, 10);
    cmp.hacerLider(1, ana);
    http.expectOne({ method: 'PUT', url: `${EMPRESAS}/1/integrantes/10/lider` }).flush(ana);
    http.expectOne(`${EMPRESAS}/1/integrantes`).flush([integrante(1, 10, true)]);

    cmp.quitarIntegrante(1, ana);
    http.expectOne({ method: 'DELETE', url: `${EMPRESAS}/1/integrantes/10` }).flush(null);
    http.expectOne(`${EMPRESAS}/1/integrantes`).flush([]);
    expect(cmp.disponibles().map((e) => e.id)).toEqual(['10', '30']);
  });

  it('marca "Sin líder" si la empresa tiene integrantes pero ninguno es líder', () => {
    const cmp = montar().componentInstance;
    expect(cmp.sinLider(1)).toBe(false);
    cmp.integrantes.update((m) => ({ ...m, 1: [integrante(1, 10)] }));
    expect(cmp.sinLider(1)).toBe(true);
  });

  it('muestra en la tarjeta el 400 del backend', () => {
    const fixture = montar();
    const cmp = fixture.componentInstance;
    cmp.actualizarFormIntegrante(1, { idUsuario: '30' });
    cmp.agregarIntegrante(cmp.empresas()[0]);
    http
      .expectOne({ method: 'POST', url: `${EMPRESAS}/1/integrantes` })
      .flush({ message: 'El estudiante ya pertenece a otra empresa' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(cmp.erroresEmpresa()[1]).toBe('El estudiante ya pertenece a otra empresa');
    expect(cmp.ocupado()).toBe(false);
  });
});
