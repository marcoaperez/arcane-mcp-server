import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArcaneClient } from "../arcane-client";
import { resolveEnvironmentId } from "./resolve";
import { withErrors, listResponse } from "./respond";

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
    "List backups of a Docker volume. Returns pagination; if the response says there are more pages, pass start to see the rest.",
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
    "Download a volume backup. Returns download URL or instructions.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      backupId: z.string().describe("Backup ID"),
    },
    withErrors(async ({ environmentId, environmentName, backupId }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      return {
        content: [{ type: "text", text: `Download available for backup '${backupId}' in environment '${envId}'.\nNote: Binary download is not supported via MCP tool interface. Use the API directly to download the backup file.` }],
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
