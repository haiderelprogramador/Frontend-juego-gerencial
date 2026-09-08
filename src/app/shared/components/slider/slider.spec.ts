import { TestBed } from '@angular/core/testing';

import { Slider } from './slider';

describe('Slider', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Slider] }).compileComponents();
  });

  it('muestra el valor con prefijo/sufijo', () => {
    const fixture = TestBed.createComponent(Slider);
    fixture.componentRef.setInput('valor', 1200);
    fixture.componentRef.setInput('prefijo', '$');
    fixture.detectChanges();
    const val = (fixture.nativeElement as HTMLElement).querySelector('.slider__value')!;
    expect(val.textContent).toMatch(/\$\s*1[.,]?200/);
  });
});
