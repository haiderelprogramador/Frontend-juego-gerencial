import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { ngrokSkipWarningInterceptor } from './core/interceptors/ngrok-skip-warning.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // HttpClient queda listo para el backend real; el interceptor adjunta el
    // token cuando exista sesión. ngrokSkipWarningInterceptor es solo para
    // las pruebas contra el túnel ngrok (ver ese archivo para quitarlo).
    provideHttpClient(withInterceptors([authInterceptor, ngrokSkipWarningInterceptor])),
  ],
};
