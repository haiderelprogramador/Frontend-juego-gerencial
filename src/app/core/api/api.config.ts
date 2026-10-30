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
     *  GET `/{id}/decisiones` -> DecisionEmpresa[] (una fila por empresa de la
     *  simulación, con `decidio`). Rol DOCENTE.
     *  Boletín (D14): PUT `/{id}/boletin` -> BoletinRequest ; GET -> Boletin o
     *  204 ; DELETE. Ver `disponible.boletin`.
     *  GET `/{id}/estados-empresas` -> EmpresaEstados[] = { idEmpresa,
     *  codigoEmpresa, nombre, inicial, final } (estados en `null` si todavía no
     *  existen). Responde en ngrok desde el 30-oct-2026; sin uso en la UI todavía.
     */
    casos: '/docente/casos',

    /**
     * Simulaciones (contrato 57 endpoints — SimulacionService). Rol DOCENTE.
     * También base de las rutas anidadas `/{id}/casos` y `/{id}/empresas`.
     *  GET/POST -> SimulacionRequest ; GET/PUT/DELETE `/{id}` ;
     *  POST `/{id}/programar|desprogramar|iniciar|finalizar` ; GET `/{id}/clasificacion`
     *  -> Clasificacion (cualquier estado; ClasificacionService) ;
     *  GET `/{id}/exportar` -> .xlsx (ver `disponible.exportar`).
     */
    simulacionesDocente: '/docente/simulaciones',
    /**
     * Empresas (mismo doc — EmpresaService). Rol DOCENTE.
     * GET/PUT/DELETE por id cuelgan de acá; el alta cuelga de
     * `simulacionesDocente/{id}/empresas`. También base de
     * `/{id}/integrantes` (IntegranteService) y de `/{id}/historia`
     * -> HistoriaCasoEmpresa[] (ver `disponible.historia`).
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
    /**
     * GET `/{idEmpresa}` -> MiEmpresa (con integrantes[]); 400 si no pertenece.
     * GET `/{idEmpresa}/historia` -> HistoriaCasoEmpresa[] (ver `disponible.historia`).
     */
    estudianteEmpresas: '/estudiante/empresas',
    /**
     * GET `/{id}` -> CasoEstudiante; 400 si el caso aún no es visible.
     * (El backend también expone GET `/{id}/boletin`, pero el portal ya no lo
     * usa: el boletín viene en `caso-actual`.)
     */
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
    /**
     * Boletín del caso (D14): publicado en develop y en ngrok (oct-2026). El
     * docente publica, edita y elimina el boletín desde Casos (`tieneBoletin`
     * de la lista dice si ya tiene). El portal del estudiante no depende de
     * este flag: usa `caso-actual.boletin`, que siempre viene (o `null`) desde
     * el 30-oct-2026. En `false`, Casos no muestra el botón.
     */
    boletin: true,
    /**
     * Historia por empresa (contrato B): GET /docente/empresas/{id}/historia y
     * GET /estudiante/empresas/{id}/historia. En develop y en ngrok desde el
     * 30-oct-2026 (doc API, sección "Estados financieros por empresa (D2)").
     * Reportes financieros la usa para el gráfico de evolución y como respaldo
     * cuando caso-actual responde 204. En `false`, no la pide.
     */
    historia: true,
    /**
     * GET /docente/simulaciones/{id}/exportar (.xlsx con Clasificación,
     * Estados por empresa y Decisiones). Probado en vivo contra develop el
     * 16-oct-2026 (simulación 61). En `false`, Clasificación no muestra
     * "Descargar Excel".
     */
    exportar: true,
  },
} as const;

/** Construye la URL absoluta de un endpoint del contrato. */
export function apiUrl(endpoint: string): string {
  return `${API_CONFIG.baseUrl}${endpoint}`;
}
