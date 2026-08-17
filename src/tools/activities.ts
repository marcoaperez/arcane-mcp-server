import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArcaneClient } from "../arcane-client";
import { resolveEnvironmentId } from "./resolve";
import { withErrors, listResponse, textResponse } from "./respond";

const LIST_PARAMS = {
  search: z.string().optional().describe("Free-text search over activity names and resources"),
  sort: z.string().optional().describe("Column to sort by, e.g. createdAt, status, type"),
  order: z.string().optional().describe("Sort direction: asc or desc"),
  start: z.number().int().min(0).optional().describe("Start index for pagination (server default: 0)"),
  limit: z.number().int().min(1).optional().describe("Items per page (server default: 50)"),
};

export function registerActivityTools(server: McpServer, client: ArcaneClient): void {
  server.tool(
    "arcane_activity_list",
    "List background activities (deployments, pulls, scans) with optional filters. Returns pagination; if the response says there are more pages, pass start to see the rest before concluding an activity did not happen.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      ...LIST_PARAMS,
      status: z.string().optional().describe("Filter by status, e.g. running, success, failed"),
      type: z.string().optional().describe("Filter by activity type, e.g. image_update_check"),
      resourceType: z.string().optional().describe("Filter by resource type, e.g. images, volume"),
    },
    withErrors(async ({ environmentId, environmentName, search, sort, order, start, limit, status, type, resourceType }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.activities.list(envId, { search, sort, order, start, limit, status, type, resourceType });
      return listResponse(result, "activities");
    }),
  );

  server.tool(
    "arcane_activity_get",
    "Get a background activity with its full message log. Use this to resolve the activityId returned by deploy, redeploy and pull operations. The server truncates the message log to 500 entries by default; pass limit to raise that.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      activityId: z.string().describe("Activity ID"),
      limit: z.number().optional().describe("Maximum number of log messages to return (server default: 500)"),
    },
    withErrors(async ({ environmentId, environmentName, activityId, limit }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.activities.get(envId, activityId, limit);
      return { content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }] };
    }),
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
    withErrors(async ({ environmentId, environmentName, activityId, requestedBy }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.activities.cancel(envId, activityId, requestedBy);
      if (result.success === false) {
        return {
          content: [{ type: "text" as const, text: `Error: ${result.data?.error || "Cancel failed"}` }],
          isError: true,
        };
      }
      // El mensaje sale del estado real de la activity, no de un `message` inexistente.
      return textResponse(`Activity ${activityId} is now '${result.data.status}'`);
    }),
  );
}
