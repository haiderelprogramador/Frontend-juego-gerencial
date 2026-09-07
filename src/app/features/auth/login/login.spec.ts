import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { Login } from './login';

describe('Login', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([]), provideHttpClient()],
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
});
