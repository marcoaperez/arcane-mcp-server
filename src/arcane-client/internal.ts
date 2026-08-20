import type { ActionResponse, ComposeStreamEvent, ListOptionsWithSort } from "./types-catalog";
import type { BuildStreamSummary } from "./types-system-build";

/**
 * Extract the error text from a stream event, whichever shape it arrived in.
 * openapi.txt declares these streaming endpoints' 200 responses with no
 * `content`, so the stream shape isn't specified: Arcane may report a
 * failure via the plain `error` string, or via `errorDetail` (an object,
 * typically `{"message":"..."}`) — this was first observed on /pull, but
 * nothing rules it out on /up or /redeploy, so all four endpoints check both.
 * When both are present with the same text, `error` wins so the text isn't
 * duplicated in the aggregated message.
 */
function extractStreamError(e: ComposeStreamEvent): string | undefined {
  if (typeof e.error === "string" && e.error.length > 0) return e.error;
  if (e.errorDetail && typeof e.errorDetail.message === "string" && e.errorDetail.message.length > 0) {
    return e.errorDetail.message;
  }
  return undefined;
}

/**
 * Aggregate an NDJSON compose/pull stream into a single ActionResponse.
 * Surfaces stream errors actionably and treats `{"done":true}` as success.
 */
export function summarizeComposeStream(events: ComposeStreamEvent[], action: string): ActionResponse {
  const errors = events.map(extractStreamError).filter((e): e is string => typeof e === "string");
  if (errors.length > 0) {
    return { success: false, message: `${action} failed: ${errors.join("; ")}` };
  }

  // Defensive fallback: a non-streaming response (single ActionResponse object).
  // requestNdjson yields it as one event — pass it through unchanged.
  if (events.length === 1 && typeof events[0]?.success === "boolean") {
    return { success: events[0].success as boolean, message: events[0].message ?? `${action} finished` };
  }

  const done = events.some(e => e.done === true);
  const logs = events
    .filter(e => typeof e.log === "string")
    .map(e => (e.log as string).trim())
    .filter(Boolean);
  return {
    success: done,
    message: logs.length > 0 ? logs.join(" | ") : `${action} finished (${events.length} events)`,
  };
}

export const BUILD_ARG_OCULTO = "<hidden by arcane-mcp>";
export const LINEAS_DE_LOG_CONSERVADAS = 100;

/**
 * Sustituye los valores de buildArgs y conserva las claves.
 *
 * Va en el CLIENTE y no en la capa de tool a proposito: en la tool, una
 * segunda tool futura sobre el mismo endpoint reintroduciria la fuga sin que
 * nada fallara. Es exactamente como se desplego rota arcane_image_update_check
 * en F3, por una rama que nadie ejercito.
 */
export function enmascaraBuildArgs<T extends { buildArgs?: Record<string, string> }>(registro: T): T {
  if (!registro.buildArgs) return registro;
  const ocultos: Record<string, string> = {};
  for (const clave of Object.keys(registro.buildArgs)) ocultos[clave] = BUILD_ARG_OCULTO;
  return { ...registro, buildArgs: ocultos };
}

/**
 * Agrega el NDJSON de una build.
 *
 * No reutiliza summarizeComposeStream porque aquel une TODOS los logs en un
 * solo `message`: un compose up produce unas lineas, una build produce
 * cientos, sin cota. Comparte `extractStreamError`, que es lo unico igual.
 */
export function summarizeBuildStream(events: ComposeStreamEvent[], action: string): BuildStreamSummary {
  const activityId = events.find(e => typeof e.activityId === "string")?.activityId;
  const logs = events
    .filter(e => typeof e.log === "string")
    .map(e => (e.log as string).trimEnd())
    .filter(l => l.length > 0);
  const logTail = logs.slice(-LINEAS_DE_LOG_CONSERVADAS);
  const droppedLines = logs.length - logTail.length;

  const errors = events.map(extractStreamError).filter((e): e is string => typeof e === "string");
  if (errors.length > 0) {
    return { success: false, message: `${action} failed: ${errors.join("; ")}`, activityId, logTail, droppedLines };
  }

  const done = events.some(e => e.done === true);
  return {
    success: done,
    message: done ? `${action} finished` : `${action} ended without a completion event`,
    activityId,
    logTail,
    droppedLines,
  };
}

/**
 * Escribe en la query los cinco parametros de listado que openapi.txt declara
 * para practicamente todos los endpoints de coleccion.
 *
 * `start` se compara con undefined y no por veracidad: `start=0` es un valor
 * valido, no una ausencia.
 */
export function appendListParams(params: URLSearchParams, opts?: ListOptionsWithSort): void {
  if (opts?.search) params.set("search", opts.search);
  if (opts?.sort) params.set("sort", opts.sort);
  if (opts?.order) params.set("order", opts.order);
  if (opts?.start !== undefined) params.set("start", String(opts.start));
  if (opts?.limit) params.set("limit", String(opts.limit));
}

/**
 * Codifica un segmento de ruta conservando los dos puntos literales.
 *
 * Medido el 2026-08-19: Arcane NO decodifica %3A en el segmento imageId
 * -devuelve 404 en los GET, 500 en el scan, y un 200 con cero items en el
 * listado, que es el fallo silencioso-, asi que el sha256: tiene que viajar
 * crudo. Pero interpolar el valor entero sin codificar permitia inyectar
 * ruta: un imageId con "../" y "#" resolvia a cualquier endpoint de Arcane,
 * incluido system/containers/stop-all. Se codifica todo lo demas y se
 * devuelven los dos puntos a su forma literal.
 */
export function segmentoDeRuta(valor: string): string {
  return encodeURIComponent(valor).replace(/%3A/gi, ":");
}

