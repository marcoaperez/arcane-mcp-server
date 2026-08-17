export class ArcaneApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ArcaneApiError";
  }
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
  updateInfo?: any;
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
  updateInfo?: any;
}

export interface ImagePullOptions {
  imageName: string;
}

export interface ImagePruneReport {
  imagesDeleted: number;
  spaceReclaimed: number;
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

export interface ListOptions {
  search?: string;
  limit?: number;
}

export interface ListOptionsWithSort extends ListOptions {
  sort?: string;
  order?: string;
  start?: number;
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

class EnvironmentsMethods {
  constructor(private client: ArcaneClient) {}

  async list(opts?: ListOptions): Promise<PaginatedResponse<Environment>> {
    const params = new URLSearchParams();
    if (opts?.search) params.set("search", opts.search);
    if (opts?.limit) params.set("limit", String(opts.limit));
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

  async list(envId: string, opts?: ListOptions): Promise<PaginatedResponse<Project>> {
    const params = new URLSearchParams();
    if (opts?.search) params.set("search", opts.search);
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

  async list(envId: string): Promise<PaginatedResponse<ContainerSummary>> {
    return this.client.request<PaginatedResponse<ContainerSummary>>("GET", `/environments/${encodeURIComponent(envId)}/containers`);
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

class ImagesMethods {
  constructor(private client: ArcaneClient) {}

  async list(envId: string): Promise<PaginatedResponse<ImageSummary>> {
    return this.client.request<PaginatedResponse<ImageSummary>>("GET", `/environments/${encodeURIComponent(envId)}/images`);
  }

  async pull(envId: string, dto: ImagePullOptions): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("POST", `/environments/${encodeURIComponent(envId)}/images/pull`, dto);
  }

  async remove(envId: string, imageId: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("DELETE", `/environments/${encodeURIComponent(envId)}/images/${encodeURIComponent(imageId)}`);
  }

  async prune(envId: string): Promise<{ success: boolean; data: ImagePruneReport }> {
    return this.client.request<{ success: boolean; data: ImagePruneReport }>("POST", `/environments/${encodeURIComponent(envId)}/images/prune`);
  }
}

class VolumesMethods {
  constructor(private client: ArcaneClient) {}

  async list(envId: string): Promise<PaginatedResponse<Volume>> {
    return this.client.request<PaginatedResponse<Volume>>("GET", `/environments/${encodeURIComponent(envId)}/volumes`);
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

  async list(envId: string): Promise<PaginatedResponse<NetworkSummary>> {
    return this.client.request<PaginatedResponse<NetworkSummary>>("GET", `/environments/${encodeURIComponent(envId)}/networks`);
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

  async list(opts?: ListOptions): Promise<PaginatedResponse<Template>> {
    const params = new URLSearchParams();
    if (opts?.search) params.set("search", opts.search);
    const query = params.toString();
    return this.client.request<PaginatedResponse<Template>>(`GET`, `/templates${query ? `?${query}` : ""}`);
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
    return this.client.requestHead("HEAD", `/environments/${encodeURIComponent(envId)}/system/health`);
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

export interface ActivityListOptions extends ListOptionsWithSort {
  status?: string;
  type?: string;
  resourceType?: string;
}

class ActivitiesMethods {
  constructor(private client: ArcaneClient) {}

  async list(envId: string, opts?: ActivityListOptions): Promise<PaginatedResponse<Activity>> {
    const params = new URLSearchParams();
    if (opts?.search) params.set("search", opts.search);
    if (opts?.status) params.set("status", opts.status);
    if (opts?.type) params.set("type", opts.type);
    if (opts?.resourceType) params.set("resourceType", opts.resourceType);
    if (opts?.limit) params.set("limit", String(opts.limit));
    const query = params.toString();
    return this.client.request<PaginatedResponse<Activity>>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/activities${query ? `?${query}` : ""}`
    );
  }

  async get(envId: string, activityId: string): Promise<{ success: boolean; data: ActivityDetail }> {
    return this.client.request<{ success: boolean; data: ActivityDetail }>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/activities/${encodeURIComponent(activityId)}`
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

export interface EventListOptions extends ListOptionsWithSort {
  /** Si viene, la consulta va a la ruta por entorno en vez de a la global. */
  environmentId?: string;
  severity?: string;
  type?: string;
}

class EventsMethods {
  constructor(private client: ArcaneClient) {}

  async list(opts?: EventListOptions): Promise<PaginatedResponse<Event>> {
    const params = new URLSearchParams();
    if (opts?.search) params.set("search", opts.search);
    if (opts?.severity) params.set("severity", opts.severity);
    if (opts?.type) params.set("type", opts.type);
    if (opts?.limit) params.set("limit", String(opts.limit));
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

class GitRepositoriesMethods {
  constructor(private client: ArcaneClient) {}

  async list(opts?: ListOptionsWithSort): Promise<PaginatedResponse<GitRepository>> {
    const params = new URLSearchParams();
    if (opts?.search) params.set("search", opts.search);
    if (opts?.sort) params.set("sort", opts.sort);
    if (opts?.order) params.set("order", opts.order);
    if (opts?.start) params.set("start", String(opts.start));
    if (opts?.limit) params.set("limit", String(opts.limit));
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

  async list(envId: string, opts?: ListOptionsWithSort): Promise<PaginatedResponse<GitOpsSync>> {
    const params = new URLSearchParams();
    if (opts?.search) params.set("search", opts.search);
    if (opts?.sort) params.set("sort", opts.sort);
    if (opts?.order) params.set("order", opts.order);
    if (opts?.start) params.set("start", String(opts.start));
    if (opts?.limit) params.set("limit", String(opts.limit));
    const query = params.toString();
    return this.client.request<PaginatedResponse<GitOpsSync>>(
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
    if (opts?.search) params.set("search", opts.search);
    if (opts?.sort) params.set("sort", opts.sort);
    if (opts?.order) params.set("order", opts.order);
    if (opts?.start) params.set("start", String(opts.start));
    if (opts?.limit) params.set("limit", String(opts.limit));
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

    if (!response.ok) {
      let message = response.statusText;
      try {
        const err = (await response.json()) as { detail?: string };
        if (err.detail) message = err.detail;
      } catch {}
      throw new ArcaneApiError(response.status, message);
    }

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
  readonly gitRepositories: GitRepositoriesMethods;
  readonly gitOpsSyncs: GitOpsSyncsMethods;
  readonly projectAdditional: ProjectAdditionalMethods;
  readonly containerAdditional: ContainerAdditionalMethods;
  readonly volumeBackups: VolumeBackupsMethods;
  readonly volumeFiles: VolumeFilesMethods;

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
    this.gitRepositories = new GitRepositoriesMethods(this);
    this.gitOpsSyncs = new GitOpsSyncsMethods(this);
    this.projectAdditional = new ProjectAdditionalMethods(this);
    this.containerAdditional = new ContainerAdditionalMethods(this);
    this.volumeBackups = new VolumeBackupsMethods(this);
    this.volumeFiles = new VolumeFilesMethods(this);
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

    if (!response.ok) {
      let message = response.statusText;
      try {
        const err = (await response.json()) as { detail?: string };
        if (err.detail) message = err.detail;
      } catch {}
      throw new ArcaneApiError(response.status, message);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Como `request<T>`, pero para endpoints que no devuelven cuerpo (HEAD).
   *
   * `request()` termina en `response.json()`, que con un cuerpo vacio lanza.
   * Aqui el veredicto es el codigo de estado, y un estado de error NO lanza:
   * "el sistema no esta sano" es una respuesta valida, no un fallo de la llamada.
   */
  async requestHead(method: string, path: string): Promise<{ ok: boolean; status: number }> {
    const response = await this._fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { "X-API-Key": this.apiKey },
    });
    return { ok: response.ok, status: response.status };
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

    if (!response.ok) {
      let message = response.statusText;
      try {
        const err = (await response.json()) as { detail?: string };
        if (err.detail) message = err.detail;
      } catch {}
      throw new ArcaneApiError(response.status, message);
    }

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

    if (!response.ok) {
      let message = response.statusText;
      try {
        const err = (await response.json()) as { detail?: string };
        if (err.detail) message = err.detail;
      } catch {}
      throw new ArcaneApiError(response.status, message);
    }

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
