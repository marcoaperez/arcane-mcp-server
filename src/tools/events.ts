import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArcaneClient } from "../arcane-client";
import { withErrors, listResponse } from "./respond";

const LIST_PARAMS = {
  search: z.string().optional().describe("Free-text search over event messages"),
  sort: z.string().optional().describe("Column to sort by, e.g. timestamp, severity"),
  order: z.string().optional().describe("Sort direction: asc or desc"),
  start: z.number().int().min(0).optional().describe("Start index for pagination (server default: 0)"),
  limit: z.number().int().min(1).optional().describe("Items per page (server default: 20)"),
};

/**
 * Los endpoints de events son GLOBALES, no por entorno: aqui `environmentId`
 * es un filtro opcional, no algo que haya que resolver con resolveEnvironmentId.
 * Por eso estas dos tools no aceptan `environmentName`.
 */
export function registerEventTools(server: McpServer, client: ArcaneClient): void {
  server.tool(
    "arcane_event_list",
    "List audit log events. Returns pagination; if the response says there are more pages, pass start to see the rest before concluding an event was not recorded.",
    {
      environmentId: z.string().optional().describe("Filter events to one environment"),
      ...LIST_PARAMS,
      severity: z.string().optional().describe("Filter by severity: info, success, warning, error"),
      type: z.string().optional().describe("Filter by event type"),
    },
    withErrors(async ({ environmentId, search, sort, order, start, limit, severity, type }) => {
      const result = await client.events.list({ environmentId, search, sort, order, start, limit, severity, type });
      return listResponse(result, "events");
    }),
  );

  server.tool(
    "arcane_event_stats",
    "Get event counts by severity across all environments.",
    {},
    withErrors(async () => {
      const result = await client.events.stats();
      return { content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }] };
    }),
  );
}
