import { TestBed } from '@angular/core/testing';

import { DesignSystem } from './design-system';

describe('DesignSystem', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DesignSystem] }).compileComponents();
  });

  it('renderiza los swatches de color y los bloques de botones/badges', () => {
    const fixture = TestBed.createComponent(DesignSystem);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('.swatch').length).toBeGreaterThanOrEqual(9);
    expect(host.querySelectorAll('.btn').length).toBeGreaterThanOrEqual(6);
    expect(host.querySelectorAll('app-badge').length).toBeGreaterThanOrEqual(7);
  });
});
