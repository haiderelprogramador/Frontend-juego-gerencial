import { TestBed } from '@angular/core/testing';

import { Badge } from './badge';

describe('Badge', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Badge] }).compileComponents();
  });

  it('aplica la clase de la variante y proyecta el contenido', () => {
    const fixture = TestBed.createComponent(Badge);
    fixture.componentRef.setInput('variante', 'pendiente');
    fixture.detectChanges();
    const el = (fixture.nativeElement as HTMLElement).querySelector('.badge')!;
    expect(el.classList).toContain('badge--pendiente');
  });
});
