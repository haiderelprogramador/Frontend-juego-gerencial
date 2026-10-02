#!/usr/bin/env node
/**
 * Pruebas de integración REALES (sin mocks) contra el backend Estratego, vía
 * el túnel ngrok configurado en `src/app/core/api/api.config.ts`.
 *
 * Estrategia para no ensuciar la base de desarrollo:
 *  - Reusa la cuenta docente y los dos estudiantes de prueba ya guardados en
 *    `.env.test` (gitignored, ver `.env.test.example`) en vez de crear
 *    cuentas nuevas cada corrida.
 *  - Reusa una simulación PROGRAMADA que ya haya quedado de una corrida
 *    anterior (`TEST_ID_SIMULACION`, con su empresa y caso ya armados) para
 *    probar el flujo completo iniciar→decidir, en vez de crear una nueva.
 *  - El resto de los endpoints de Simulaciones/Empresas/Integrantes que no
 *    se ejercen en ese flujo (actualizar, eliminar) se prueban sobre una
 *    simulación DESCARTABLE que este script crea y borra por completo al
 *    final (cascada: integrante → empresa → simulación), así no queda
 *    basura nueva en la base.
 *
 * Uso:  node scripts/integration/estratego-api.integration.mjs
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as XLSX from 'xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_FILE = join(__dirname, '..', '..', '.env.test');

// ---------------------------------------------------------------------------
// .env.test — lectura/escritura mínima, sin dependencias nuevas
// ---------------------------------------------------------------------------

function leerEnvTest() {
  if (!existsSync(ENV_FILE)) return {};
  const contenido = readFileSync(ENV_FILE, 'utf-8');
  const vars = {};
  for (const linea of contenido.split('\n')) {
    const l = linea.trim();
    if (!l || l.startsWith('#')) continue;
    const idx = l.indexOf('=');
    if (idx === -1) continue;
    vars[l.slice(0, idx).trim()] = l.slice(idx + 1).trim();
  }
  return vars;
}

function escribirEnvTest(vars) {
  const contenido =
    '# Generado por scripts/integration/estratego-api.integration.mjs — NO commitear (ver .gitignore)\n' +
    Object.entries(vars)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n') +
    '\n';
  writeFileSync(ENV_FILE, contenido, 'utf-8');
}

const env = leerEnvTest();
const BASE_URL = env.API_BASE_URL || 'https://unnatural-resonate-gift.ngrok-free.dev/api';
const SUFIJO = env.TEST_RUN_ID || String(Date.now());

// ---------------------------------------------------------------------------
// Cliente HTTP mínimo
// ---------------------------------------------------------------------------

async function pedir(method, path, { token, body, form } = {}) {
  const headers = { 'ngrok-skip-browser-warning': 'true' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE_URL}${path}`, { method, headers, body: payload });
  const texto = await res.text();
  let data = null;
  if (texto) {
    try {
      data = JSON.parse(texto);
    } catch {
      data = texto;
    }
  }
  return { status: res.status, ok: res.ok, data };
}

// ---------------------------------------------------------------------------
// Reporte final
// ---------------------------------------------------------------------------

const filas = [];
function reportar(endpoint, probado, resultado) {
  filas.push({ endpoint, probado, resultado });
  console.log(`${probado ? '✅' : '⏭️'} ${endpoint} — ${resultado}`);
}

function ok(res) {
  return `${res.status} ${res.status >= 400 ? JSON.stringify(res.data) : ''}`.trim();
}

function esperado(res, cuandoOk) {
  return `${res.status} ${res.ok === cuandoOk ? '✔' : '✘ NO esperado'}`;
}

function assert(cond, mensaje) {
  if (!cond) throw new Error(mensaje);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * ⚠️ Bug confirmado en vivo (29-sep-2026): el backend NO convierte fechas con
 * `Z`/offset a hora de Colombia para `fechaVisualizacion`/`fechaInicioPartida`/
 * `fechaFinPartida` del Caso — solo les quita el sufijo de zona y guarda los
 * mismos dígitos de reloj tal cual (los deja ~5h adelantados respecto a la
 * hora real de Bogotá, bloqueando `/estudiante/decision` con "La partida aún
 * no ha iniciado" aunque el caso esté activo y la simulación EN_CURSO).
 * Mientras el backend no lo corrija de verdad: mandarle la hora de Bogotá ya
 * calculada, SIN sufijo de zona. `SimulacionRequest.fechaInicio/fechaFin` NO
 * tiene este bug (probado: `/programar` e `/iniciar` funcionan bien con
 * `.toISOString()`), así que esta función es solo para fechas de Caso.
 */
