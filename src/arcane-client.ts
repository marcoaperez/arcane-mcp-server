export class ArcaneApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ArcaneApiError";
  }
}

/**
 * Lanza ArcaneApiError si la respuesta no es correcta, usando el `detail` del
 * cuerpo de error cuando lo hay.
 *
 * Extraido en F5: el mismo bloque estaba repetido literalmente en request(),
 * requestMultipart(), requestNdjson() y VolumeBackupsMethods.download(), y la
 * fase añadia dos sitios mas.
 */
async function lanzaSiFalla(response: Response): Promise<void> {
  if (response.ok) return;
  let message = response.statusText;
  try {
    const err = (await response.json()) as { detail?: string };
    if (err.detail) message = err.detail;
  } catch {}
  throw new ArcaneApiError(response.status, message);
}

export interface Environment {
  id: string;
  name?: string;
  apiUrl: string;
  status: string;
  enabled: boolean;
  isEdge: boolean;
  apiKey?: string;
  connected?: boolean;
  connectedAt?: string;
  edgeAgentInstance?: string;
  edgeCapabilities?: any;
  edgeMTLSCertificate?: string;
  edgeSecurityMode?: string;
  edgeSessionId?: string;
  edgeTransport?: string;
  lastEdgeTransport?: string;
  lastHeartbeat?: string;
  lastPollAt?: string;
  lastSeen?: string;
}

export interface EnvironmentCreate {
  apiUrl: string;
  name?: string;
  accessToken?: string;
  bootstrapToken?: string;
  enabled?: boolean;
  isEdge?: boolean;
  useApiKey?: boolean;
}

export interface EnvironmentUpdate {
  name?: string;
  apiUrl?: string;
  accessToken?: string;
  bootstrapToken?: string;
  enabled?: boolean;
  regenerateApiKey?: boolean;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  status: string;
  serviceCount: number;
  runningCount: number;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
  composeContent?: string;
  envContent?: string;
  dirName?: string;
  gitRepositoryURL?: string;
  gitOpsManagedBy?: string;
  lastSyncCommit?: string;
  statusReason?: string;
  urls?: string[] | null;
  activityId?: string;
  archivedAt?: string;
  composeFileName?: string;
  /**
   * Obligatorio en 2.8.0 (nueva función de etiquetado de proyectos, upstream #3601).
   * El spec lo declara `required` con tipo nullable.
   */
  tags: string[] | null;
  hasBuildDirective?: boolean;
  iconDarkUrl?: string;
  iconLightUrl?: string;
  isDiscovered?: boolean;
  overrideContent?: string;
  overrideFileName?: string;
  redeployDisabled?: boolean;
  relativePath?: string;
  /** Estado de actualizacion del proyecto (spec: ProjectDetails.updateInfo). */
  updateInfo?: ProjectUpdateInfo;
}

export interface ProjectCreate {
  name: string;
  composeContent: string;
  envContent?: string;
}

export interface ProjectUpdate {
  name?: string;
  composeContent?: string;
  envContent?: string;
}

export interface ContainerSummary {
  id: string;
  names: string[] | null;
  image: string;
  imageId: string;
  command: string;
  created: number;
  state: string;
  status: string;
  ports: any[] | null;
  labels: Record<string, string>;
  hostConfig: any;
  networkSettings: any;
  mounts: any[] | null;
  /** Estado de actualizacion del contenedor (spec: ContainerSummary.updateInfo -> ImageUpdateInfo). */
  updateInfo?: ImageUpdateInfo;
  iconDarkUrl?: string;
  iconLightUrl?: string;
  redeployDisabled?: boolean;
}

export interface ContainerDetails {
  id: string;
  name: string;
  image: string;
  imageId: string;
  created: string;
  state: any;
  config: any;
  hostConfig: any;
  networkSettings: any;
  ports: any[] | null;
  mounts: any[] | null;
  labels?: Record<string, string>;
  activityId?: string;
  composeInfo?: any;
  iconDarkUrl?: string;
  iconLightUrl?: string;
  redeployDisabled?: boolean;
}

export interface ImageSummary {
  id: string;
  repoTags: string[] | null;
  repoDigests: string[] | null;
  created: number;
  size: number;
  virtualSize: number;
  labels: Record<string, any>;
  inUse: boolean;
  repo: string;
  tag: string;
  /** Estado de actualizacion de la imagen (spec: ImageSummary.updateInfo -> ImageUpdateInfo). */
  updateInfo?: ImageUpdateInfo;
  /**
   * Que usa esta imagen. La instancia ya lo devolvia y el tipo lo descartaba:
   * era una de las desalineaciones FALTA-EN-TS-OPCIONAL de la auditoria.
   * Es lo que separa "esta imagen tiene actualizacion" de "actualizarla
   * reinicia el proyecto arcane-mcp".
   */
  usedBy?: ImageUsedBy[] | null;
}

export interface ImagePullOptions {
  imageName: string;
}

export interface ImagePruneReport {
  imagesDeleted: number;
  spaceReclaimed: number;
}

/** Respuesta de una comprobación en vivo (spec: ImageupdateResponse). */
export interface ImageUpdateResponse {
  checkTime: string;
  currentVersion: string;
  hasUpdate: boolean;
  responseTimeMs: number;
  updateType: string;
  activityId?: string;
  authMethod?: string;
  authRegistry?: string;
  authUsername?: string;
  currentDigest?: string;
  error?: string;
  latestDigest?: string;
  latestVersion?: string;
  usedCredential?: boolean;
}

