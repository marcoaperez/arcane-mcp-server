# Plan de implementación — F4: vulnerabilidades

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exponer las 12 operaciones de vulnerabilidades de Arcane 2.8.0 como 12 tools MCP con verificación unitaria y e2e contra la instancia real, sembrando los datos con un escaneo del propio `beforeAll`.

**Architecture:** Un fichero nuevo de tools (`src/tools/vulnerabilities.ts`), una clase nueva en el cliente (`VulnerabilitiesMethods`), 10 tipos bajo auditoría de drift. El cliente es fiel a la API; la única transformación (el recorte de `_scan_result`) vive en la capa tool.

**Tech Stack:** TypeScript, Zod, vitest, MCP SDK. Sin dependencias nuevas.

**Spec:** [2026-08-18-f4-vulnerabilidades-design.md](../specs/2026-08-18-f4-vulnerabilidades-design.md)

## Global Constraints

- **`openapi.txt` manda** sobre este plan y sobre el spec. Antes de escribir código, verifica los tipos/parámetros contra el spec con los comandos del paso correspondiente. Si discrepan, para y repórtalo.
- **Falsabilidad por mutación en cada tarea:** tras escribir un test, muta el código como indica la tarea, comprueba que el test FALLA, revierte, comprueba que PASA. Un test que no puede fallar no cuenta.
- **Prohibido enumerar claves `undefined` en `toHaveBeenCalledWith`** (`sort: undefined` no comprueba nada — trampa documentada de F2). Los parámetros opcionales se cubren con URL literal completa CON el parámetro y otra SIN él.
- **Nada de `any`** en tipos nuevos: la auditoría de drift no los detecta (trampa documentada).
- Rama de trabajo: `feat/f4-vulnerabilidades` (ya existe, con el spec commiteado). **Commits firmados.** 1Password se autobloquea cada 20–30 min y tumba la firma: si `git commit` falla por firma, PIDE AL PROPIETARIO desbloquear. **Nunca `--no-gpg-sign`.**
- Unitarios: `npm test` (sin red). e2e: `set -a; . ./.dev.vars; set +a` y `ARCANE_BASE_URL=http://192.168.180.210:3552 npm run test:e2e -- --reporter=verbose`. La red (Tailscale) tira el 10–30 % de conexiones EN CUALQUIER PUERTO: un fallo `ECONNREFUSED`/`fetch failed` se reintenta antes de diagnosticar. **Un fichero que aborta al importar sale como `skipped`, no como fallo: cuenta las `✓` una a una; `skipped` no es verde.**
- Mutantes e2e SOLO sobre la imagen `SCAN_IMAGE` (`curlimages/curl:8.5.0` por defecto). **Nunca** sobre el contenedor `arcane-mcp-server` ni la imagen `ghcr.io/getarcaneapp/arcane`.
- `npm test` y `npm run type-check` deben estar verdes ANTES de empezar cada tarea y DESPUÉS de terminarla.

**Estado de partida medido (2026-08-18):** `main`=`2a0bff4`, rama con el spec en `91625c6`. 262 tests unitarios, 46 e2e, 88 tools, drift 21 (0 graves), type-check limpio. Instancia sembrada: `curlimages/curl:8.5.0` escaneada (44 CVEs hoy — cifra volátil, no la claves en ningún test).

---

### Task 1: Tipos de vulnerabilidades bajo auditoría de drift

**Files:**
- Modify: `src/arcane-client.ts` (interfaces nuevas tras `AutoUpdateRecord`, busca `export interface AutoUpdateRecord`)
- Modify: `scripts/audit-schema-drift.mjs` (el mapa `MAP`)

**Interfaces:**
- Consumes: nada.
- Produces: los 11 tipos exportados que usan las Tasks 2–7: `ScannerStatus`, `VulnerabilitySeveritySummary`, `VulnerabilityCVSSInfo`, `Vulnerability`, `VulnerabilityWithImage`, `VulnerabilityScanResult`, `VulnerabilityScanSummary`, `VulnerabilityScanSummariesResponse`, `EnvironmentVulnerabilitySummary`, `IgnoredVulnerability`, `VulnerabilityIgnoreRequest`.

- [ ] **Step 1: Verifica los shapes contra `openapi.txt`** (la fuente de verdad, no este plan):

```bash
node -e "
const s=JSON.parse(require('fs').readFileSync('openapi.txt','utf8'));
for(const k of ['ScannerStatus','VulnerabilitySeveritySummary','VulnerabilityCVSSInfo','VulnerabilityVulnerability','VulnerabilityVulnerabilityWithImage','VulnerabilityScanResult','VulnerabilityScanSummary','VulnerabilityScanSummariesResponse','VulnerabilityEnvironmentVulnerabilitySummary','VulnerabilityIgnoredVulnerability','VulnerabilityIgnorePayload']){
  const o=s.components.schemas[k];
  console.log(k, 'required:', JSON.stringify(o.required||[]));
  console.log('  campos:', Object.keys(o.properties).filter(x=>x!=='\$schema').join(', '));
}"
```

Contrasta con el Step 2. Si un campo o su opcionalidad no coincide, gana el spec.

- [ ] **Step 2: Añade las interfaces** en `src/arcane-client.ts`, justo después de `AutoUpdateRecord`:

```ts
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
export interface VulnerabilityWithImage extends Vulnerability {
  imageId: string;
  imageName: string;
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
```

- [ ] **Step 3: Registra los tipos en el `MAP`** de `scripts/audit-schema-drift.mjs` (10 entradas — `VulnerabilityIgnoreRequest` NO va: es un payload de petición endurecido a propósito, auditarlo daría falso positivo por `reason`):

```js
  ScannerStatus: "ScannerStatus",
  VulnerabilitySeveritySummary: "VulnerabilitySeveritySummary",
  VulnerabilityCVSSInfo: "VulnerabilityCVSSInfo",
  Vulnerability: "VulnerabilityVulnerability",
  VulnerabilityWithImage: "VulnerabilityVulnerabilityWithImage",
  VulnerabilityScanResult: "VulnerabilityScanResult",
  VulnerabilityScanSummary: "VulnerabilityScanSummary",
  VulnerabilityScanSummariesResponse: "VulnerabilityScanSummariesResponse",
  EnvironmentVulnerabilitySummary: "VulnerabilityEnvironmentVulnerabilitySummary",
  IgnoredVulnerability: "VulnerabilityIgnoredVulnerability",
```

- [ ] **Step 4: Verifica**:

```bash
npm run type-check
node scripts/audit-schema-drift.mjs | tail -3
```

Esperado: type-check limpio. Drift: **31 desalineaciones, 0 graves** — las 21 previas más UNA fila `$schema FALTA-EN-TS-OPCIONAL` por cada tipo nuevo del MAP (los tipos TS no declaran `$schema` por convención del proyecto). **Si sale cualquier otra cifra o aparece una fila que no sea `$schema`, PARA: falta un campo de verdad.**

- [ ] **Step 5: Commit**

```bash
git add src/arcane-client.ts scripts/audit-schema-drift.mjs
git commit -m "feat(client): tipos de vulnerabilidades bajo auditoria de drift"
```

---

### Task 2: Métodos de lectura del cliente (9) con tests

**Files:**
- Modify: `src/arcane-client.ts` (interfaces de opciones junto a `ImageListOptions`; clase nueva tras `UpdaterMethods`, busca `class UpdaterMethods`; wiring en la clase `ArcaneClient` junto a `readonly updater`)
- Test: `src/__tests__/arcane-client.test.ts` (describe nuevo `VulnerabilitiesMethods`)

