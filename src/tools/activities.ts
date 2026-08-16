import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArcaneClient } from "../arcane-client";
import { resolveEnvironmentId } from "./resolve";

export function registerActivityTools(server: McpServer, client: ArcaneClient): void {
  server.tool(
    "arcane_activity_list",
    "List background activities (deployments, pulls, scans) with optional filters.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      status: z.string().optional().describe("Filter by status, e.g. running, success, failed"),
      type: z.string().optional().describe("Filter by activity type, e.g. image_update_check"),
      resourceType: z.string().optional().describe("Filter by resource type, e.g. images, volume"),
      search: z.string().optional().describe("Free-text search"),
      limit: z.number().optional().describe("Maximum number of activities to return"),
    },
    async ({ environmentId, environmentName, status, type, resourceType, search, limit }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        const result = await client.activities.list(envId, { search, status, type, resourceType, limit });
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
    "arcane_activity_get",
    "Get a background activity with its full message log. Use this to resolve the activityId returned by deploy, redeploy and pull operations.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      activityId: z.string().describe("Activity ID"),
    },
    async ({ environmentId, environmentName, activityId }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        const result = await client.activities.get(envId, activityId);
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
    "arcane_activity_cancel",
    "Cancel a running background activity.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      activityId: z.string().describe("Activity ID"),
      requestedBy: z.string().optional().describe("Who requested the cancellation"),
    },
    async ({ environmentId, environmentName, activityId, requestedBy }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        const result = await client.activities.cancel(envId, activityId, requestedBy);
        if (result.success === false) {
          return {
            content: [{ type: "text", text: `Error: ${result.message || "Cancel failed"}` }],
            isError: true,
          };
        }
        return { content: [{ type: "text", text: result.message || "Activity cancelled" }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );
}
