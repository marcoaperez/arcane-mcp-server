import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArcaneClient } from "../arcane-client";
import { resolveEnvironmentId } from "./resolve";
import { withErrors, listResponse } from "./respond";

const LIST_PARAMS = {
  search: z.string().optional().describe("Free-text search over environment names"),
  sort: z.string().optional().describe("Column to sort by, e.g. name, status"),
  order: z.string().optional().describe("Sort direction: asc or desc"),
  start: z.number().int().min(0).optional().describe("Start index for pagination (server default: 0)"),
  limit: z.number().int().min(1).optional().describe("Items per page (server default: 20)"),
};

export function registerEnvironmentTools(server: McpServer, client: ArcaneClient): void {
  server.tool(
    "arcane_environment_list",
    "List Docker environments managed by Arcane. Returns environment IDs, names, connection status and pagination; if the response says there are more pages, pass start to see the rest before drawing conclusions about what exists.",
    {
      ...LIST_PARAMS,
      type: z.string().optional().describe("Filter by environment type"),
    },
    withErrors(async ({ search, sort, order, start, limit, type }) => {
      const result = await client.environments.list({ search, sort, order, start, limit, type });
      return listResponse(result, "environments");
    }),
  );

  server.tool(
    "arcane_environment_get",
    "Get details of a specific Docker environment by ID or name.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
    },
    withErrors(async ({ environmentId, environmentName }) => {
      const id = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.environments.get(id);
      return {
        content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }],
      };
    }),
  );

  server.tool(
    "arcane_environment_create",
    "Create a new Docker environment in Arcane.",
    {
      name: z.string().describe("Environment name"),
      apiUrl: z.string().describe("Docker API URL"),
      accessToken: z.string().optional().describe("Docker access token"),
      bootstrapToken: z.string().optional().describe("Bootstrap token for agent pairing"),
      enabled: z.boolean().optional().describe("Whether the environment is enabled"),
      isEdge: z.boolean().optional().describe("Whether this is an edge environment"),
      useApiKey: z.boolean().optional().describe("Use API key authentication"),
    },
    withErrors(async (dto) => {
      const result = await client.environments.create(dto);
      return {
        content: [{ type: "text", text: `Environment created successfully:\n${JSON.stringify(result.data, null, 2)}` }],
      };
    }),
  );

  server.tool(
    "arcane_environment_update",
    "Update an existing Docker environment.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      name: z.string().optional().describe("New environment name"),
      apiUrl: z.string().optional().describe("New Docker API URL"),
      accessToken: z.string().optional().describe("New Docker access token"),
      bootstrapToken: z.string().optional().describe("New bootstrap token"),
      enabled: z.boolean().optional().describe("Enable or disable the environment"),
      regenerateApiKey: z.boolean().optional().describe("Regenerate the API key"),
    },
    withErrors(async ({ environmentId, environmentName, ...dto }) => {
      const id = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.environments.update(id, dto);
      return {
        content: [{ type: "text", text: `Environment updated successfully:\n${JSON.stringify(result.data, null, 2)}` }],
      };
    }),
  );

  server.tool(
    "arcane_environment_delete",
    "Delete a Docker environment from Arcane.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
    },
    withErrors(async ({ environmentId, environmentName }) => {
      const id = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.environments.delete(id);
      return {
        content: [{ type: "text", text: result.message || "Environment deleted successfully" }],
      };
    }),
  );
}
