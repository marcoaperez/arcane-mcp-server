import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArcaneClient } from "../arcane-client";
import { resolveEnvironmentId } from "./resolve";
import { withErrors, listResponse } from "./respond";

const LIST_PARAMS = {
  search: z.string().optional().describe("Free-text search over network names and drivers"),
  sort: z.string().optional().describe("Column to sort by, e.g. name, driver, created"),
  order: z.string().optional().describe("Sort direction: asc or desc"),
  start: z.number().int().min(0).optional().describe("Start index for pagination (server default: 0)"),
  limit: z.number().int().min(1).optional().describe("Items per page (server default: 20)"),
};

export function registerNetworkTools(server: McpServer, client: ArcaneClient): void {
  server.tool(
    "arcane_network_list",
    "List Docker networks in an environment. Returns pagination and in-use counts; if the response says there are more pages, pass start to see the rest before drawing conclusions about what exists.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      ...LIST_PARAMS,
      inUse: z.string().optional().describe("Filter by in-use status: true or false"),
    },
    withErrors(async ({ environmentId, environmentName, search, sort, order, start, limit, inUse }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.networks.list(envId, { search, sort, order, start, limit, inUse });
      return listResponse(result, "networks");
    }),
  );

  server.tool(
    "arcane_network_inspect",
    "Get details of a specific Docker network.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      networkId: z.string().describe("Network ID to inspect"),
    },
    async ({ environmentId, environmentName, networkId }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        const result = await client.networks.inspect(envId, networkId);
        return {
          content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "arcane_network_remove",
    "Remove a Docker network from an environment.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      networkId: z.string().describe("Network ID to remove"),
    },
    async ({ environmentId, environmentName, networkId }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        const result = await client.networks.remove(envId, networkId);
        return {
          content: [{ type: "text", text: result.message || `Network '${networkId}' removed successfully` }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "arcane_network_prune",
    "Remove unused Docker networks from an environment.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
    },
    async ({ environmentId, environmentName }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        const result = await client.networks.prune(envId);
        return {
          content: [
            {
              type: "text",
              text: `Pruned ${result.data.networksDeleted} networks`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );
}