**Interfaces:**
- Consumes: tipos de Task 1; `appendListParams`, `ListOptionsWithSort`, `PaginatedResponse<T>` (ya existen en `arcane-client.ts`).
- Produces (usado por Tasks 4, 6): `client.vulnerabilities.` + `scannerStatus(envId)`, `environmentSummary(envId)`, `listAll(envId, opts?: VulnerabilityListOptions)`, `imageOptions(envId, severity?)`, `scanResult(envId, imageId)`, `imageList(envId, imageId, opts?: ImageVulnerabilityListOptions)`, `imageSummary(envId, imageId)`, `imageSummaries(envId, imageIds: string[])`, `ignoredList(envId, opts?: ListOptionsWithSort)`.

- [ ] **Step 1: Verifica los parámetros de query contra el spec:**

```bash
node -e "
const s=JSON.parse(require('fs').readFileSync('openapi.txt','utf8'));
for(const p of ['/environments/{id}/images/{imageId}/vulnerabilities/list','/environments/{id}/vulnerabilities/all','/environments/{id}/vulnerabilities/ignored','/environments/{id}/vulnerabilities/image-options']){
  console.log(p, '->', (s.paths[p].get.parameters||[]).filter(x=>x.in==='query').map(x=>x.name).join(','));
}"
```

Esperado: `list` → los 5 estándar + `severity`; `all` → + `severity,imageName`; `ignored` → solo los 5; `image-options` → solo `severity`.

- [ ] **Step 2: Escribe los tests que fallan** en `arcane-client.test.ts`, dentro de un `describe("VulnerabilitiesMethods", ...)` nuevo. El molde de mock es el del fichero (`mockFetch.mockResolvedValue({ ok: true, json: async () => (...) } as Response)`). Tests, con la URL LITERAL completa (base `http://localhost:3552/api`):

```ts
describe("VulnerabilitiesMethods", () => {
  it(".scannerStatus(envId) - GET /vulnerabilities/scanner-status", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { available: true, version: "0.73.0" } }),
    } as Response);
    const r = await client.vulnerabilities.scannerStatus("env1");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3552/api/environments/env1/vulnerabilities/scanner-status",
      expect.objectContaining({ method: "GET" })
    );
    expect(r.data.available).toBe(true);
  });

  it(".environmentSummary(envId) - GET /vulnerabilities/summary", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { totalImages: 19, scannedImages: 1 } }),
    } as Response);
    await client.vulnerabilities.environmentSummary("env1");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3552/api/environments/env1/vulnerabilities/summary",
      expect.objectContaining({ method: "GET" })
    );
  });

  it(".listAll con todos los filtros construye la query completa", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [], pagination: { totalPages: 1, totalItems: 0, currentPage: 1, itemsPerPage: 5 } }),
    } as Response);
    await client.vulnerabilities.listAll("env1", {
      sort: "severity", limit: 5, severity: "high", imageName: "curlimages/curl:8.5.0",
    });
    // URL literal completa: si severity o imageName dejan de escribirse, esto falla.
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3552/api/environments/env1/vulnerabilities/all?sort=severity&limit=5&severity=high&imageName=curlimages%2Fcurl%3A8.5.0",
      expect.objectContaining({ method: "GET" })
    );
  });

  it(".listAll sin opciones no lleva query", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [], pagination: { totalPages: 1, totalItems: 0, currentPage: 1, itemsPerPage: 20 } }),
    } as Response);
    await client.vulnerabilities.listAll("env1");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3552/api/environments/env1/vulnerabilities/all",
      expect.objectContaining({ method: "GET" })
    );
  });

  it(".imageOptions con severity y sin severity", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    } as Response);
    await client.vulnerabilities.imageOptions("env1", "critical");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3552/api/environments/env1/vulnerabilities/image-options?severity=critical",
      expect.objectContaining({ method: "GET" })
    );
    await client.vulnerabilities.imageOptions("env1");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3552/api/environments/env1/vulnerabilities/image-options",
      expect.objectContaining({ method: "GET" })
    );
  });

  it(".scanResult codifica el imageId en la ruta", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { imageId: "sha256:abc", imageName: "x", scanTime: "t", status: "completed" } }),
    } as Response);
    await client.vulnerabilities.scanResult("env1", "sha256:abc");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3552/api/environments/env1/images/sha256%3Aabc/vulnerabilities",
      expect.objectContaining({ method: "GET" })
    );
  });

  it(".imageList con severity construye la query", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [], pagination: { totalPages: 1, totalItems: 0, currentPage: 1, itemsPerPage: 3 } }),
    } as Response);
    await client.vulnerabilities.imageList("env1", "sha256:abc", { sort: "severity", limit: 3, severity: "high" });
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3552/api/environments/env1/images/sha256%3Aabc/vulnerabilities/list?sort=severity&limit=3&severity=high",
      expect.objectContaining({ method: "GET" })
    );
  });

  it(".imageSummary - GET /images/{id}/vulnerabilities/summary", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { imageId: "sha256:abc", scanTime: "t", status: "completed" } }),
    } as Response);
    await client.vulnerabilities.imageSummary("env1", "sha256:abc");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3552/api/environments/env1/images/sha256%3Aabc/vulnerabilities/summary",
      expect.objectContaining({ method: "GET" })
    );
  });

  it(".imageSummaries envía el body {imageIds}", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { summaries: {} } }),
    } as Response);
    await client.vulnerabilities.imageSummaries("env1", ["sha256:a", "sha256:b"]);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3552/api/environments/env1/images/vulnerabilities/summaries",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ imageIds: ["sha256:a", "sha256:b"] }) })
    );
  });

  it(".ignoredList con y sin query", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [], pagination: { totalPages: 1, totalItems: 0, currentPage: 1, itemsPerPage: 20 } }),
    } as Response);
    await client.vulnerabilities.ignoredList("env1", { sort: "id", limit: 200 });
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3552/api/environments/env1/vulnerabilities/ignored?sort=id&limit=200",
      expect.objectContaining({ method: "GET" })
    );
    await client.vulnerabilities.ignoredList("env1");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3552/api/environments/env1/vulnerabilities/ignored",
      expect.objectContaining({ method: "GET" })
    );
  });
});
```

> Antes de dar por bueno `.imageSummaries`, comprueba cómo serializa `request()` el body (busca `async request<T>` en `arcane-client.ts`) y ajusta la aserción si no es `JSON.stringify(body)` a secas.

- [ ] **Step 3: Ejecuta y verifica que fallan** — `npm test -- arcane-client` → los 10 tests nuevos FAIL (`client.vulnerabilities` es `undefined`).

- [ ] **Step 4: Implementa.** (a) Interfaces de opciones junto a `ImageListOptions`:

```ts
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
```

(b) La clase, tras `UpdaterMethods`:

