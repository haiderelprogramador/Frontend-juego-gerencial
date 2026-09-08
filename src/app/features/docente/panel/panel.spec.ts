import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Panel } from './panel';

describe('Panel', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Panel],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('arranca en la tab "Control de periodos" y puede cambiar de tab', () => {
    const fixture = TestBed.createComponent(Panel);
    fixture.detectChanges();
    expect(fixture.componentInstance.tab()).toBe('periodos');
    expect((fixture.nativeElement as HTMLElement).querySelector('.periodos')).toBeTruthy();

    fixture.componentInstance.irA('casos');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.placeholder')).toBeTruthy();
  });
});
