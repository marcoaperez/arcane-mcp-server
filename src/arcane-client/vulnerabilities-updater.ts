import type { ArcaneClient } from "../arcane-client";
import type { ImageVulnerabilityListOptions, ListOptionsWithSort, PaginatedResponse, VulnerabilityListOptions } from "./types-catalog";
import type { AutoUpdateRecord, ScannerStatus, UpdaterResult, UpdaterStatus } from "./types-resources";
import type { EnvironmentVulnerabilitySummary, IgnoredVulnerability, Vulnerability, VulnerabilityIgnoreRequest, VulnerabilityScanResult, VulnerabilityScanSummariesResponse, VulnerabilityScanSummary, VulnerabilityWithImage } from "./types-vulnerabilities";
import { appendListParams, segmentoDeRuta } from "./internal";

export class UpdaterMethods {
  constructor(private client: ArcaneClient) {}

  async status(envId: string): Promise<{ success: boolean; data: UpdaterStatus }> {
    return this.client.request<{ success: boolean; data: UpdaterStatus }>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/updater/status`
    );
  }

  /**
   * OJO: este endpoint devuelve un array pelado, SIN sobre de paginacion y sin
   * `start`. Acepta `limit` (default 50 en el servidor) y no hay forma de saber
   * cuantos registros hay en total. La tool lo advierte con una heuristica.
   */
  async history(envId: string, limit?: number): Promise<{ success: boolean; data: AutoUpdateRecord[] | null }> {
    const params = new URLSearchParams();
    if (limit !== undefined) params.set("limit", String(limit));
    const query = params.toString();
    return this.client.request<{ success: boolean; data: AutoUpdateRecord[] | null }>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/updater/history${query ? `?${query}` : ""}`
    );
  }

  /**
   * Aplica actualizaciones. `resourceIds` es OBLIGATORIO aqui aunque el spec lo
   * declare opcional: sin el, una sola llamada actualizaria y reiniciaria todo
   * el entorno, incluido el contenedor arcane-mcp-server que atiende esta misma
   * peticion. Es el mismo motivo por el que F2 excluyo system/containers/stop-all.
   */
  async run(
    envId: string,
    opts: { resourceIds: string[]; type?: string; dryRun?: boolean; forceUpdate?: boolean }
  ): Promise<{ success: boolean; data: UpdaterResult }> {
    if (!opts.resourceIds || opts.resourceIds.length === 0) {
      throw new Error("run() necesita al menos un elemento en resourceIds: la actualizacion masiva no se expone");
    }
    const body: Record<string, unknown> = { resourceIds: opts.resourceIds };
    if (opts.type !== undefined) body.type = opts.type;
    if (opts.dryRun !== undefined) body.dryRun = opts.dryRun;
    if (opts.forceUpdate !== undefined) body.forceUpdate = opts.forceUpdate;
    return this.client.request<{ success: boolean; data: UpdaterResult }>(
      "POST",
      `/environments/${encodeURIComponent(envId)}/updater/run`,
      body
    );
  }
}

/**
 * Vulnerabilidades (Trivy integrado en Arcane). Los endpoints por imagen
 * responden 404 "Vulnerability scan not found" si la imagen no se ha
 * escaneado: es su estado normal, no una avería.
 */
export class VulnerabilitiesMethods {
  constructor(private client: ArcaneClient) {}

