import { ArcaneClient } from "../arcane-client";

/**
 * Construye un ArcaneClient apuntando a la instancia real.
 * Falla con un mensaje accionable si faltan las variables de entorno,
 * en vez de dar un error de red críptico 30 segundos después.
 */
export function e2eClient(): ArcaneClient {
  const baseUrl = process.env.ARCANE_BASE_URL;
  const apiKey = process.env.ARCANE_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error(
      "Faltan ARCANE_BASE_URL y/o ARCANE_API_KEY.\n" +
        "Ejemplo:\n" +
        "  ARCANE_BASE_URL=http://192.168.180.210:3552 \\\n" +
        "  ARCANE_API_KEY=<clave> \\\n" +
        "  npm run test:e2e",
    );
  }
  return new ArcaneClient(apiKey, baseUrl);
}

/**
 * Stack sobre el que es seguro ejecutar acciones mutantes: levantarlo o
 * redesplegarlo repetidamente no tiene efectos observables fuera de sí mismo.
 */
export const IDEMPOTENT_STACK = process.env.ARCANE_E2E_STACK ?? "ical-bridge";

/**
 * Imagen sobre la que es seguro lanzar escaneos de vulnerabilidades: pequeña
 * (33 MB), sin contenedores que dependan de ella, y reescanearla SUSTITUYE el
 * resultado anterior sin acumular (medido en la puerta de F4, 2026-08-18).
 * Nunca uses aquí la imagen del contenedor arcane-mcp-server.
 */
export const SCAN_IMAGE = process.env.ARCANE_E2E_SCAN_IMAGE ?? "curlimages/curl:8.5.0";

/**
 * Crea un registro de contenedor sonda por fetch directo, no por tool.
 *
 * F5 decidio NO exponer las escrituras de registro -el modelo tendria que
 * redactar el secreto para invocarlas- pero las lecturas necesitan datos y la
 * instancia tiene cero registros. La suite no es el modelo, asi que siembra
 * por la API cruda.
 *
 * Sujeto inocuo: URL .invalid (nunca resuelve) y enabled:false, para que nada
 * intente usarlo en un pull real.
 */
export async function siembraRegistroDeContenedor(): Promise<string> {
  const res = await fetch(`${process.env.ARCANE_BASE_URL}/api/container-registries`, {
    method: "POST",
    headers: { "X-API-Key": process.env.ARCANE_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({
      url: "arcane-mcp-e2e.invalid",
      username: "e2e",
      token: "no-es-un-secreto-real",
      description: "sonda e2e de arcane-mcp - borrar si sobrevive",
      insecure: false,
      enabled: false,
      registryType: "generic",
      repositoryNames: [],
      awsAccessKeyId: "",
      awsSecretAccessKey: "",
      awsRegion: "",
    }),
  });
  if (!res.ok) throw new Error(`No se pudo sembrar el registro: HTTP ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { data: { id: string } };
  return body.data.id;
}

/**
 * Borra el registro sembrado. AVISA en vez de fallar: si el borrado no
 * funciona, tumbar la suite no elimina el residuo, solo esconde el resto de
 * los resultados. Mismo trato que la limpieza de ignores en F4.
 */
export async function borraRegistroDeContenedor(id: string): Promise<void> {
  const res = await fetch(`${process.env.ARCANE_BASE_URL}/api/container-registries/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "X-API-Key": process.env.ARCANE_API_KEY! },
  });
  if (!res.ok) {
    console.error(
      `\n[e2e] RESIDUO: el registro de contenedor ${id} no se pudo borrar (HTTP ${res.status}).\n` +
      `[e2e] Borralo a mano:\n` +
      `[e2e]   curl -X DELETE -H "X-API-Key: $ARCANE_API_KEY" \\\n` +
      `[e2e]     "$ARCANE_BASE_URL/api/container-registries/${id}"\n`,
    );
  }
}

/**
 * Devuelve un entorno cuyo workspace de builds funciona.
 *
 * Medido el 2026-08-19: cinco de los seis entornos de esta instancia responden
 * 500 "failed to ensure builds directory: mkdir /builds: permission denied";
 * solo uno responde 200. Cablear ese id seria fabricar el defecto que ya tiene
 * resolvers.e2e.ts -un test acoplado al inventario vivo-.
 *
 * Si NINGUNO funciona, FALLA. No salta. La regla dura del proyecto dice que
 * ninguna tool se entrega sin e2e, asi que "no he podido comprobarlo" es rojo;
 * y un fichero saltado se lee como verde, que es justo el disfraz a evitar.
 */
export async function entornoConWorkspaceDeBuilds(): Promise<string> {
  const forzado = process.env.ARCANE_E2E_BUILD_ENV;
  const client = e2eClient();
  const candidatos = forzado
    ? [forzado]
    : ((await client.environments.list({ limit: 50, sort: "name" })).data ?? []).map(e => e.id);

  const fallos: string[] = [];
  for (const id of candidatos) {
    try {
      await client.buildWorkspace.browse(id);
      return id;
    } catch (e) {
      fallos.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  throw new Error(
    "Ningun entorno tiene un workspace de builds utilizable, asi que las tools de " +
      "build-workspace NO se pueden verificar contra la instancia.\n" +
      "Probados:\n  " + fallos.join("\n  ") + "\n" +
      "Fuerza uno con ARCANE_E2E_BUILD_ENV=<id> si sabes de alguno que sirva.",
  );
}
