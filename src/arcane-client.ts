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
  fileTreeRevision?: string;
  fileTreeTruncated?: boolean;
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

export interface VolumeFileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: string;
}

export interface VolumeUploadFile {
  filename: string;
  content: string;
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
    return this.client.request<{ success: boolean; data: Environment }>("GET", `/environments/${id}`);
  }

  async create(dto: EnvironmentCreate): Promise<{ success: boolean; data: Environment }> {
    return this.client.request<{ success: boolean; data: Environment }>("POST", "/environments", dto);
  }

  async update(id: string, dto: EnvironmentUpdate): Promise<{ success: boolean; data: Environment }> {
    return this.client.request<{ success: boolean; data: Environment }>("PUT", `/environments/${id}`, dto);
  }

  async delete(id: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("DELETE", `/environments/${id}`);
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
      `/environments/${envId}/projects${query ? `?${query}` : ""}`
    );
  }

  async get(envId: string, stackId: string): Promise<{ success: boolean; data: Project }> {
    return this.client.request<{ success: boolean; data: Project }>("GET", `/environments/${envId}/projects/${stackId}`);
  }

  async deploy(envId: string, dto: ProjectCreate): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("POST", `/environments/${envId}/projects`, dto);
  }

  async update(envId: string, stackId: string, dto: ProjectUpdate): Promise<{ success: boolean; data: Project }> {
    return this.client.request<{ success: boolean; data: Project }>("PUT", `/environments/${envId}/projects/${stackId}`, dto);
  }

  async delete(envId: string, stackId: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("DELETE", `/environments/${envId}/projects/${stackId}/destroy`);
  }

  async start(envId: string, stackId: string): Promise<ActionResponse> {
    // /up streams NDJSON (docker compose up progress), not a single JSON object.
    // Parse the stream and summarize it as an ActionResponse.
    const events = await this.client.requestNdjson<ComposeStreamEvent>(
      "POST",
      `/environments/${envId}/projects/${stackId}/up`
    );
    return summarizeComposeStream(events, "Start");
  }

  async stop(envId: string, stackId: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("POST", `/environments/${envId}/projects/${stackId}/down`);
  }

  async restart(envId: string, stackId: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("POST", `/environments/${envId}/projects/${stackId}/restart`);
  }

  async pull(envId: string, stackId: string): Promise<ActionResponse> {
    // /pull streams NDJSON, like /up and /redeploy (Task 11: confirmed against
    // a real Arcane v2.7.0 stream to be the same {activityId,log,done} shape,
    // not docker-pull-style {status,id}). Parse and summarize the same way.
    const events = await this.client.requestNdjson<ComposeStreamEvent>(
      "POST",
      `/environments/${envId}/projects/${stackId}/pull`
    );
    return summarizeComposeStream(events, "Pull");
  }
}

class ContainersMethods {
  constructor(private client: ArcaneClient) {}

  async list(envId: string): Promise<PaginatedResponse<ContainerSummary>> {
    return this.client.request<PaginatedResponse<ContainerSummary>>("GET", `/environments/${envId}/containers`);
  }

  async get(envId: string, containerId: string): Promise<{ success: boolean; data: ContainerDetails }> {
    return this.client.request<{ success: boolean; data: ContainerDetails }>(
      "GET",
      `/environments/${envId}/containers/${containerId}`
    );
  }

  async start(envId: string, containerId: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("POST", `/environments/${envId}/containers/${containerId}/start`);
  }

  async stop(envId: string, containerId: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("POST", `/environments/${envId}/containers/${containerId}/stop`);
  }

  async restart(envId: string, containerId: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("POST", `/environments/${envId}/containers/${containerId}/restart`);
  }

  async kill(envId: string, containerId: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("POST", `/environments/${envId}/containers/${containerId}/update`, { action: "kill" });
  }
}

class ImagesMethods {
  constructor(private client: ArcaneClient) {}

  async list(envId: string): Promise<PaginatedResponse<ImageSummary>> {
    return this.client.request<PaginatedResponse<ImageSummary>>("GET", `/environments/${envId}/images`);
  }

  async pull(envId: string, dto: ImagePullOptions): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("POST", `/environments/${envId}/images/pull`, dto);
  }

  async remove(envId: string, imageId: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("DELETE", `/environments/${envId}/images/${imageId}`);
  }

  async prune(envId: string): Promise<{ success: boolean; data: ImagePruneReport }> {
    return this.client.request<{ success: boolean; data: ImagePruneReport }>("POST", `/environments/${envId}/images/prune`);
  }
}

class VolumesMethods {
  constructor(private client: ArcaneClient) {}

  async list(envId: string): Promise<PaginatedResponse<Volume>> {
    return this.client.request<PaginatedResponse<Volume>>("GET", `/environments/${envId}/volumes`);
  }

  async inspect(envId: string, name: string): Promise<{ success: boolean; data: Volume }> {
    return this.client.request<{ success: boolean; data: Volume }>("GET", `/environments/${envId}/volumes/${name}`);
  }

