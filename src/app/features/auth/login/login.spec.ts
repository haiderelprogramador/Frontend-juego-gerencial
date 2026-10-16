import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { Login } from './login';

describe('Login', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      // Backend simulado: ningún test sale a ngrok (ni siquiera el que envía el formulario).
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('el formulario arranca inválido (vacío)', () => {
    const fixture = TestBed.createComponent(Login);
    expect(fixture.componentInstance.form.invalid).toBe(true);
  });

  it('el formulario es válido con correo y contraseña', () => {
    const fixture = TestBed.createComponent(Login);
    fixture.componentInstance.form.setValue({
      correo: 'docente@demo.com',
      contrasena: 'demo1234',
    });
    expect(fixture.componentInstance.form.valid).toBe(true);
  });

  it('el botón de mostrar/ocultar contraseña alterna el tipo del input sin afectar la validez', () => {
    const fixture = TestBed.createComponent(Login);
    const cmp = fixture.componentInstance;
    cmp.form.setValue({ correo: 'docente@demo.com', contrasena: 'demo1234' });
    fixture.detectChanges();

    const input = (fixture.nativeElement as HTMLElement).querySelector(
      'input[formControlName="contrasena"]',
    ) as HTMLInputElement;
    const toggle = (fixture.nativeElement as HTMLElement).querySelector(
      '.field__toggle',
    ) as HTMLButtonElement;

    expect(input.type).toBe('password');

    toggle.click();
    fixture.detectChanges();
    expect(cmp.verContrasena()).toBe(true);
    expect(input.type).toBe('text');

    toggle.click();
    fixture.detectChanges();
    expect(input.type).toBe('password');

    // El toggle no toca el formulario.
    expect(cmp.form.valid).toBe(true);
  });

  it('ofrece el enlace de navegación cruzada hacia el registro', () => {
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    const link = (fixture.nativeElement as HTMLElement).querySelector(
      '.form__switch a',
    ) as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/auth/registro-docente');
  });

  describe('aviso de sesión vencida', () => {
    function crearCon(queryParams: Record<string, string>) {
      TestBed.overrideProvider(ActivatedRoute, {
        useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } },
      });
      const fixture = TestBed.createComponent(Login);
      fixture.detectChanges();
      return fixture;
    }

    it('con ?motivo=sesion-vencida muestra "Tu sesión venció. Inicia sesión de nuevo."', () => {
      const fixture = crearCon({ motivo: 'sesion-vencida', returnUrl: '/docente/casos' });
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Tu sesión venció. Inicia sesión de nuevo.');
    });

    it('sin ese motivo no muestra el aviso', () => {
      const fixture = crearCon({});
      expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Tu sesión venció');
    });

    it('al volver a intentar entrar, el aviso se va', () => {
      const fixture = crearCon({ motivo: 'sesion-vencida' });
      fixture.componentInstance.form.setValue({ correo: 'docente@demo.com', contrasena: 'demo1234' });
      fixture.componentInstance.enviar();
      fixture.detectChanges();
      expect(fixture.componentInstance.sesionVencida()).toBe(false);
      TestBed.inject(HttpTestingController).match(() => true);
    });
  });
});