function bogotaISO(offsetMs = 0) {
  const real = Date.now() + offsetMs;
  return new Date(real - 5 * 3600_000).toISOString().replace('Z', '');
}

// ---------------------------------------------------------------------------
// Helper: construye un .xlsx de 1 fila en memoria para carga masiva
// ---------------------------------------------------------------------------

function excelDeUnEstudiante({ correo, nombre, numeroIdentificacion, edad, genero }) {
  const hoja = XLSX.utils.json_to_sheet([
    { correo, nombre, 'numero de identificacion': numeroIdentificacion, edad, genero },
  ]);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Hoja1');
  const buffer = XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' });
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

async function crearEstudiante(tokenDocente, datos) {
  const form = new FormData();
  form.append('archivo', excelDeUnEstudiante(datos), 'estudiante.xlsx');
  const res = await pedir('POST', '/docente/estudiantes/carga-masiva', { token: tokenDocente, form });
  assert(res.ok, `carga-masiva de estudiante falló: ${res.status} ${JSON.stringify(res.data)}`);
  const creado = res.data.creados?.[0];
  assert(creado, `carga-masiva no creó al estudiante: ${JSON.stringify(res.data)}`);
  return creado; // { id, correo, contrasenaGenerada, ... }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Backend: ${BASE_URL}\n`);
  const ahora = Date.now();

  // --- Cuenta de prueba: DOCENTE (registro solo si no hay una guardada) -----
  let docenteCorreo = env.TEST_DOCENTE_CORREO;
  let docentePass = env.TEST_DOCENTE_PASSWORD;
  let tokenDocente;

  if (docenteCorreo && docentePass) {
    const login = await pedir('POST', '/auth/login', { body: { correo: docenteCorreo, contrasena: docentePass } });
    assert(login.ok, `login de docente de prueba existente falló: ${login.status}`);
    tokenDocente = login.data.token;
    reportar('POST /auth/login (docente)', true, `200 — reusando cuenta ${docenteCorreo}`);
  } else {
    docenteCorreo = `integracion.docente.${SUFIJO}@estratego-test.local`;
    docentePass = `Test${SUFIJO}!Aa1`;
    const registro = await pedir('POST', '/auth/registro-docente', {
      body: {
        nombre: 'Docente Integración',
        correo: docenteCorreo,
        numeroIdentificacion: `TESTDOC${SUFIJO}`.slice(0, 15),
        contrasena: docentePass,
      },
    });
    assert(registro.ok, `registro de docente falló: ${registro.status} ${JSON.stringify(registro.data)}`);
    tokenDocente = registro.data.token;
    reportar('POST /auth/registro-docente', true, `201 — cuenta nueva ${docenteCorreo}`);
  }

  const sesionDocente = await pedir('GET', '/auth/sesion', { token: tokenDocente });
  reportar('GET /auth/sesion', true, ok(sesionDocente) || `200 — ${sesionDocente.data?.usuario?.correo}`);

  // --- Estudiantes de prueba (líder + un integrante raso), reusados si ya existen --
  let estudianteLider = env.TEST_ESTUDIANTE_LIDER_CORREO
    ? {
        correo: env.TEST_ESTUDIANTE_LIDER_CORREO,
        contrasenaGenerada: env.TEST_ESTUDIANTE_LIDER_PASSWORD,
        id: env.TEST_ESTUDIANTE_LIDER_ID,
      }
    : null;
  if (!estudianteLider) {
    estudianteLider = await crearEstudiante(tokenDocente, {
      correo: `integracion.lider.${SUFIJO}@estratego-test.local`,
      nombre: 'Estudiante Lider Integración',
      numeroIdentificacion: `9${SUFIJO}`.slice(0, 15),
      edad: '20',
      genero: 'F',
    });
  }
  reportar('POST /docente/estudiantes/carga-masiva (líder)', true, `estudiante ${estudianteLider.correo} (id ${estudianteLider.id})`);

  let estudianteRaso = env.TEST_ESTUDIANTE_RASO_CORREO
    ? {
        correo: env.TEST_ESTUDIANTE_RASO_CORREO,
        contrasenaGenerada: env.TEST_ESTUDIANTE_RASO_PASSWORD,
        id: env.TEST_ESTUDIANTE_RASO_ID,
      }
    : null;
  if (!estudianteRaso) {
    estudianteRaso = await crearEstudiante(tokenDocente, {
      correo: `integracion.raso.${SUFIJO}@estratego-test.local`,
      nombre: 'Estudiante Raso Integración',
      numeroIdentificacion: `8${SUFIJO}`.slice(0, 15),
      edad: '21',
      genero: 'M',
    });
  }
  reportar('POST /docente/estudiantes/carga-masiva (raso)', true, `estudiante ${estudianteRaso.correo} (id ${estudianteRaso.id})`);

  // =============================================================================
  // FASE A — reusa una simulación PROGRAMADA de una corrida anterior (con su
  // empresa/integrantes/caso ya armados) para probar iniciar→decidir sin
  // crear entidades nuevas.
  // =============================================================================

  let idSimulacion = env.TEST_ID_SIMULACION ? Number(env.TEST_ID_SIMULACION) : null;
  let idEmpresa = env.TEST_ID_EMPRESA ? Number(env.TEST_ID_EMPRESA) : null;
  let idCaso = env.TEST_ID_CASO ? Number(env.TEST_ID_CASO) : null;
  let idOpcionA = null;

  if (idSimulacion) {
    const obtenerSim = await pedir('GET', `/docente/simulaciones/${idSimulacion}`, { token: tokenDocente });
    reportar('GET /docente/simulaciones/{id} (reusando de corrida anterior)', true, `${obtenerSim.status} — estado ${obtenerSim.data?.estado}`);
    if (!obtenerSim.ok || obtenerSim.data?.estado === 'FINALIZADA') {
      idSimulacion = null; // ya no sirve, se crea una nueva más abajo
    }
  }

  if (!idSimulacion) {
    const crearSim = await pedir('POST', '/docente/simulaciones', {
      token: tokenDocente,
      body: { nombre: `Simulación integración ${SUFIJO}`, fechaInicio: new Date(ahora + 5_000).toISOString(), fechaFin: new Date(ahora + 7 * 86_400_000).toISOString() },
    });
    reportar('POST /docente/simulaciones', true, `${crearSim.status} — id ${crearSim.data?.id}`);
    assert(crearSim.ok, 'no se pudo crear la simulación — se cancela el resto del flujo');
    idSimulacion = crearSim.data.id;

    const programar = await pedir('POST', `/docente/simulaciones/${idSimulacion}/programar`, { token: tokenDocente });
    reportar(`POST /docente/simulaciones/${idSimulacion}/programar`, true, `${programar.status} — estado ${programar.data?.estado}`);
    await sleep(8000); // que pase fechaInicio, para poder llamar /iniciar

    const crearEmpresa = await pedir('POST', `/docente/simulaciones/${idSimulacion}/empresas`, {
      token: tokenDocente,
      body: { nombre: `Empresa Integración ${SUFIJO}`, tipoJugador: 'MULTIUSUARIO' },
    });
    reportar('POST /docente/simulaciones/{id}/empresas', true, `${crearEmpresa.status} — id ${crearEmpresa.data?.id}`);
    assert(crearEmpresa.ok, 'no se pudo crear la empresa — se cancela el resto del flujo');
    idEmpresa = crearEmpresa.data.id;

    await pedir('POST', `/docente/empresas/${idEmpresa}/integrantes`, {
      token: tokenDocente,
      body: { idUsuario: Number(estudianteLider.id), departamento: 'GERENCIA_GENERAL' },
    });
    await pedir('POST', `/docente/empresas/${idEmpresa}/integrantes`, {
      token: tokenDocente,
      body: { idUsuario: Number(estudianteRaso.id), departamento: 'OPERACIONES' },
    });
    await pedir('PUT', `/docente/empresas/${idEmpresa}/integrantes/${estudianteLider.id}/lider`, { token: tokenDocente });
    reportar('POST/PUT /docente/empresas/{id}/integrantes (alta + líder)', true, 'armado para la simulación nueva');

    const crearCaso = await pedir('POST', '/docente/casos', {
      token: tokenDocente,
      body: {
        idSimulacion,
        nombre: `Caso integración ${SUFIJO}`,
        tipo: 'Manufactura',
        mision: 'Misión de prueba.',
        vision: 'Visión de prueba.',
        // Las 19 partidas (obligatorias); los 4 totales los calcula el backend.
        // Cuadra: activo 1.550.000 = pasivo 700.000 + patrimonio 850.000.
        financiero: {
          efectivo: 200000, cuentasPorCobrar: 150000, inventarios: 250000, propiedadPlantaEquipo: 900000,
          activosIntangibles: 50000, cuentasPorPagar: 180000, obligacionesFinancierasCortoPlazo: 120000,
          obligacionesFinancierasLargoPlazo: 400000, capitalSocial: 600000, utilidadesRetenidas: 120000,
          ventasNetas: 1200000, costoVentas: 700000, gastosAdministracion: 150000, gastosVentas: 100000,
          gastosFinancieros: 50000, impuestoRenta: 70000, flujoOperativo: 180000, flujoInversion: -80000,
          flujoFinanciacion: -50000,
        },
        penalizacionMin: 1,
        penalizacionMax: 3,
        fechaVisualizacion: bogotaISO(-3600_000),
        fechaInicioPartida: bogotaISO(-1800_000),
        fechaFinPartida: bogotaISO(7 * 86_400_000),
        asignacionEquipos: 'automatica',
        opciones: [
          {
            opcion: 'Opción A — ampliar planta',
            resultado: 'Activo total +180000',
            impacto: { ventasNetas: { tipo: 'porcentaje', valor: 10 }, costoVentas: { tipo: 'monto', valor: 50000 } },
          },
          { opcion: 'Opción B — no hacer nada', resultado: 'Utilidad neta -8000' },
        ],
      },
    });
    reportar('POST /docente/casos', true, `${crearCaso.status} — id ${crearCaso.data?.id}`);
    assert(crearCaso.ok, 'no se pudo crear el caso — se cancela el resto del flujo');
    idCaso = crearCaso.data.id;
    await pedir('POST', `/docente/casos/${idCaso}/activar`, { token: tokenDocente });
  } else {
    reportar('POST /docente/simulaciones (omitido)', false, `reusando simulación ${idSimulacion} / empresa ${idEmpresa} / caso ${idCaso}`);
    const obtenerCasoExistente = await pedir('GET', `/docente/casos/${idCaso}`, { token: tokenDocente });
    idOpcionA = obtenerCasoExistente.data?.opciones?.[0]?.id ?? null;
  }

  // --- Endpoint /iniciar: transición válida por sí misma, pero NO es requisito
  // para decidir (confirmado: decision solo exige PROGRAMADA o EN_CURSO, más
  // las fechas del caso — el bloqueo real era el bug de zona horaria de arriba).
  const iniciar = await pedir('POST', `/docente/simulaciones/${idSimulacion}/iniciar`, { token: tokenDocente });
  reportar(`POST /docente/simulaciones/${idSimulacion}/iniciar`, true, `${iniciar.status} — estado ${iniciar.data?.estado ?? '(ver mensaje)'} ${iniciar.ok ? '' : JSON.stringify(iniciar.data)}`);

  if (!idOpcionA) {
    const casoDetalle = await pedir('GET', `/docente/casos/${idCaso}`, { token: tokenDocente });
    idOpcionA = casoDetalle.data?.opciones?.[0]?.id;
  }

  const obtenerEmpresaDocente = await pedir('GET', `/docente/empresas/${idEmpresa}`, { token: tokenDocente });
  reportar('GET /docente/empresas/{id}', true, `${obtenerEmpresaDocente.status} — código ${obtenerEmpresaDocente.data?.codigoEmpresa}`);

  const listarIntegrantes = await pedir('GET', `/docente/empresas/${idEmpresa}/integrantes`, { token: tokenDocente });
  reportar('GET /docente/empresas/{id}/integrantes', true, `${listarIntegrantes.status} — ${listarIntegrantes.data?.length ?? '?'} integrante(s)`);

  // --- Login estudiante líder + caso-actual ANTES de decidir -------------------
  const loginLider = await pedir('POST', '/auth/login', { body: { correo: estudianteLider.correo, contrasena: estudianteLider.contrasenaGenerada } });
  reportar('POST /auth/login (estudiante líder)', true, ok(loginLider) || '200');
  assert(loginLider.ok, 'no se pudo loguear al estudiante líder — se cancela el resto del flujo');
  const tokenLider = loginLider.data.token;

  const misSimsLider = await pedir('GET', '/estudiante/simulaciones', { token: tokenLider });
  reportar('GET /estudiante/simulaciones', true, `${misSimsLider.status} — ${misSimsLider.data?.length ?? '?'} simulación(es)`);

  const miEmpresaLider = await pedir('GET', `/estudiante/empresas/${idEmpresa}`, { token: tokenLider });
  reportar('GET /estudiante/empresas/{id}', true, `${miEmpresaLider.status} — ${miEmpresaLider.data?.integrantes?.length ?? '?'} integrante(s)`);

  const casoActualAntes = await pedir('GET', `/estudiante/caso-actual?idSimulacion=${idSimulacion}`, { token: tokenLider });
  const sinResultadoAntes =
    casoActualAntes.status === 200 &&
    !(casoActualAntes.data?.caso?.opciones ?? []).some((o) => 'resultado' in o || 'impacto' in o);
  reportar(
    'GET /estudiante/caso-actual (antes de decidir)',
    true,
    `${casoActualAntes.status} — puedeDecidir=${casoActualAntes.data?.puedeDecidir}, decision=${JSON.stringify(casoActualAntes.data?.decision)}, opciones sin "resultado"/"impacto"=${sinResultadoAntes}`,
  );

  // --- Decidir (líder) ----------------------------------------------------------
  const decidir = await pedir('POST', '/estudiante/decision', { token: tokenLider, body: { idCaso, idOpcion: idOpcionA } });
  reportar('POST /estudiante/decision (líder, 1ra vez)', true, ok(decidir) || '201');

  const casoActualDespues = await pedir('GET', `/estudiante/caso-actual?idSimulacion=${idSimulacion}`, { token: tokenLider });
  reportar(
    'GET /estudiante/caso-actual (después de decidir)',
    true,
    `${casoActualDespues.status} — decision.resultado=${casoActualDespues.data?.decision?.resultado ?? '(vacío — revisar si el flujo llegó hasta acá)'}`,
  );

  // --- Casos de error esperados --------------------------------------------------
  const decidirDeNuevo = await pedir('POST', '/estudiante/decision', { token: tokenLider, body: { idCaso, idOpcion: idOpcionA } });
  reportar('POST /estudiante/decision (líder, 2da vez — debe fallar)', true, esperado(decidirDeNuevo, false));

  const loginRaso = await pedir('POST', '/auth/login', { body: { correo: estudianteRaso.correo, contrasena: estudianteRaso.contrasenaGenerada } });
  if (loginRaso.ok) {
    const tokenRaso = loginRaso.data.token;
    const decidirComoRaso = await pedir('POST', '/estudiante/decision', { token: tokenRaso, body: { idCaso, idOpcion: idOpcionA } });
    reportar('POST /estudiante/decision (integrante NO líder — debe fallar)', true, esperado(decidirComoRaso, false));

    const rolEquivocado = await pedir('POST', '/docente/casos', { token: tokenRaso, body: { idSimulacion, nombre: 'x' } });
    reportar('POST /docente/casos con token de ESTUDIANTE (rol equivocado — debe fallar)', true, esperado(rolEquivocado, false));
  } else {
    reportar('POST /auth/login (estudiante raso)', false, `${loginRaso.status} — no se pudo probar "no es líder" ni "rol equivocado"`);
  }

  const opcionAjena = await pedir('POST', '/estudiante/decision', { token: tokenLider, body: { idCaso, idOpcion: 999999999 } });
  reportar('POST /estudiante/decision con idOpcion ajena/inexistente (debe fallar)', true, esperado(opcionAjena, false));

  const casoActualDocente = await pedir('GET', '/estudiante/caso-actual', { token: tokenDocente });
  reportar('GET /estudiante/caso-actual con token de DOCENTE (rol equivocado — debe fallar)', true, esperado(casoActualDocente, false));

  // --- Historial + decisiones del caso -------------------------------------------
  const historial = await pedir('GET', `/estudiante/simulaciones/${idSimulacion}/casos`, { token: tokenLider });
  reportar('GET /estudiante/simulaciones/{id}/casos', true, `${historial.status} — ${historial.data?.length ?? '?'} caso(s) visibles`);

  const casoPorId = await pedir('GET', `/estudiante/casos/${idCaso}`, { token: tokenLider });
  reportar('GET /estudiante/casos/{id}', true, `${casoPorId.status}`);

  const decisionesDelCaso = await pedir('GET', `/docente/casos/${idCaso}/decisiones`, { token: tokenDocente });
  reportar(
    'GET /docente/casos/{id}/decisiones',
    true,
    `${decisionesDelCaso.status} — ${decisionesDelCaso.data?.filter((d) => d.decidio).length ?? '?'} empresa(s) decidieron`,
  );

  // --- Cierre natural de la simulación reusada (EN_CURSO -> FINALIZADA) ----------
  const finalizar = await pedir('POST', `/docente/simulaciones/${idSimulacion}/finalizar`, { token: tokenDocente });
  reportar(`POST /docente/simulaciones/${idSimulacion}/finalizar`, true, `${finalizar.status} — estado ${finalizar.data?.estado}`);

  // =============================================================================
  // FASE B — simulación DESCARTABLE: prueba actualizar/eliminar de Simulación,
  // Empresa e Integrante, y la borra por completo al final (cero basura nueva).
  // =============================================================================

  console.log('\n--- Fase B: CRUD completo (crear/actualizar/eliminar) sobre entidades descartables ---\n');

  const crearSimDescartable = await pedir('POST', '/docente/simulaciones', {
    token: tokenDocente,
    body: { nombre: `Descartable ${SUFIJO}`, fechaInicio: new Date(ahora + 30 * 86_400_000).toISOString(), fechaFin: new Date(ahora + 37 * 86_400_000).toISOString() },
  });
  reportar('POST /docente/simulaciones (descartable)', true, `${crearSimDescartable.status} — id ${crearSimDescartable.data?.id}`);
  assert(crearSimDescartable.ok, 'no se pudo crear la simulación descartable — se corta la Fase B');
  const idSimDescartable = crearSimDescartable.data.id;

  const actualizarSim = await pedir('PUT', `/docente/simulaciones/${idSimDescartable}`, {
    token: tokenDocente,
    body: { nombre: `Descartable ${SUFIJO} (editada)`, fechaInicio: crearSimDescartable.data.fechaInicio, fechaFin: crearSimDescartable.data.fechaFin },
  });
  reportar('PUT /docente/simulaciones/{id}', true, `${actualizarSim.status}`);

  const crearEmpresaDescartable = await pedir('POST', `/docente/simulaciones/${idSimDescartable}/empresas`, {
    token: tokenDocente,
    body: { nombre: `Empresa descartable ${SUFIJO}` },
  });
  reportar('POST /docente/simulaciones/{id}/empresas (descartable)', true, `${crearEmpresaDescartable.status} — id ${crearEmpresaDescartable.data?.id}`);
  assert(crearEmpresaDescartable.ok, 'no se pudo crear la empresa descartable — se corta la Fase B');
  const idEmpresaDescartable = crearEmpresaDescartable.data.id;

  const actualizarEmpresa = await pedir('PUT', `/docente/empresas/${idEmpresaDescartable}`, {
    token: tokenDocente,
    body: { nombre: `Empresa descartable ${SUFIJO} (editada)`, estrategia: 'Liderazgo en costos' },
  });
  reportar('PUT /docente/empresas/{id}', true, `${actualizarEmpresa.status}`);

  const agregarIntegranteDescartable = await pedir('POST', `/docente/empresas/${idEmpresaDescartable}/integrantes`, {
    token: tokenDocente,
    body: { idUsuario: Number(estudianteRaso.id), departamento: 'ADMINISTRATIVA' },
  });
  reportar('POST /docente/empresas/{id}/integrantes (descartable)', true, `${agregarIntegranteDescartable.status}`);

  const actualizarDeptoDescartable = await pedir('PUT', `/docente/empresas/${idEmpresaDescartable}/integrantes/${estudianteRaso.id}`, {
    token: tokenDocente,
    body: { departamento: 'COMERCIAL' },
  });
  reportar('PUT /docente/empresas/{id}/integrantes/{idUsuario} (descartable)', true, `${actualizarDeptoDescartable.status}`);

  const eliminarIntegranteDescartable = await pedir('DELETE', `/docente/empresas/${idEmpresaDescartable}/integrantes/${estudianteRaso.id}`, { token: tokenDocente });
  reportar('DELETE /docente/empresas/{id}/integrantes/{idUsuario}', true, `${eliminarIntegranteDescartable.status}`);

  const eliminarEmpresaDescartable = await pedir('DELETE', `/docente/empresas/${idEmpresaDescartable}`, { token: tokenDocente });
  reportar('DELETE /docente/empresas/{id}', true, `${eliminarEmpresaDescartable.status}`);

  const eliminarSimDescartable = await pedir('DELETE', `/docente/simulaciones/${idSimDescartable}`, { token: tokenDocente });
  reportar('DELETE /docente/simulaciones/{id}', true, `${eliminarSimDescartable.status} — sin basura nueva: entidad descartable borrada`);

  // --- Guardar credenciales para la próxima corrida ------------------------------
  escribirEnvTest({
    API_BASE_URL: BASE_URL,
    TEST_RUN_ID: SUFIJO,
    TEST_DOCENTE_CORREO: docenteCorreo,
    TEST_DOCENTE_PASSWORD: docentePass,
    TEST_ESTUDIANTE_LIDER_CORREO: estudianteLider.correo,
    TEST_ESTUDIANTE_LIDER_PASSWORD: estudianteLider.contrasenaGenerada || env.TEST_ESTUDIANTE_LIDER_PASSWORD,
    TEST_ESTUDIANTE_LIDER_ID: estudianteLider.id,
    TEST_ESTUDIANTE_RASO_CORREO: estudianteRaso.correo,
    TEST_ESTUDIANTE_RASO_PASSWORD: estudianteRaso.contrasenaGenerada || env.TEST_ESTUDIANTE_RASO_PASSWORD,
    TEST_ESTUDIANTE_RASO_ID: estudianteRaso.id,
    // La simulación reusada quedó FINALIZADA: la próxima corrida crea una nueva.
    TEST_ID_SIMULACION: '',
    TEST_ID_EMPRESA: '',
    TEST_ID_CASO: '',
  });

  imprimirTabla('Tabla final');
}

function imprimirTabla(titulo) {
  console.log(`\n--- ${titulo} ---\n`);
  console.log('| Endpoint | Probado en vivo | Resultado |');
  console.log('|---|---|---|');
  for (const f of filas) {
    console.log(`| ${f.endpoint} | ${f.probado ? 'sí' : 'no'} | ${String(f.resultado).replace(/\|/g, '\\|')} |`);
  }
}

main().catch((e) => {
  console.error('\n💥 Se cortó el flujo:', e.message);
  imprimirTabla('Tabla parcial (hasta el punto de falla)');
  process.exit(1);
});