```ts
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

  async scanResult(envId: string, imageId: string): Promise<{ success: boolean; data: VulnerabilityScanResult }> {
    return this.client.request<{ success: boolean; data: VulnerabilityScanResult }>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/images/${encodeURIComponent(imageId)}/vulnerabilities`
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
      `/environments/${encodeURIComponent(envId)}/images/${encodeURIComponent(imageId)}/vulnerabilities/list${query ? `?${query}` : ""}`
    );
  }

  async imageSummary(envId: string, imageId: string): Promise<{ success: boolean; data: VulnerabilityScanSummary }> {
    return this.client.request<{ success: boolean; data: VulnerabilityScanSummary }>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/images/${encodeURIComponent(imageId)}/vulnerabilities/summary`
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
}
```

(c) Wiring en la clase `ArcaneClient`: `readonly vulnerabilities: VulnerabilitiesMethods;` junto a `readonly updater`, y `this.vulnerabilities = new VulnerabilitiesMethods(this);` en el constructor junto a `this.updater = ...`.

- [ ] **Step 5: Verifica que pasan** — `npm test -- arcane-client` y `npm run type-check`.

- [ ] **Step 6: Falsabilidad.** Muta `listAll`: borra la línea `if (opts?.severity) ...`. El test de la query completa debe FALLAR (la URL ya no lleva `severity=high`). Revierte. Muta `imageSummaries`: cambia el body a `{ ids: imageIds }`. Su test debe FALLAR. Revierte. Confirma verde.

- [ ] **Step 7: Commit**

```bash
git add src/arcane-client.ts src/__tests__/arcane-client.test.ts
git commit -m "feat(client): nueve metodos de lectura de vulnerabilidades"
```

---

### Task 3: Métodos mutantes del cliente (3) con tests

**Files:**
- Modify: `src/arcane-client.ts` (dentro de `VulnerabilitiesMethods`)
- Test: `src/__tests__/arcane-client.test.ts` (mismo describe)

**Interfaces:**
- Consumes: `VulnerabilityIgnoreRequest` (Task 1), clase de Task 2.
- Produces (usado por Tasks 5, 7): `client.vulnerabilities.scan(envId, imageId)` → `{success, data: VulnerabilityScanResult}` (acuse), `.ignore(envId, payload: VulnerabilityIgnoreRequest)` → `{success, data: IgnoredVulnerability}`, `.unignore(envId, ignoreId)` → `{success: boolean}`.

- [ ] **Step 1: Tests que fallan:**

```ts
  it(".scan(envId, imageId) - POST .../vulnerabilities/scan (acuse asincrono)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { imageId: "sha256:abc", imageName: "x", scanTime: "t", status: "scanning", activityId: "act-1" },
      }),
    } as Response);
    const r = await client.vulnerabilities.scan("env1", "sha256:abc");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3552/api/environments/env1/images/sha256%3Aabc/vulnerabilities/scan",
      expect.objectContaining({ method: "POST" })
    );
    expect(r.data.status).toBe("scanning");
    expect(r.data.activityId).toBe("act-1");
  });

  it(".ignore envía el payload exacto, sin createdBy", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { id: "ign-1", environmentId: "env1", imageId: "sha256:abc", vulnerabilityId: "CVE-1", pkgName: "p", installedVersion: "1", createdAt: "t", createdBy: "arcane" },
      }),
    } as Response);
    const payload = { imageId: "sha256:abc", vulnerabilityId: "CVE-1", pkgName: "p", reason: "triaje", installedVersion: "1" };
    await client.vulnerabilities.ignore("env1", payload);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3552/api/environments/env1/vulnerabilities/ignore");
    expect(init.method).toBe("POST");
    // Body serializado real: el payload entero, y NADA más.
    expect(init.body).toBe(JSON.stringify(payload));
    expect(String(init.body)).not.toContain("createdBy");
  });

  it(".unignore(envId, ignoreId) - DELETE .../ignore/{ignoreId}", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) } as Response);
    const r = await client.vulnerabilities.unignore("env1", "ign-1");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3552/api/environments/env1/vulnerabilities/ignore/ign-1",
      expect.objectContaining({ method: "DELETE" })
    );
    expect(r.success).toBe(true);
  });
```

- [ ] **Step 2: Verifica que fallan** — `npm test -- arcane-client` → 3 FAIL (métodos no existen).

- [ ] **Step 3: Implementa** dentro de `VulnerabilitiesMethods`:

```ts
  /**
   * MUTANTE: lanza un escaneo ASÍNCRONO de UNA imagen. Devuelve el ACUSE
   * (status "scanning" + activityId), no el resultado — medido en la puerta
   * de F4: el resultado se recoge después con scanResult(). Acotado a una
   * imagen por construcción: el endpoint exige imageId en la ruta.
   */
  async scan(envId: string, imageId: string): Promise<{ success: boolean; data: VulnerabilityScanResult }> {
    return this.client.request<{ success: boolean; data: VulnerabilityScanResult }>(
      "POST",
      `/environments/${encodeURIComponent(envId)}/images/${encodeURIComponent(imageId)}/vulnerabilities/scan`
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
```

- [ ] **Step 4: Verifica que pasan** — `npm test -- arcane-client` y `npm run type-check`.

- [ ] **Step 5: Falsabilidad.** Muta `ignore`: añade `createdBy: "x"` al body (`{ ...payload, createdBy: "x" }`). El test debe FALLAR por las dos aserciones del body. Revierte. Prueba también que `ignore("env1", { imageId: "a", vulnerabilityId: "b", pkgName: "c" } as any)` sin `reason` NO compila quitando el `as any` — es la garantía de tipo, no hace falta test.

- [ ] **Step 6: Commit**

```bash
git add src/arcane-client.ts src/__tests__/arcane-client.test.ts
git commit -m "feat(client): scan, ignore y unignore de vulnerabilidades"
```

---

### Task 4: e2e de siembra y lecturas contra la instancia real

**Files:**
- Modify: `src/__e2e__/helpers.ts` (constante `SCAN_IMAGE`)
- Create: `src/__e2e__/vulnerabilidades.e2e.ts`

**Interfaces:**
- Consumes: `client.vulnerabilities.*` (Tasks 2–3), `e2eClient()` de helpers.
- Produces: `SCAN_IMAGE` (usada por Task 5); el `beforeAll` de siembra que Task 5 comparte (mismo fichero).

- [ ] **Step 1: Añade a `src/__e2e__/helpers.ts`:**

```ts
/**
 * Imagen sobre la que es seguro lanzar escaneos de vulnerabilidades: pequeña
 * (33 MB), sin contenedores que dependan de ella, y reescanearla SUSTITUYE el
 * resultado anterior sin acumular (medido en la puerta de F4, 2026-08-18).
 * Nunca uses aquí la imagen del contenedor arcane-mcp-server.
 */
export const SCAN_IMAGE = process.env.ARCANE_E2E_SCAN_IMAGE ?? "curlimages/curl:8.5.0";
```

- [ ] **Step 2: Crea `src/__e2e__/vulnerabilidades.e2e.ts`** con la siembra y las lecturas. El orden de los `it` IMPORTA: las lecturas van antes del ciclo de ignore (Task 5) para que ningún ignore transitorio pueda afectar a los recuentos leídos.

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { e2eClient, SCAN_IMAGE } from "./helpers";
import type { VulnerabilityScanResult } from "../arcane-client";

/**
 * Vulnerabilidades contra la instancia real. La SIEMBRA es parte de la suite:
 * el beforeAll escanea SCAN_IMAGE (asíncrono, ~13 s en frío y ~1 s en caliente,
 * medido en la puerta de F4), así que todas las lecturas ejercitan datos
 * reales, no envolturas vacías. Sin cifras clavadas: la BD de CVEs cambia.
 */
describe("vulnerabilidades (e2e, Arcane 2.8.0)", () => {
  const client = e2eClient();
  const envId = "0";
  let imageId: string;
  let acuse: VulnerabilityScanResult;
  let resultado: VulnerabilityScanResult;

  beforeAll(async () => {
    const imgs = await client.images.list(envId, { limit: 200 });
    const img = (imgs.data ?? []).find((i) => (i.repoTags ?? []).includes(SCAN_IMAGE));
    if (!img) throw new Error(`No existe ${SCAN_IMAGE} en el entorno; ajusta ARCANE_E2E_SCAN_IMAGE`);
    imageId = img.id;

    const lanzado = await client.vulnerabilities.scan(envId, imageId);
    acuse = lanzado.data;

    // Sondeo hasta completed. Tolera cortes de Tailscale reintentando; un
    // escaneo en estado failed NO se tolera: es un fallo real.
    const plazo = Date.now() + 90_000;
    let ultimoEstado = "(sin respuesta)";
    for (;;) {
      try {
        const r = await client.vulnerabilities.scanResult(envId, imageId);
        ultimoEstado = r.data.status;
        if (r.data.status === "completed") {
          resultado = r.data;
          return;
        }
        if (r.data.status === "failed") {
          throw new Error(`SCAN_FAILED: ${r.data.error ?? "(sin detalle)"}`);
        }
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("SCAN_FAILED")) throw err;
        // corte de red: se reintenta hasta agotar el plazo
      }
      if (Date.now() > plazo) throw new Error(`Timeout esperando el escaneo; último estado: ${ultimoEstado}`);
      await new Promise((res) => setTimeout(res, 3_000));
    }
  }, 120_000);

  it("scanner-status: el escáner está disponible", async () => {
    const r = await client.vulnerabilities.scannerStatus(envId);
    expect(r.success).toBe(true);
    expect(r.data.available).toBe(true);
    expect(r.data.version ?? "").not.toBe("");
  });

  it("el acuse del scan es asíncrono y trae activityId", () => {
    // Medido en la puerta de F4: el POST devuelve el acuse, no el resultado.
    expect(["scanning", "completed"]).toContain(acuse.status);
    expect(typeof acuse.activityId).toBe("string");
    expect(acuse.activityId!.length).toBeGreaterThan(0);
    expect(acuse.imageId).toBe(imageId);
  });

  it("el resultado completado tiene summary coherente y CVEs con forma", () => {
    const s = resultado.summary!;
    expect(s.total).toBeGreaterThanOrEqual(1);
    expect(s.total).toBe(s.critical + s.high + s.medium + s.low + s.unknown);
    const cves = resultado.vulnerabilities ?? [];
    expect(cves.length).toBeGreaterThan(0);
    for (const c of cves.slice(0, 5)) {
      expect(c.vulnerabilityId).toBeTruthy();
      expect(c.pkgName).toBeTruthy();
      expect(c.severity).toBeTruthy();
    }
  });

  it("imageSummary cuadra con el resultado del escaneo", async () => {
    const r = await client.vulnerabilities.imageSummary(envId, imageId);
    expect(r.data.status).toBe("completed");
    expect(r.data.summary!.total).toBe(resultado.summary!.total);
  });

  it("imageList pagina y su total cuadra con el summary", async () => {
    const r = await client.vulnerabilities.imageList(envId, imageId, { sort: "severity", limit: 5 });
    expect((r.data ?? []).length).toBeGreaterThan(0);
    expect((r.data ?? []).length).toBeLessThanOrEqual(5);
    // Cruce entre endpoints: si list y summary discrepan, uno de los dos miente.
    expect(r.pagination.grandTotalItems).toBe(resultado.summary!.total);
  });

  it("el filtro severity filtra de verdad", async () => {
    const r = await client.vulnerabilities.imageList(envId, imageId, { sort: "severity", severity: "high", limit: 100 });
    // Todo item devuelto ES high — la aserción de filtro real, no "no explota".
    for (const c of r.data ?? []) {
      expect(c.severity).toBe("HIGH");
    }
    expect(r.pagination.totalItems).toBe(resultado.summary!.high);
  });

  it("listAll filtra por imageName", async () => {
    const r = await client.vulnerabilities.listAll(envId, { sort: "severity", imageName: SCAN_IMAGE, limit: 100 });
    expect((r.data ?? []).length).toBeGreaterThan(0);
    for (const c of r.data ?? []) {
      expect(c.imageName).toBe(SCAN_IMAGE);
      expect(c.imageId).toBe(imageId);
    }
  });

  it("image-options contiene la imagen escaneada y severity devuelve un subconjunto", async () => {
    const todas = await client.vulnerabilities.imageOptions(envId);
    expect(todas.data).toContain(SCAN_IMAGE);
    const altas = await client.vulnerabilities.imageOptions(envId, "high");
    for (const nombre of altas.data) {
      expect(todas.data).toContain(nombre);
    }
  });

  it("el batch de summaries omite lo no escaneado y no inventa claves", async () => {
    const inventado = "sha256:0000000000000000000000000000000000000000000000000000000000000000";
    const r = await client.vulnerabilities.imageSummaries(envId, [imageId, inventado]);
    const mapa = r.data.summaries;
    // La escaneada está, con estado terminal.
    expect(mapa[imageId]).toBeDefined();
    expect(mapa[imageId].status).toBe("completed");
    // La inventada se OMITE (comportamiento medido, patrón by-refs de F3)...
    expect(mapa[inventado]).toBeUndefined();
    // ...y ninguna clave no pedida aparece.
    for (const clave of Object.keys(mapa)) {
      expect([imageId, inventado]).toContain(clave);
    }
  });

  it("el summary del entorno refleja al menos la imagen sembrada", async () => {
    const r = await client.vulnerabilities.environmentSummary(envId);
    expect(r.data.scannedImages).toBeGreaterThanOrEqual(1);
    expect(r.data.totalImages).toBeGreaterThanOrEqual(r.data.scannedImages);
    expect(r.data.summary!.total).toBeGreaterThanOrEqual(resultado.summary!.total);
  });
});
```

- [ ] **Step 3: Ejecuta** (reintenta ante `ECONNREFUSED` — con ~11 tests de red, espera necesitar varios intentos):

```bash
set -a; . ./.dev.vars; set +a
ARCANE_BASE_URL=http://192.168.180.210:3552 npm run test:e2e -- --reporter=verbose vulnerabilidades 2>&1 | tee /tmp/f4-e2e-task4.txt
```

Esperado: 11 `✓`, 0 `skipped`, contadas una a una. Si `severity` devuelto no fuera `"HIGH"` en mayúsculas o algún cruce de totales fallara de forma REPRODUCIBLE (no `ECONNREFUSED`), es un descubrimiento sobre la API: PARA y repórtalo, no relajes la aserción en silencio.

- [ ] **Step 4: Falsabilidad.** En `imageList`, muta el cliente para perder `severity` (borra su `params.set`). El test del filtro debe FALLAR (devuelve todas las severidades). Revierte, reejecuta ese test, verde.

- [ ] **Step 5: Commit**

```bash
git add src/__e2e__/helpers.ts src/__e2e__/vulnerabilidades.e2e.ts
git commit -m "test(e2e): siembra por escaneo y lecturas de vulnerabilidades reales"
```

---

### Task 5: e2e del ciclo ignore → unignore, autolimpiante

**Files:**
- Modify: `src/__e2e__/vulnerabilidades.e2e.ts` (añade al final del describe)

**Interfaces:**
- Consumes: `client.vulnerabilities.ignore/unignore/ignoredList/imageList` (Tasks 2–3), `imageId` del `beforeAll` de Task 4.
- Produces: nada (cierre de la suite e2e).

- [ ] **Step 1: Añade el ciclo y la limpieza** al final del `describe` (tras el último `it` de Task 4):

```ts
  // ── Ciclo mutante: SIEMPRE al final, para no afectar a las lecturas ──

  const MARCA = "e2e-arcane-mcp";

  it("ciclo completo: ignore → aparece en ignored → unignore → desaparece", async () => {
    const lista = await client.vulnerabilities.imageList(envId, imageId, { sort: "severity", limit: 1 });
    const cve = (lista.data ?? [])[0];
    expect(cve).toBeDefined();

    const creado = await client.vulnerabilities.ignore(envId, {
      imageId,
      vulnerabilityId: cve.vulnerabilityId,
      pkgName: cve.pkgName,
      installedVersion: cve.installedVersion,
      reason: `${MARCA}: ciclo e2e, se elimina en este mismo test`,
    });
    expect(creado.success).toBe(true);
    expect(creado.data.id).toBeTruthy();
    // Eco de campos: el registro creado es el que se pidió crear.
    expect(creado.data.vulnerabilityId).toBe(cve.vulnerabilityId);
    expect(creado.data.imageId).toBe(imageId);
    expect(creado.data.pkgName).toBe(cve.pkgName);

    const con = await client.vulnerabilities.ignoredList(envId, { sort: "id", limit: 200 });
    expect((con.data ?? []).some((x) => x.id === creado.data.id)).toBe(true);

    const borrado = await client.vulnerabilities.unignore(envId, creado.data.id);
    expect(borrado.success).toBe(true);

    const sin = await client.vulnerabilities.ignoredList(envId, { sort: "id", limit: 200 });
    expect((sin.data ?? []).some((x) => x.id === creado.data.id)).toBe(false);
  });

  afterAll(async () => {
    // Red de seguridad: si el ciclo abortó a medias (Tailscale), ningún ignore
    // marcado puede quedar vivo alterando la postura de seguridad real.
    try {
      const ign = await client.vulnerabilities.ignoredList(envId, { sort: "id", limit: 200 });
      for (const resto of (ign.data ?? []).filter((x) => (x.reason ?? "").includes(MARCA))) {
        await client.vulnerabilities.unignore(envId, resto.id);
      }
    } catch {
      // La limpieza no debe tumbar la suite; el siguiente run la reintenta.
    }
  });
