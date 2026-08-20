import type { ArcaneClient } from "../arcane-client";
import type { ActionResponse, ContainerListOptions, ContainerStatusCounts, ListOptionsWithSort, PaginatedResponse, PaginatedResponseWithCounts } from "./types-catalog";
import type { ContainerRegistry, MessageResponse, RegistryPullUsageResponse } from "./types-registries";
import type { ContainerDetails, ContainerSummary } from "./types-resources";
import type { ContainerCreateOptions } from "./types-system-build";
import { appendListParams } from "./internal";

export class ContainersMethods {
  constructor(private client: ArcaneClient) {}

  async list(envId: string, opts?: ContainerListOptions): Promise<PaginatedResponseWithCounts<ContainerSummary, ContainerStatusCounts>> {
    const params = new URLSearchParams();
    appendListParams(params, opts);
    if (opts?.includeInternal !== undefined) params.set("includeInternal", String(opts.includeInternal));
    if (opts?.standalone) params.set("standalone", opts.standalone);
    if (opts?.updates) params.set("updates", opts.updates);
    const query = params.toString();
    return this.client.request<PaginatedResponseWithCounts<ContainerSummary, ContainerStatusCounts>>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/containers${query ? `?${query}` : ""}`
    );
  }

  async get(envId: string, containerId: string): Promise<{ success: boolean; data: ContainerDetails }> {
    return this.client.request<{ success: boolean; data: ContainerDetails }>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/containers/${encodeURIComponent(containerId)}`
    );
  }

  async start(envId: string, containerId: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("POST", `/environments/${encodeURIComponent(envId)}/containers/${encodeURIComponent(containerId)}/start`);
  }

  async stop(envId: string, containerId: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("POST", `/environments/${encodeURIComponent(envId)}/containers/${encodeURIComponent(containerId)}/stop`);
  }

  async restart(envId: string, containerId: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("POST", `/environments/${encodeURIComponent(envId)}/containers/${encodeURIComponent(containerId)}/restart`);
  }

  async kill(envId: string, containerId: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("POST", `/environments/${encodeURIComponent(envId)}/containers/${encodeURIComponent(containerId)}/update`, { action: "kill" });
  }
}

export class ContainerAdditionalMethods {
  constructor(private client: ArcaneClient) {}

  async create(envId: string, dto: ContainerCreateOptions): Promise<{ success: boolean; data: ContainerDetails }> {
    return this.client.request<{ success: boolean; data: ContainerDetails }>("POST", `/environments/${encodeURIComponent(envId)}/containers`, dto);
  }

  async delete(envId: string, containerId: string, force?: boolean, volumes?: boolean): Promise<ActionResponse> {
    const params = new URLSearchParams();
    if (force) params.set("force", "true");
    if (volumes) params.set("volumes", "true");
    const query = params.toString();
    return this.client.request<ActionResponse>(
      "DELETE",
      `/environments/${encodeURIComponent(envId)}/containers/${encodeURIComponent(containerId)}${query ? `?${query}` : ""}`
    );
  }

  async update(envId: string, containerId: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("POST", `/environments/${encodeURIComponent(envId)}/containers/${encodeURIComponent(containerId)}/update`);
  }
}

export class ContainerRegistriesMethods {
  constructor(private client: ArcaneClient) {}

  async list(opts?: ListOptionsWithSort): Promise<PaginatedResponse<ContainerRegistry>> {
    const params = new URLSearchParams();
    appendListParams(params, opts);
    const query = params.toString();
    return this.client.request<PaginatedResponse<ContainerRegistry>>(
      "GET",
      `/container-registries${query ? `?${query}` : ""}`,
    );
  }

  async get(id: string): Promise<{ success: boolean; data: ContainerRegistry }> {
    return this.client.request<{ success: boolean; data: ContainerRegistry }>(
      "GET",
      `/container-registries/${encodeURIComponent(id)}`,
    );
  }

  async pullUsage(): Promise<{ success: boolean; data: RegistryPullUsageResponse }> {
    return this.client.request<{ success: boolean; data: RegistryPullUsageResponse }>(
      "GET",
      "/container-registries/pull-usage",
    );
  }

  async test(id: string): Promise<MessageResponse> {
    return this.client.request<MessageResponse>(
      "POST",
      `/container-registries/${encodeURIComponent(id)}/test`,
    );
  }
}