  async scannerStatus(envId: string): Promise<{ success: boolean; data: ScannerStatus }> {
    return this.client.request<{ success: boolean; data: ScannerStatus }>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/vulnerabilities/scanner-status`
    );
  }

  async environmentSummary(envId: string): Promise<{ success: boolean; data: EnvironmentVulnerabilitySummary }> {
    return this.client.request<{ success: boolean; data: EnvironmentVulnerabilitySummary }>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/vulnerabilities/summary`
    );
  }

  async listAll(envId: string, opts?: VulnerabilityListOptions): Promise<PaginatedResponse<VulnerabilityWithImage>> {
    const params = new URLSearchParams();
    appendListParams(params, opts);
    if (opts?.severity) params.set("severity", opts.severity);
    if (opts?.imageName) params.set("imageName", opts.imageName);
    const query = params.toString();
    return this.client.request<PaginatedResponse<VulnerabilityWithImage>>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/vulnerabilities/all${query ? `?${query}` : ""}`
    );
  }

  async imageOptions(envId: string, severity?: string): Promise<{ success: boolean; data: string[] }> {
    const params = new URLSearchParams();
    if (severity) params.set("severity", severity);
    const query = params.toString();
    return this.client.request<{ success: boolean; data: string[] }>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/vulnerabilities/image-options${query ? `?${query}` : ""}`
    );
  }

  /**
   * El imageId pasa por segmentoDeRuta(), no por encodeURIComponent() a
   * secas. Un image ID Docker tiene forma "sha256:08e466...": el router de
   * Arcane no decodifica un %3A en este segmento -medido el 2026-08-19: 404
   * en este endpoint y en /summary, 500 "invalid reference format" en
   * /scan, y en /list falla EN SILENCIO devolviendo 200 con 0 items-, asi
   * que los dos puntos tienen que viajar crudos. Pero un imageId es
   * atacante-controlable, y el fetch subyacente resuelve "../" y trunca en
   * "#": sin codificar el resto del valor, un imageId como
   * "../../0/system/containers/stop-all#" reescribe la ruta entera hacia
   * cualquier endpoint de Arcane. segmentoDeRuta() codifica todo excepto
   * los dos puntos.
   */
  async scanResult(envId: string, imageId: string): Promise<{ success: boolean; data: VulnerabilityScanResult }> {
    return this.client.request<{ success: boolean; data: VulnerabilityScanResult }>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/images/${segmentoDeRuta(imageId)}/vulnerabilities`
    );
  }

  async imageList(
    envId: string,
    imageId: string,
    opts?: ImageVulnerabilityListOptions
  ): Promise<PaginatedResponse<Vulnerability>> {
    const params = new URLSearchParams();
    appendListParams(params, opts);
    if (opts?.severity) params.set("severity", opts.severity);
    const query = params.toString();
    return this.client.request<PaginatedResponse<Vulnerability>>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/images/${segmentoDeRuta(imageId)}/vulnerabilities/list${query ? `?${query}` : ""}`
    );
  }

  async imageSummary(envId: string, imageId: string): Promise<{ success: boolean; data: VulnerabilityScanSummary }> {
    return this.client.request<{ success: boolean; data: VulnerabilityScanSummary }>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/images/${segmentoDeRuta(imageId)}/vulnerabilities/summary`
    );
  }

  /**
   * Resúmenes en lote. El mapa de la respuesta OMITE las imágenes sin escaneo
   * (medido contra la instancia real): la capa tool avisa de las omisiones.
   */
  async imageSummaries(envId: string, imageIds: string[]): Promise<{ success: boolean; data: VulnerabilityScanSummariesResponse }> {
    return this.client.request<{ success: boolean; data: VulnerabilityScanSummariesResponse }>(
      "POST",
      `/environments/${encodeURIComponent(envId)}/images/vulnerabilities/summaries`,
      { imageIds }
    );
  }

  async ignoredList(envId: string, opts?: ListOptionsWithSort): Promise<PaginatedResponse<IgnoredVulnerability>> {
    const params = new URLSearchParams();
    appendListParams(params, opts);
    const query = params.toString();
    return this.client.request<PaginatedResponse<IgnoredVulnerability>>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/vulnerabilities/ignored${query ? `?${query}` : ""}`
    );
  }

  /**
   * MUTANTE: lanza un escaneo ASÍNCRONO de UNA imagen. Devuelve el ACUSE
   * (status "scanning" + activityId), no el resultado — medido en la puerta
   * de F4: el resultado se recoge después con scanResult(). Acotado a una
   * imagen por construcción: el endpoint exige imageId en la ruta.
   */
  async scan(envId: string, imageId: string): Promise<{ success: boolean; data: VulnerabilityScanResult }> {
    return this.client.request<{ success: boolean; data: VulnerabilityScanResult }>(
      "POST",
      `/environments/${encodeURIComponent(envId)}/images/${segmentoDeRuta(imageId)}/vulnerabilities/scan`
    );
  }

  /**
   * MUTANTE: silencia una vulnerabilidad de forma persistente. `reason` es
   * obligatorio en esta firma aunque el spec lo declare opcional (spec F4
   * §3.2). Devuelve el registro creado, con el `id` que usa unignore().
   */
  async ignore(envId: string, payload: VulnerabilityIgnoreRequest): Promise<{ success: boolean; data: IgnoredVulnerability }> {
    return this.client.request<{ success: boolean; data: IgnoredVulnerability }>(
      "POST",
      `/environments/${encodeURIComponent(envId)}/vulnerabilities/ignore`,
      payload
    );
  }

  /** MUTANTE: deja de ignorar. El ignoreId sale de ignoredList() o del retorno de ignore(). */
  async unignore(envId: string, ignoreId: string): Promise<{ success: boolean }> {
    return this.client.request<{ success: boolean }>(
      "DELETE",
      `/environments/${encodeURIComponent(envId)}/vulnerabilities/ignore/${encodeURIComponent(ignoreId)}`
    );
  }
}
