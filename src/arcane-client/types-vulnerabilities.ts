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

