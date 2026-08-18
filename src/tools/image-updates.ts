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
    "Get the STORED update information for specific image references. Does not query any registry, so it is fast and safe to call repeatedly. The response map can omit references that have no cached result — the tool flags this in prose when it happens. Use arcane_image_update_check instead when you need a fresh answer.",
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

      // Comprobado contra la instancia real: la API omite del mapa las
      // referencias que no tiene cacheadas (de 20 pedidas, 2 no aparecieron).
      // Sin aviso, un modelo que pide 5 y recibe 3 no puede distinguir "esas
      // dos no tienen actualizacion" de "esas dos nunca se comprobaron". Se
      // dice lo que se sabe -que faltan del mapa- sin afirmar por que, porque
      // la tool tampoco lo sabe.
      const devueltas = new Set(Object.keys(result.data ?? {}));
      const faltantes = pedidas.filter((ref) => !devueltas.has(ref));
      if (faltantes.length > 0) {
        return textResponse(
          `The response omits ${faltantes.length} of ${pedidas.length} requested reference(s), ` +
            `which have no cached update result: ${faltantes.join(", ")}.\n${texto}`,
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
