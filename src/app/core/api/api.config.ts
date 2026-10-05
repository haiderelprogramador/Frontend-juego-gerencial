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
  /**
   * Prefijo común.
   *
   * 🎨 Apuntando temporalmente al backend real expuesto por un compañero vía
   * ngrok, para probar el flujo end-to-end. Para volver a modo demo: poner
   * `baseUrl` en `/api` y `demoMode` en `true`.
   */
  baseUrl: 'https://unnatural-resonate-gift.ngrok-free.dev/api',

  /** true = respuestas simuladas; false = HttpClient real contra Spring Boot. */
  demoMode: false,

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
     * POST (con Bearer token) -> CambiarContrasenaRequest ; 200 -> { message }.
     * 400 si la nueva no cumple las reglas del registro o es igual a la actual;
     * 401 "La contraseña actual es incorrecta" — ese 401 NO significa token
     * vencido: nada debe cerrar sesión por él.
     */
    cambiarContrasena: '/auth/cambiar-contrasena',

    /**
     * POST (rol DOCENTE) -> CargaMasivaRequest ; 200 -> CargaMasivaResponse.
     * El backend regenera/valida las contraseñas del lado servidor; el frontend
     * solo manda los datos extraídos del Excel y muestra una previsualización.
     */
    estudiantesCargaMasiva: '/docente/estudiantes/carga-masiva',
    /** GET (rol DOCENTE) -> EstudianteCargado[] : estudiantes ya cargados por el docente. */
    estudiantes: '/docente/estudiantes',


    /**
     * Casos (API Estratego, 57 endpoints, doc 28-sep-2026 — CasoApiService):
     *  GET / POST -> CasoRequest ; GET/PUT/DELETE `/{id}` ; POST `/{id}/activar`
     *  GET `/{id}/decisiones` -> DecisionEmpresa[]. Rol DOCENTE.
     */
    casos: '/docente/casos',

    /**
     * Simulaciones (contrato 57 endpoints — SimulacionService). Rol DOCENTE.
     * También base de las rutas anidadas `/{id}/casos` y `/{id}/empresas`.
     *  GET/POST -> SimulacionRequest ; GET/PUT/DELETE `/{id}` ;
     *  POST `/{id}/programar|iniciar|finalizar` ; GET `/{id}/clasificacion`
     *  -> Clasificacion (cualquier estado; ClasificacionService).
     */
    simulacionesDocente: '/docente/simulaciones',
    /**
     * Empresas (mismo doc — EmpresaService). Rol DOCENTE.
     * GET/PUT/DELETE por id cuelgan de acá; el alta cuelga de
     * `simulacionesDocente/{id}/empresas`. También base de
     * `/{id}/integrantes` (IntegranteService).
     */
    empresasDocente: '/docente/empresas',

    /**
     * Portal del estudiante (mismo doc — PortalEstudianteService). Rol ESTUDIANTE.
     *  GET `?idSimulacion=` -> CasoActual, 200 o 204 si no hay caso activo visible.
     */
    estudianteCasoActual: '/estudiante/caso-actual',
    /** POST {idCaso, idOpcion} -> Decision (201). La toma el líder, una vez por empresa/caso. */
    estudianteDecision: '/estudiante/decision',
    /**
     * GET -> MiSimulacion[] (la más reciente primero).
     * GET `/{id}/clasificacion` -> Clasificacion, solo con la simulación
     * FINALIZADA (400 antes, o si el estudiante no participa).
     */
    estudianteSimulaciones: '/estudiante/simulaciones',
    /** GET `/{idEmpresa}` -> MiEmpresa (con integrantes[]); 400 si no pertenece. */
    estudianteEmpresas: '/estudiante/empresas',
    /** GET `/{id}` -> CasoEstudiante; 400 si el caso aún no es visible. */
    estudianteCasos: '/estudiante/casos',
  },

  /**
   * Endpoints del contrato que el backend TODAVÍA NO expone. Mientras estén en
   * `false`, el frontend usa un respaldo en vez de llamarlos. Cuando Camilo
   * los active, se cambian a `true` aquí y listo.
   */
  disponible: {
    /** GET /docente/estudiantes — confirmado funcionando (53/53 endpoints probados, 29-sep-2026). */
    listarEstudiantes: true,
  },
} as const;

/** Construye la URL absoluta de un endpoint del contrato. */
export function apiUrl(endpoint: string): string {
  return `${API_CONFIG.baseUrl}${endpoint}`;
}
