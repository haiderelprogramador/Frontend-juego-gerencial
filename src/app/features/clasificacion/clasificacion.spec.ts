import { TestBed } from '@angular/core/testing';

import { Clasificacion } from './clasificacion';

describe('Clasificacion', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Clasificacion] }).compileComponents();
  });

  it('alterna entre ranking y estado vacío', () => {
    const fixture = TestBed.createComponent(Clasificacion);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('.podio')).toBeTruthy();
    expect(host.querySelector('.vacio')).toBeNull();

    fixture.componentInstance.alternarVacio();
    fixture.detectChanges();
    expect(host.querySelector('.podio')).toBeNull();
    expect(host.querySelector('.vacio')).toBeTruthy();
  });
});