```

Añade `afterAll` al import de vitest de la cabecera del fichero.

- [ ] **Step 2: Ejecuta** igual que en Task 4, Step 3. Esperado: **12 `✓`, 0 skipped**. Comprueba además a mano que no quedó residuo:

```bash
set -a; . ./.dev.vars; set +a
curl -s -H "X-API-Key: $ARCANE_API_KEY" "http://192.168.180.210:3552/api/environments/0/vulnerabilities/ignored?limit=200&sort=id" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log('ignoradas vivas:',(j.data??[]).length)})"
```

Esperado: `ignoradas vivas: 0` (o las que ya existieran antes de la suite, nunca con la marca).

- [ ] **Step 3: Falsabilidad.** Muta `unignore` en el cliente para apuntar a `/vulnerabilities/ignore` sin el id. El ciclo debe FALLAR (el registro sigue en la lista). Revierte, reejecuta, verde — y confirma con el `curl` del Step 2 que la limpieza del `afterAll` retiró el ignore que la mutación dejó vivo.

- [ ] **Step 4: Commit**

```bash
git add src/__e2e__/vulnerabilidades.e2e.ts
git commit -m "test(e2e): ciclo ignore-unignore autolimpiante sobre la imagen sembrada"
```

---

### Task 6: Tools de lectura (9), registro y tests

**Files:**
- Create: `src/tools/vulnerabilities.ts`
- Modify: `src/index.ts` (import + register), `scripts/gen-tools-table.mjs` (entrada en `GROUPS`)
- Test: `src/__tests__/tools.test.ts`

**Interfaces:**
- Consumes: `client.vulnerabilities.*` (Tasks 2–3), `resolveEnvironmentId` (`./resolve`), `withErrors`/`textResponse`/`listResponse` (`./respond`), `parseCommaList` (`./comma-list`).
- Produces: `registerVulnerabilityTools(server, client)`; las 9 tools de lectura con los nombres EXACTOS de la tabla del spec §4.1 (Task 7 añade las 3 mutantes al mismo fichero).

- [ ] **Step 1: Tests que fallan** en `tools.test.ts`. Primero amplía `createMockClient()` con el bloque `vulnerabilities` (mismo estilo que los existentes):

```ts
      vulnerabilities: {
        scannerStatus: vi.fn().mockResolvedValue({ success: true, data: { available: true, version: "0.73.0" } }),
        environmentSummary: vi.fn().mockResolvedValue({
          success: true,
          data: { totalImages: 19, scannedImages: 1, summary: { critical: 0, high: 6, medium: 21, low: 17, unknown: 0, total: 44 } },
        }),
        listAll: vi.fn().mockResolvedValue({
          success: true, data: [],
          pagination: { totalPages: 1, totalItems: 0, currentPage: 1, itemsPerPage: 20 },
        }),
        imageOptions: vi.fn().mockResolvedValue({ success: true, data: ["curlimages/curl:8.5.0"] }),
        scanResult: vi.fn().mockResolvedValue({
          success: true,
          data: { imageId: "sha256:abc", imageName: "curlimages/curl:8.5.0", scanTime: "t", status: "completed" },
        }),
        imageList: vi.fn().mockResolvedValue({
          success: true, data: [],
          pagination: { totalPages: 1, totalItems: 0, currentPage: 1, itemsPerPage: 20 },
        }),
        imageSummary: vi.fn().mockResolvedValue({
          success: true, data: { imageId: "sha256:abc", scanTime: "t", status: "completed" },
        }),
        imageSummaries: vi.fn().mockResolvedValue({ success: true, data: { summaries: {} } }),
        ignoredList: vi.fn().mockResolvedValue({
          success: true, data: [],
          pagination: { totalPages: 1, totalItems: 0, currentPage: 1, itemsPerPage: 20 },
        }),
        scan: vi.fn(),
        ignore: vi.fn(),
        unignore: vi.fn(),
      },
