import type { ListOptionsWithSort } from "./types-catalog";

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

