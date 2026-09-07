import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { MainLayout } from './main-layout';

describe('MainLayout', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MainLayout],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
  });

  it('se crea', () => {
    const fixture = TestBed.createComponent(MainLayout);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
