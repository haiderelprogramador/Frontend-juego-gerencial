/**
 * Contrato de API contra el que se escriben todos los servicios.
 *
 * El backend en Spring Boot todavía NO existe. Mientras `demoMode` sea `true`,
 * los servicios responden con datos simulados en memoria / localStorage, pero
 * respetando exactamente estas rutas y la forma de los DTOs. Cuando el backend
 * esté listo: poner `demoMode` en `false` (o leerlo de un environment) y las
 * mismas rutas se usan contra el servidor real, sin reescribir los servicios.
 */
export const API_CONFIG = {
  /** Prefijo común. En producción será algo como `https://<host>/api`. */
  baseUrl: '/api',

  /** true = respuestas simuladas; false = HttpClient real contra Spring Boot. */
  demoMode: true,

  /** Latencia simulada (ms) para que el flujo demo se sienta como red real. */
  demoLatenciaMs: 400,

  endpoints: {
    /** POST -> LoginRequest ; 200 -> AuthResponse ; 401 si credenciales inválidas. */
    login: '/auth/login',
    /** POST -> RegistroDocenteRequest ; 201 -> AuthResponse ; 409 si el correo ya existe. */
    registroDocente: '/auth/registro-docente',
    /** GET (con Bearer token) -> { usuario: Usuario } ; 401 si el token no es válido. */
    sesion: '/auth/sesion',

    /**
     * POST (rol DOCENTE) -> CargaMasivaRequest ; 200 -> CargaMasivaResponse.
     * El backend regenera/valida las contraseñas del lado servidor; el frontend
     * solo manda los datos extraídos del Excel y muestra una previsualización.
     */
    estudiantesCargaMasiva: '/docente/estudiantes/carga-masiva',
    /** GET (rol DOCENTE) -> EstudianteCargado[] : estudiantes ya cargados por el docente. */
    estudiantes: '/docente/estudiantes',
  },
} as const;

/** Construye la URL absoluta de un endpoint del contrato. */
export function apiUrl(endpoint: string): string {
  return `${API_CONFIG.baseUrl}${endpoint}`;
}
