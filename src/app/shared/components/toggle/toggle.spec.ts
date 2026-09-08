import { TestBed } from '@angular/core/testing';

import { Toggle } from './toggle';

describe('Toggle', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Toggle] }).compileComponents();
  });

  it('alterna el valor al hacer click y no lo hace si está disabled', () => {
    const fixture = TestBed.createComponent(Toggle);
    const btn = () => (fixture.nativeElement as HTMLElement).querySelector('.toggle') as HTMLButtonElement;

    fixture.detectChanges();
    btn().click();
    expect(fixture.componentInstance.valor()).toBe(true);

    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    btn().click();
    expect(fixture.componentInstance.valor()).toBe(true);
  });
});
