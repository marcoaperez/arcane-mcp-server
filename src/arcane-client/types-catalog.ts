export interface Volume {
  id: string;
  name: string;
  driver: string;
  mountpoint: string;
  scope: string;
  createdAt: string;
  size: number;
  inUse: boolean;
  containers: string[] | null;
  labels: Record<string, string>;
  options: Record<string, string>;
  usageData?: any;
  activityId?: string;
}

export interface VolumePruneReport {
  volumesDeleted: number;
  spaceReclaimed: number;
}

export interface NetworkSummary {
  id: string;
  name: string;
  driver: string;
  scope: string;
  created: string;
  inUse: boolean;
  isDefault: boolean;
  labels: Record<string, string>;
  options: Record<string, string>;
}

export interface NetworkInspect {
  id: string;
  name: string;
  driver: string;
  scope: string;
  created: string;
  internal: boolean;
  attachable: boolean;
  ingress: boolean;
  configOnly: boolean;
  configFrom: any;
  enableIPv4: boolean;
  enableIPv6: boolean;
  ipam: any;
  containers: any;
  containersList: any;
  options: any;
  labels: Record<string, string>;
  peers?: any;
  services?: any;
}

export interface NetworkPruneReport {
  networksDeleted: number;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  content: string;
  isCustom: boolean;
  isRemote: boolean;
  envContent?: string;
  metadata?: any;
  registry?: any;
  registryId?: string;
}

export interface TemplateCreate {
  name: string;
  description: string;
  content: string;
  envContent: string;
}

export interface TemplateUpdate {
  name: string;
  description: string;
  content: string;
  envContent: string;
}

export interface Pagination {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  itemsPerPage: number;
  grandTotalItems?: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[] | null;
  pagination: Pagination;
}

/**
 * Sobre paginado que ademas trae agregados de la coleccion filtrada.
 *
 * El spec lo separa igual: `BasePaginated...` frente a
 * `BasePaginatedWithCounts...`. `counts` va sin `?` porque openapi.txt lo
 * declara en `required` en los cuatro schemas que lo usan (containers,
 * volumes, networks y gitops-syncs).
 */
export interface PaginatedResponseWithCounts<T, C> extends PaginatedResponse<T> {
  counts: C;
}

/** Agregados de `GET /environments/{id}/containers` (spec: ContainerStatusCounts). */
export interface ContainerStatusCounts {
  runningContainers: number;
  stoppedContainers: number;
  totalContainers: number;
}

/** Agregados de `GET /environments/{id}/volumes` (spec: DockerVolumeVolumeUsageCountsData). */
export interface VolumeUsageCounts {
  inuse: number;
  unused: number;
  total: number;
}

/** Agregados de `GET /environments/{id}/networks` (spec: NetworkUsageCounts). */
export interface NetworkUsageCounts {
  inuse: number;
  unused: number;
  total: number;
}

/**
 * Agregados de `GET /environments/{id}/gitops-syncs` (spec: GitopsSyncCounts).
 *
 * El inventario original del plan solo contaba tres endpoints con `counts`
 * (containers, volumes, networks); `BasePaginatedWithCountsGitopsGitOpsSyncGitopsSyncCounts`
 * en openapi.txt declara este cuarto tambien con `counts` en `required`.
 */
export interface GitopsSyncCounts {
  totalSyncs: number;
  activeSyncs: number;
  successfulSyncs: number;
}

export interface ActionResponse {
  success: boolean;
  message: string;
}

/**
 * Respuesta de GET /app-version. Endpoint público: no requiere API key.
 *
 * `nodeVersion` y `svelteKitVersion` no estaban en el código propuesto por el brief
 * de la Tarea 6, pero `openapi.txt` (fuente de verdad) los marca `required` en
 * `VersionInfo` — se añaden aquí para que la interfaz quede alineada de verdad.
 * Ver la sección de discrepancias del informe de la tarea.
 */
export interface VersionInfo {
  currentVersion: string;
  displayVersion: string;
  goVersion: string;
  nodeVersion: string;
  svelteKitVersion: string;
  revision: string;
  shortRevision: string;
  isSemverVersion: boolean;
  updateAvailable: boolean;
  buildTime?: string;
  newestVersion?: string;
  releaseUrl?: string;
}

/**
 * One line of the NDJSON stream emitted by the compose/pull action endpoints
 * (/up, /redeploy, and — as of Task 11 — /pull too). Arcane serves these as
 * `application/x-json-stream`:
 *   {"type":"activity","activityId":"..."}   // opening handle
 *   {"log":" Container foo Recreated "}       // docker compose/pull progress lines
 *   {"done":true}                             // terminal success marker
 *   {"error":"..."}                           // emitted instead on failure
 *   {"errorDetail":{"message":"..."}}         // alternate failure shape
 * `success`/`message` are only present in the defensive single-object fallback
 * (some Arcane versions/endpoints may answer with a plain ActionResponse).
 *
 * Task 11: /pull was believed to emit docker-pull-style `{status,id}` events
 * and had its own aggregator (`summarizePullStream`/`PullStreamEvent`). A
 * real stream captured against Arcane v2.7.0 (2026-08-16, `/projects/{id}/pull`)
 * showed `activityId`/`log`/`done` — the exact same shape as /up and /redeploy,
 * never `status` or `id`. `summarizePullStream` is gone; all four endpoints
 * (stacks.pull, stacks.start, projectAdditional.pullImages, projectAdditional.redeploy)
 * now share this one event shape and summarizeComposeStream() below.
 */
export interface ComposeStreamEvent {
  type?: string;
  activityId?: string;
  log?: string;
  done?: boolean;
  error?: string;
  errorDetail?: { message?: string };
  success?: boolean;
  message?: string;
}

export interface ListOptions {
  search?: string;
  limit?: number;
}

export interface ListOptionsWithSort extends ListOptions {
  sort?: string;
  order?: string;
  start?: number;
}

export interface ContainerListOptions extends ListOptionsWithSort {
  /** El spec lo declara boolean, con default false. */
  includeInternal?: boolean;
  /** El spec lo declara string: "true" | "false". */
  standalone?: string;
  /** has_update | up_to_date | error | unknown */
  updates?: string;
}

export interface ImageListOptions extends ListOptionsWithSort {
  /** El spec lo declara string: "true" | "false". */
  inUse?: string;
  /** "true" | "false" — en images es booleano expresado como cadena, no el enumerado de los otros */
  updates?: string;
}

export interface VulnerabilityListOptions extends ListOptionsWithSort {
  /** critical | high | medium | low | unknown */
  severity?: string;
  /** Nombre exacto de imagen, p. ej. "curlimages/curl:8.5.0" */
  imageName?: string;
}

export interface ImageVulnerabilityListOptions extends ListOptionsWithSort {
  /** critical | high | medium | low | unknown */
  severity?: string;
}

export interface VolumeListOptions extends ListOptionsWithSort {
  inUse?: string;
  includeInternal?: boolean;
}

export interface NetworkListOptions extends ListOptionsWithSort {
  inUse?: string;
}

export interface EnvironmentListOptions extends ListOptionsWithSort {
  type?: string;
}

export interface ProjectListOptions extends ListOptionsWithSort {
  /** Coma-separado: running, stopped, partially running. */
  status?: string;
  /** "true" (solo archivados) o "all" (incluirlos). Por defecto se excluyen. */
  archived?: string;
  /** Coma-separado, semantica OR. */
  tags?: string;
  /** has_update | up_to_date | error | unknown */
  updates?: string;
}

export interface TemplateListOptions extends ListOptionsWithSort {
  type?: string;
}