/**
 * Informacion persistida de actualizacion (spec: ImageUpdateInfo).
 *
 * Mismos campos que ImageUpdateResponse pero MAS estrictos: el spec marca
 * currentDigest, latestDigest, latestVersion y error como obligatorios aqui y
 * opcionales alli. No unificar los dos tipos.
 */
export interface ImageUpdateInfo {
  checkTime: string;
  currentDigest: string;
  currentVersion: string;
  error: string;
  hasUpdate: boolean;
  latestDigest: string;
  latestVersion: string;
  responseTimeMs: number;
  updateType: string;
  authMethod?: string;
  authRegistry?: string;
  authUsername?: string;
  usedCredential?: boolean;
}

/** Recuento agregado (spec: ImageupdateSummary). */
export interface ImageUpdateSummary {
  digestUpdates: number;
  errorsCount: number;
  imagesWithUpdates: number;
  totalImages: number;
}

/** Quien usa una imagen (spec: ImageUsedBy). */
export interface ImageUsedBy {
  name: string;
  type: string;
  id?: string;
}

/** Estado de actualizacion de un proyecto (spec: ProjectUpdateInfo). */
export interface ProjectUpdateInfo {
  checkedImageCount: number;
  errorCount: number;
  hasUpdate: boolean;
  imageCount: number;
  imagesWithUpdates: number;
  status: string;
  errorMessage?: string;
  imageRefs?: string[] | null;
  lastCheckedAt?: string;
  updatedImageRefs?: string[] | null;
}

/** Resultado por recurso de una pasada del updater (spec: UpdaterResourceResult). */
export interface UpdaterResourceResult {
  resourceId: string;
  resourceType: string;
  status: string;
  details?: Record<string, unknown>;
  error?: string;
  newImages?: Record<string, string>;
  oldImages?: Record<string, string>;
  resourceName?: string;
  updateApplied?: boolean;
  updateAvailable?: boolean;
}

/** Resultado de POST /updater/run (spec: UpdaterResult). */
export interface UpdaterResult {
  checked: number;
  duration: string;
  failed: number;
  items: UpdaterResourceResult[] | null;
  skipped: number;
  updated: number;
  activityId?: string;
  endTime?: string;
  restarted?: number;
  startTime?: string;
  success?: boolean;
}

/** Que se esta actualizando ahora mismo (spec: UpdaterStatus). */
export interface UpdaterStatus {
  containerIds: string[] | null;
  projectIds: string[] | null;
  updatingContainers: number;
  updatingProjects: number;
}

/** Entrada del historial del updater (spec: AutoUpdateRecord). */
export interface AutoUpdateRecord {
  createdAt: string;
  id: string;
  resourceId: string;
  resourceName: string;
  resourceType: string;
  startTime: string;
  status: string;
  updateApplied: boolean;
  updateAvailable: boolean;
  details?: Record<string, unknown>;
  endTime?: string;
  error?: string;
  newImageVersions?: Record<string, unknown>;
  oldImageVersions?: Record<string, unknown>;
  updatedAt?: string;
}

/** Estado del escáner Trivy (spec: ScannerStatus). */
export interface ScannerStatus {
  available: boolean;
  version?: string;
}

/** Contadores por severidad (spec: VulnerabilitySeveritySummary). */
export interface VulnerabilitySeveritySummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  unknown: number;
  total: number;
}

/** Puntuaciones CVSS (spec: VulnerabilityCVSSInfo). */
export interface VulnerabilityCVSSInfo {
  v2Score?: number;
  v2Vector?: string;
  v3Score?: number;
  v3Vector?: string;
}

/** Una CVE de un escaneo (spec: VulnerabilityVulnerability). */
export interface Vulnerability {
  vulnerabilityId: string;
  pkgName: string;
  installedVersion: string;
  severity: string;
  fixedVersion?: string;
  title?: string;
  description?: string;
  references?: string[] | null;
  cvss?: VulnerabilityCVSSInfo;
  publishedDate?: string;
  lastModifiedDate?: string;
}

/** Una CVE con la imagen a la que pertenece (spec: VulnerabilityVulnerabilityWithImage). */
export interface VulnerabilityWithImage {
  vulnerabilityId: string;
  pkgName: string;
  installedVersion: string;
  severity: string;
  imageId: string;
  imageName: string;
  fixedVersion?: string;
  title?: string;
  description?: string;
  references?: string[] | null;
  cvss?: VulnerabilityCVSSInfo;
  publishedDate?: string;
  lastModifiedDate?: string;
}

/**
 * Resultado de un escaneo (spec: VulnerabilityScanResult). El MISMO schema es
 * el acuse del POST scan (status "scanning", sin array) y el resultado del GET
 * (status "completed", con array). Medido en la puerta de F4 (spec §2.1).
 */
export interface VulnerabilityScanResult {
  imageId: string;
  imageName: string;
  scanTime: string;
  status: string;
  scanPhase?: string;
  activityId?: string;
  duration?: number;
  error?: string;
  scannerVersion?: string;
  summary?: VulnerabilitySeveritySummary;
  vulnerabilities?: Vulnerability[] | null;
}