```

Después el describe (importa `registerVulnerabilityTools` arriba del fichero, junto a los demás imports de tools):

```ts
  describe("vulnerability tools", () => {
    const NOMBRES_LECTURA = [
      "arcane_vulnerability_scanner_status",
      "arcane_vulnerability_summary",
      "arcane_vulnerability_list",
      "arcane_vulnerability_image_options",
      "arcane_vulnerability_scan_result",
      "arcane_vulnerability_image_list",
      "arcane_vulnerability_image_summary",
      "arcane_vulnerability_image_summaries",
      "arcane_vulnerability_ignored_list",
    ];

    it("registra las 9 tools de lectura", () => {
      const server = createMockServer();
      registerVulnerabilityTools(server as any, createMockClient());
      for (const nombre of NOMBRES_LECTURA) {
        expect(server.getHandler(nombre), nombre).toBeDefined();
      }
    });

    it("scan_result RECORTA el detalle: metadatos sí, CVEs no", async () => {
      const mockClient = createMockClient();
      (mockClient.vulnerabilities.scanResult as any).mockResolvedValue({
        success: true,
        data: {
          imageId: "sha256:abc", imageName: "curlimages/curl:8.5.0", scanTime: "t",
          status: "completed", scanPhase: "storing_results", activityId: "act-1",
          scannerVersion: "0.73.0", duration: 13,
          summary: { critical: 0, high: 1, medium: 1, low: 1, unknown: 0, total: 3 },
          vulnerabilities: [
            { vulnerabilityId: "CVE-2023-42363", pkgName: "busybox", installedVersion: "1", severity: "MEDIUM", description: "use-after-free in awk", references: ["https://example.org/cve"] },
            { vulnerabilityId: "CVE-2024-6119", pkgName: "libcrypto3", installedVersion: "3", severity: "HIGH", description: "denial of service", references: [] },
            { vulnerabilityId: "CVE-2023-42364", pkgName: "busybox", installedVersion: "1", severity: "LOW", description: "otra", references: [] },
          ],
        },
      });
      const server = createMockServer();
      registerVulnerabilityTools(server as any, mockClient);
      const out = await server.getHandler("arcane_vulnerability_scan_result")!({ environmentId: "env1", imageId: "sha256:abc" });
      const texto = out.content[0].text;
      // Metadatos presentes...
      expect(texto).toContain('"status": "completed"');
      expect(texto).toContain('"activityId": "act-1"');
      expect(texto).toContain('"total": 3');
      // ...prosa que remite al listado paginado...
      expect(texto).toContain("arcane_vulnerability_image_list");
      // ...y NADA del detalle de las CVEs.
      expect(texto).not.toContain("CVE-2023-42363");
      expect(texto).not.toContain("use-after-free");
      expect(texto).not.toContain('"references"');
    });

    it("image_summaries avisa cuando el mapa omite referencias pedidas", async () => {
      const mockClient = createMockClient();
      (mockClient.vulnerabilities.imageSummaries as any).mockResolvedValue({
        success: true,
        data: { summaries: { "sha256:a": { imageId: "sha256:a", scanTime: "t", status: "completed" } } },
      });
      const server = createMockServer();
      registerVulnerabilityTools(server as any, mockClient);
      const out = await server.getHandler("arcane_vulnerability_image_summaries")!({ environmentId: "env1", imageIds: "sha256:a, sha256:b" });
      expect(out.content[0].text).toContain("omits 1 of 2");
      expect(out.content[0].text).toContain("sha256:b");
    });

    it("image_summaries NO avisa cuando el mapa está completo", async () => {
      const mockClient = createMockClient();
      (mockClient.vulnerabilities.imageSummaries as any).mockResolvedValue({
        success: true,
        data: { summaries: { "sha256:a": { imageId: "sha256:a", scanTime: "t", status: "completed" } } },
      });
      const server = createMockServer();
      registerVulnerabilityTools(server as any, mockClient);
      const out = await server.getHandler("arcane_vulnerability_image_summaries")!({ environmentId: "env1", imageIds: "sha256:a" });
      expect(out.content[0].text).not.toContain("omits");
    });

    it("vulnerability_list usa el contrato de listResponse con prosa multipágina", async () => {
      const mockClient = createMockClient();
      (mockClient.vulnerabilities.listAll as any).mockResolvedValue({
        success: true,
        data: [{ vulnerabilityId: "CVE-1", pkgName: "p", installedVersion: "1", severity: "HIGH", imageId: "sha256:a", imageName: "x" }],
        pagination: { totalPages: 2, totalItems: 3, currentPage: 1, itemsPerPage: 2, grandTotalItems: 3 },
      });
      const server = createMockServer();
      registerVulnerabilityTools(server as any, mockClient);
      const out = await server.getHandler("arcane_vulnerability_list")!({ environmentId: "env1", severity: "high" });
      expect(out.content[0].text).toContain("Showing 1 of 3 vulnerabilities (page 1 of 2).");
      expect((mockClient.vulnerabilities.listAll as any).mock.calls[0][1]).toMatchObject({ severity: "high" });
    });

    it("las tools de lectura devuelven isError ante un fallo del cliente", async () => {
      const mockClient = createMockClient();
      (mockClient.vulnerabilities.scanResult as any).mockRejectedValue(new ArcaneApiError("Vulnerability scan not found", 404));
      const server = createMockServer();
      registerVulnerabilityTools(server as any, mockClient);
      const out = await server.getHandler("arcane_vulnerability_scan_result")!({ environmentId: "env1", imageId: "sha256:no" });
      expect(out.isError).toBe(true);
      expect(out.content[0].text).toContain("Vulnerability scan not found");
    });
  });
