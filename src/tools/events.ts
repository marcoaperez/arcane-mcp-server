import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArcaneClient } from "../arcane-client";

/**
 * Los endpoints de events son GLOBALES, no por entorno: aqui `environmentId`
 * es un filtro opcional, no algo que haya que resolver con resolveEnvironmentId.
 * Por eso estas dos tools no aceptan `environmentName`.
 */
export function registerEventTools(server: McpServer, client: ArcaneClient): void {
  server.tool(
    "arcane_event_list",
    "List audit events. Without environmentId returns events from all environments.",
    {
      environmentId: z.string().optional().describe("Filter events to one environment"),
      severity: z.string().optional().describe("Filter by severity: info, success, warning, error"),
      type: z.string().optional().describe("Filter by event type"),
      search: z.string().optional().describe("Free-text search"),
      limit: z.number().optional().describe("Maximum number of events to return"),
    },
    async ({ environmentId, severity, type, search, limit }) => {
      try {
        const result = await client.events.list({ environmentId, severity, type, search, limit });
        return { content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "arcane_event_stats",
    "Get event counts by severity across all environments.",
    {},
    async () => {
      try {
        const result = await client.events.stats();
        return { content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );
}