/** Resumen del escaneo de una imagen (spec: VulnerabilityScanSummary). */
export interface VulnerabilityScanSummary {
  imageId: string;
  scanTime: string;
  status: string;
  scanPhase?: string;
  error?: string;
  summary?: VulnerabilitySeveritySummary;
}

/**
 * Respuesta del batch (spec: VulnerabilityScanSummariesResponse). El mapa
 * OMITE las imágenes sin escaneo — medido contra la instancia real, mismo
 * comportamiento que by-refs en F3.
 */
export interface VulnerabilityScanSummariesResponse {
  summaries: Record<string, VulnerabilityScanSummary>;
}

/** Resumen de vulnerabilidades del entorno (spec: VulnerabilityEnvironmentVulnerabilitySummary). */
export interface EnvironmentVulnerabilitySummary {
  totalImages: number;
  scannedImages: number;
  summary?: VulnerabilitySeveritySummary;
}

/** Registro persistido de una vulnerabilidad ignorada (spec: VulnerabilityIgnoredVulnerability). */
export interface IgnoredVulnerability {
  id: string;
  environmentId: string;
  imageId: string;
  vulnerabilityId: string;
  pkgName: string;
  installedVersion: string;
  createdAt: string;
  createdBy: string;
  reason?: string;
}

/**
 * Payload de ignore (spec: VulnerabilityIgnorePayload), endurecido: `reason` es
 * obligatorio AQUÍ aunque el spec lo declare opcional (spec F4 §3.2), y
 * `createdBy` NO se expone — lo rellena el servidor con el usuario autenticado.
 */
export interface VulnerabilityIgnoreRequest {
  imageId: string;
  vulnerabilityId: string;
  pkgName: string;
  reason: string;
  installedVersion?: string;
}

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

/**
 * Extract the error text from a stream event, whichever shape it arrived in.
 * openapi.txt declares these streaming endpoints' 200 responses with no
 * `content`, so the stream shape isn't specified: Arcane may report a
 * failure via the plain `error` string, or via `errorDetail` (an object,
 * typically `{"message":"..."}`) — this was first observed on /pull, but
 * nothing rules it out on /up or /redeploy, so all four endpoints check both.
 * When both are present with the same text, `error` wins so the text isn't
 * duplicated in the aggregated message.
 */
function extractStreamError(e: ComposeStreamEvent): string | undefined {
  if (typeof e.error === "string" && e.error.length > 0) return e.error;
  if (e.errorDetail && typeof e.errorDetail.message === "string" && e.errorDetail.message.length > 0) {
    return e.errorDetail.message;
  }
  return undefined;
}

/**
 * Aggregate an NDJSON compose/pull stream into a single ActionResponse.
 * Surfaces stream errors actionably and treats `{"done":true}` as success.
 */
function summarizeComposeStream(events: ComposeStreamEvent[], action: string): ActionResponse {
  const errors = events.map(extractStreamError).filter((e): e is string => typeof e === "string");
  if (errors.length > 0) {
    return { success: false, message: `${action} failed: ${errors.join("; ")}` };
  }

  // Defensive fallback: a non-streaming response (single ActionResponse object).
  // requestNdjson yields it as one event — pass it through unchanged.
  if (events.length === 1 && typeof events[0]?.success === "boolean") {
    return { success: events[0].success as boolean, message: events[0].message ?? `${action} finished` };
  }

  const done = events.some(e => e.done === true);
  const logs = events
    .filter(e => typeof e.log === "string")
    .map(e => (e.log as string).trim())
    .filter(Boolean);
  return {
    success: done,
    message: logs.length > 0 ? logs.join(" | ") : `${action} finished (${events.length} events)`,
  };
}

export const BUILD_ARG_OCULTO = "<hidden by arcane-mcp>";
export const LINEAS_DE_LOG_CONSERVADAS = 100;

/**
 * Sustituye los valores de buildArgs y conserva las claves.
 *
 * Va en el CLIENTE y no en la capa de tool a proposito: en la tool, una
 * segunda tool futura sobre el mismo endpoint reintroduciria la fuga sin que
 * nada fallara. Es exactamente como se desplego rota arcane_image_update_check
 * en F3, por una rama que nadie ejercito.
 */
function enmascaraBuildArgs<T extends { buildArgs?: Record<string, string> }>(registro: T): T {
  if (!registro.buildArgs) return registro;
  const ocultos: Record<string, string> = {};
  for (const clave of Object.keys(registro.buildArgs)) ocultos[clave] = BUILD_ARG_OCULTO;
  return { ...registro, buildArgs: ocultos };
}

/**
 * Agrega el NDJSON de una build.
 *
 * No reutiliza summarizeComposeStream porque aquel une TODOS los logs en un
 * solo `message`: un compose up produce unas lineas, una build produce
 * cientos, sin cota. Comparte `extractStreamError`, que es lo unico igual.
 */
