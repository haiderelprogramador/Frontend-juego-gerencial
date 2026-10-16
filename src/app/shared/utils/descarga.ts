/** Espera antes de liberar la URL: Firefox y Safari a veces cancelan la descarga si se libera en el acto. */
export const RETRASO_LIBERAR_URL_MS = 1000;

/**
 * Descarga un archivo que ya está en memoria (por ejemplo, un .xlsx recibido
 * con `responseType: 'blob'`): crea un enlace temporal con
 * `URL.createObjectURL`, le hace clic y libera la URL `RETRASO_LIBERAR_URL_MS`
 * después. Si el clic falla, la libera de inmediato.
 */
export function descargarArchivo(blob: Blob, nombre: string, doc: Document = document): void {
  const url = URL.createObjectURL(blob);
  const enlace = doc.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.style.display = 'none';
  doc.body.appendChild(enlace);
  try {
    enlace.click();
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  } finally {
    enlace.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), RETRASO_LIBERAR_URL_MS);
}

/**
 * Nombre del archivo en un header `Content-Disposition`. Acepta
 * `filename*=UTF-8''…` (RFC 5987, con prioridad) y `filename="…"` o sin
 * comillas. `null` si no hay header o no trae nombre.
 */
export function nombreDesdeContentDisposition(header: string | null): string | null {
  if (!header) {
    return null;
  }
  const extendido = /filename\*\s*=\s*(?:[\w-]+'[^']*')?([^;]+)/i.exec(header);
  if (extendido) {
    try {
      return decodeURIComponent(extendido[1].trim().replace(/^"|"$/g, ''));
    } catch {
      // Codificación inválida: se intenta con `filename=`.
    }
  }
  const simple = /filename\s*=\s*("([^"]*)"|[^;]+)/i.exec(header);
  const nombre = (simple?.[2] ?? simple?.[1])?.trim();
  return nombre ? nombre : null;
}
