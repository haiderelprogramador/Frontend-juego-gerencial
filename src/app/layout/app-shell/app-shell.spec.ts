import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { AppShell } from './app-shell';

describe('AppShell', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [AppShell],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
  });

  it('se crea y arranca con nav de estudiante (sin sesión de docente)', () => {
    const fixture = TestBed.createComponent(AppShell);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.componentInstance.esDocente()).toBe(false);
  });
});
