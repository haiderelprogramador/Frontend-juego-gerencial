import { TestBed } from '@angular/core/testing';

import { TomaDecisiones } from './toma-decisiones';

describe('TomaDecisiones', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TomaDecisiones] }).compileComponents();
  });

  it('renderiza las tres áreas de decisión', () => {
    const fixture = TestBed.createComponent(TomaDecisiones);
    fixture.detectChanges();
    const areas = (fixture.nativeElement as HTMLElement).querySelectorAll('.area');
    expect(areas).toHaveLength(3);
  });
});
