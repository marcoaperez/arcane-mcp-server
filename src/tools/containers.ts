import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArcaneClient } from "../arcane-client";
import { resolveEnvironmentId, resolveContainerId } from "./resolve";
import { withErrors, listResponse } from "./respond";

const LIST_PARAMS = {
  search: z.string().optional().describe("Free-text search over container names and images"),
  sort: z.string().optional().describe("Column to sort by, e.g. name, state, created"),
  order: z.string().optional().describe("Sort direction: asc or desc"),
  start: z.number().int().min(0).optional().describe("Start index for pagination (server default: 0)"),
  limit: z.number().int().min(1).optional().describe("Items per page (server default: 20)"),
};

export function registerContainerTools(server: McpServer, client: ArcaneClient): void {
  server.tool(
    "arcane_container_list",
    "List Docker containers in an environment. Returns pagination and running/stopped counts; if the response says there are more pages, pass start to see the rest before drawing conclusions about what exists.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      ...LIST_PARAMS,
      includeInternal: z.boolean().optional().describe("Include internal containers (server default: false)"),
      standalone: z.string().optional().describe("Filter standalone containers only: true or false"),
    },
    withErrors(async ({ environmentId, environmentName, search, sort, order, start, limit, includeInternal, standalone }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.containers.list(envId, { search, sort, order, start, limit, includeInternal, standalone });
      return listResponse(result, "containers");
    }),
  );

  server.tool(
    "arcane_container_get",
    "Get details of a specific Docker container by ID or name.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      containerId: z.string().optional().describe("Container ID (use if known)"),
      containerName: z.string().optional().describe("Container name (alternative to ID)"),
    },
    withErrors(async ({ environmentId, environmentName, containerId, containerName }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const cId = await resolveContainerId(client, envId, containerId, containerName);
      const result = await client.containers.get(envId, cId);
      return {
        content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }],
      };
    }),
  );

  server.tool(
    "arcane_container_start",
    "Start a Docker container.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      containerId: z.string().optional().describe("Container ID (use if known)"),
      containerName: z.string().optional().describe("Container name (alternative to ID)"),
    },
    withErrors(async ({ environmentId, environmentName, containerId, containerName }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const cId = await resolveContainerId(client, envId, containerId, containerName);
      const containerNameValue = containerName || (await client.containers.get(envId, cId)).data.name;
      const result = await client.containers.start(envId, cId);
      return {
        content: [{ type: "text", text: `Container '${containerNameValue}' started successfully in environment '${envId}'` }],
      };
    }),
  );

  server.tool(
    "arcane_container_stop",
    "Stop a Docker container.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      containerId: z.string().optional().describe("Container ID (use if known)"),
      containerName: z.string().optional().describe("Container name (alternative to ID)"),
    },
    withErrors(async ({ environmentId, environmentName, containerId, containerName }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const cId = await resolveContainerId(client, envId, containerId, containerName);
      const containerNameValue = containerName || (await client.containers.get(envId, cId)).data.name;
      const result = await client.containers.stop(envId, cId);
      return {
        content: [{ type: "text", text: `Container '${containerNameValue}' stopped successfully in environment '${envId}'` }],
      };
    }),
  );

  server.tool(
    "arcane_container_restart",
    "Restart a Docker container.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      containerId: z.string().optional().describe("Container ID (use if known)"),
      containerName: z.string().optional().describe("Container name (alternative to ID)"),
    },
    withErrors(async ({ environmentId, environmentName, containerId, containerName }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const cId = await resolveContainerId(client, envId, containerId, containerName);
      const containerNameValue = containerName || (await client.containers.get(envId, cId)).data.name;
      const result = await client.containers.restart(envId, cId);
      return {
        content: [{ type: "text", text: `Container '${containerNameValue}' restarted successfully in environment '${envId}'` }],
      };
    }),
  );

  server.tool(
    "arcane_container_kill",
    "Force kill a Docker container.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      containerId: z.string().optional().describe("Container ID (use if known)"),
      containerName: z.string().optional().describe("Container name (alternative to ID)"),
    },
    withErrors(async ({ environmentId, environmentName, containerId, containerName }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const cId = await resolveContainerId(client, envId, containerId, containerName);
      const containerNameValue = containerName || (await client.containers.get(envId, cId)).data.name;
      const result = await client.containers.kill(envId, cId);
      return {
        content: [{ type: "text", text: `Container '${containerNameValue}' killed successfully in environment '${envId}'` }],
      };
    }),
  );
}
