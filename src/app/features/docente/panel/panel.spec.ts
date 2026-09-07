import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { Panel } from './panel';

describe('Panel', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Panel],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
  });

  it('se crea', () => {
    const fixture = TestBed.createComponent(Panel);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
