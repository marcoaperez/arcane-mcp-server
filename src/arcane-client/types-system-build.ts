import type { ListOptionsWithSort } from "./types-catalog";
import type { ProjectUpdate } from "./types-resources";

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