```

> Comprueba la firma real de `ArcaneApiError` (`grep -n "class ArcaneApiError" -A 6 src/arcane-client.ts`) y ajusta el constructor del test si no es `(message, status)`.

- [ ] **Step 2: Verifica que fallan** — `npm test -- tools` → FAIL (el módulo `../tools/vulnerabilities` no existe).

- [ ] **Step 3: Crea `src/tools/vulnerabilities.ts`** con las 9 tools de lectura:

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArcaneClient } from "../arcane-client";
import { resolveEnvironmentId } from "./resolve";
import { withErrors, textResponse, listResponse } from "./respond";
import { parseCommaList } from "./comma-list";

const LIST_PARAMS = {
  search: z.string().optional().describe("Free-text search over vulnerability IDs and package names"),
  sort: z.string().optional().describe("Column to sort by, e.g. severity, pkgName, vulnerabilityId"),
  order: z.string().optional().describe("Sort direction: asc or desc"),
  start: z.number().int().min(0).optional().describe("Start index for pagination (server default: 0)"),
  limit: z.number().int().min(1).optional().describe("Items per page (server default: 20)"),
};

export function registerVulnerabilityTools(server: McpServer, client: ArcaneClient): void {
  server.tool(
    "arcane_vulnerability_scanner_status",
    "Check whether the vulnerability scanner (Trivy) is available in an environment, and its version. Check this before launching a scan with arcane_vulnerability_scan.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
    },
    withErrors(async ({ environmentId, environmentName }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.vulnerabilities.scannerStatus(envId);
      return textResponse(JSON.stringify(result.data, null, 2));
    }),
  );

  server.tool(
    "arcane_vulnerability_summary",
    "Get the environment-wide vulnerability summary: how many images exist, how many have been scanned, and the aggregate CVE counts by severity. Images never scanned contribute nothing: check scannedImages vs totalImages before reading the counts as the whole picture.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
    },
    withErrors(async ({ environmentId, environmentName }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.vulnerabilities.environmentSummary(envId);
      return textResponse(JSON.stringify(result.data, null, 2));
    }),
  );

  server.tool(
    "arcane_vulnerability_list",
    "List vulnerabilities across all scanned images in an environment, paginated. Filter by severity (critical, high, medium, low, unknown) and/or by exact image name.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      ...LIST_PARAMS,
      severity: z.string().optional().describe("Filter by severity: critical, high, medium, low or unknown"),
      imageName: z.string().optional().describe("Filter by exact image name, e.g. 'curlimages/curl:8.5.0'"),
    },
    withErrors(async ({ environmentId, environmentName, search, sort, order, start, limit, severity, imageName }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.vulnerabilities.listAll(envId, { search, sort, order, start, limit, severity, imageName });
      return listResponse(result, "vulnerabilities");
    }),
  );

  server.tool(
    "arcane_vulnerability_image_options",
    "List the names of images that have vulnerability scan results, optionally only those with findings of a given severity. Useful to discover what has been scanned before drilling down.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      severity: z.string().optional().describe("Only images with findings of this severity: critical, high, medium, low or unknown"),
    },
    withErrors(async ({ environmentId, environmentName, severity }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.vulnerabilities.imageOptions(envId, severity);
      return textResponse(JSON.stringify(result.data, null, 2));
    }),
  );

  server.tool(
    "arcane_vulnerability_scan_result",
    "Get the scan metadata for ONE image: status (scanning/completed/failed), scan time, scanner version, error if any, and the severity summary. The full CVE detail is deliberately NOT included — page through it with arcane_vulnerability_image_list. An error saying the scan was not found means the image has never been scanned: launch arcane_vulnerability_scan first.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      imageId: z.string().describe("Image ID (sha256:...), from arcane_image_list"),
    },
    withErrors(async ({ environmentId, environmentName, imageId }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.vulnerabilities.scanResult(envId, imageId);
      // Recorte deliberado (spec F4 §4.1): el detalle completo pesa cientos de
      // KB (124 KB medidos con solo 44 CVEs) y ya es accesible paginado via
      // arcane_vulnerability_image_list. Aqui, los metadatos que solo este
      // endpoint tiene, mas el summary.
      const { vulnerabilities, ...meta } = result.data;
      const n = vulnerabilities?.length ?? 0;
      return textResponse(
        `Scan metadata and summary. The CVE detail (${n} item(s)) is NOT included here: ` +
          `use arcane_vulnerability_image_list to page through it.\n` +
          JSON.stringify(meta, null, 2),
      );
    }),
  );

  server.tool(
    "arcane_vulnerability_image_list",
    "List the vulnerabilities of ONE image, paginated, with full CVE detail per item. Filter by severity. An error saying the scan was not found means the image has never been scanned: launch arcane_vulnerability_scan first.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      imageId: z.string().describe("Image ID (sha256:...), from arcane_image_list"),
      ...LIST_PARAMS,
      severity: z.string().optional().describe("Filter by severity: critical, high, medium, low or unknown"),
    },
    withErrors(async ({ environmentId, environmentName, imageId, search, sort, order, start, limit, severity }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.vulnerabilities.imageList(envId, imageId, { search, sort, order, start, limit, severity });
      return listResponse(result, "vulnerabilities");
    }),
  );

  server.tool(
    "arcane_vulnerability_image_summary",
    "Get the vulnerability summary of ONE image: scan status, scan time and CVE counts by severity. An error saying the scan was not found means the image has never been scanned: launch arcane_vulnerability_scan first.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      imageId: z.string().describe("Image ID (sha256:...), from arcane_image_list"),
    },
    withErrors(async ({ environmentId, environmentName, imageId }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.vulnerabilities.imageSummary(envId, imageId);
      return textResponse(JSON.stringify(result.data, null, 2));
    }),
  );

  server.tool(
    "arcane_vulnerability_image_summaries",
    "Get vulnerability scan summaries for a LIST of images in one call. The response map omits images that have never been scanned — the tool flags this in prose when it happens.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      imageIds: z.string().describe("Image IDs, comma-separated, e.g. 'sha256:abc,sha256:def'"),
    },
    withErrors(async ({ environmentId, environmentName, imageIds }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const pedidas = parseCommaList(imageIds);
      const result = await client.vulnerabilities.imageSummaries(envId, pedidas);
      const texto = JSON.stringify(result.data, null, 2);
      // Comportamiento medido contra la instancia real: las imagenes sin
      // escaneo se OMITEN del mapa sin decir por que. Mismo tratamiento que
      // arcane_image_update_status con by-refs.
      const devueltas = new Set(Object.keys(result.data.summaries ?? {}));
      const faltantes = pedidas.filter((id) => !devueltas.has(id));
      if (faltantes.length > 0) {
        return textResponse(
          `The response omits ${faltantes.length} of ${pedidas.length} requested image(s): ` +
            `${faltantes.join(", ")}. Most likely those images have never been scanned — ` +
            `launch arcane_vulnerability_scan on them to get results.\n${texto}`,
        );
      }
      return textResponse(texto);
    }),
  );

  server.tool(
    "arcane_vulnerability_ignored_list",
    "List the vulnerabilities that have been marked as ignored in an environment, paginated. Each record includes who ignored it, when, and the stated reason. Use the record id with arcane_vulnerability_unignore to reverse one.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      ...LIST_PARAMS,
    },
    withErrors(async ({ environmentId, environmentName, search, sort, order, start, limit }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.vulnerabilities.ignoredList(envId, { search, sort, order, start, limit });
      return listResponse(result, "ignored vulnerabilities");
    }),
  );
}
```

