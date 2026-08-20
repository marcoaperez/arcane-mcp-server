import type { ArcaneClient } from "../arcane-client";
import type { ActionResponse, ComposeStreamEvent, ImageListOptions, PaginatedResponse } from "./types-catalog";
import type { ImagePruneReport, ImagePullOptions, ImageSummary, ImageUpdateInfo, ImageUpdateResponse, ImageUpdateSummary, Project } from "./types-resources";
import type { BuildFileContent, BuildListOptions, BuildRequest, BuildStreamSummary, BuildWorkspaceEntry, ImageBuildRecord, ProjectBuildRequest } from "./types-system-build";
import { appendListParams, enmascaraBuildArgs, segmentoDeRuta, summarizeBuildStream } from "./internal";

export class ImagesMethods {
  constructor(private client: ArcaneClient) {}

  async list(envId: string, opts?: ImageListOptions): Promise<PaginatedResponse<ImageSummary>> {
    const params = new URLSearchParams();
    appendListParams(params, opts);
    if (opts?.inUse) params.set("inUse", opts.inUse);
    if (opts?.updates) params.set("updates", opts.updates);
    const query = params.toString();
    return this.client.request<PaginatedResponse<ImageSummary>>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/images${query ? `?${query}` : ""}`
    );
  }

  async pull(envId: string, dto: ImagePullOptions): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("POST", `/environments/${encodeURIComponent(envId)}/images/pull`, dto);
  }

  async remove(envId: string, imageId: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("DELETE", `/environments/${encodeURIComponent(envId)}/images/${segmentoDeRuta(imageId)}`);
  }

  async prune(envId: string): Promise<{ success: boolean; data: ImagePruneReport }> {
    return this.client.request<{ success: boolean; data: ImagePruneReport }>("POST", `/environments/${encodeURIComponent(envId)}/images/prune`);
  }
}

export class ImageUpdatesMethods {
  constructor(private client: ArcaneClient) {}

  async summary(envId: string): Promise<{ success: boolean; data: ImageUpdateSummary }> {
    return this.client.request<{ success: boolean; data: ImageUpdateSummary }>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/image-updates/summary`
    );
  }

  /**
   * Informacion PERSISTIDA: no consulta los registros. El spec declara
   * imageRefs como una cadena separada por comas, no como parametro repetido.
   */
  async byRefs(envId: string, imageRefs: string[]): Promise<{ success: boolean; data: Record<string, ImageUpdateInfo> }> {
    const params = new URLSearchParams();
    params.set("imageRefs", imageRefs.join(","));
    return this.client.request<{ success: boolean; data: Record<string, ImageUpdateInfo> }>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/image-updates/by-refs?${params.toString()}`
    );
  }

  /** Comprobacion EN VIVO de una imagen, por referencia o por ID. */
  async check(envId: string, opts: { imageRef?: string; imageId?: string }): Promise<{ success: boolean; data: ImageUpdateResponse }> {
    const base = `/environments/${encodeURIComponent(envId)}/image-updates`;
    if (opts.imageId) {
      return this.client.request<{ success: boolean; data: ImageUpdateResponse }>(
        "GET",
        `${base}/check/${segmentoDeRuta(opts.imageId)}`
      );
    }
    if (opts.imageRef) {
      const params = new URLSearchParams();
      params.set("imageRef", opts.imageRef);
      return this.client.request<{ success: boolean; data: ImageUpdateResponse }>(
        "GET",
        `${base}/check?${params.toString()}`
      );
    }
    throw new Error("check() necesita imageRef o imageId");
  }

  /** Comprobacion EN VIVO de una lista explicita. */
  async checkBatch(envId: string, imageRefs: string[]): Promise<{ success: boolean; data: Record<string, ImageUpdateResponse> }> {
    return this.client.request<{ success: boolean; data: Record<string, ImageUpdateResponse> }>(
      "POST",
      `/environments/${encodeURIComponent(envId)}/image-updates/check-batch`,
      { imageRefs }
    );
  }
}

export class ImageBuildsMethods {
  constructor(private client: ArcaneClient) {}

  // El endpoint transmite NDJSON (application/x-json-stream) y devuelve
  // HTTP 200 aunque la build falle: el fracaso solo vive dentro del stream.
  async build(envId: string, req: BuildRequest): Promise<BuildStreamSummary> {
    const events = await this.client.requestNdjson<ComposeStreamEvent>(
      "POST",
      `/environments/${encodeURIComponent(envId)}/images/build`,
      req,
    );
    return summarizeBuildStream(events, "Build");
  }

  async buildProject(envId: string, projectId: string, req: ProjectBuildRequest): Promise<BuildStreamSummary> {
    const events = await this.client.requestNdjson<ComposeStreamEvent>(
      "POST",
      `/environments/${encodeURIComponent(envId)}/projects/${encodeURIComponent(projectId)}/build`,
      req,
    );
    return summarizeBuildStream(events, "Project build");
  }

  async list(envId: string, opts?: BuildListOptions): Promise<PaginatedResponse<ImageBuildRecord>> {
    const params = new URLSearchParams();
    appendListParams(params, opts);
    if (opts?.status) params.set("status", opts.status);
    if (opts?.provider) params.set("provider", opts.provider);
    const query = params.toString();
    const res = await this.client.request<PaginatedResponse<ImageBuildRecord>>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/images/builds${query ? `?${query}` : ""}`,
    );
    return { ...res, data: res.data ? res.data.map(enmascaraBuildArgs) : res.data };
  }

  async get(envId: string, buildId: string): Promise<{ success: boolean; data: ImageBuildRecord }> {
    const res = await this.client.request<{ success: boolean; data: ImageBuildRecord }>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/images/builds/${encodeURIComponent(buildId)}`,
    );
    return { ...res, data: res.data ? enmascaraBuildArgs(res.data) : res.data };
  }
}

export class BuildWorkspaceMethods {
  constructor(private client: ArcaneClient) {}

  private ruta(envId: string, sufijo: string, params: URLSearchParams): string {
    const query = params.toString();
    return `/environments/${encodeURIComponent(envId)}/builds/browse${sufijo}${query ? `?${query}` : ""}`;
  }

  async browse(envId: string, path?: string): Promise<{ success: boolean; data: BuildWorkspaceEntry[] | null }> {
    const params = new URLSearchParams();
    if (path !== undefined) params.set("path", path);
    return this.client.request<{ success: boolean; data: BuildWorkspaceEntry[] | null }>(
      "GET",
      this.ruta(envId, "", params),
    );
  }

  async read(envId: string, path: string, maxBytes?: number): Promise<{ success: boolean; data: BuildFileContent }> {
    const params = new URLSearchParams();
    params.set("path", path);
    if (maxBytes !== undefined) params.set("maxBytes", String(maxBytes));
    return this.client.request<{ success: boolean; data: BuildFileContent }>(
      "GET",
      this.ruta(envId, "/content", params),
    );
  }

  // mkdir y delete devuelven 204 sin cuerpo: request() reventaria con res.json().
  async mkdir(envId: string, path: string): Promise<void> {
    const params = new URLSearchParams();
    params.set("path", path);
    return this.client.requestSinCuerpo("POST", this.ruta(envId, "/mkdir", params));
  }

  async delete(envId: string, path: string): Promise<void> {
    const params = new URLSearchParams();
    params.set("path", path);
    return this.client.requestSinCuerpo("DELETE", this.ruta(envId, "", params));
  }
}
