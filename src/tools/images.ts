import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArcaneClient } from "../arcane-client";
import { resolveEnvironmentId } from "./resolve";
import { withErrors, listResponse } from "./respond";

const LIST_PARAMS = {
  search: z.string().optional().describe("Free-text search over image repositories and tags"),
  sort: z.string().optional().describe("Column to sort by, e.g. repository, size, created"),
  order: z.string().optional().describe("Sort direction: asc or desc"),
  start: z.number().int().min(0).optional().describe("Start index for pagination (server default: 0)"),
  limit: z.number().int().min(1).optional().describe("Items per page (server default: 20)"),
};

export function registerImageTools(server: McpServer, client: ArcaneClient): void {
  server.tool(
    "arcane_image_list",
    "List Docker images in an environment. Returns pagination; if the response says there are more pages, pass start to see the rest before drawing conclusions about what exists.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      ...LIST_PARAMS,
      inUse: z.string().optional().describe("Filter by in-use status: true or false"),
    },
    withErrors(async ({ environmentId, environmentName, search, sort, order, start, limit, inUse }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.images.list(envId, { search, sort, order, start, limit, inUse });
      return listResponse(result, "images");
    }),
  );

  server.tool(
    "arcane_image_pull",
    "Pull a Docker image in an environment.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      imageName: z.string().describe("Image name to pull (e.g., nginx:latest)"),
    },
    async ({ environmentId, environmentName, imageName }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        const result = await client.images.pull(envId, { imageName });
        return {
          content: [{ type: "text", text: result.message || `Image '${imageName}' pulled successfully` }],
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
    "arcane_image_remove",
    "Remove a Docker image from an environment.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      imageId: z.string().describe("Image ID to remove"),
    },
    async ({ environmentId, environmentName, imageId }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        const result = await client.images.remove(envId, imageId);
        return {
          content: [{ type: "text", text: result.message || `Image '${imageId}' removed successfully` }],
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
    "arcane_image_prune",
    "Remove unused Docker images from an environment.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
    },
    async ({ environmentId, environmentName }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        const result = await client.images.prune(envId);
        return {
          content: [
            {
              type: "text",
              text: `Pruned ${result.data.imagesDeleted} images, reclaimed ${result.data.spaceReclaimed} bytes`,
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