  async remove(envId: string, name: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("DELETE", `/environments/${envId}/volumes/${name}`);
  }

  async prune(envId: string): Promise<{ success: boolean; data: VolumePruneReport }> {
    return this.client.request<{ success: boolean; data: VolumePruneReport }>("POST", `/environments/${envId}/volumes/prune`);
  }
}

class NetworksMethods {
  constructor(private client: ArcaneClient) {}

  async list(envId: string): Promise<PaginatedResponse<NetworkSummary>> {
    return this.client.request<PaginatedResponse<NetworkSummary>>("GET", `/environments/${envId}/networks`);
  }

  async inspect(envId: string, networkId: string): Promise<{ success: boolean; data: NetworkInspect }> {
    return this.client.request<{ success: boolean; data: NetworkInspect }>(
      "GET",
      `/environments/${envId}/networks/${networkId}`
    );
  }

  async remove(envId: string, networkId: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("DELETE", `/environments/${envId}/networks/${networkId}`);
  }

  async prune(envId: string): Promise<{ success: boolean; data: NetworkPruneReport }> {
    return this.client.request<{ success: boolean; data: NetworkPruneReport }>("POST", `/environments/${envId}/networks/prune`);
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
    return this.client.request<{ success: boolean; data: Template }>("GET", `/templates/${id}`);
  }

  async create(dto: TemplateCreate): Promise<{ success: boolean; data: Template }> {
    return this.client.request<{ success: boolean; data: Template }>("POST", "/templates", dto);
  }

  async update(id: string, dto: TemplateUpdate): Promise<{ success: boolean; data: Template }> {
    return this.client.request<{ success: boolean; data: Template }>("PUT", `/templates/${id}`, dto);
  }

  async delete(id: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("DELETE", `/templates/${id}`);
  }
}

class SystemMethods {
  constructor(private client: ArcaneClient) {}

  async version(): Promise<VersionInfo> {
    return this.client.request<VersionInfo>("GET", "/app-version");
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
    return this.client.request<{ success: boolean; data: GitRepository }>("GET", `/customize/git-repositories/${id}`);
  }

  async create(dto: GitRepositoryCreate): Promise<{ success: boolean; data: GitRepository }> {
    return this.client.request<{ success: boolean; data: GitRepository }>("POST", "/customize/git-repositories", dto);
  }

  async update(id: string, dto: GitRepositoryUpdate): Promise<{ success: boolean; data: GitRepository }> {
    return this.client.request<{ success: boolean; data: GitRepository }>("PUT", `/customize/git-repositories/${id}`, dto);
  }

  async delete(id: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("DELETE", `/customize/git-repositories/${id}`);
  }

  async listBranches(id: string): Promise<{ success: boolean; data: GitBranch[] }> {
    return this.client.request<{ success: boolean; data: GitBranch[] }>("GET", `/customize/git-repositories/${id}/branches`);
  }

  async browseFiles(id: string, branch?: string, path?: string): Promise<{ success: boolean; data: GitFileNode[] }> {
    const params = new URLSearchParams();
    if (branch) params.set("branch", branch);
    if (path) params.set("path", path);
    const query = params.toString();
    return this.client.request<{ success: boolean; data: GitFileNode[] }>(
      "GET",
      `/customize/git-repositories/${id}/files${query ? `?${query}` : ""}`
    );
  }

  async test(id: string, branch?: string): Promise<ActionResponse> {
    const body = branch ? { branch } : undefined;
    return this.client.request<ActionResponse>("POST", `/customize/git-repositories/${id}/test`, body);
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
      `/environments/${envId}/gitops-syncs${query ? `?${query}` : ""}`
    );
  }

  async get(envId: string, syncId: string): Promise<{ success: boolean; data: GitOpsSync }> {
    return this.client.request<{ success: boolean; data: GitOpsSync }>(
      "GET",
      `/environments/${envId}/gitops-syncs/${syncId}`
    );
  }

  async create(envId: string, dto: GitOpsSyncCreate): Promise<{ success: boolean; data: GitOpsSync }> {
    return this.client.request<{ success: boolean; data: GitOpsSync }>(
      "POST",
      `/environments/${envId}/gitops-syncs`,
      dto
    );
  }

  async update(envId: string, syncId: string, dto: GitOpsSyncUpdate): Promise<{ success: boolean; data: GitOpsSync }> {
    return this.client.request<{ success: boolean; data: GitOpsSync }>(
      "PUT",
      `/environments/${envId}/gitops-syncs/${syncId}`,
      dto
    );
  }

  async delete(envId: string, syncId: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("DELETE", `/environments/${envId}/gitops-syncs/${syncId}`);
  }

  async browseFiles(envId: string, syncId: string, path?: string): Promise<{ success: boolean; data: GitFileNode[] }> {
    const params = new URLSearchParams();
    if (path) params.set("path", path);
    const query = params.toString();
    return this.client.request<{ success: boolean; data: GitFileNode[] }>(
      "GET",
      `/environments/${envId}/gitops-syncs/${syncId}/files${query ? `?${query}` : ""}`
    );
  }

  async getStatus(envId: string, syncId: string): Promise<{ success: boolean; data: GitOpsSyncStatus }> {
    return this.client.request<{ success: boolean; data: GitOpsSyncStatus }>(
      "GET",
      `/environments/${envId}/gitops-syncs/${syncId}/status`
    );
  }

  async performSync(envId: string, syncId: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("POST", `/environments/${envId}/gitops-syncs/${syncId}/sync`);
  }
}