function summarizeBuildStream(events: ComposeStreamEvent[], action: string): BuildStreamSummary {
  const activityId = events.find(e => typeof e.activityId === "string")?.activityId;
  const logs = events
    .filter(e => typeof e.log === "string")
    .map(e => (e.log as string).trimEnd())
    .filter(l => l.length > 0);
  const logTail = logs.slice(-LINEAS_DE_LOG_CONSERVADAS);
  const droppedLines = logs.length - logTail.length;

  const errors = events.map(extractStreamError).filter((e): e is string => typeof e === "string");
  if (errors.length > 0) {
    return { success: false, message: `${action} failed: ${errors.join("; ")}`, activityId, logTail, droppedLines };
  }

  const done = events.some(e => e.done === true);
  return {
    success: done,
    message: done ? `${action} finished` : `${action} ended without a completion event`,
    activityId,
    logTail,
    droppedLines,
  };
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

/**
 * Escribe en la query los cinco parametros de listado que openapi.txt declara
 * para practicamente todos los endpoints de coleccion.
 *
 * `start` se compara con undefined y no por veracidad: `start=0` es un valor
 * valido, no una ausencia.
 */
function appendListParams(params: URLSearchParams, opts?: ListOptionsWithSort): void {
  if (opts?.search) params.set("search", opts.search);
  if (opts?.sort) params.set("sort", opts.sort);
  if (opts?.order) params.set("order", opts.order);
  if (opts?.start !== undefined) params.set("start", String(opts.start));
  if (opts?.limit) params.set("limit", String(opts.limit));
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

export interface GitRepository {
  id: string;
  name: string;
  url: string;
  authType: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  description?: string;
  sshHostKeyVerification?: string;
  username?: string;
}

export interface GitRepositoryCreate {
  name: string;
  url: string;
  authType: string;
  description?: string;
  enabled?: boolean;
  username?: string;
  token?: string;
  sshKey?: string;
  sshHostKeyVerification?: string;
}

export interface GitRepositoryUpdate {
  name?: string;
  url?: string;
  authType?: string;
  description?: string;
  enabled?: boolean;
  username?: string;
  token?: string;
  sshKey?: string;
  sshHostKeyVerification?: string;
}

export interface GitBranch {
  name: string;
  isDefault: boolean;
}

export interface GitFileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: GitFileNode[];
}

export interface GitOpsSync {
  id: string;
  name: string;
  environmentId: string;
  repositoryId: string;
  projectName: string;
  branch: string;
  composePath: string;
  targetType: string;
  autoSync: boolean;
  syncInterval: number;
  syncDirectory: boolean;
  maxSyncFiles: number;
  maxSyncBinarySize: number;
  maxSyncTotalSize: number;
  preDeployNetworkMode: string;
  preDeployTimeoutSec: number;
  createdAt: string;
  updatedAt: string;
  lastSyncAt?: string;
  lastSyncCommit?: string;
  lastSyncError?: string;
  lastSyncStatus?: string;
  projectId?: string;
  repository?: any;
  syncedFiles?: string;
}

export interface GitOpsSyncCreate {
  name: string;
  repositoryId: string;
  branch: string;
  composePath: string;
  projectName?: string;
  autoSync?: boolean;
  syncInterval?: number;
}

export interface GitOpsSyncUpdate {
  name?: string;
  repositoryId?: string;
  branch?: string;
  composePath?: string;
  projectName?: string;
  autoSync?: boolean;
  syncInterval?: number;
}

export interface GitOpsSyncStatus {
  status: string;
  lastSyncAt?: string;
  lastSyncCommit?: string;
  lastSyncMessage?: string;
  errorMessage?: string;
}

export interface VolumeBackup {
  id: string;
  volumeName: string;
  size: number;
  createdAt: string;
  activityId?: string;
  updatedAt?: string;
}

/**
 * Entrada del árbol de ficheros de un workspace (schema `WorkspaceFileEntry`).
 * Arcane 2.8.0 retiró la familia `/browse` y la sustituyó por `/workspace`:
 * el antiguo `type: 'file' | 'directory'` pasa a ser el booleano `isDirectory`.
 */
export interface WorkspaceFileEntry {
  name: string;
  path: string;
  relativePath: string;
  size: number;
  modTime: string;
  isDirectory: boolean;
  isSymlink: boolean;
  editable: boolean;
  mode?: string;
  linkTarget?: string;
  readOnlyReason?: "binary" | "too_large" | "symlink" | "special";
}

/** Schema `WorkspaceWorkspace`. `files` es nullable en el spec. */
export interface VolumeWorkspace {
  files: WorkspaceFileEntry[] | null;
  fileTreeRevision: string;
  fileTreeTruncated: boolean;
  activityId?: string;
}

export interface WorkspaceFileChange {
  operation:
    | "create_file"
    | "create_folder"
    | "update_file"
    | "rename"
    | "move"
    | "delete"
    | "restore_file";
  relativePath: string;
  newName?: string;
  newParentPath?: string;
  /** Índice del fichero correspondiente dentro del campo `files` del multipart. */
  uploadIndex?: number;
  baselineIndex?: number;
  backupId?: string;
  recursive?: boolean;
}

export interface WorkspaceUpdateManifest {
  /** Testigo de concurrencia optimista: el `fileTreeRevision` leído del workspace. */
  fileTreeRevision: string;
  fileChanges: WorkspaceFileChange[];
}

// ---------------------------------------------------------------------------
// F2 — observabilidad: activities, events, jobs y system
// ---------------------------------------------------------------------------

export interface ActivityStartedBy {
  displayName?: string;
  userId?: string;
  username: string;
}

export interface ActivityMessage {
  activityId: string;
  createdAt: string;
  id: string;
  level: string;
  message: string;
  payload?: Record<string, unknown>;
}

export interface Activity {
  batchId?: string;
  createdAt: string;
  durationMs?: number;
  endedAt?: string;
  environmentId: string;
  error?: string;
  id: string;
  latestMessage?: string;
  metadata?: Record<string, unknown>;
  progress?: number;
  resourceId?: string;
  resourceName?: string;
  resourceType?: string;
  sourceEnvironmentId?: string;
  sourceEnvironmentName?: string;
  startedAt: string;
  startedBy?: ActivityStartedBy;
  status: string;
  step?: string;
  type: string;
  updatedAt?: string;
}

export interface ActivityDetail {
  activity: Activity;
  messages: ActivityMessage[] | null;
}

export interface ActivityListOptions extends ListOptionsWithSort {
  status?: string;
  type?: string;
  resourceType?: string;
}

export interface Event {
  createdAt: string;
  description?: string;
  environmentId?: string;
  id: string;
  metadata?: Record<string, unknown>;
  resourceId?: string;
  resourceName?: string;
  resourceType?: string;
  severity: string;
  timestamp: string;
  title: string;
  type: string;
  updatedAt?: string;
  userId?: string;
  username?: string;
}

export interface EventSeverityCounts {
  error: number;
  info: number;
  success: number;
  total: number;
  warning: number;
}

export interface EventListOptions extends ListOptionsWithSort {
  /** Si viene, la consulta va a la ruta por entorno en vez de a la global. */
  environmentId?: string;
  severity?: string;
  type?: string;
}

export interface JobPrerequisite {
  isMet: boolean;
  label: string;
  settingKey: string;
  settingsUrl?: string;
}

export interface JobStatus {
  canRunManually: boolean;
  category: string;
  description: string;
  enabled: boolean;
  id: string;
  isContinuous: boolean;
  managerOnly: boolean;
  name: string;
  nextRun?: string;
  prerequisites: JobPrerequisite[] | null;
  schedule: string;
  settingsKey?: string;
}

/**
 * OJO: este endpoint NO usa el sobre paginado `{data, pagination}` del resto
 * de la API, sino `{jobs, isAgent}`. Tratarlo como paginado devuelve vacio
 * en silencio. Verificado en vivo contra la instancia el 2026-08-16.
 */
export interface JobListResponse {
  isAgent: boolean;
  jobs: JobStatus[] | null;
}

export interface JobSchedulesConfig {
  autoHealInterval: string;
  autoUpdateInterval: string;
  dockerClientRefreshInterval: string;
  environmentHealthInterval: string;
  eventCleanupInterval: string;
  expiredSessionsCleanupInterval: string;
  pollingInterval: string;
  scheduledPruneInterval: string;
  vulnerabilityScanInterval: string;
}

/** Todos los campos son opcionales: el spec declara `required: []`. */
export interface JobSchedulesUpdate {
  autoHealInterval?: string;
  autoUpdateInterval?: string;
  dockerClientRefreshInterval?: string;
  environmentHealthInterval?: string;
  eventCleanupInterval?: string;
  expiredSessionsCleanupInterval?: string;
  pollingInterval?: string;
  scheduledPruneInterval?: string;
  vulnerabilityScanInterval?: string;
}

/** Opciones de poda por recurso. `mode` es obligatorio en cada bloque. */
export interface SystemPruneResourceOptions {
  mode: string;
  until?: string;
}

export interface SystemPruneRequest {
  buildCache?: SystemPruneResourceOptions;
  containers?: SystemPruneResourceOptions;
  images?: SystemPruneResourceOptions;
  networks?: SystemPruneResourceOptions;
  /** `SystemPruneVolumesOptions` es el unico que NO admite `until` en el spec. */
  volumes?: { mode: string };
}

export interface SystemPruneResult {
  activityId?: string;
  buildCacheSpaceReclaimed?: number;
  containerSpaceReclaimed?: number;
  containersPruned?: string[] | null;
  errors?: string[] | null;
  imageSpaceReclaimed?: number;
  imagesDeleted?: string[] | null;
  networksDeleted?: string[] | null;
  spaceReclaimed: number;
  success: boolean;
  volumeSpaceReclaimed?: number;
  volumesDeleted?: string[] | null;
}

export interface SystemConvertResult {
  dockerCompose: string;
  envVars: string;
  serviceName: string;
  success: boolean;
}

/**
 * Respuesta de `GET /system/docker/info`. Es un reenvio del `info` de Docker:
 * ninguna tool lee sus campos, se serializa entero. Se declara completo para
 * que la auditoria de drift lo vigile. Los campos anidados propios de Docker
 * (`Plugins`, `Swarm`, `RegistryConfig`...) se dejan como `unknown`: la
 * auditoria compara presencia y opcionalidad de campos, no tipos, asi que
 * declararlos no aportaria nada y arrastraria una docena de interfaces mas.
 */
export interface DockerInfo {
  Architecture: string;
  CDISpecDirs: string[] | null;
  CPUSet: boolean;
  CPUShares: boolean;
  CgroupDriver: string;
  CgroupVersion?: string;
  Containerd?: unknown;
  ContainerdCommit: unknown;
  Containers: number;
  ContainersPaused: number;
  ContainersRunning: number;
  ContainersStopped: number;
  CpuCfsPeriod: boolean;
  CpuCfsQuota: boolean;
  Debug: boolean;
  DefaultAddressPools?: unknown[] | null;
  DefaultRuntime: string;
  DiscoveredDevices?: unknown[] | null;
  DockerRootDir: string;
  Driver: string;
  DriverStatus: (string[] | null)[] | null;
  ExperimentalBuild: boolean;
  FirewallBackend?: unknown;
  GenericResources: unknown[] | null;
  HttpProxy: string;
  HttpsProxy: string;
  ID: string;
  IPv4Forwarding: boolean;
  Images: number;
  IndexServerAddress: string;
  InitBinary: string;
  InitCommit: unknown;
  Isolation: string;
  KernelVersion: string;
  Labels: string[] | null;
  LiveRestoreEnabled: boolean;
  LoggingDriver: string;
  MemTotal: number;
  MemoryLimit: boolean;
  NCPU: number;
  NEventsListener: number;
  NFd: number;
  NGoroutines: number;
  NRI?: unknown;
  Name: string;
  NoProxy: string;
  OSType: string;
  OSVersion: string;
  OomKillDisable: boolean;
  OperatingSystem: string;
  PidsLimit: boolean;
  Plugins: unknown;
  ProductLicense?: string;
  RegistryConfig: unknown;
  RuncCommit: unknown;
  Runtimes: Record<string, unknown>;
  SecurityOptions: string[] | null;
  ServerVersion: string;
  SwapLimit: boolean;
  Swarm: unknown;
  SystemStatus?: (string[] | null)[] | null;
  SystemTime: string;
  Warnings: string[] | null;
  apiVersion: string;
  arch: string;
  buildTime: string;
  gitCommit: string;
  goVersion: string;
  os: string;
  success: boolean;
}

export interface ProjectUpdateExtended extends ProjectUpdate {
  removeFiles?: boolean;
  removeVolumes?: boolean;
}

export interface ContainerCreateOptions {
  name: string;
  image: string;
  cmd?: string[];
  env?: string[];
  ports?: Record<string, string>;
  volumes?: string[];
  networks?: string[];
  restartPolicy?: string;
  detach?: boolean;
}

// ---------------------------------------------------------------------------
// F5 — workspace de builds
// ---------------------------------------------------------------------------

/**
 * Entrada del workspace de builds.
 *
 * MEDIDO el 2026-08-19, y contradice openapi.txt: la respuesta real trae
 * {modTime, name, path, mode, size, isDirectory, isSymlink} y se identifica
 * como BaseApiResponseListVolumeFileEntry, NO como WorkspaceFileEntry. Faltan
 * `relativePath` y `editable`, que el spec declara OBLIGATORIOS.
 *
 * El tipo sigue a la realidad. La auditoria de drift los marcara contra el
 * spec: eso es correcto y esperado. NO los pongas obligatorios "para arreglar
 * el drift" -romperias el consumo real-.
 */
export interface BuildWorkspaceEntry {
  modTime: string;
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  isSymlink: boolean;
  mode?: string;
  relativePath?: string;
  editable?: boolean;
  linkTarget?: string;
  readOnlyReason?: "binary" | "too_large" | "symlink" | "special";
}

export interface BuildFileContent {
  /** base64 */
  content: string;
  mimeType: string;
}

/**
 * Registro del historial de builds.
 *
 * `buildArgs` llega SIEMPRE enmascarado desde el cliente: medido el
 * 2026-08-19, la API los persiste y los devuelve en claro, y los build args
 * llevan tokens de rutina. Ver `enmascaraBuildArgs`.
 *
 * `output` NO se enmascara y NO se puede: un log de build contiene todo lo que
 * la build imprimio. Se devuelve tal cual y la tool lo dice.
 */
export interface ImageBuildRecord {
  id: string;
  environmentId: string;
  status: string;
  createdAt: string;
  contextDir: string;
  noCache: boolean;
  pull: boolean;
  privileged: boolean;
  push: boolean;
  load: boolean;
  outputTruncated: boolean;
  buildArgs?: Record<string, string>;
  labels?: Record<string, string>;
  ulimits?: Record<string, string>;
  cacheFrom?: string[] | null;
  cacheTo?: string[] | null;
  platforms?: string[] | null;
  entitlements?: string[] | null;
  extraHosts?: string[] | null;
  tags?: string[] | null;
  completedAt?: string;
  digest?: string;
  dockerfile?: string;
  durationMs?: number;
  errorMessage?: string;
  isolation?: string;
  network?: string;
  output?: string;
  provider?: string;
  shmSize?: number;
  target?: string;
  userId?: string;
  username?: string;
}

export interface BuildRequest {
  contextDir: string;
  dockerfile?: string;
  dockerfileInline?: string;
  tags?: string[];
  buildArgs?: Record<string, string>;
  labels?: Record<string, string>;
  target?: string;
  platforms?: string[];
  noCache?: boolean;
  pull?: boolean;
  push?: boolean;
  load?: boolean;
  provider?: string;
}

export interface ProjectBuildRequest {
  services?: string[];
  push?: boolean;
  load?: boolean;
  provider?: string;
}

export interface BuildListOptions extends ListOptionsWithSort {
  status?: string;
  provider?: string;
}

export interface BuildStreamSummary {
  success: boolean;
  message: string;
  activityId?: string;
  logTail: string[];
  droppedLines: number;
}

class EnvironmentsMethods {
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

class StacksMethods {
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

class ContainersMethods {
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

/**
 * Codifica un segmento de ruta conservando los dos puntos literales.
 *
 * Medido el 2026-08-19: Arcane NO decodifica %3A en el segmento imageId
 * -devuelve 404 en los GET, 500 en el scan, y un 200 con cero items en el
 * listado, que es el fallo silencioso-, asi que el sha256: tiene que viajar
 * crudo. Pero interpolar el valor entero sin codificar permitia inyectar
 * ruta: un imageId con "../" y "#" resolvia a cualquier endpoint de Arcane,
 * incluido system/containers/stop-all. Se codifica todo lo demas y se
 * devuelven los dos puntos a su forma literal.
 */
function segmentoDeRuta(valor: string): string {
  return encodeURIComponent(valor).replace(/%3A/gi, ":");
}

class ImagesMethods {
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

class VolumesMethods {
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

class NetworksMethods {
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

class TemplatesMethods {
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

class SystemMethods {
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

class ActivitiesMethods {
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

class EventsMethods {
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

class JobsMethods {
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

class ImageUpdatesMethods {
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

class UpdaterMethods {
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
class VulnerabilitiesMethods {
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

/**
 * Registro de contenedor. Medido el 2026-08-19 contra Arcane 2.8.0 con sondas
 * `generic` y `ecr`: la respuesta NO incluye `token` ni `awsSecretAccessKey`
 * -no es que vengan enmascarados, es que el campo no existe-, y por eso las
 * lecturas se exponen. `awsAccessKeyId` si viene: es un identificador.
 */
export interface ContainerRegistry {
  id: string;
  url: string;
  username: string;
  insecure: boolean;
  enabled: boolean;
  registryType: string;
  repositoryNames: string[] | null;
  createdAt: string;
  updatedAt: string;
  description?: string;
  awsAccessKeyId?: string;
  awsRegion?: string;
}

export interface RegistryPullUsage {
  registryId: string;
  provider: string;
  registry: string;
  displayName: string;
  observedPulls: number;
  authMethod: string;
  checkedAt: string;
  authUsername?: string;
  error?: string;
  limit?: number;
  remaining?: number;
  repository?: string;
  source?: string;
  used?: number;
  windowSeconds?: number;
}

export interface RegistryPullUsageResponse {
  registries: RegistryPullUsage[] | null;
}

/**
 * Respuesta de los endpoints que devuelven un mensaje. NO es `ActionResponse`:
 * medido, el mensaje viene anidado bajo `data`, no en la raiz.
 */
export interface MessageResponse {
  success: boolean;
  data: { message: string };
}

/**
 * Registro de plantillas: un catalogo de plantillas por URL. A diferencia de
 * ContainerRegistry, NO guarda credenciales de ningun tipo -medido contra el
 * spec y contra la instancia-, asi que su CRUD se expone entero.
 */
export interface TemplateRegistry {
  id: string;
  enabled: boolean;
  name: string;
  description: string;
  url: string;
  lastFetchError?: string;
}

export interface TemplateRegistryInput {
  name: string;
  url: string;
  description: string;
  enabled: boolean;
}

class TemplateRegistriesMethods {
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

class GitRepositoriesMethods {
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

class GitOpsSyncsMethods {
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

class ProjectAdditionalMethods {
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

class ContainerAdditionalMethods {
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

class VolumeBackupsMethods {
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

  async download(envId: string, backupId: string): Promise<Blob> {
    const response = await this.client.fetchFn(`${this.client.getBaseUrl()}/environments/${encodeURIComponent(envId)}/volumes/backups/${encodeURIComponent(backupId)}/download`, {
      method: "GET",
      headers: {
        "X-API-Key": this.client.getApiKey(),
      },
    });

    await lanzaSiFalla(response);

    return response.blob();
  }

  async restore(envId: string, volumeName: string, backupId: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>(
      "POST",
      `/environments/${encodeURIComponent(envId)}/volumes/${encodeURIComponent(volumeName)}/backups/${encodeURIComponent(backupId)}/restore`
    );
  }
}

class VolumeFilesMethods {
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

class ContainerRegistriesMethods {
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

class ImageBuildsMethods {
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

class BuildWorkspaceMethods {
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

export class ArcaneClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly _fetch: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

  readonly environments: EnvironmentsMethods;
  readonly stacks: StacksMethods;
  readonly containers: ContainersMethods;
  readonly images: ImagesMethods;
  readonly volumes: VolumesMethods;
  readonly networks: NetworksMethods;
  readonly templates: TemplatesMethods;
  readonly system: SystemMethods;
  readonly activities: ActivitiesMethods;
  readonly events: EventsMethods;
  readonly jobs: JobsMethods;
  readonly imageUpdates: ImageUpdatesMethods;
  readonly updater: UpdaterMethods;
  readonly vulnerabilities: VulnerabilitiesMethods;
  readonly gitRepositories: GitRepositoriesMethods;
  readonly gitOpsSyncs: GitOpsSyncsMethods;
  readonly projectAdditional: ProjectAdditionalMethods;
  readonly containerAdditional: ContainerAdditionalMethods;
  readonly volumeBackups: VolumeBackupsMethods;
  readonly volumeFiles: VolumeFilesMethods;
  readonly containerRegistries: ContainerRegistriesMethods;
  readonly templateRegistries: TemplateRegistriesMethods;
  readonly buildWorkspace: BuildWorkspaceMethods;
  readonly imageBuilds: ImageBuildsMethods;

  // When a Cloudflare VPC Fetcher is provided, routing to the Arcane backend
  // is handled by the service binding — only the path portion of URLs matters.
  // When running locally (wrangler dev), pass a real baseUrl instead.
  constructor(apiKey: string, fetcherOrBaseUrl?: Fetcher | string) {
    if (typeof fetcherOrBaseUrl === "string") {
      // Local / Docker mode: real base URL provided
      this.baseUrl = fetcherOrBaseUrl.replace(/\/+$/, "") + "/api";
      this.apiKey = apiKey;
      this._fetch = (input, init) => fetch(input, init);
    } else {
      // Cloudflare Worker mode: VPC service binding
      this.baseUrl = "http://placeholder/api";
      this.apiKey = apiKey;
      this._fetch = fetcherOrBaseUrl ? fetcherOrBaseUrl.fetch.bind(fetcherOrBaseUrl) : fetch;
    }
    this.environments = new EnvironmentsMethods(this);
    this.stacks = new StacksMethods(this);
    this.containers = new ContainersMethods(this);
    this.images = new ImagesMethods(this);
    this.volumes = new VolumesMethods(this);
    this.networks = new NetworksMethods(this);
    this.templates = new TemplatesMethods(this);
    this.system = new SystemMethods(this);
    this.activities = new ActivitiesMethods(this);
    this.events = new EventsMethods(this);
    this.jobs = new JobsMethods(this);
    this.imageUpdates = new ImageUpdatesMethods(this);
    this.updater = new UpdaterMethods(this);
    this.vulnerabilities = new VulnerabilitiesMethods(this);
    this.gitRepositories = new GitRepositoriesMethods(this);
    this.gitOpsSyncs = new GitOpsSyncsMethods(this);
    this.projectAdditional = new ProjectAdditionalMethods(this);
    this.containerAdditional = new ContainerAdditionalMethods(this);
    this.volumeBackups = new VolumeBackupsMethods(this);
    this.volumeFiles = new VolumeFilesMethods(this);
    this.containerRegistries = new ContainerRegistriesMethods(this);
    this.templateRegistries = new TemplateRegistriesMethods(this);
    this.buildWorkspace = new BuildWorkspaceMethods(this);
    this.imageBuilds = new ImageBuildsMethods(this);
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  getApiKey(): string {
    return this.apiKey;
  }

  get fetchFn(): (input: string | URL | Request, init?: RequestInit) => Promise<Response> {
    return this._fetch;
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await this._fetch(url, {
      method,
      headers: {
        "X-API-Key": this.apiKey,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    await lanzaSiFalla(response);

    return response.json() as Promise<T>;
  }

  /**
   * Como `request<T>`, pero para endpoints que no devuelven cuerpo (HEAD).
   *
   * `request()` termina en `response.json()`, que con un cuerpo vacio lanza.
   * Aqui el veredicto es el codigo de estado, y un estado de error NO lanza:
   * "el sistema no esta sano" es una respuesta valida, no un fallo de la llamada.
   */
  async requestHead(path: string): Promise<{ ok: boolean; status: number }> {
    const response = await this._fetch(`${this.baseUrl}${path}`, {
      method: "HEAD",
      headers: { "X-API-Key": this.apiKey },
    });
    return { ok: response.ok, status: response.status };
  }

  /**
   * Como `request<T>`, pero para endpoints que responden 204 sin cuerpo.
   *
   * `request()` termina en `response.json()`, que con un cuerpo vacio lanza.
   * Medido el 2026-08-19: POST /builds/browse/mkdir y DELETE /builds/browse
   * devuelven 204 y ningun byte.
   *
   * A diferencia de `requestHead()`, aqui un estado de error SI lanza: alli el
   * codigo era el dato ("el sistema no esta sano" es una respuesta valida), aqui
   * "no pude crear el directorio" es un fallo de la llamada.
   */
  async requestSinCuerpo(method: string, path: string, body?: unknown): Promise<void> {
    const response = await this._fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "X-API-Key": this.apiKey,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    await lanzaSiFalla(response);
  }

  /**
   * Like `request<T>`, but sends a `FormData` body for multipart endpoints
   * (e.g. `PUT /volumes/{name}/workspace`).
   *
   * Deliberately omits `Content-Type`: the runtime must set it so it can add the
   * multipart boundary. Setting it by hand produces a body the server can't parse.
   */
  async requestMultipart<T>(method: string, path: string, form: FormData): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await this._fetch(url, {
      method,
      headers: { "X-API-Key": this.apiKey },
      body: form,
    });

    await lanzaSiFalla(response);

    return response.json() as Promise<T>;
  }

  /**
   * Like `request<T>`, but parses the response as NDJSON (newline-delimited JSON).
   * Used for streaming endpoints like /pull that emit one JSON object per line.
   * Returns an array with one entry per parsed line. Empty/blank lines are skipped.
   */
  async requestNdjson<T = unknown>(method: string, path: string, body?: unknown): Promise<T[]> {
    const url = `${this.baseUrl}${path}`;
    const response = await this._fetch(url, {
      method,
      headers: {
        "X-API-Key": this.apiKey,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    await lanzaSiFalla(response);

    const text = await response.text();
    const events: T[] = [];
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        events.push(JSON.parse(trimmed) as T);
      } catch {
        // Ignore unparseable lines (e.g. trailing partial chunks)
      }
    }
    return events;
  }
}
