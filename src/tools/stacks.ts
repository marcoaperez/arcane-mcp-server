import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArcaneClient } from "../arcane-client";
import { resolveEnvironmentId, resolveStackId } from "./resolve";
import { withErrors, listResponse } from "./respond";

const LIST_PARAMS = {
  search: z.string().optional().describe("Free-text search over stack names"),
  sort: z.string().optional().describe("Column to sort by, e.g. name, status, createdAt"),
  order: z.string().optional().describe("Sort direction: asc or desc"),
  start: z.number().int().min(0).optional().describe("Start index for pagination (server default: 0)"),
  limit: z.number().int().min(1).optional().describe("Items per page (server default: 20)"),
};

export function registerStackTools(server: McpServer, client: ArcaneClient): void {
  server.tool(
    "arcane_stack_list",
    "List Docker Compose stacks (projects) in an environment. Returns pagination; if the response says there are more pages, pass start to see the rest before drawing conclusions about what exists.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      ...LIST_PARAMS,
      status: z.string().optional().describe("Filter by status, comma-separated: running, stopped, partially running"),
      archived: z.string().optional().describe("Archived filter: 'true' for only archived, 'all' to include them. Excluded by default"),
      tags: z.string().optional().describe("Filter by tag names, comma-separated, OR semantics"),
    },
    withErrors(async ({ environmentId, environmentName, search, sort, order, start, limit, status, archived, tags }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.stacks.list(envId, { search, sort, order, start, limit, status, archived, tags });
      return listResponse(result, "stacks");
    }),
  );

  server.tool(
    "arcane_stack_get",
    "Get details of a specific Docker Compose stack by ID or name.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      stackId: z.string().optional().describe("Stack ID (use if known)"),
      stackName: z.string().optional().describe("Stack name (alternative to ID)"),
    },
    async ({ environmentId, environmentName, stackId, stackName }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        const sId = await resolveStackId(client, envId, stackId, stackName);
        const result = await client.stacks.get(envId, sId);
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
    "arcane_stack_deploy",
    "Deploy a new Docker Compose stack to an environment.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      name: z.string().describe("Stack name"),
      composeContent: z.string().describe("Docker Compose YAML content"),
      envContent: z.string().optional().describe("Environment variables file content"),
    },
    async ({ environmentId, environmentName, ...dto }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        const result = await client.stacks.deploy(envId, dto);
        return {
          content: [{ type: "text", text: `Stack '${dto.name}' deployed successfully in environment '${envId}'` }],
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
    "arcane_stack_update",
    "Update an existing Docker Compose stack.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      stackId: z.string().optional().describe("Stack ID (use if known)"),
      stackName: z.string().optional().describe("Stack name (alternative to ID)"),
      name: z.string().optional().describe("New stack name"),
      composeContent: z.string().optional().describe("New Docker Compose YAML content"),
      envContent: z.string().optional().describe("New environment variables file content"),
    },
    async ({ environmentId, environmentName, stackId, stackName, ...dto }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        const sId = await resolveStackId(client, envId, stackId, stackName);
        const result = await client.stacks.update(envId, sId, dto);
        return {
          content: [{ type: "text", text: `Stack updated successfully:\n${JSON.stringify(result.data, null, 2)}` }],
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
    "arcane_stack_delete",
    "Delete a Docker Compose stack from an environment.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      stackId: z.string().optional().describe("Stack ID (use if known)"),
      stackName: z.string().optional().describe("Stack name (alternative to ID)"),
    },
    async ({ environmentId, environmentName, stackId, stackName }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        const sId = await resolveStackId(client, envId, stackId, stackName);
        const result = await client.stacks.delete(envId, sId);
        return {
          content: [{ type: "text", text: result.message || "Stack deleted successfully" }],
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
    "arcane_stack_start",
    "Start a Docker Compose stack.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      stackId: z.string().optional().describe("Stack ID (use if known)"),
      stackName: z.string().optional().describe("Stack name (alternative to ID)"),
    },
    async ({ environmentId, environmentName, stackId, stackName }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        const sId = await resolveStackId(client, envId, stackId, stackName);
        const stackNameValue = stackName || (await client.stacks.get(envId, sId)).data.name;
        const result = await client.stacks.start(envId, sId);
        if (result.success === false) {
          return {
            content: [{ type: "text", text: `Failed to start stack '${stackNameValue}': ${result.message}` }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text", text: `Stack '${stackNameValue}' started successfully in environment '${envId}'. ${result.message}` }],
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
    "arcane_stack_stop",
    "Stop a Docker Compose stack.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      stackId: z.string().optional().describe("Stack ID (use if known)"),
      stackName: z.string().optional().describe("Stack name (alternative to ID)"),
    },
    async ({ environmentId, environmentName, stackId, stackName }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        const sId = await resolveStackId(client, envId, stackId, stackName);
        const stackNameValue = stackName || (await client.stacks.get(envId, sId)).data.name;
        const result = await client.stacks.stop(envId, sId);
        return {
          content: [{ type: "text", text: `Stack '${stackNameValue}' stopped successfully in environment '${envId}'` }],
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
    "arcane_stack_restart",
    "Restart a Docker Compose stack.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      stackId: z.string().optional().describe("Stack ID (use if known)"),
      stackName: z.string().optional().describe("Stack name (alternative to ID)"),
    },
    async ({ environmentId, environmentName, stackId, stackName }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        const sId = await resolveStackId(client, envId, stackId, stackName);
        const stackNameValue = stackName || (await client.stacks.get(envId, sId)).data.name;
        const result = await client.stacks.restart(envId, sId);
        return {
          content: [{ type: "text", text: `Stack '${stackNameValue}' restarted successfully in environment '${envId}'` }],
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
    "arcane_stack_pull",
    "Pull images for a Docker Compose stack.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      stackId: z.string().optional().describe("Stack ID (use if known)"),
      stackName: z.string().optional().describe("Stack name (alternative to ID)"),
    },
    async ({ environmentId, environmentName, stackId, stackName }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        const sId = await resolveStackId(client, envId, stackId, stackName);
        const stackNameValue = stackName || (await client.stacks.get(envId, sId)).data.name;
        const result = await client.stacks.pull(envId, sId);
        if (result.success === false) {
          return {
            content: [{ type: "text", text: `Pull failed for stack '${stackNameValue}': ${result.message}` }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text", text: `Images pulled successfully for stack '${stackNameValue}' in environment '${envId}'. ${result.message}` }],
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