class ProjectAdditionalMethods {
  constructor(private client: ArcaneClient) {}

  async down(envId: string, projectId: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("POST", `/environments/${envId}/projects/${projectId}/down`);
  }

  async pullImages(envId: string, projectId: string): Promise<ActionResponse> {
    // /pull streams NDJSON, like /up and /redeploy (Task 11: confirmed against
    // a real Arcane v2.7.0 stream to be the same {activityId,log,done} shape,
    // not docker-pull-style {status,id}). Parse and summarize the same way.
    const events = await this.client.requestNdjson<ComposeStreamEvent>(
      "POST",
      `/environments/${envId}/projects/${projectId}/pull`
    );
    return summarizeComposeStream(events, "Pull");
  }

  async redeploy(envId: string, projectId: string): Promise<ActionResponse> {
    // /redeploy streams NDJSON (docker compose down+up progress), like /up.
    // Parse the stream and summarize it as an ActionResponse.
    const events = await this.client.requestNdjson<ComposeStreamEvent>(
      "POST",
      `/environments/${envId}/projects/${projectId}/redeploy`
    );
    return summarizeComposeStream(events, "Redeploy");
  }

  async destroy(envId: string, projectId: string, removeFiles?: boolean, removeVolumes?: boolean): Promise<ActionResponse> {
    return this.client.request<ActionResponse>(
      "DELETE",
      `/environments/${envId}/projects/${projectId}/destroy?removeFiles=${removeFiles ?? false}&removeVolumes=${removeVolumes ?? false}`
    );
  }
}

class ContainerAdditionalMethods {
  constructor(private client: ArcaneClient) {}

  async create(envId: string, dto: ContainerCreateOptions): Promise<{ success: boolean; data: ContainerDetails }> {
    return this.client.request<{ success: boolean; data: ContainerDetails }>("POST", `/environments/${envId}/containers`, dto);
  }

  async delete(envId: string, containerId: string, force?: boolean, volumes?: boolean): Promise<ActionResponse> {
    const params = new URLSearchParams();
    if (force) params.set("force", "true");
    if (volumes) params.set("volumes", "true");
    const query = params.toString();
    return this.client.request<ActionResponse>(
      "DELETE",
      `/environments/${envId}/containers/${containerId}${query ? `?${query}` : ""}`
    );
  }

  async update(envId: string, containerId: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("POST", `/environments/${envId}/containers/${containerId}/update`);
  }
}

class VolumeBackupsMethods {
  constructor(private client: ArcaneClient) {}

  async create(envId: string, volumeName: string): Promise<{ success: boolean; data: VolumeBackup }> {
    return this.client.request<{ success: boolean; data: VolumeBackup }>(
      "POST",
      `/environments/${envId}/volumes/${volumeName}/backups`
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
      `/environments/${envId}/volumes/${volumeName}/backups${query ? `?${query}` : ""}`
    );
  }

  async delete(envId: string, backupId: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("DELETE", `/environments/${envId}/volumes/backups/${backupId}`);
  }

  async download(envId: string, backupId: string): Promise<Blob> {
    const response = await this.client.fetchFn(`${this.client.getBaseUrl()}/environments/${envId}/volumes/backups/${backupId}/download`, {
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
      `/environments/${envId}/volumes/${volumeName}/backups/${backupId}/restore`
    );
  }
}

class VolumeFilesMethods {
  constructor(private client: ArcaneClient) {}

  async browse(envId: string, volumeName: string, path?: string): Promise<{ success: boolean; data: VolumeFileNode[] }> {
    const params = new URLSearchParams();
    if (path) params.set("path", path);
    const query = params.toString();
    return this.client.request<{ success: boolean; data: VolumeFileNode[] }>(
      "GET",
      `/environments/${envId}/volumes/${volumeName}/browse${query ? `?${query}` : ""}`
    );
  }

  async upload(envId: string, volumeName: string, filename: string, content: string, path?: string): Promise<ActionResponse> {
    const params = new URLSearchParams();
    if (path) params.set("path", path);
    const query = params.toString();
    return this.client.request<ActionResponse>(
      "POST",
      `/environments/${envId}/volumes/${volumeName}/browse/upload${query ? `?${query}` : ""}`,
      { filename, content }
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
