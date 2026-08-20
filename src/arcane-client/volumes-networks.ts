import type { ArcaneClient } from "../arcane-client";
import type { ActionResponse, ListOptionsWithSort, NetworkInspect, NetworkListOptions, NetworkPruneReport, NetworkSummary, NetworkUsageCounts, PaginatedResponse, PaginatedResponseWithCounts, Volume, VolumeListOptions, VolumePruneReport, VolumeUsageCounts } from "./types-catalog";
import type { VolumeBackup, VolumeWorkspace, WorkspaceUpdateManifest } from "./types-git-activity";
import { appendListParams } from "./internal";

export class VolumesMethods {
  constructor(private client: ArcaneClient) {}

  async list(envId: string, opts?: VolumeListOptions): Promise<PaginatedResponseWithCounts<Volume, VolumeUsageCounts>> {
    const params = new URLSearchParams();
    appendListParams(params, opts);
    if (opts?.inUse) params.set("inUse", opts.inUse);
    if (opts?.includeInternal !== undefined) params.set("includeInternal", String(opts.includeInternal));
    const query = params.toString();
    return this.client.request<PaginatedResponseWithCounts<Volume, VolumeUsageCounts>>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/volumes${query ? `?${query}` : ""}`
    );
  }

  async inspect(envId: string, name: string): Promise<{ success: boolean; data: Volume }> {
    return this.client.request<{ success: boolean; data: Volume }>("GET", `/environments/${encodeURIComponent(envId)}/volumes/${encodeURIComponent(name)}`);
  }

  async remove(envId: string, name: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("DELETE", `/environments/${encodeURIComponent(envId)}/volumes/${encodeURIComponent(name)}`);
  }

  async prune(envId: string): Promise<{ success: boolean; data: VolumePruneReport }> {
    return this.client.request<{ success: boolean; data: VolumePruneReport }>("POST", `/environments/${encodeURIComponent(envId)}/volumes/prune`);
  }
}

export class NetworksMethods {
  constructor(private client: ArcaneClient) {}

  async list(envId: string, opts?: NetworkListOptions): Promise<PaginatedResponseWithCounts<NetworkSummary, NetworkUsageCounts>> {
    const params = new URLSearchParams();
    appendListParams(params, opts);
    if (opts?.inUse) params.set("inUse", opts.inUse);
    const query = params.toString();
    return this.client.request<PaginatedResponseWithCounts<NetworkSummary, NetworkUsageCounts>>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/networks${query ? `?${query}` : ""}`
    );
  }

  async inspect(envId: string, networkId: string): Promise<{ success: boolean; data: NetworkInspect }> {
    return this.client.request<{ success: boolean; data: NetworkInspect }>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/networks/${encodeURIComponent(networkId)}`
    );
  }

  async remove(envId: string, networkId: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("DELETE", `/environments/${encodeURIComponent(envId)}/networks/${encodeURIComponent(networkId)}`);
  }

  async prune(envId: string): Promise<{ success: boolean; data: NetworkPruneReport }> {
    return this.client.request<{ success: boolean; data: NetworkPruneReport }>("POST", `/environments/${encodeURIComponent(envId)}/networks/prune`);
  }
}

export class VolumeBackupsMethods {
  constructor(private client: ArcaneClient) {}

  async create(envId: string, volumeName: string): Promise<{ success: boolean; data: VolumeBackup }> {
    return this.client.request<{ success: boolean; data: VolumeBackup }>(
      "POST",
      `/environments/${encodeURIComponent(envId)}/volumes/${encodeURIComponent(volumeName)}/backups`
    );
  }

  async list(envId: string, volumeName: string, opts?: ListOptionsWithSort): Promise<PaginatedResponse<VolumeBackup>> {
    const params = new URLSearchParams();
    appendListParams(params, opts);
    const query = params.toString();
    return this.client.request<PaginatedResponse<VolumeBackup>>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/volumes/${encodeURIComponent(volumeName)}/backups${query ? `?${query}` : ""}`
    );
  }

  async delete(envId: string, backupId: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("DELETE", `/environments/${encodeURIComponent(envId)}/volumes/backups/${encodeURIComponent(backupId)}`);
  }

  // No hay metodo download(): un cliente MCP no puede recibir un flujo
  // binario. arcane_volume_backup_download (src/tools/volume-backups.ts)
  // verifica el backup con list() y devuelve el comando curl exacto contra
  // el endpoint /environments/{envId}/volumes/backups/{backupId}/download
  // para que lo ejecute un humano. Antes de este arreglo este metodo existia
  // pero ninguna tool lo llamaba: era codigo muerto.

  async restore(envId: string, volumeName: string, backupId: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>(
      "POST",
      `/environments/${encodeURIComponent(envId)}/volumes/${encodeURIComponent(volumeName)}/backups/${encodeURIComponent(backupId)}/restore`
    );
  }
}

export class VolumeFilesMethods {
  constructor(private client: ArcaneClient) {}

  /**
   * Devuelve el árbol completo del volumen. A diferencia del antiguo `/browse`,
   * la API workspace no acepta un parámetro de ruta: entrega el árbol entero y
   * cada entrada trae su `relativePath`.
   */
  async getWorkspace(envId: string, volumeName: string): Promise<{ success: boolean; data: VolumeWorkspace }> {
    return this.client.request<{ success: boolean; data: VolumeWorkspace }>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/volumes/${encodeURIComponent(volumeName)}/workspace`
    );
  }

  /**
   * Escribe un fichero en el volumen mediante `PUT /workspace` (multipart).
   * Lee antes el workspace porque el manifiesto exige el `fileTreeRevision`
   * vigente: es el testigo de concurrencia optimista que evita pisar cambios ajenos.
   */
  async uploadFile(
    envId: string,
    volumeName: string,
    relativePath: string,
    content: string
  ): Promise<ActionResponse> {
    const workspace = await this.getWorkspace(envId, volumeName);

    const manifest: WorkspaceUpdateManifest = {
      fileTreeRevision: workspace.data.fileTreeRevision,
      fileChanges: [{ operation: "create_file", relativePath, uploadIndex: 0 }],
    };

    const form = new FormData();
    form.set("manifest", JSON.stringify(manifest));
    form.append("files", new File([content], relativePath.split("/").pop() || relativePath));

    return this.client.requestMultipart<ActionResponse>(
      "PUT",
      `/environments/${encodeURIComponent(envId)}/volumes/${encodeURIComponent(volumeName)}/workspace`,
      form
    );
  }
}
