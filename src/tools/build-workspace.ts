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

/**
 * Medido el 2026-08-19 contra esta instancia: de los seis entornos, solo uno
 * tiene el workspace de builds utilizable. Los otros cinco responden
 * `500 failed to ensure builds directory: mkdir /builds: permission denied`
 * ante cualquiera de estas cuatro tools. No se sabe por que, y no se
 * sugiere aqui cual es el entorno bueno: solo se deja constancia del hecho
 * observable, para que un modelo que reciba ese error no concluya que el
 * workspace esta roto ni se invente una causa.
 *
 * NOTA: el texto se repite como literal en las cuatro tools, en vez de
 * factorizarse en una constante o interpolarse en un template literal,
 * porque `scripts/gen-tools-table.mjs` solo reconoce el segundo argumento de
 * `server.tool(...)` cuando es exactamente un `StringLiteral`: cualquier
 * expresion mas rica (template literal, concatenacion) lo deja vacio en el
 * README hasta que alguien se acuerde de correr `--check` y lo note.
 */

export function registerBuildWorkspaceTools(server: McpServer, client: ArcaneClient): void {
  server.tool(
    "arcane_build_workspace_browse",
    "List files and directories in the build workspace of an environment. The workspace is a directory inside the Arcane agent, not the host filesystem, and paths cannot escape it. Measured against this instance: only 1 of the 6 environments has a usable build workspace. The other 5 respond \"500 failed to ensure builds directory: mkdir /builds: permission denied\".",
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
    "Read a file from the build workspace. Binary files are not returned: their MIME type and the number of bytes read are reported instead. Measured against this instance: only 1 of the 6 environments has a usable build workspace. The other 5 respond \"500 failed to ensure builds directory: mkdir /builds: permission denied\".",
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
        // bytes.length es lo que se leyo, no el tamano del fichero: si
        // maxBytes recorto la lectura, esta cifra puede ser menor que el
        // fichero real y no hay forma de saberlo desde aqui (la API no
        // devuelve el tamano total). Se dice "bytes read", no "bytes", y se
        // avisa cuando la lectura pudo quedar truncada por maxBytes.
        const posibleTruncado = maxBytes !== undefined && bytes.length >= maxBytes;
        const aviso = posibleTruncado
          ? ` Reading was capped at maxBytes=${maxBytes}: this may be less than the file's actual size, which is not known here.`
          : "";
        return textResponse(
          `'${path}' is ${result.data.mimeType}; ${bytes.length} bytes were read.${aviso} Binary content is not returned.`,
        );
      }
      return textResponse(bytes.toString("utf8"));
    }),
  );

  server.tool(
    "arcane_build_workspace_mkdir",
    "Create a directory in the build workspace. Measured against this instance: only 1 of the 6 environments has a usable build workspace. The other 5 respond \"500 failed to ensure builds directory: mkdir /builds: permission denied\".",
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
    "Delete a file or directory from the build workspace. A path is required: this tool cannot delete the workspace root. Measured against this instance: only 1 of the 6 environments has a usable build workspace. The other 5 respond \"500 failed to ensure builds directory: mkdir /builds: permission denied\".",
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
