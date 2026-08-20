import type { ArcaneClient } from "../arcane-client";
import type { ActionResponse, ComposeStreamEvent, EnvironmentListOptions, PaginatedResponse, ProjectListOptions } from "./types-catalog";
import type { Environment, EnvironmentCreate, EnvironmentUpdate, Project, ProjectCreate, ProjectUpdate } from "./types-resources";
import { appendListParams, summarizeComposeStream } from "./internal";

export class EnvironmentsMethods {
  constructor(private client: ArcaneClient) {}

  async list(opts?: EnvironmentListOptions): Promise<PaginatedResponse<Environment>> {
    const params = new URLSearchParams();
    appendListParams(params, opts);
    if (opts?.type) params.set("type", opts.type);
    const query = params.toString();
    return this.client.request<PaginatedResponse<Environment>>(
      "GET",
      `/environments${query ? `?${query}` : ""}`
    );
  }

  async get(id: string): Promise<{ success: boolean; data: Environment }> {
    return this.client.request<{ success: boolean; data: Environment }>("GET", `/environments/${encodeURIComponent(id)}`);
  }

  async create(dto: EnvironmentCreate): Promise<{ success: boolean; data: Environment }> {
    return this.client.request<{ success: boolean; data: Environment }>("POST", "/environments", dto);
  }

  async update(id: string, dto: EnvironmentUpdate): Promise<{ success: boolean; data: Environment }> {
    return this.client.request<{ success: boolean; data: Environment }>("PUT", `/environments/${encodeURIComponent(id)}`, dto);
  }

  async delete(id: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("DELETE", `/environments/${encodeURIComponent(id)}`);
  }
}

export class StacksMethods {
  constructor(private client: ArcaneClient) {}

  async list(envId: string, opts?: ProjectListOptions): Promise<PaginatedResponse<Project>> {
    const params = new URLSearchParams();
    appendListParams(params, opts);
    if (opts?.status) params.set("status", opts.status);
    if (opts?.archived) params.set("archived", opts.archived);
    if (opts?.tags) params.set("tags", opts.tags);
    if (opts?.updates) params.set("updates", opts.updates);
    const query = params.toString();
    return this.client.request<PaginatedResponse<Project>>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/projects${query ? `?${query}` : ""}`
    );
  }

  async get(envId: string, stackId: string): Promise<{ success: boolean; data: Project }> {
    return this.client.request<{ success: boolean; data: Project }>("GET", `/environments/${encodeURIComponent(envId)}/projects/${encodeURIComponent(stackId)}`);
  }

  async deploy(envId: string, dto: ProjectCreate): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("POST", `/environments/${encodeURIComponent(envId)}/projects`, dto);
  }

  async update(envId: string, stackId: string, dto: ProjectUpdate): Promise<{ success: boolean; data: Project }> {
    return this.client.request<{ success: boolean; data: Project }>("PUT", `/environments/${encodeURIComponent(envId)}/projects/${encodeURIComponent(stackId)}`, dto);
  }

  async delete(envId: string, stackId: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("DELETE", `/environments/${encodeURIComponent(envId)}/projects/${encodeURIComponent(stackId)}/destroy`);
  }

  async start(envId: string, stackId: string): Promise<ActionResponse> {
    // /up streams NDJSON (docker compose up progress), not a single JSON object.
    // Parse the stream and summarize it as an ActionResponse.
    const events = await this.client.requestNdjson<ComposeStreamEvent>(
      "POST",
      `/environments/${encodeURIComponent(envId)}/projects/${encodeURIComponent(stackId)}/up`
    );
    return summarizeComposeStream(events, "Start");
  }

  async stop(envId: string, stackId: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("POST", `/environments/${encodeURIComponent(envId)}/projects/${encodeURIComponent(stackId)}/down`);
  }

  async restart(envId: string, stackId: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("POST", `/environments/${encodeURIComponent(envId)}/projects/${encodeURIComponent(stackId)}/restart`);
  }

  async pull(envId: string, stackId: string): Promise<ActionResponse> {
    // /pull streams NDJSON, like /up and /redeploy (Task 11: confirmed against
    // a real Arcane v2.7.0 stream to be the same {activityId,log,done} shape,
    // not docker-pull-style {status,id}). Parse and summarize the same way.
    const events = await this.client.requestNdjson<ComposeStreamEvent>(
      "POST",
      `/environments/${encodeURIComponent(envId)}/projects/${encodeURIComponent(stackId)}/pull`
    );
    return summarizeComposeStream(events, "Pull");
  }
}

export class ProjectAdditionalMethods {
  constructor(private client: ArcaneClient) {}

  async down(envId: string, projectId: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("POST", `/environments/${encodeURIComponent(envId)}/projects/${encodeURIComponent(projectId)}/down`);
  }

  async pullImages(envId: string, projectId: string): Promise<ActionResponse> {
    // /pull streams NDJSON, like /up and /redeploy (Task 11: confirmed against
    // a real Arcane v2.7.0 stream to be the same {activityId,log,done} shape,
    // not docker-pull-style {status,id}). Parse and summarize the same way.
    const events = await this.client.requestNdjson<ComposeStreamEvent>(
      "POST",
      `/environments/${encodeURIComponent(envId)}/projects/${encodeURIComponent(projectId)}/pull`
    );
    return summarizeComposeStream(events, "Pull");
  }

  async redeploy(envId: string, projectId: string): Promise<ActionResponse> {
    // /redeploy streams NDJSON (docker compose down+up progress), like /up.
    // Parse the stream and summarize it as an ActionResponse.
    const events = await this.client.requestNdjson<ComposeStreamEvent>(
      "POST",
      `/environments/${encodeURIComponent(envId)}/projects/${encodeURIComponent(projectId)}/redeploy`
    );
    return summarizeComposeStream(events, "Redeploy");
  }

  async destroy(envId: string, projectId: string, removeFiles?: boolean, removeVolumes?: boolean): Promise<ActionResponse> {
    return this.client.request<ActionResponse>(
      "DELETE",
      `/environments/${encodeURIComponent(envId)}/projects/${encodeURIComponent(projectId)}/destroy?removeFiles=${removeFiles ?? false}&removeVolumes=${removeVolumes ?? false}`
    );
  }
}
