import type { ArcaneClient } from "../arcane-client";
import type { ActionResponse, PaginatedResponse, VersionInfo } from "./types-catalog";
import type { Activity, ActivityDetail, ActivityListOptions, Event, EventListOptions, EventSeverityCounts, JobListResponse, JobSchedulesConfig, JobSchedulesUpdate } from "./types-git-activity";
import type { DockerInfo, SystemConvertResult, SystemPruneRequest, SystemPruneResult } from "./types-system-build";
import { appendListParams } from "./internal";

export class SystemMethods {
  constructor(private client: ArcaneClient) {}

  async version(): Promise<VersionInfo> {
    return this.client.request<VersionInfo>("GET", "/app-version");
  }

  async dockerInfo(envId: string): Promise<DockerInfo> {
    return this.client.request<DockerInfo>("GET", `/environments/${encodeURIComponent(envId)}/system/docker/info`);
  }

  /** HEAD sin cuerpo: el veredicto es el codigo de estado. */
  async health(envId: string): Promise<{ ok: boolean; status: number }> {
    return this.client.requestHead(`/environments/${encodeURIComponent(envId)}/system/health`);
  }

  async prune(envId: string, opciones: SystemPruneRequest): Promise<{ success: boolean; data: SystemPruneResult }> {
    return this.client.request<{ success: boolean; data: SystemPruneResult }>(
      "POST",
      `/environments/${encodeURIComponent(envId)}/system/prune`,
      opciones
    );
  }

  async convert(envId: string, dockerRunCommand: string): Promise<SystemConvertResult> {
    return this.client.request<SystemConvertResult>(
      "POST",
      `/environments/${encodeURIComponent(envId)}/system/convert`,
      { dockerRunCommand }
    );
  }
}

export class ActivitiesMethods {
  constructor(private client: ArcaneClient) {}

  async list(envId: string, opts?: ActivityListOptions): Promise<PaginatedResponse<Activity>> {
    const params = new URLSearchParams();
    appendListParams(params, opts);
    if (opts?.status) params.set("status", opts.status);
    if (opts?.type) params.set("type", opts.type);
    if (opts?.resourceType) params.set("resourceType", opts.resourceType);
    const query = params.toString();
    return this.client.request<PaginatedResponse<Activity>>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/activities${query ? `?${query}` : ""}`
    );
  }

  /**
   * `limit` es el maximo de mensajes del log a devolver. openapi.txt lo declara
   * `default: 500` en el propio servidor: sin pasarlo explicitamente, un log
   * mas largo que eso llega truncado sin ningun aviso.
   */
  async get(envId: string, activityId: string, limit?: number): Promise<{ success: boolean; data: ActivityDetail }> {
    const params = new URLSearchParams();
    if (limit !== undefined) params.set("limit", String(limit));
    const query = params.toString();
    return this.client.request<{ success: boolean; data: ActivityDetail }>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/activities/${encodeURIComponent(activityId)}${query ? `?${query}` : ""}`
    );
  }

  /**
   * OJO: NO devuelve ActionResponse. El spec declara BaseApiResponseActivityActivity,
   * es decir `{success, data: Activity}`: no hay campo `message` en ningun nivel.
   */
  async cancel(
    envId: string,
    activityId: string,
    requestedBy?: string
  ): Promise<{ success: boolean; data: Activity }> {
    const params = new URLSearchParams();
    if (requestedBy) params.set("requestedBy", requestedBy);
    const query = params.toString();
    return this.client.request<{ success: boolean; data: Activity }>(
      "POST",
      `/environments/${encodeURIComponent(envId)}/activities/${encodeURIComponent(activityId)}/cancel${query ? `?${query}` : ""}`
    );
  }
}

export class EventsMethods {
  constructor(private client: ArcaneClient) {}

  async list(opts?: EventListOptions): Promise<PaginatedResponse<Event>> {
    const params = new URLSearchParams();
    appendListParams(params, opts);
    if (opts?.severity) params.set("severity", opts.severity);
    if (opts?.type) params.set("type", opts.type);
    const query = params.toString();
    const base = opts?.environmentId ? `/events/environment/${encodeURIComponent(opts.environmentId)}` : "/events";
    return this.client.request<PaginatedResponse<Event>>("GET", `${base}${query ? `?${query}` : ""}`);
  }

  async stats(): Promise<{ success: boolean; data: EventSeverityCounts }> {
    return this.client.request<{ success: boolean; data: EventSeverityCounts }>("GET", "/events/stats");
  }
}

export class JobsMethods {
  constructor(private client: ArcaneClient) {}

  /** Devuelve el sobre `{jobs, isAgent}` tal cual: NO es el paginado del resto de la API. */
  async list(envId: string): Promise<JobListResponse> {
    return this.client.request<JobListResponse>("GET", `/environments/${encodeURIComponent(envId)}/jobs`);
  }

  async run(envId: string, jobId: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("POST", `/environments/${encodeURIComponent(envId)}/jobs/${encodeURIComponent(jobId)}/run`);
  }

  async getSchedules(envId: string): Promise<JobSchedulesConfig> {
    return this.client.request<JobSchedulesConfig>("GET", `/environments/${encodeURIComponent(envId)}/job-schedules`);
  }

  /**
   * OJO: NO devuelve ActionResponse. El spec declara BaseApiResponseJobscheduleConfig,
   * es decir `{success, data: JobSchedulesConfig}`: devuelve la configuracion ya
   * aplicada, y no hay campo `message` en ningun nivel.
   */
  async updateSchedules(
    envId: string,
    cambios: JobSchedulesUpdate
  ): Promise<{ success: boolean; data: JobSchedulesConfig }> {
    return this.client.request<{ success: boolean; data: JobSchedulesConfig }>(
      "PUT",
      `/environments/${encodeURIComponent(envId)}/job-schedules`,
      cambios
    );
  }
}
