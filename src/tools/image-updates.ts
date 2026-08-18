import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArcaneClient } from "../arcane-client";
import { resolveEnvironmentId } from "./resolve";
import { withErrors, textResponse } from "./respond";
import { parseCommaList } from "./comma-list";

export function registerImageUpdateTools(server: McpServer, client: ArcaneClient): void {
  server.tool(
    "arcane_image_update_summary",
    "Get the aggregate image update counts for an environment: how many images there are, how many have updates available, and how many failed to check. Cheap: reads stored results, does not query any registry.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
    },
    withErrors(async ({ environmentId, environmentName }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.imageUpdates.summary(envId);
      return textResponse(JSON.stringify(result.data, null, 2));
    }),
  );

  server.tool(
    "arcane_image_update_status",
    "Get the STORED update information for specific image references. Does not query any registry, so it is fast and safe to call repeatedly. The response map can omit some of the requested references, and the response does not say why — the tool flags this in prose when it happens. Use arcane_image_update_check for a fresh answer on the omitted references.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      imageRefs: z.string().describe("Image references, comma-separated, e.g. 'nginx:latest,redis:7'"),
    },
    withErrors(async ({ environmentId, environmentName, imageRefs }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const pedidas = parseCommaList(imageRefs);
      const result = await client.imageUpdates.byRefs(envId, pedidas);
      const texto = JSON.stringify(result.data, null, 2);

      // Comprobado contra la instancia real: la API omite del mapa referencias
      // pedidas sin decir por que -incluso una referencia que no existe
      // (noexiste/pepe:1) se omite igual que una real sin cache, y openapi.txt
      // no documenta ningun motivo para las omisiones de by-refs. Se dice lo
      // que se sabe -que faltan del mapa- sin afirmar por que, porque la tool
      // tampoco lo sabe, y se da la accion: pedir una respuesta fresca con
      // arcane_image_update_check.
      const devueltas = new Set(Object.keys(result.data ?? {}));
      const faltantes = pedidas.filter((ref) => !devueltas.has(ref));
      if (faltantes.length > 0) {
        return textResponse(
          `The response omits ${faltantes.length} of ${pedidas.length} requested reference(s): ` +
            `${faltantes.join(", ")}. The response does not say why they are missing. ` +
            `Use arcane_image_update_check to get a fresh answer for those references.\n${texto}`,
        );
      }
      return textResponse(texto);
    }),
  );

  server.tool(
    "arcane_image_update_check",
    "Check ONE image for updates by querying its registry LIVE. Slower than arcane_image_update_status and subject to registry rate limits, so prefer the stored status unless you need a fresh answer. Accepts an image reference or an image ID.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      imageRef: z.string().optional().describe("Image reference, e.g. 'nginx:latest'"),
      imageId: z.string().optional().describe("Image ID (alternative to imageRef)"),
    },
    withErrors(async ({ environmentId, environmentName, imageRef, imageId }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.imageUpdates.check(envId, { imageRef, imageId });
      return textResponse(JSON.stringify(result.data, null, 2));
    }),
  );

  server.tool(
    "arcane_image_update_check_batch",
    "Check a specific LIST of images for updates by querying their registries LIVE. Requires the list: checking every image at once is not exposed, because a scheduled job already does that sweep hourly.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      imageRefs: z.string().describe("Image references to check, comma-separated"),
    },
    withErrors(async ({ environmentId, environmentName, imageRefs }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.imageUpdates.checkBatch(envId, parseCommaList(imageRefs));
      return textResponse(JSON.stringify(result.data, null, 2));
    }),
  );
}
