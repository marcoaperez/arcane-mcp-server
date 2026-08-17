import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArcaneClient } from "../arcane-client";
import { resolveEnvironmentId } from "./resolve";
import { withErrors, listResponse } from "./respond";

const LIST_PARAMS = {
  search: z.string().optional().describe("Free-text search over volume names and drivers"),
  sort: z.string().optional().describe("Column to sort by, e.g. name, createdAt, size"),
  order: z.string().optional().describe("Sort direction: asc or desc"),
  start: z.number().int().min(0).optional().describe("Start index for pagination (server default: 0)"),
  limit: z.number().int().min(1).optional().describe("Items per page (server default: 20)"),
};

export function registerVolumeTools(server: McpServer, client: ArcaneClient): void {
  server.tool(
    "arcane_volume_list",
    "List Docker volumes in an environment. Returns pagination and in-use counts; if the response says there are more pages, pass start to see the rest before drawing conclusions about what exists.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      ...LIST_PARAMS,
      inUse: z.string().optional().describe("Filter by in-use status: true or false"),
      includeInternal: z.boolean().optional().describe("Include internal volumes (server default: false)"),
    },
    withErrors(async ({ environmentId, environmentName, search, sort, order, start, limit, inUse, includeInternal }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.volumes.list(envId, { search, sort, order, start, limit, inUse, includeInternal });
      return listResponse(result, "volumes");
    }),
  );

  server.tool(
    "arcane_volume_inspect",
    "Get details of a specific Docker volume.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      volumeName: z.string().describe("Volume name to inspect"),
    },
    withErrors(async ({ environmentId, environmentName, volumeName }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.volumes.inspect(envId, volumeName);
      return {
        content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }],
      };
    }),
  );

  server.tool(
    "arcane_volume_remove",
    "Remove a Docker volume from an environment.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      volumeName: z.string().describe("Volume name to remove"),
    },
    withErrors(async ({ environmentId, environmentName, volumeName }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.volumes.remove(envId, volumeName);
      return {
        content: [{ type: "text", text: result.message || `Volume '${volumeName}' removed successfully` }],
      };
    }),
  );

  server.tool(
    "arcane_volume_prune",
    "Remove unused Docker volumes from an environment.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
    },
    withErrors(async ({ environmentId, environmentName }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.volumes.prune(envId);
      return {
        content: [
          {
            type: "text",
            text: `Pruned ${result.data.volumesDeleted} volumes, reclaimed ${result.data.spaceReclaimed} bytes`,
          },
        ],
      };
    }),
  );
}
