import type { ArcaneClient } from "../arcane-client";
import type { ActionResponse, GitopsSyncCounts, ListOptionsWithSort, PaginatedResponse, PaginatedResponseWithCounts, Template, TemplateCreate, TemplateListOptions, TemplateUpdate } from "./types-catalog";
import type { GitBranch, GitFileNode, GitOpsSync, GitOpsSyncCreate, GitOpsSyncStatus, GitOpsSyncUpdate, GitRepository, GitRepositoryCreate, GitRepositoryUpdate } from "./types-git-activity";
import type { MessageResponse, TemplateRegistry, TemplateRegistryInput } from "./types-registries";
import { appendListParams } from "./internal";

export class TemplatesMethods {
  constructor(private client: ArcaneClient) {}

  async list(opts?: TemplateListOptions): Promise<PaginatedResponse<Template>> {
    const params = new URLSearchParams();
    appendListParams(params, opts);
    if (opts?.type) params.set("type", opts.type);
    const query = params.toString();
    return this.client.request<PaginatedResponse<Template>>("GET", `/templates${query ? `?${query}` : ""}`);
  }

  async get(id: string): Promise<{ success: boolean; data: Template }> {
    return this.client.request<{ success: boolean; data: Template }>("GET", `/templates/${encodeURIComponent(id)}`);
  }

  async create(dto: TemplateCreate): Promise<{ success: boolean; data: Template }> {
    return this.client.request<{ success: boolean; data: Template }>("POST", "/templates", dto);
  }

  async update(id: string, dto: TemplateUpdate): Promise<{ success: boolean; data: Template }> {
    return this.client.request<{ success: boolean; data: Template }>("PUT", `/templates/${encodeURIComponent(id)}`, dto);
  }

  async delete(id: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("DELETE", `/templates/${encodeURIComponent(id)}`);
  }
}

export class TemplateRegistriesMethods {
  constructor(private client: ArcaneClient) {}

  async list(): Promise<{ success: boolean; data: TemplateRegistry[] | null }> {
    return this.client.request<{ success: boolean; data: TemplateRegistry[] | null }>(
      "GET",
      "/templates/registries",
    );
  }

  async create(dto: TemplateRegistryInput): Promise<{ success: boolean; data: TemplateRegistry }> {
    return this.client.request<{ success: boolean; data: TemplateRegistry }>(
      "POST",
      "/templates/registries",
      dto,
    );
  }

  async update(id: string, dto: TemplateRegistryInput): Promise<MessageResponse> {
    return this.client.request<MessageResponse>(
      "PUT",
      `/templates/registries/${encodeURIComponent(id)}`,
      dto,
    );
  }

  async delete(id: string): Promise<MessageResponse> {
    return this.client.request<MessageResponse>(
      "DELETE",
      `/templates/registries/${encodeURIComponent(id)}`,
    );
  }
}

export class GitRepositoriesMethods {
  constructor(private client: ArcaneClient) {}

  async list(opts?: ListOptionsWithSort): Promise<PaginatedResponse<GitRepository>> {
    const params = new URLSearchParams();
    appendListParams(params, opts);
    const query = params.toString();
    return this.client.request<PaginatedResponse<GitRepository>>(
      "GET",
      `/customize/git-repositories${query ? `?${query}` : ""}`
    );
  }

  async get(id: string): Promise<{ success: boolean; data: GitRepository }> {
    return this.client.request<{ success: boolean; data: GitRepository }>("GET", `/customize/git-repositories/${encodeURIComponent(id)}`);
  }

  async create(dto: GitRepositoryCreate): Promise<{ success: boolean; data: GitRepository }> {
    return this.client.request<{ success: boolean; data: GitRepository }>("POST", "/customize/git-repositories", dto);
  }

  async update(id: string, dto: GitRepositoryUpdate): Promise<{ success: boolean; data: GitRepository }> {
    return this.client.request<{ success: boolean; data: GitRepository }>("PUT", `/customize/git-repositories/${encodeURIComponent(id)}`, dto);
  }

  async delete(id: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("DELETE", `/customize/git-repositories/${encodeURIComponent(id)}`);
  }

  async listBranches(id: string): Promise<{ success: boolean; data: GitBranch[] }> {
    return this.client.request<{ success: boolean; data: GitBranch[] }>("GET", `/customize/git-repositories/${encodeURIComponent(id)}/branches`);
  }

  async browseFiles(id: string, branch?: string, path?: string): Promise<{ success: boolean; data: GitFileNode[] }> {
    const params = new URLSearchParams();
    if (branch) params.set("branch", branch);
    if (path) params.set("path", path);
    const query = params.toString();
    return this.client.request<{ success: boolean; data: GitFileNode[] }>(
      "GET",
      `/customize/git-repositories/${encodeURIComponent(id)}/files${query ? `?${query}` : ""}`
    );
  }

  async test(id: string, branch?: string): Promise<ActionResponse> {
    const body = branch ? { branch } : undefined;
    return this.client.request<ActionResponse>("POST", `/customize/git-repositories/${encodeURIComponent(id)}/test`, body);
  }
}

export class GitOpsSyncsMethods {
  constructor(private client: ArcaneClient) {}

  async list(envId: string, opts?: ListOptionsWithSort): Promise<PaginatedResponseWithCounts<GitOpsSync, GitopsSyncCounts>> {
    const params = new URLSearchParams();
    appendListParams(params, opts);
    const query = params.toString();
    return this.client.request<PaginatedResponseWithCounts<GitOpsSync, GitopsSyncCounts>>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/gitops-syncs${query ? `?${query}` : ""}`
    );
  }

  async get(envId: string, syncId: string): Promise<{ success: boolean; data: GitOpsSync }> {
    return this.client.request<{ success: boolean; data: GitOpsSync }>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/gitops-syncs/${encodeURIComponent(syncId)}`
    );
  }

  async create(envId: string, dto: GitOpsSyncCreate): Promise<{ success: boolean; data: GitOpsSync }> {
    return this.client.request<{ success: boolean; data: GitOpsSync }>(
      "POST",
      `/environments/${encodeURIComponent(envId)}/gitops-syncs`,
      dto
    );
  }

  async update(envId: string, syncId: string, dto: GitOpsSyncUpdate): Promise<{ success: boolean; data: GitOpsSync }> {
    return this.client.request<{ success: boolean; data: GitOpsSync }>(
      "PUT",
      `/environments/${encodeURIComponent(envId)}/gitops-syncs/${encodeURIComponent(syncId)}`,
      dto
    );
  }

  async delete(envId: string, syncId: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("DELETE", `/environments/${encodeURIComponent(envId)}/gitops-syncs/${encodeURIComponent(syncId)}`);
  }

  async browseFiles(envId: string, syncId: string, path?: string): Promise<{ success: boolean; data: GitFileNode[] }> {
    const params = new URLSearchParams();
    if (path) params.set("path", path);
    const query = params.toString();
    return this.client.request<{ success: boolean; data: GitFileNode[] }>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/gitops-syncs/${encodeURIComponent(syncId)}/files${query ? `?${query}` : ""}`
    );
  }

  async getStatus(envId: string, syncId: string): Promise<{ success: boolean; data: GitOpsSyncStatus }> {
    return this.client.request<{ success: boolean; data: GitOpsSyncStatus }>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/gitops-syncs/${encodeURIComponent(syncId)}/status`
    );
  }

  async performSync(envId: string, syncId: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("POST", `/environments/${encodeURIComponent(envId)}/gitops-syncs/${encodeURIComponent(syncId)}/sync`);
  }
}
