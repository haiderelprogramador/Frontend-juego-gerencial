import { TestBed } from '@angular/core/testing';

import { CasoService } from './caso.service';
import { CasoFormulario } from '../models/caso.model';

function casoDePrueba(nombre: string): CasoFormulario {
  return {
    nombre,
    tipo: 'Servicios',
    estado: 'borrador',
    mision: '',
    vision: '',
    penalizacionMin: 1,
    penalizacionMax: 3,
    fechaVisualizacion: '',
    fechaInicioPartida: '',
    fechaFinPartida: '',
    asignacionEquipos: 'automatica',
    financiero: { activoTotal: '', pasivoTotal: '', patrimonio: '', utilidadNeta: '' },
    opciones: [],
  };
}

describe('CasoService', () => {
  let service: CasoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CasoService);
  });

  it('arranca con un caso activo sembrado (el que ve el estudiante)', () => {
    expect(service.casos().length).toBeGreaterThan(0);
    expect(service.casoActivo()?.estado).toBe('activo');
  });

  it('crear() agrega un caso nuevo a la lista', () => {
    const totalAntes = service.casos().length;
    const nuevo = service.crear(casoDePrueba('Caso de prueba'));

    expect(service.casos()).toHaveLength(totalAntes + 1);
    expect(service.obtener(nuevo.id)?.nombre).toBe('Caso de prueba');
  });

  it('actualizar() modifica el caso existente sin duplicarlo', () => {
    const totalAntes = service.casos().length;
    const nuevo = service.crear(casoDePrueba('Original'));

    service.actualizar(nuevo.id, { ...casoDePrueba('Editado'), estado: 'borrador' });

    expect(service.casos()).toHaveLength(totalAntes + 1);
    expect(service.obtener(nuevo.id)?.nombre).toBe('Editado');
  });

  it('activar() deja un solo caso activo a la vez', () => {
    const nuevo = service.crear(casoDePrueba('Segundo caso'));
    service.activar(nuevo.id);

    const activos = service.casos().filter((c) => c.estado === 'activo');
    expect(activos).toHaveLength(1);
    expect(activos[0].id).toBe(nuevo.id);
    expect(service.casoActivo()?.id).toBe(nuevo.id);
  });
});
