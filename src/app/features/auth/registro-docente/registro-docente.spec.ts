import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { RegistroDocente } from './registro-docente';

describe('RegistroDocente', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegistroDocente],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
  });

  it('rechaza un número de identificación con letras', () => {
    const fixture = TestBed.createComponent(RegistroDocente);
    fixture.componentInstance.form.patchValue({ numeroIdentificacion: 'ABC123' });
    expect(fixture.componentInstance.form.controls.numeroIdentificacion.valid).toBe(false);
  });

  it('acepta datos completos y válidos', () => {
    const fixture = TestBed.createComponent(RegistroDocente);
    fixture.componentInstance.form.setValue({
      nombre: 'Ana Docente',
      correo: 'ana@uni.edu',
      numeroIdentificacion: '1094567890',
      contrasena: 'claveSegura1',
    });
    expect(fixture.componentInstance.form.valid).toBe(true);
  });

  it('el botón de mostrar/ocultar contraseña alterna el tipo del input sin afectar la validez', () => {
    const fixture = TestBed.createComponent(RegistroDocente);
    const cmp = fixture.componentInstance;
    cmp.form.setValue({
      nombre: 'Ana Docente',
      correo: 'ana@uni.edu',
      numeroIdentificacion: '1094567890',
      contrasena: 'claveSegura1',
    });
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
    expect(cmp.form.valid).toBe(true);
  });

  it('ofrece el enlace de navegación cruzada hacia el login', () => {
    const fixture = TestBed.createComponent(RegistroDocente);
    fixture.detectChanges();
    const link = (fixture.nativeElement as HTMLElement).querySelector(
      '.form__switch a',
    ) as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/auth/login');
  });
});
