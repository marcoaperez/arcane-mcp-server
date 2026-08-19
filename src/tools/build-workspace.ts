import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArcaneClient } from "../arcane-client";
import { resolveEnvironmentId } from "./resolve";
import { withErrors, textResponse } from "./respond";

/**
 * `path` obligatorio y no vacio en las tools que escriben.
 *
 * openapi.txt lo declara OPCIONAL en el DELETE, asi que
 * `DELETE /builds/browse` sin path es una llamada legal cuyo efecto plausible
 * es borrar la raiz del workspace. No esta medido y no se va a medir: se
 * impide desde el esquema.
 */
const RUTA_OBLIGATORIA = z
  .string()
  .min(1)
  .describe("Path relative to the builds workspace root (required, must not be empty)");

/** Tipos cuyo contenido tiene sentido volcar como texto. */
const TIPOS_TEXTUALES = ["application/json", "application/yaml", "application/x-yaml", "application/xml"];

function esTextual(mimeType: string): boolean {
  return mimeType.startsWith("text/") || TIPOS_TEXTUALES.includes(mimeType);
}

export function registerBuildWorkspaceTools(server: McpServer, client: ArcaneClient): void {
  server.tool(
    "arcane_build_workspace_browse",
    "List files and directories in the build workspace of an environment. The workspace is a directory inside the Arcane agent, not the host filesystem, and paths cannot escape it.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      path: z.string().optional().describe("Path relative to the workspace root (defaults to the root)"),
    },
    withErrors(async ({ environmentId, environmentName, path }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.buildWorkspace.browse(envId, path);
      return textResponse(JSON.stringify({ data: result.data ?? [] }, null, 2));
    }),
  );

  server.tool(
    "arcane_build_workspace_read",
    "Read a file from the build workspace. Binary files are not returned: their type and size are reported instead.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      path: RUTA_OBLIGATORIA,
      maxBytes: z.number().int().min(1).optional().describe("Maximum bytes to read"),
    },
    withErrors(async ({ environmentId, environmentName, path, maxBytes }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.buildWorkspace.read(envId, path, maxBytes);
      const bytes = Buffer.from(result.data.content, "base64");
      if (!esTextual(result.data.mimeType)) {
        return textResponse(
          `'${path}' is ${result.data.mimeType}, ${bytes.length} bytes. Binary content is not returned.`,
        );
      }
      return textResponse(bytes.toString("utf8"));
    }),
  );

  server.tool(
    "arcane_build_workspace_mkdir",
    "Create a directory in the build workspace.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      path: RUTA_OBLIGATORIA,
    },
    withErrors(async ({ environmentId, environmentName, path }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      await client.buildWorkspace.mkdir(envId, path);
      return textResponse(`Created '${path}' in the build workspace.`);
    }),
  );

  server.tool(
    "arcane_build_workspace_delete",
    "Delete a file or directory from the build workspace. A path is required: this tool cannot delete the workspace root.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      path: RUTA_OBLIGATORIA,
    },
    withErrors(async ({ environmentId, environmentName, path }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      await client.buildWorkspace.delete(envId, path);
      return textResponse(`Deleted '${path}' from the build workspace.`);
    }),
  );
}
