import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArcaneClient } from "../arcane-client";
import { resolveEnvironmentId } from "./resolve";
import { withErrors, listResponse } from "./respond";
import { collectAllPages } from "./paging";

const LIST_PARAMS = {
  search: z.string().optional().describe("Free-text search over backup names"),
  sort: z.string().optional().describe("Column to sort by, e.g. createdAt, size"),
  order: z.string().optional().describe("Sort direction: asc or desc"),
  start: z.number().int().min(0).optional().describe("Start index for pagination (server default: 0)"),
  limit: z.number().int().min(1).optional().describe("Items per page (server default: 20)"),
};

export function registerVolumeBackupTools(server: McpServer, client: ArcaneClient): void {
  server.tool(
    "arcane_volume_backup_create",
    "Create a backup of a Docker volume.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      volumeName: z.string().describe("Volume name"),
    },
    withErrors(async ({ environmentId, environmentName, volumeName }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.volumeBackups.create(envId, volumeName);
      return {
        content: [{ type: "text", text: `Volume backup created successfully:\n${JSON.stringify(result.data, null, 2)}` }],
      };
    }),
  );

  server.tool(
    "arcane_volume_backup_list",
    "List backups of a Docker volume. Returns pagination; if the response says there are more pages, pass start to see the rest before drawing conclusions about what exists.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      volumeName: z.string().describe("Volume name"),
      ...LIST_PARAMS,
    },
    withErrors(async ({ environmentId, environmentName, volumeName, search, sort, order, start, limit }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.volumeBackups.list(envId, volumeName, { search, sort, order, start, limit });
      return listResponse(result, "volume backups");
    }),
  );

  server.tool(
    "arcane_volume_backup_delete",
    "Delete a volume backup.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      backupId: z.string().describe("Backup ID"),
    },
    withErrors(async ({ environmentId, environmentName, backupId }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.volumeBackups.delete(envId, backupId);
      return {
        content: [{ type: "text", text: result.message || "Volume backup deleted successfully" }],
      };
    }),
  );

  server.tool(
    "arcane_volume_backup_download",
    "Look up a volume backup and get the command to download it. This tool cannot stream the binary backup file to an MCP client, so it does NOT return the file itself: it verifies the backup really exists (isError if not), returns its metadata, and gives the exact curl command for a human to run to fetch the file directly from the Arcane API.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      volumeName: z.string().describe("Volume name the backup belongs to"),
      backupId: z.string().describe("Backup ID"),
    },
    withErrors(async ({ environmentId, environmentName, volumeName, backupId }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);

      // No hay endpoint "get" para un backup suelto: la unica forma de
      // verificar que existe de verdad es recorrer el listado del volumen y
      // buscarlo por id, igual que hacen los resolvers nombre->id.
      const { items, complete, totalItems } = await collectAllPages("createdAt", (req) =>
        client.volumeBackups.list(envId, volumeName, req),
      );
      const backup = items.find((b) => b.id === backupId);

      if (!backup) {
        if (!complete) {
          return {
            content: [{
              type: "text",
              text: `Backup '${backupId}' not found among the first ${items.length} of ${totalItems} backups ` +
                `for volume '${volumeName}' in environment '${envId}'. The collection is large; this check did not see all of it.`,
            }],
            isError: true,
          };
        }
        return {
          content: [{
            type: "text",
            text: `Backup '${backupId}' not found for volume '${volumeName}' in environment '${envId}'.`,
          }],
          isError: true,
        };
      }

      // Mismo endpoint que usa ArcaneClient.volumeBackups.download(): sin
      // volumeName en la ruta, solo envId + backupId.
      const downloadUrl = `${client.getBaseUrl()}/environments/${encodeURIComponent(envId)}/volumes/backups/${encodeURIComponent(backupId)}/download`;
      const command = `curl -H "X-API-Key: $ARCANE_API_KEY" -o "${volumeName}-${backupId}.backup" "${downloadUrl}"`;

      return {
        content: [{
          type: "text",
          text: `Backup found. Metadata:\n${JSON.stringify(backup, null, 2)}\n\n` +
            `This MCP tool interface cannot stream binary data, so run this to download the file:\n${command}`,
        }],
      };
    }),
  );

  server.tool(
    "arcane_volume_backup_restore",
    "Restore a volume from a backup.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      volumeName: z.string().describe("Volume name"),
      backupId: z.string().describe("Backup ID"),
    },
    withErrors(async ({ environmentId, environmentName, volumeName, backupId }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.volumeBackups.restore(envId, volumeName, backupId);
      return {
        content: [{ type: "text", text: result.message || "Volume restored successfully from backup" }],
      };
    }),
  );
}