- [ ] **Step 4: Registra.** En `src/index.ts`: `import { registerVulnerabilityTools } from "./tools/vulnerabilities";` junto a los demás, y `registerVulnerabilityTools(this.server, client);` tras `registerUpdaterTools(...)`. En `scripts/gen-tools-table.mjs`, añade a `GROUPS`: `["vulnerabilities.ts", "Vulnerabilities"],` tras la fila de `updater.ts`.

- [ ] **Step 5: Verifica** — `npm test -- tools` (verdes los 6 nuevos), `npm run type-check`, y `npm run gen-tools-table -- --check` DEBE FALLAR con la tabla desactualizada (las tools nuevas existen y el README no las tiene — se regenera en Task 8; si prefieres verde ya, ejecuta `npm run gen-tools-table` ahora y commitea el README junto).

- [ ] **Step 6: Falsabilidad.** Muta el recorte de `_scan_result`: devuelve `result.data` entero. El test del recorte debe FALLAR por `not.toContain("CVE-2023-42363")`. Revierte. Muta el aviso del batch: cambia la condición a `faltantes.length > 1`. El test "avisa cuando omite" debe FALLAR. Revierte. Verde.

- [ ] **Step 7: Commit**

```bash
git add src/tools/vulnerabilities.ts src/index.ts scripts/gen-tools-table.mjs src/__tests__/tools.test.ts README.md
git commit -m "feat(tools): nueve tools de lectura de vulnerabilidades"
```

---

### Task 7: Tools mutantes (3) con reason obligatorio falsable

**Files:**
- Modify: `src/tools/vulnerabilities.ts` (añade al final de `registerVulnerabilityTools`)
- Test: `src/__tests__/tools.test.ts`

**Interfaces:**
- Consumes: `client.vulnerabilities.scan/ignore/unignore` (Task 3).
- Produces: las 3 tools mutantes del spec §4.2, cerrando las 12.

- [ ] **Step 1: Tests que fallan** (en el describe de vulnerability tools):

```ts
    it("registra las 3 tools mutantes", () => {
      const server = createMockServer();
      registerVulnerabilityTools(server as any, createMockClient());
      for (const nombre of ["arcane_vulnerability_scan", "arcane_vulnerability_ignore", "arcane_vulnerability_unignore"]) {
        expect(server.getHandler(nombre), nombre).toBeDefined();
      }
    });

    it("vulnerability_scan devuelve el acuse con activityId", async () => {
      const mockClient = createMockClient();
      (mockClient.vulnerabilities.scan as any).mockResolvedValue({
        success: true,
        data: { imageId: "sha256:abc", imageName: "x", scanTime: "t", status: "scanning", scanPhase: "creating_container", activityId: "act-9" },
      });
      const server = createMockServer();
      registerVulnerabilityTools(server as any, mockClient);
      const out = await server.getHandler("arcane_vulnerability_scan")!({ environmentId: "env1", imageId: "sha256:abc" });
      expect((mockClient.vulnerabilities.scan as any).mock.calls[0]).toEqual(["env1", "sha256:abc"]);
      expect(out.content[0].text).toContain('"activityId": "act-9"');
      expect(out.content[0].text).toContain("asynchronous");
    });

    it("el schema de vulnerability_ignore exige reason y no admite createdBy", () => {
      const server = createMockServer();
      registerVulnerabilityTools(server as any, createMockClient());
      const call = (server.tool as any).mock.calls.find((c: any[]) => c[0] === "arcane_vulnerability_ignore");
      const schemaShape = call[2];
      const schema = z.object(schemaShape);
      // Sin reason: rechazado. Es la garantia falsable de la salvaguarda 1
      // del spec §3.2 — el mock de servidor no valida schemas, asi que sin
      // este test relajar reason a .optional() no haria fallar nada.
      expect(() =>
        schema.parse({ imageId: "sha256:abc", vulnerabilityId: "CVE-1", pkgName: "p" })
      ).toThrow();
      // Con reason: aceptado.
      const parsed = schema.parse({ imageId: "sha256:abc", vulnerabilityId: "CVE-1", pkgName: "p", reason: "no aplica" });
      expect(parsed.reason).toBe("no aplica");
      // createdBy no existe en el schema: lo pone el servidor.
      expect(schemaShape.createdBy).toBeUndefined();
    });

    it("vulnerability_ignore pasa el payload al cliente y devuelve el registro", async () => {
      const mockClient = createMockClient();
      (mockClient.vulnerabilities.ignore as any).mockResolvedValue({
        success: true,
        data: { id: "ign-7", environmentId: "env1", imageId: "sha256:abc", vulnerabilityId: "CVE-1", pkgName: "p", installedVersion: "1", createdAt: "t", createdBy: "arcane", reason: "no aplica" },
      });
      const server = createMockServer();
      registerVulnerabilityTools(server as any, mockClient);
      const out = await server.getHandler("arcane_vulnerability_ignore")!({
        environmentId: "env1", imageId: "sha256:abc", vulnerabilityId: "CVE-1", pkgName: "p", reason: "no aplica",
      });
      expect((mockClient.vulnerabilities.ignore as any).mock.calls[0][1]).toMatchObject({
        imageId: "sha256:abc", vulnerabilityId: "CVE-1", pkgName: "p", reason: "no aplica",
      });
      expect(out.content[0].text).toContain('"id": "ign-7"');
    });

    it("vulnerability_unignore pasa el ignoreId", async () => {
      const mockClient = createMockClient();
      (mockClient.vulnerabilities.unignore as any).mockResolvedValue({ success: true });
      const server = createMockServer();
      registerVulnerabilityTools(server as any, mockClient);
      const out = await server.getHandler("arcane_vulnerability_unignore")!({ environmentId: "env1", ignoreId: "ign-7" });
      expect((mockClient.vulnerabilities.unignore as any).mock.calls[0]).toEqual(["env1", "ign-7"]);
      expect(out.isError).toBeUndefined();
    });
```

