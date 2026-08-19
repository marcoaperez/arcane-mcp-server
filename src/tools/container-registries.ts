import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArcaneClient } from "../arcane-client";
import { withErrors, listResponse, textResponse } from "./respond";

const LIST_PARAMS = {
  search: z.string().optional().describe("Free-text search over registry URLs and usernames"),
  sort: z.string().optional().describe("Column to sort by, e.g. url, registryType"),
  order: z.string().optional().describe("Sort direction: asc or desc"),
  start: z.number().int().min(0).optional().describe("Start index for pagination (server default: 0)"),
  limit: z.number().int().min(1).optional().describe("Items per page (server default: 20)"),
};

export function registerContainerRegistryTools(server: McpServer, client: ArcaneClient): void {
  server.tool(
    "arcane_container_registry_list",
    "List the container registries Arcane pulls images from. Credentials are never returned by this API: tokens and AWS secret keys are absent from the response, so what you get is configuration only.",
    { ...LIST_PARAMS },
    withErrors(async ({ search, sort, order, start, limit }) => {
      const result = await client.containerRegistries.list({ search, sort, order, start, limit });
      return listResponse(result, "container registries");
    }),
  );

  server.tool(
    "arcane_container_registry_get",
    "Get one container registry by ID. Credentials are never returned by this API.",
    { registryId: z.string().describe("Registry ID") },
    withErrors(async ({ registryId }) => {
      const result = await client.containerRegistries.get(registryId);
      return textResponse(JSON.stringify(result.data, null, 2));
    }),
  );

  server.tool(
    "arcane_container_registry_pull_usage",
    "Report pull-rate usage per registry: observed pulls, and the remaining quota when the provider exposes one.",
    {},
    withErrors(async () => {
      const result = await client.containerRegistries.pullUsage();
      const cuerpo = { registries: result.data.registries ?? [] };
      return textResponse(JSON.stringify(cuerpo, null, 2));
    }),
  );

  server.tool(
    "arcane_container_registry_test",
    "Test connectivity and authentication to a container registry. Does not modify the registry's configuration in Arcane. This performs a real registry login against the third-party host; only the failure path has been observed (host unreachable) — the success path has not been exercised against this instance, so what it does beyond that is not confirmed. On failure the error text is the registry login output, which names the host and the reason.",
    { registryId: z.string().describe("Registry ID") },
    withErrors(async ({ registryId }) => {
      const result = await client.containerRegistries.test(registryId);
      return textResponse(result.data.message);
    }),
  );
}
