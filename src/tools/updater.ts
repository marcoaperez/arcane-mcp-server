import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArcaneClient } from "../arcane-client";
import { resolveEnvironmentId } from "./resolve";
import { withErrors, textResponse } from "./respond";
import { parseCommaList } from "./comma-list";

/** Limit que aplica el servidor cuando no se pide ninguno. */
const LIMIT_POR_DEFECTO_DEL_SERVIDOR = 50;

export function registerUpdaterTools(server: McpServer, client: ArcaneClient): void {
  server.tool(
    "arcane_updater_status",
    "Report which containers and projects are being updated right now.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
    },
    withErrors(async ({ environmentId, environmentName }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.updater.status(envId);
      return textResponse(JSON.stringify(result.data, null, 2));
    }),
  );

  server.tool(
    "arcane_updater_history",
    "List past automatic update runs. This endpoint reports no total count and cannot be paged, so the list may be incomplete: raise limit if you need to be sure you are seeing everything.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      limit: z.number().int().min(1).optional().describe("Number of entries to return (server default: 50)"),
    },
    withErrors(async ({ environmentId, environmentName, limit }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.updater.history(envId, limit);
      const registros = result.data ?? [];
      const texto = JSON.stringify(registros, null, 2);

      // Este endpoint devuelve un array pelado: ni total, ni start. Si sirve
      // exactamente tantos registros como se le pidieron, lo mas probable es que
      // haya mas. Se dice como sospecha y no como certeza, porque la API no
      // permite distinguirlo: prometer lo contrario seria el defecto que
      // arcane_volume_browse tenia al anunciar "the full file tree".
      const pedidos = limit ?? LIMIT_POR_DEFECTO_DEL_SERVIDOR;
      if (registros.length === pedidos) {
        return textResponse(
          `This history may be truncated: exactly ${pedidos} records were requested and ` +
            `${registros.length} were returned, and this endpoint reports no total. ` +
            `Raise limit to find out.\n${texto}`,
        );
      }
      return textResponse(texto);
    }),
  );

  server.tool(
    "arcane_updater_run",
    "Apply pending updates to SPECIFIC containers or projects, recreating them. You must name the targets: updating everything at once is deliberately not available. Pass dryRun to see what would happen without changing anything.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      resourceIds: z.string().describe("IDs of the containers or projects to update, comma-separated. Required: this tool will not update everything at once"),
      type: z.string().optional().describe("Resource type, e.g. container or project"),
      dryRun: z.boolean().optional().describe("Report what would be updated without applying anything"),
      forceUpdate: z.boolean().optional().describe("Apply even if no update is detected"),
    },
    withErrors(async ({ environmentId, environmentName, resourceIds, type, dryRun, forceUpdate }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.updater.run(envId, {
        resourceIds: parseCommaList(resourceIds),
        type,
        dryRun,
        forceUpdate,
      });
      return textResponse(JSON.stringify(result.data, null, 2));
    }),
  );
}
