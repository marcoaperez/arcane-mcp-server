import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArcaneClient } from "../arcane-client";
import { withErrors, textResponse } from "./respond";

const CAMPOS = {
  name: z.string().describe("Registry name"),
  url: z.string().describe("URL of the template catalog"),
  description: z.string().describe("Human-readable description"),
  enabled: z.boolean().describe("Whether Arcane fetches templates from this registry"),
};

export function registerTemplateRegistryTools(server: McpServer, client: ArcaneClient): void {
  server.tool(
    "arcane_template_registry_list",
    "List the template registries Arcane fetches Compose templates from. Check lastFetchError to see whether a registry is failing to load.",
    {},
    withErrors(async () => {
      const result = await client.templateRegistries.list();
      return textResponse(JSON.stringify({ data: result.data ?? [] }, null, 2));
    }),
  );

  server.tool(
    "arcane_template_registry_create",
    "Add a template registry. Template registries hold no credentials: a name, a URL, a description and enabled — all four are required.",
    { ...CAMPOS },
    withErrors(async ({ name, url, description, enabled }) => {
      const result = await client.templateRegistries.create({ name, url, description, enabled });
      return textResponse(JSON.stringify(result.data, null, 2));
    }),
  );

  server.tool(
    "arcane_template_registry_update",
    "Update a template registry. All four fields are required and this replaces all of them, including the ones you didn't mean to change: read the current values with arcane_template_registry_list first, or you will silently overwrite a field with a guessed value.",
    { registryId: z.string().describe("Registry ID"), ...CAMPOS },
    withErrors(async ({ registryId, name, url, description, enabled }) => {
      const result = await client.templateRegistries.update(registryId, { name, url, description, enabled });
      return textResponse(result.data.message);
    }),
  );

  server.tool(
    "arcane_template_registry_delete",
    "Delete a template registry.",
    { registryId: z.string().describe("Registry ID") },
    withErrors(async ({ registryId }) => {
      const result = await client.templateRegistries.delete(registryId);
      return textResponse(result.data.message);
    }),
  );
}