- [ ] **Step 2: Verifica que fallan** — `npm test -- tools` → FAIL (tools no registradas).

- [ ] **Step 3: Implementa** al final de `registerVulnerabilityTools`:

```ts
  server.tool(
    "arcane_vulnerability_scan",
    "Launch a vulnerability scan (Trivy) of ONE image. The scan is asynchronous: this returns an acknowledgement with an activityId, not the result. Follow progress with arcane_activity_get, and read the outcome with arcane_vulnerability_scan_result once completed (~15 s for a small image). Scanning consumes CPU on the host. Check arcane_vulnerability_scanner_status first if unsure the scanner is available.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      imageId: z.string().describe("Image ID (sha256:...) to scan, from arcane_image_list"),
    },
    withErrors(async ({ environmentId, environmentName, imageId }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.vulnerabilities.scan(envId, imageId);
      return textResponse(
        "Scan launched (asynchronous). Follow it with arcane_activity_get using the activityId, " +
          "and read the outcome with arcane_vulnerability_scan_result once completed.\n" +
          JSON.stringify(result.data, null, 2),
      );
    }),
  );

  server.tool(
    "arcane_vulnerability_ignore",
    "Mark ONE vulnerability of ONE image as ignored. This persistently changes the environment's security reporting: the CVE stops counting against that image until un-ignored. Requires a reason, which is stored and shown in arcane_vulnerability_ignored_list. Reversible with arcane_vulnerability_unignore.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      imageId: z.string().describe("Image ID (sha256:...) the vulnerability belongs to"),
      vulnerabilityId: z.string().describe("CVE identifier, e.g. 'CVE-2024-6119'"),
      pkgName: z.string().describe("Package the CVE applies to, e.g. 'libcrypto3'"),
      reason: z.string().describe("Why this vulnerability is being ignored. Required: an ignore without a written reason is invisible debt."),
      installedVersion: z.string().optional().describe("Installed version of the package, from the CVE detail"),
    },
    withErrors(async ({ environmentId, environmentName, imageId, vulnerabilityId, pkgName, reason, installedVersion }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.vulnerabilities.ignore(envId, { imageId, vulnerabilityId, pkgName, reason, installedVersion });
      return textResponse(JSON.stringify(result.data, null, 2));
    }),
  );

  server.tool(
    "arcane_vulnerability_unignore",
    "Stop ignoring a vulnerability: the CVE counts again in the environment's security reporting. The ignoreId comes from arcane_vulnerability_ignored_list or from the record returned by arcane_vulnerability_ignore.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      ignoreId: z.string().describe("Id of the ignore record to remove"),
    },
    withErrors(async ({ environmentId, environmentName, ignoreId }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.vulnerabilities.unignore(envId, ignoreId);
      return textResponse(JSON.stringify(result, null, 2));
    }),
  );
```

- [ ] **Step 4: Verifica que pasan** — `npm test` completo y `npm run type-check`.

- [ ] **Step 5: Falsabilidad.** Muta el schema: `reason: z.string().optional()`. El test del schema debe FALLAR (el parse sin reason ya no lanza). Revierte. Verde.

- [ ] **Step 6: Commit**

```bash
git add src/tools/vulnerabilities.ts src/__tests__/tools.test.ts
git commit -m "feat(tools): scan, ignore y unignore con reason obligatorio"
```

---

### Task 8: Cierre — tabla, índice, verificación completa medida

**Files:**
- Modify: `README.md` (tabla regenerada), `docs/README.md` (índice)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: rama lista para revisión final y merge; cifras medidas para el balance.

- [ ] **Step 1: Regenera la tabla** — `npm run gen-tools-table` y después `npm run gen-tools-table -- --check` → esperado `OK: la tabla del README.md está al día (100 tools).` Si la cifra no es 100, cuenta qué falta (12 nuevas sobre 88).

- [ ] **Step 2: Actualiza `docs/README.md`:** añade a la sección «Specs y planes» los enlaces al spec y plan de F4, **y los 4 que faltan de fases anteriores** (hallazgo de la revisión del 2026-08-18): spec y plan de la coherencia de listado (2026-08-17) y spec y plan de F3 (2026-08-17). Sigue el formato de las entradas existentes.

- [ ] **Step 3: Verificación completa, todo medido:**

```bash
npm test 2>&1 | tail -4
npm run type-check
npm run gen-tools-table -- --check
node scripts/audit-schema-drift.mjs | tail -2
set -a; . ./.dev.vars; set +a
ARCANE_BASE_URL=http://192.168.180.210:3552 npm run test:e2e -- --reporter=verbose 2>&1 | tee .superpowers/sdd/f4-e2e-clean-run.txt | tail -15
```

Esperado: unitarios TODOS verdes (≈286: 262 + ~24 nuevos — cuenta la cifra real del summary); type-check limpio; 100 tools; drift **31, 0 graves**; e2e **58 `✓`, 0 skipped** (46 + 12 nuevos — CUENTA las `✓` una a una en el fichero guardado; con ~58 tests de red espera repetir la corrida varias veces hasta lograr una limpia, como en F3, que costó 8 intentos).

- [ ] **Step 4: Commit**

```bash
git add README.md docs/README.md
git commit -m "docs: tabla de 100 tools e indice al dia tras F4"
```

- [ ] **Step 5: Anuncia el cierre al propietario** con las cifras MEDIDAS (ninguna proyectada). El balance de fase, el merge a `main`, el push y la verificación del despliegue dentro del contenedor los decide y ordena el propietario — no los ejecutes sin su instrucción.

---

## Verificación final del plan (self-review hecha)

- Cobertura del spec: §2.1→Task 4 (siembra), §3.1→Tasks 3+7 (scan), §3.2→Tasks 3+5+7 (ignore endurecido), §3.3→Tasks 2+6 (listados), §4.1→Task 6, §4.2→Task 7, §5→Tasks 1–3, §6.1→Tasks 2,3,6,7, §6.2→Tasks 4–5, §6.3→Tasks 6–7 (descripciones), §6.4→Task 8. Sin huecos.
- Consistencia de nombres verificada entre tareas: `scannerStatus/environmentSummary/listAll/imageOptions/scanResult/imageList/imageSummary/imageSummaries/ignoredList/scan/ignore/unignore`; tools `arcane_vulnerability_*` idénticas en Tasks 6, 7 y spec §4.
- Sin placeholders: todo step de código lleva el código.
