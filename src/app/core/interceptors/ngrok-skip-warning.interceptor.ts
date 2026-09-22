import { HttpInterceptorFn } from '@angular/common/http';

/**
 * 🎨 Solo para las pruebas contra el backend expuesto por ngrok (docs/07,
 * `API_CONFIG.baseUrl`): en el plan gratuito, ngrok intercepta las peticiones
 * con una página HTML de advertencia (incluso las de API), y sin este header
 * HttpClient recibe ese HTML en vez del JSON esperado y todo falla al
 * parsear. Quitar este interceptor (y su registro en app.config.ts) cuando
 * se deje de usar ngrok.
 */
export const ngrokSkipWarningInterceptor: HttpInterceptorFn = (req, next) =>
  next(req.clone({ setHeaders: { 'ngrok-skip-browser-warning': 'true' } }));
