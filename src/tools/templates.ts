import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArcaneClient } from "../arcane-client";
import { withErrors, listResponse } from "./respond";

const LIST_PARAMS = {
  search: z.string().optional().describe("Free-text search over template names"),
  sort: z.string().optional().describe("Column to sort by, e.g. name, createdAt"),
  order: z.string().optional().describe("Sort direction: asc or desc"),
  start: z.number().int().min(0).optional().describe("Start index for pagination (server default: 0)"),
  limit: z.number().int().min(1).optional().describe("Items per page (server default: 20)"),
};

export function registerTemplateTools(server: McpServer, client: ArcaneClient): void {
  server.tool(
    "arcane_template_list",
    "List Docker Compose templates. Returns pagination; if the response says there are more pages, pass start to see the rest before drawing conclusions about what exists.",
    {
      ...LIST_PARAMS,
      type: z.string().optional().describe("Filter by template type"),
    },
    withErrors(async ({ search, sort, order, start, limit, type }) => {
      const result = await client.templates.list({ search, sort, order, start, limit, type });
      return listResponse(result, "templates");
    }),
  );

  server.tool(
    "arcane_template_get",
    "Get details of a specific template.",
    {
      templateId: z.string().describe("Template ID"),
    },
    async ({ templateId }) => {
      try {
        const result = await client.templates.get(templateId);
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
    "arcane_template_create",
    "Create a new Docker Compose template.",
    {
      name: z.string().describe("Template name"),
      description: z.string().describe("Template description"),
      content: z.string().describe("Docker Compose YAML content"),
      envContent: z.string().describe("Environment variables file content"),
    },
    async (dto) => {
      try {
        const result = await client.templates.create(dto);
        return {
          content: [{ type: "text", text: `Template created successfully:\n${JSON.stringify(result.data, null, 2)}` }],
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
    "arcane_template_update",
    "Update an existing template. The API replaces the whole template, so all fields are required.",
    {
      templateId: z.string().describe("Template ID"),
      name: z.string().describe("Template name"),
      description: z.string().describe("Template description"),
      content: z.string().describe("Docker Compose YAML content"),
      envContent: z.string().describe("Environment variables file content"),
    },
    async ({ templateId, ...dto }) => {
      try {
        const result = await client.templates.update(templateId, dto);
        return {
          content: [{ type: "text", text: `Template updated successfully:\n${JSON.stringify(result.data, null, 2)}` }],
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
    "arcane_template_delete",
    "Delete a template.",
    {
      templateId: z.string().describe("Template ID"),
    },
    async ({ templateId }) => {
      try {
        const result = await client.templates.delete(templateId);
        return {
          content: [{ type: "text", text: result.message || "Template deleted successfully" }],
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
