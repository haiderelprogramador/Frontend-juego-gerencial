import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { EstudianteService } from './estudiante.service';

describe('EstudianteService (mock)', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
  });

  it('el "backend" simulado genera la contraseña con patrón USU-###-<identificación>', async () => {
    const service = TestBed.inject(EstudianteService);

    const res = await firstValueFrom(
      service.cargaMasiva({
        estudiantes: [
          {
            nombre: 'Juan Pérez',
            correo: 'juan@uni.edu',
            numeroIdentificacion: '1094567890',
            edad: '22',
            genero: 'Masculino',
            columnasAdicionales: {},
          },
        ],
      }),
    );

    expect(res.creados).toHaveLength(1);
    expect(res.creados[0].contrasenaGenerada).toBe('USU-001-1094567890');
    expect(res.errores).toHaveLength(0);
  });

  it('rechaza correos duplicados contra los ya cargados', async () => {
    const service = TestBed.inject(EstudianteService);
    const fila = {
      nombre: 'Ana Gómez',
      correo: 'ana@uni.edu',
      numeroIdentificacion: '1032654987',
      edad: '19',
      genero: 'Femenino',
      columnasAdicionales: {},
    };

    await firstValueFrom(service.cargaMasiva({ estudiantes: [fila] }));
    const segunda = await firstValueFrom(service.cargaMasiva({ estudiantes: [fila] }));

    expect(segunda.creados).toHaveLength(0);
    expect(segunda.errores[0].correo).toBe('ana@uni.edu');
  });
});
