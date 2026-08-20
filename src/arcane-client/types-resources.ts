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
