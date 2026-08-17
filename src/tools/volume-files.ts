import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArcaneClient } from "../arcane-client";
import { resolveEnvironmentId } from "./resolve";
import { withErrors, textResponse } from "./respond";

export function registerVolumeFileTools(server: McpServer, client: ArcaneClient): void {
  server.tool(
    "arcane_volume_browse",
    "List the file tree of a Docker volume. The server may truncate the tree: check fileTreeTruncated before concluding a file does not exist.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      volumeName: z.string().describe("Volume name"),
    },
    withErrors(async ({ environmentId, environmentName, volumeName }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.volumeFiles.getWorkspace(envId, volumeName);

      // `files` admite null en el spec; sin esto se serializaria como el texto
      // "null", que no es ni una lista vacia ni un error. Misma deuda que tuvo
      // arcane_job_list.
      const cuerpo = { ...result.data, files: result.data.files ?? [] };
      const texto = JSON.stringify(cuerpo, null, 2);

      // El spec declara fileTreeTruncated como obligatorio: la propia API
      // contempla devolver un arbol recortado. Enterrado entre cientos de
      // entradas es facil de saltarse leyendo, asi que cuando ocurre se dice
      // en prosa, igual que hace listResponse con las listas paginadas.
      if (result.data.fileTreeTruncated) {
        return textResponse(
          "This file tree is TRUNCATED: it does not list every file in the volume. " +
            "Do not conclude a file is absent from what is missing here.\n" +
            texto,
        );
      }

      return textResponse(texto);
    }),
  );

  server.tool(
    "arcane_volume_upload_file",
    "Upload a file to a Docker volume.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      volumeName: z.string().describe("Volume name"),
      filename: z.string().describe("Name of the file to create"),
      content: z.string().describe("File content"),
      path: z.string().optional().describe("Destination path within the volume (defaults to root)"),
    },
    withErrors(async ({ environmentId, environmentName, volumeName, filename, content, path }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      // La API workspace direcciona por ruta relativa única, no por (path, filename).
      const relativePath = path ? `${path.replace(/\/+$/, "")}/${filename}` : filename;
      const result = await client.volumeFiles.uploadFile(envId, volumeName, relativePath, content);
      if (result.success === false) {
        return {
          content: [{ type: "text", text: `Error: ${result.message || "Upload failed"}` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text", text: result.message || "File uploaded successfully" }],
      };
    }),
  );
}
