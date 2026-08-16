# F2 — Observabilidad y núcleo del host: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir 13 tools MCP que permitan ver qué está pasando en el host Docker y por qué falló algo — activities, events, jobs y el núcleo de system.

**Architecture:** Se sigue el patrón ya establecido del fork: los tipos se declaran contra `openapi.txt` campo a campo, el acceso HTTP vive en clases `*Methods` dentro de `src/arcane-client.ts`, y cada dominio tiene su fichero en `src/tools/` que registra las tools. Se añade un tercer transporte al cliente, `requestHead()`, porque `HEAD /system/health` no devuelve cuerpo y el `request()` actual reventaría al hacer `response.json()`.

**Tech Stack:** TypeScript, Zod (esquemas de las tools), `@modelcontextprotocol/sdk`, Vitest (unitarios y e2e), Bun para instalar.

## Global Constraints

- **Spec de referencia:** `openapi.txt`, Arcane **2.8.0**, 273 paths. Es la fuente de verdad; no el código de otros forks.
- **Convención de nombres:** `arcane_<dominio>_<acción>`.
- **Toda tool acepta `environmentId` y `environmentName`**, resueltos con `resolveEnvironmentId(client, environmentId, environmentName)` de `src/tools/resolve.ts`. Excepción: las tools de events, cuyos endpoints son globales.
- **Ninguna tool lanza.** Ante error se devuelve `{ content: [...], isError: true }`.
- **Las tools que reciban `ActionResponse` comprueban `result.success === false`** y lo propagan como `isError: true`. Un `success:false` silenciado ya fue el bug de `arcane_project_redeploy` y se repitió en `arcane_volume_upload_file`.
- **Regla dura de verificación:** ninguna tool se da por terminada sin test unitario con `fetch` mockeado **y** comprobación e2e contra la instancia real.
- **E2E mutantes:** cada test es dueño del sujeto que muta, o la mutación es idempotente. **Prohibido** podar imágenes, volúmenes o contenedores; cambiar intervalos reales; cancelar activities ajenas al test.
- **Todo el trabajo va en la rama `feat/f2-observabilidad`.** Nunca commits sueltos en `main`. Commits firmados: si 1Password está bloqueado el commit falla — desbloquéalo, nunca `--no-gpg-sign`.
- **Credenciales para e2e:** `set -a; . ./.dev.vars; set +a` y luego `ARCANE_BASE_URL=http://192.168.180.210:3552 npm run test:e2e`.
- **La red a la instancia es intermitente:** `ECONNREFUSED` esporádico no es un fallo del código. Reintenta antes de diagnosticar.

---

## File Structure

| Fichero | Responsabilidad | Acción |
|---|---|---|
| `src/arcane-client.ts` | Tipos de los payloads, `requestHead()`, y las clases `ActivitiesMethods`, `EventsMethods`, `JobsMethods`; ampliación de `SystemMethods` | Modificar |
| `src/tools/activities.ts` | Registra las 3 tools de activities | Crear |
| `src/tools/events.ts` | Registra las 2 tools de events | Crear |
| `src/tools/jobs.ts` | Registra las 4 tools de jobs | Crear |
| `src/tools/system.ts` | Añade las 4 tools de system a `arcane_version` | Modificar |
| `src/index.ts` | Registra las tres funciones nuevas | Modificar |
| `scripts/audit-schema-drift.mjs` | Añade los tipos nuevos al `MAP` | Modificar |
| `src/__tests__/arcane-client.test.ts` | Tests unitarios de los métodos del cliente | Modificar |
| `src/__tests__/tools.test.ts` | Tests unitarios de las tools | Modificar |
| `src/__e2e__/observabilidad.e2e.ts` | E2E de los cuatro dominios contra la instancia real | Crear |

Un fichero por dominio porque es la convención que ya sigue `src/tools/`, y porque mantiene cada uno pequeño y revisable por separado.

---

### Task 0: Preparar la rama

- [ ] **Step 1: Crear la rama desde `main` actualizada**

```bash
git checkout main && git pull origin main && git checkout -b feat/f2-observabilidad
```

- [ ] **Step 2: Comprobar que se parte de verde**

Run: `npm test && npm run type-check && npm run gen-tools-table -- --check`
Expected: `111 passed`, sin salida de `tsc`, y `OK: la tabla del README.md está al día (68 tools).`

---

### Task 1: Cimientos — `requestHead()`, tipos y auditoría

**Files:**
- Modify: `src/arcane-client.ts`
- Modify: `scripts/audit-schema-drift.mjs`
- Test: `src/__tests__/arcane-client.test.ts`

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces: `requestHead(method: string, path: string): Promise<{ ok: boolean; status: number }>` como método público de `ArcaneClient`, y los tipos exportados `Activity`, `ActivityDetail`, `ActivityMessage`, `ActivityStartedBy`, `Event`, `EventSeverityCounts`, `JobPrerequisite`, `JobStatus`, `JobListResponse`, `JobSchedulesConfig`, `JobSchedulesUpdate`, `SystemPruneRequest`, `SystemPruneResult`, `SystemConvertResult`, `DockerInfo`.

- [ ] **Step 1: Escribir los tests que fallan para `requestHead()`**

Añadir dentro del `describe("request() internals", ...)` de `src/__tests__/arcane-client.test.ts`:

```ts
    it("requestHead() no parsea cuerpo y devuelve el codigo de estado", async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 } as Response);

      const resultado = await client.requestHead("HEAD", "/environments/env123/system/health");

      expect(resultado).toEqual({ ok: true, status: 200 });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/system/health",
        expect.objectContaining({ method: "HEAD" })
      );
    });

    it("requestHead() devuelve ok:false en vez de lanzar cuando el estado no es 2xx", async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 503 } as Response);

      const resultado = await client.requestHead("HEAD", "/environments/env123/system/health");

      expect(resultado).toEqual({ ok: false, status: 503 });
    });
```

- [ ] **Step 2: Ver que fallan**

Run: `npx vitest run src/__tests__/arcane-client.test.ts -t "requestHead"`
Expected: FAIL con `client.requestHead is not a function`

- [ ] **Step 3: Implementar `requestHead()`**

En `src/arcane-client.ts`, justo antes del método `requestMultipart`:

```ts
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
```

- [ ] **Step 4: Ver que pasan**

Run: `npx vitest run src/__tests__/arcane-client.test.ts -t "requestHead"`
Expected: PASS (2 tests)

- [ ] **Step 5: Declarar los tipos**

En `src/arcane-client.ts`, tras la interfaz `WorkspaceUpdateManifest`. Copiados del spec campo a campo: lo que el spec liste en `required` va **sin** `?`.

```ts
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
```

- [ ] **Step 6: Añadir los tipos al `MAP` de la auditoría**

En `scripts/audit-schema-drift.mjs`, dentro de `const MAP = {...}`, tras `WorkspaceFileEntry`:

```js
  Activity: "ActivityActivity",
  ActivityDetail: "ActivityDetail",
  ActivityMessage: "ActivityMessage",
  ActivityStartedBy: "ActivityStartedBy",
  JobPrerequisite: "JobscheduleJobPrerequisite",
  Event: "EventEvent",
  EventSeverityCounts: "EventSeverityCounts",
  JobStatus: "JobscheduleJobStatus",
  JobSchedulesConfig: "JobscheduleConfig",
  SystemPruneResult: "SystemPruneAllResult",
  SystemConvertResult: "SystemConvertDockerRunResponse",
  DockerInfo: "DockerinfoInfo",
```

- [ ] **Step 7: Comprobar que la auditoría sigue en 0 hallazgos graves**

Run: `node scripts/audit-schema-drift.mjs | grep -cE "SOBRA-EN-TS|FALTA-EN-TS-REQUERIDO|OPCIONAL-PERO-REQUERIDO|OBLIGATORIO-PERO-OPCIONAL|INTERFAZ-AUSENTE|SCHEMA-AUSENTE"`
Expected: `0`

Si sale distinto de 0, la interfaz no coincide con el spec: corrige la interfaz, **nunca** el `MAP` ni el script.

- [ ] **Step 8: Type-check y suite**

Run: `npm run type-check && npm test`
Expected: sin salida de `tsc`; `113 passed`

- [ ] **Step 9: Commit**

```bash
git add src/arcane-client.ts scripts/audit-schema-drift.mjs src/__tests__/arcane-client.test.ts
git commit -m "feat(client): requestHead y tipos de observabilidad para F2

HEAD /system/health declara 200 sin content: request() reventaria al hacer
response.json(). requestHead devuelve el codigo de estado y no lanza ante un
estado de error, porque 'no esta sano' es una respuesta valida.

Los 15 tipos se declaran contra el spec 2.8.0 campo a campo y 10 entran en el
MAP de la auditoria de drift. DockerInfo se declara completo (71 campos) pese
a ser un reenvio, para que la auditoria lo vigile."
```

---

### Task 2: Activities

**Files:**
- Modify: `src/arcane-client.ts`
- Create: `src/tools/activities.ts`
- Modify: `src/index.ts`
- Test: `src/__tests__/arcane-client.test.ts`, `src/__tests__/tools.test.ts`

**Interfaces:**
- Consumes: `Activity`, `ActivityDetail`, `PaginatedResponse<T>`, `ActionResponse` de la Task 1.
- Produces: `client.activities.list(envId, opts?)`, `client.activities.get(envId, activityId)`, `client.activities.cancel(envId, activityId, requestedBy?)`, y `registerActivityTools(server, client)`.

- [ ] **Step 1: Escribir los tests del cliente que fallan**

En `src/__tests__/arcane-client.test.ts`, tras el `describe("volumeFiles ...")`:

```ts
  describe("activities", () => {
    it(".list(envId, opts) - GET /environments/{envId}/activities con filtros", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [], pagination: { totalItems: 0 } }),
      } as Response);

      await client.activities.list("env123", { status: "failed", limit: 10 });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/activities?status=failed&limit=10",
        expect.objectContaining({ method: "GET" })
      );
    });

    it(".get(envId, activityId) - GET /environments/{envId}/activities/{activityId}", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { activity: { id: "act1" }, messages: [] } }),
      } as Response);

      await client.activities.get("env123", "act1");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/activities/act1",
        expect.objectContaining({ method: "GET" })
      );
    });

    it(".cancel(envId, activityId) - POST /environments/{envId}/activities/{activityId}/cancel", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, message: "Cancelled" }),
      } as Response);

      await client.activities.cancel("env123", "act1");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/activities/act1/cancel",
        expect.objectContaining({ method: "POST" })
      );
    });
  });
```

- [ ] **Step 2: Ver que fallan**

Run: `npx vitest run src/__tests__/arcane-client.test.ts -t "activities"`
Expected: FAIL con `Cannot read properties of undefined (reading 'list')`

- [ ] **Step 3: Implementar `ActivitiesMethods`**

En `src/arcane-client.ts`, tras la clase `SystemMethods`:

```ts
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
      `/environments/${envId}/activities${query ? `?${query}` : ""}`
    );
  }

  async get(envId: string, activityId: string): Promise<{ success: boolean; data: ActivityDetail }> {
    return this.client.request<{ success: boolean; data: ActivityDetail }>(
      "GET",
      `/environments/${envId}/activities/${activityId}`
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
      `/environments/${envId}/activities/${activityId}/cancel${query ? `?${query}` : ""}`
    );
  }
}
```

Declarar la propiedad y cablearla en `ArcaneClient`, junto a las demás:

```ts
  readonly activities: ActivitiesMethods;
```

```ts
    this.activities = new ActivitiesMethods(this);
```

- [ ] **Step 4: Ver que pasan**

Run: `npx vitest run src/__tests__/arcane-client.test.ts -t "activities"`
Expected: PASS (3 tests)

- [ ] **Step 5: Escribir los tests de las tools que fallan**

En `src/__tests__/tools.test.ts`, tras el bloque de volume file tools. Añadir también el import `import { registerActivityTools } from "../tools/activities";` en la cabecera:

```ts
  describe("activity tools", () => {
    const clienteConActivities = () => {
      const mockClient = createMockClient() as any;
      mockClient.activities = {
        list: vi.fn().mockResolvedValue({ success: true, data: [], pagination: { totalItems: 0 } }),
        get: vi.fn().mockResolvedValue({
          success: true,
          data: { activity: { id: "act1", status: "failed" }, messages: [] },
        }),
        cancel: vi.fn().mockResolvedValue({ success: true, message: "Cancelled" }),
      };
      return mockClient;
    };

    it("arcane_activity_list pasa los filtros al cliente", async () => {
      const mockClient = clienteConActivities();
      const server = createMockServer();
      registerActivityTools(server as any, mockClient);

      const handler = server.getHandler("arcane_activity_list");
      await handler({ environmentId: "env1", status: "failed", limit: 10 });

      expect(mockClient.activities.list).toHaveBeenCalledWith("env1", {
        search: undefined,
        status: "failed",
        type: undefined,
        resourceType: undefined,
        limit: 10,
      });
    });

    it("arcane_activity_get resuelve un activityId", async () => {
      const mockClient = clienteConActivities();
      const server = createMockServer();
      registerActivityTools(server as any, mockClient);

      const handler = server.getHandler("arcane_activity_get");
      const result = await handler({ environmentId: "env1", activityId: "act1" });

      expect(mockClient.activities.get).toHaveBeenCalledWith("env1", "act1");
      expect(result.isError).toBeUndefined();
    });

    it("arcane_activity_cancel devuelve isError con success:false", async () => {
      const mockClient = clienteConActivities();
      mockClient.activities.cancel.mockResolvedValue({ success: false, message: "already finished" });
      const server = createMockServer();
      registerActivityTools(server as any, mockClient);

      const handler = server.getHandler("arcane_activity_cancel");
      const result = await handler({ environmentId: "env1", activityId: "act1" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("already finished");
    });
  });
```

- [ ] **Step 6: Ver que fallan**

Run: `npx vitest run src/__tests__/tools.test.ts -t "activity tools"`
Expected: FAIL — el módulo `../tools/activities` no existe

- [ ] **Step 7: Crear `src/tools/activities.ts`**

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArcaneClient } from "../arcane-client";
import { resolveEnvironmentId } from "./resolve";

export function registerActivityTools(server: McpServer, client: ArcaneClient): void {
  server.tool(
    "arcane_activity_list",
    "List background activities (deployments, pulls, scans) with optional filters.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      status: z.string().optional().describe("Filter by status, e.g. running, success, failed"),
      type: z.string().optional().describe("Filter by activity type, e.g. image_update_check"),
      resourceType: z.string().optional().describe("Filter by resource type, e.g. images, volume"),
      search: z.string().optional().describe("Free-text search"),
      limit: z.number().optional().describe("Maximum number of activities to return"),
    },
    async ({ environmentId, environmentName, status, type, resourceType, search, limit }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        const result = await client.activities.list(envId, { search, status, type, resourceType, limit });
        return { content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "arcane_activity_get",
    "Get a background activity with its full message log. Use this to resolve the activityId returned by deploy, redeploy and pull operations.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      activityId: z.string().describe("Activity ID"),
    },
    async ({ environmentId, environmentName, activityId }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        const result = await client.activities.get(envId, activityId);
        return { content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "arcane_activity_cancel",
    "Cancel a running background activity.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      activityId: z.string().describe("Activity ID"),
      requestedBy: z.string().optional().describe("Who requested the cancellation"),
    },
    async ({ environmentId, environmentName, activityId, requestedBy }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        const result = await client.activities.cancel(envId, activityId, requestedBy);
        if (result.success === false) {
          return {
            content: [{ type: "text", text: `Error: ${result.data?.error || "Cancel failed"}` }],
            isError: true,
          };
        }
        // El mensaje sale del estado real de la activity, no de un `message` inexistente.
        return {
          content: [{ type: "text", text: `Activity ${activityId} is now '${result.data.status}'` }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );
}
```

- [ ] **Step 8: Registrar en `src/index.ts`**

Añadir el import junto a los demás y la llamada junto a las demás:

```ts
import { registerActivityTools } from "./tools/activities";
```

```ts
    registerActivityTools(this.server, client);
```

- [ ] **Step 9: Ver que pasan y regenerar la tabla**

Run: `npx vitest run src/__tests__/tools.test.ts -t "activity tools" && npm run gen-tools-table && npm test && npm run type-check`
Expected: los 3 tests en verde; `Tabla regenerada en README.md: 71 tools`; suite completa en verde

- [ ] **Step 10: Commit**

```bash
git add src/arcane-client.ts src/tools/activities.ts src/index.ts src/__tests__ README.md
git commit -m "feat(tools): activities - listar, resolver y cancelar

arcane_activity_get cierra el agujero del activityId huerfano: los cuatro
endpoints NDJSON abren su stream con {type:activity,activityId} y hasta ahora
ninguna tool sabia resolver ese identificador."
```

---

### Task 3: Events

**Files:**
- Modify: `src/arcane-client.ts`
- Create: `src/tools/events.ts`
- Modify: `src/index.ts`
- Test: `src/__tests__/arcane-client.test.ts`, `src/__tests__/tools.test.ts`

**Interfaces:**
- Consumes: `Event`, `EventSeverityCounts`, `PaginatedResponse<T>` de la Task 1.
- Produces: `client.events.list(opts?)`, `client.events.stats()`, y `registerEventTools(server, client)`.

- [ ] **Step 1: Escribir los tests del cliente que fallan**

```ts
  describe("events", () => {
    it(".list() sin environmentId - GET /events", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [], pagination: { totalItems: 0 } }),
      } as Response);

      await client.events.list({ severity: "error", limit: 5 });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/events?severity=error&limit=5",
        expect.objectContaining({ method: "GET" })
      );
    });

    it(".list() con environmentId - GET /events/environment/{envId}", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [], pagination: { totalItems: 0 } }),
      } as Response);

      await client.events.list({ environmentId: "env123", limit: 5 });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/events/environment/env123?limit=5",
        expect.objectContaining({ method: "GET" })
      );
    });

    it(".stats() - GET /events/stats", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { total: 0, info: 0, success: 0, warning: 0, error: 0 } }),
      } as Response);

      await client.events.stats();

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/events/stats",
        expect.objectContaining({ method: "GET" })
      );
    });
  });
```

- [ ] **Step 2: Ver que fallan**

Run: `npx vitest run src/__tests__/arcane-client.test.ts -t "events"`
Expected: FAIL con `Cannot read properties of undefined (reading 'list')`

- [ ] **Step 3: Implementar `EventsMethods`**

```ts
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
    const base = opts?.environmentId ? `/events/environment/${opts.environmentId}` : "/events";
    return this.client.request<PaginatedResponse<Event>>("GET", `${base}${query ? `?${query}` : ""}`);
  }

  async stats(): Promise<{ success: boolean; data: EventSeverityCounts }> {
    return this.client.request<{ success: boolean; data: EventSeverityCounts }>("GET", "/events/stats");
  }
}
```

Declarar `readonly events: EventsMethods;` y cablear `this.events = new EventsMethods(this);`.

- [ ] **Step 4: Ver que pasan**

Run: `npx vitest run src/__tests__/arcane-client.test.ts -t "events"`
Expected: PASS (3 tests)

- [ ] **Step 5: Escribir los tests de las tools que fallan**

Añadir el import `import { registerEventTools } from "../tools/events";` y:

```ts
  describe("event tools", () => {
    const clienteConEvents = () => {
      const mockClient = createMockClient() as any;
      mockClient.events = {
        list: vi.fn().mockResolvedValue({ success: true, data: [], pagination: { totalItems: 0 } }),
        stats: vi.fn().mockResolvedValue({
          success: true,
          data: { total: 3, info: 1, success: 1, warning: 0, error: 1 },
        }),
      };
      return mockClient;
    };

    it("arcane_event_list pasa environmentId como filtro, sin resolverlo", async () => {
      const mockClient = clienteConEvents();
      const server = createMockServer();
      registerEventTools(server as any, mockClient);

      const handler = server.getHandler("arcane_event_list");
      await handler({ environmentId: "env1", severity: "error" });

      expect(mockClient.events.list).toHaveBeenCalledWith({
        environmentId: "env1",
        severity: "error",
        type: undefined,
        search: undefined,
        limit: undefined,
      });
    });

    it("arcane_event_stats devuelve los recuentos", async () => {
      const mockClient = clienteConEvents();
      const server = createMockServer();
      registerEventTools(server as any, mockClient);

      const handler = server.getHandler("arcane_event_stats");
      const result = await handler({});

      expect(mockClient.events.stats).toHaveBeenCalled();
      expect(result.content[0].text).toContain("3");
    });
  });
```

- [ ] **Step 6: Ver que fallan**

Run: `npx vitest run src/__tests__/tools.test.ts -t "event tools"`
Expected: FAIL — el módulo `../tools/events` no existe

- [ ] **Step 7: Crear `src/tools/events.ts`**

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArcaneClient } from "../arcane-client";

/**
 * Los endpoints de events son GLOBALES, no por entorno: aqui `environmentId`
 * es un filtro opcional, no algo que haya que resolver con resolveEnvironmentId.
 * Por eso estas dos tools no aceptan `environmentName`.
 */
export function registerEventTools(server: McpServer, client: ArcaneClient): void {
  server.tool(
    "arcane_event_list",
    "List audit events. Without environmentId returns events from all environments.",
    {
      environmentId: z.string().optional().describe("Filter events to one environment"),
      severity: z.string().optional().describe("Filter by severity: info, success, warning, error"),
      type: z.string().optional().describe("Filter by event type"),
      search: z.string().optional().describe("Free-text search"),
      limit: z.number().optional().describe("Maximum number of events to return"),
    },
    async ({ environmentId, severity, type, search, limit }) => {
      try {
        const result = await client.events.list({ environmentId, severity, type, search, limit });
        return { content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "arcane_event_stats",
    "Get event counts by severity across all environments.",
    {},
    async () => {
      try {
        const result = await client.events.stats();
        return { content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );
}
```

- [ ] **Step 8: Registrar en `src/index.ts`**

```ts
import { registerEventTools } from "./tools/events";
```

```ts
    registerEventTools(this.server, client);
```

- [ ] **Step 9: Ver que pasan y regenerar la tabla**

Run: `npx vitest run src/__tests__/tools.test.ts -t "event tools" && npm run gen-tools-table && npm test && npm run type-check`
Expected: los 2 tests en verde; `73 tools`; suite completa en verde

- [ ] **Step 10: Commit**

```bash
git add src/arcane-client.ts src/tools/events.ts src/index.ts src/__tests__ README.md
git commit -m "feat(tools): events - listar y estadisticas por severidad

Una sola tool para /events y /events/environment/{id}: se diferencian en un
filtro, y ofrecer dos tools casi identicas induce fallos de seleccion."
```

---

### Task 4: Jobs

**Files:**
- Modify: `src/arcane-client.ts`
- Create: `src/tools/jobs.ts`
- Modify: `src/index.ts`
- Test: `src/__tests__/arcane-client.test.ts`, `src/__tests__/tools.test.ts`

**Interfaces:**
- Consumes: `JobListResponse`, `JobStatus`, `JobSchedulesConfig`, `JobSchedulesUpdate`, `ActionResponse` de la Task 1.
- Produces: `client.jobs.list(envId)`, `client.jobs.run(envId, jobId)`, `client.jobs.getSchedules(envId)`, `client.jobs.updateSchedules(envId, cambios)`, y `registerJobTools(server, client)`.

- [ ] **Step 1: Escribir los tests del cliente que fallan**

```ts
  describe("jobs", () => {
    it(".list(envId) - GET /environments/{envId}/jobs con el sobre {jobs}", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ isAgent: false, jobs: [{ id: "auto-heal", name: "Auto Heal" }] }),
      } as Response);

      const resultado = await client.jobs.list("env123");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/jobs",
        expect.objectContaining({ method: "GET" })
      );
      // El sobre NO es {data,pagination}: leerlo como paginado devolveria vacio.
      expect(resultado.jobs?.[0].id).toBe("auto-heal");
    });

    it(".run(envId, jobId) - POST /environments/{envId}/jobs/{jobId}/run", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, message: "Job started" }),
      } as Response);

      await client.jobs.run("env123", "auto-heal");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/jobs/auto-heal/run",
        expect.objectContaining({ method: "POST" })
      );
    });

    it(".getSchedules(envId) - GET /environments/{envId}/job-schedules", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ autoHealInterval: "30s" }),
      } as Response);

      await client.jobs.getSchedules("env123");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/job-schedules",
        expect.objectContaining({ method: "GET" })
      );
    });

    it(".updateSchedules(envId, cambios) - PUT con el cuerpo recibido", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { autoHealInterval: "30s" } }),
      } as Response);

      await client.jobs.updateSchedules("env123", { autoHealInterval: "30s" });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/job-schedules",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ autoHealInterval: "30s" }),
        })
      );
    });
  });
```

- [ ] **Step 2: Ver que fallan**

Run: `npx vitest run src/__tests__/arcane-client.test.ts -t "jobs"`
Expected: FAIL con `Cannot read properties of undefined (reading 'list')`

- [ ] **Step 3: Implementar `JobsMethods`**

```ts
class JobsMethods {
  constructor(private client: ArcaneClient) {}

  /** Devuelve el sobre `{jobs, isAgent}` tal cual: NO es el paginado del resto de la API. */
  async list(envId: string): Promise<JobListResponse> {
    return this.client.request<JobListResponse>("GET", `/environments/${envId}/jobs`);
  }

  async run(envId: string, jobId: string): Promise<ActionResponse> {
    return this.client.request<ActionResponse>("POST", `/environments/${envId}/jobs/${jobId}/run`);
  }

  async getSchedules(envId: string): Promise<JobSchedulesConfig> {
    return this.client.request<JobSchedulesConfig>("GET", `/environments/${envId}/job-schedules`);
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
      `/environments/${envId}/job-schedules`,
      cambios
    );
  }
}
```

Declarar `readonly jobs: JobsMethods;` y cablear `this.jobs = new JobsMethods(this);`.

- [ ] **Step 4: Ver que pasan**

Run: `npx vitest run src/__tests__/arcane-client.test.ts -t "jobs"`
Expected: PASS (4 tests)

- [ ] **Step 5: Escribir los tests de las tools que fallan**

Añadir el import `import { registerJobTools } from "../tools/jobs";` y:

```ts
  describe("job tools", () => {
    const clienteConJobs = () => {
      const mockClient = createMockClient() as any;
      mockClient.jobs = {
        list: vi.fn().mockResolvedValue({
          isAgent: false,
          jobs: [{ id: "auto-heal", name: "Auto Heal", canRunManually: true }],
        }),
        run: vi.fn().mockResolvedValue({ success: true, message: "Job started" }),
        getSchedules: vi.fn().mockResolvedValue({ autoHealInterval: "30s" }),
        updateSchedules: vi.fn().mockResolvedValue({
          success: true,
          data: { autoHealInterval: "45s", autoUpdateInterval: "24h" },
        }),
      };
      return mockClient;
    };

    it("arcane_job_list serializa el contenido de {jobs}, no el sobre", async () => {
      const mockClient = clienteConJobs();
      const server = createMockServer();
      registerJobTools(server as any, mockClient);

      const handler = server.getHandler("arcane_job_list");
      const result = await handler({ environmentId: "env1" });

      expect(mockClient.jobs.list).toHaveBeenCalledWith("env1");
      expect(result.content[0].text).toContain("auto-heal");
    });

    it("arcane_job_run devuelve isError con success:false", async () => {
      const mockClient = clienteConJobs();
      mockClient.jobs.run.mockResolvedValue({ success: false, message: "prerequisites not met" });
      const server = createMockServer();
      registerJobTools(server as any, mockClient);

      const handler = server.getHandler("arcane_job_run");
      const result = await handler({ environmentId: "env1", jobId: "analytics-heartbeat" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("prerequisites not met");
    });

    it("arcane_job_schedules_update envia solo los intervalos indicados", async () => {
      const mockClient = clienteConJobs();
      const server = createMockServer();
      registerJobTools(server as any, mockClient);

      const handler = server.getHandler("arcane_job_schedules_update");
      const result = await handler({ environmentId: "env1", autoHealInterval: "45s" });

      expect(mockClient.jobs.updateSchedules).toHaveBeenCalledWith("env1", { autoHealInterval: "45s" });
      // La tool devuelve la configuracion aplicada que responde el servidor.
      expect(result.content[0].text).toContain("45s");
    });

    it("arcane_job_schedules_get devuelve la configuracion", async () => {
      const mockClient = clienteConJobs();
      const server = createMockServer();
      registerJobTools(server as any, mockClient);

      const handler = server.getHandler("arcane_job_schedules_get");
      const result = await handler({ environmentId: "env1" });

      expect(mockClient.jobs.getSchedules).toHaveBeenCalledWith("env1");
      expect(result.content[0].text).toContain("30s");
    });
  });
```

- [ ] **Step 6: Ver que fallan**

Run: `npx vitest run src/__tests__/tools.test.ts -t "job tools"`
Expected: FAIL — el módulo `../tools/jobs` no existe

- [ ] **Step 7: Crear `src/tools/jobs.ts`**

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArcaneClient, JobSchedulesUpdate } from "../arcane-client";
import { resolveEnvironmentId } from "./resolve";

/** Los nueve intervalos configurables, tal y como los declara JobscheduleUpdate. */
const INTERVALOS = {
  autoHealInterval: z.string().optional().describe("Auto-heal interval, e.g. 30s"),
  autoUpdateInterval: z.string().optional().describe("Auto-update interval"),
  dockerClientRefreshInterval: z.string().optional().describe("Docker client refresh interval"),
  environmentHealthInterval: z.string().optional().describe("Environment health check interval"),
  eventCleanupInterval: z.string().optional().describe("Event cleanup interval"),
  expiredSessionsCleanupInterval: z.string().optional().describe("Expired sessions cleanup interval"),
  pollingInterval: z.string().optional().describe("Polling interval"),
  scheduledPruneInterval: z.string().optional().describe("Scheduled prune interval"),
  vulnerabilityScanInterval: z.string().optional().describe("Vulnerability scan interval"),
};

export function registerJobTools(server: McpServer, client: ArcaneClient): void {
  server.tool(
    "arcane_job_list",
    "List background jobs with their schedule, whether they are enabled, and whether they can be run manually.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
    },
    async ({ environmentId, environmentName }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        const result = await client.jobs.list(envId);
        return { content: [{ type: "text", text: JSON.stringify(result.jobs, null, 2) }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "arcane_job_run",
    "Run a background job immediately. Jobs with unmet prerequisites will not execute.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      jobId: z.string().describe("Job ID, e.g. auto-heal"),
    },
    async ({ environmentId, environmentName, jobId }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        const result = await client.jobs.run(envId, jobId);
        if (result.success === false) {
          return {
            content: [{ type: "text", text: `Error: ${result.message || "Job run failed"}` }],
            isError: true,
          };
        }
        return { content: [{ type: "text", text: result.message || "Job started" }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "arcane_job_schedules_get",
    "Get the configured intervals for scheduled background jobs.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
    },
    async ({ environmentId, environmentName }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        const result = await client.jobs.getSchedules(envId);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "arcane_job_schedules_update",
    "Update one or more scheduled job intervals. Only the intervals provided are changed.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      ...INTERVALOS,
    },
    async ({ environmentId, environmentName, ...intervalos }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        // Solo se envian los intervalos indicados: el resto se deja intacto.
        const cambios = Object.fromEntries(
          Object.entries(intervalos).filter(([, v]) => v !== undefined),
        ) as JobSchedulesUpdate;
        const result = await client.jobs.updateSchedules(envId, cambios);
        if (result.success === false) {
          return {
            content: [{ type: "text", text: "Error: update failed" }],
            isError: true,
          };
        }
        // La respuesta trae la configuracion ya aplicada: devolverla es mas util
        // que un texto fijo, y ademas confirma que los cambios cuajaron.
        return { content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );
}
```

- [ ] **Step 8: Registrar en `src/index.ts`**

```ts
import { registerJobTools } from "./tools/jobs";
```

```ts
    registerJobTools(this.server, client);
```

- [ ] **Step 9: Ver que pasan y regenerar la tabla**

Run: `npx vitest run src/__tests__/tools.test.ts -t "job tools" && npm run gen-tools-table && npm test && npm run type-check`
Expected: los 4 tests en verde; `77 tools`; suite completa en verde

- [ ] **Step 10: Commit**

```bash
git add src/arcane-client.ts src/tools/jobs.ts src/index.ts src/__tests__ README.md
git commit -m "feat(tools): jobs - listar, ejecutar y programar

GET /jobs devuelve el sobre {jobs,isAgent}, no el {data,pagination} del resto
de la API: tratarlo como paginado devolveria vacio en silencio. El test lo fija."
```

---

### Task 5: System

**Files:**
- Modify: `src/arcane-client.ts`
- Modify: `src/tools/system.ts`
- Test: `src/__tests__/arcane-client.test.ts`, `src/__tests__/tools.test.ts`

**Interfaces:**
- Consumes: `DockerInfo`, `SystemPruneRequest`, `SystemPruneResult`, `SystemConvertResult`, `requestHead()` de la Task 1.
- Produces: `client.system.dockerInfo(envId)`, `client.system.health(envId)`, `client.system.prune(envId, opciones)`, `client.system.convert(envId, dockerRunCommand)`.

- [ ] **Step 1: Escribir los tests del cliente que fallan**

```ts
  describe("system (F2)", () => {
    it(".dockerInfo(envId) - GET /environments/{envId}/system/docker/info", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, ServerVersion: "29.2.1" }),
      } as Response);

      await client.system.dockerInfo("env123");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/system/docker/info",
        expect.objectContaining({ method: "GET" })
      );
    });

    it(".health(envId) - HEAD, sin parsear cuerpo", async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 } as Response);

      const resultado = await client.system.health("env123");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/system/health",
        expect.objectContaining({ method: "HEAD" })
      );
      expect(resultado).toEqual({ ok: true, status: 200 });
    });

    it(".prune(envId, opciones) - POST con las opciones como cuerpo", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { success: true, spaceReclaimed: 0 } }),
      } as Response);

      await client.system.prune("env123", { buildCache: { mode: "dangling" } });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/system/prune",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ buildCache: { mode: "dangling" } }),
        })
      );
    });

    it(".convert(envId, comando) - POST /system/convert", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, dockerCompose: "services:", envVars: "", serviceName: "nginx" }),
      } as Response);

      await client.system.convert("env123", "docker run -d nginx");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env123/system/convert",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ dockerRunCommand: "docker run -d nginx" }),
        })
      );
    });
  });
```

- [ ] **Step 2: Ver que fallan**

Run: `npx vitest run src/__tests__/arcane-client.test.ts -t "system (F2)"`
Expected: FAIL con `client.system.dockerInfo is not a function`

- [ ] **Step 3: Ampliar `SystemMethods`**

Añadir estos métodos dentro de la clase `SystemMethods` existente, junto a `version()`:

```ts
  async dockerInfo(envId: string): Promise<DockerInfo> {
    return this.client.request<DockerInfo>("GET", `/environments/${envId}/system/docker/info`);
  }

  /** HEAD sin cuerpo: el veredicto es el codigo de estado. */
  async health(envId: string): Promise<{ ok: boolean; status: number }> {
    return this.client.requestHead("HEAD", `/environments/${envId}/system/health`);
  }

  async prune(envId: string, opciones: SystemPruneRequest): Promise<{ success: boolean; data: SystemPruneResult }> {
    return this.client.request<{ success: boolean; data: SystemPruneResult }>(
      "POST",
      `/environments/${envId}/system/prune`,
      opciones
    );
  }

  async convert(envId: string, dockerRunCommand: string): Promise<SystemConvertResult> {
    return this.client.request<SystemConvertResult>(
      "POST",
      `/environments/${envId}/system/convert`,
      { dockerRunCommand }
    );
  }
```

- [ ] **Step 4: Ver que pasan**

Run: `npx vitest run src/__tests__/arcane-client.test.ts -t "system (F2)"`
Expected: PASS (4 tests)

- [ ] **Step 5: Escribir los tests de las tools que fallan**

```ts
  describe("system tools (F2)", () => {
    const clienteConSystem = () => {
      const mockClient = createMockClient() as any;
      mockClient.system = {
        version: vi.fn(),
        dockerInfo: vi.fn().mockResolvedValue({ success: true, ServerVersion: "29.2.1", Containers: 16 }),
        health: vi.fn().mockResolvedValue({ ok: true, status: 200 }),
        prune: vi.fn().mockResolvedValue({ success: true, data: { success: true, spaceReclaimed: 1024 } }),
        convert: vi.fn().mockResolvedValue({
          success: true,
          dockerCompose: "services:\n  nginx:",
          envVars: "",
          serviceName: "nginx",
        }),
      };
      return mockClient;
    };

    it("arcane_system_health traduce el estado a un mensaje legible", async () => {
      const mockClient = clienteConSystem();
      const server = createMockServer();
      registerSystemTools(server as any, mockClient);

      const handler = server.getHandler("arcane_system_health");
      const result = await handler({ environmentId: "env1" });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("healthy");
    });

    it("arcane_system_health marca isError cuando el estado no es 2xx", async () => {
      const mockClient = clienteConSystem();
      mockClient.system.health.mockResolvedValue({ ok: false, status: 503 });
      const server = createMockServer();
      registerSystemTools(server as any, mockClient);

      const handler = server.getHandler("arcane_system_health");
      const result = await handler({ environmentId: "env1" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("503");
    });

    it("arcane_system_prune solo envia los recursos indicados", async () => {
      const mockClient = clienteConSystem();
      const server = createMockServer();
      registerSystemTools(server as any, mockClient);

      const handler = server.getHandler("arcane_system_prune");
      await handler({ environmentId: "env1", buildCache: "dangling" });

      expect(mockClient.system.prune).toHaveBeenCalledWith("env1", { buildCache: { mode: "dangling" } });
    });

    it("arcane_system_prune sin ningun recurso devuelve isError en vez de podar todo", async () => {
      const mockClient = clienteConSystem();
      const server = createMockServer();
      registerSystemTools(server as any, mockClient);

      const handler = server.getHandler("arcane_system_prune");
      const result = await handler({ environmentId: "env1" });

      expect(result.isError).toBe(true);
      expect(mockClient.system.prune).not.toHaveBeenCalled();
    });

    it("arcane_system_convert devuelve el compose", async () => {
      const mockClient = clienteConSystem();
      const server = createMockServer();
      registerSystemTools(server as any, mockClient);

      const handler = server.getHandler("arcane_system_convert");
      const result = await handler({ environmentId: "env1", dockerRunCommand: "docker run -d nginx" });

      expect(result.content[0].text).toContain("services:");
    });

    it("arcane_system_docker_info devuelve la informacion del demonio", async () => {
      const mockClient = clienteConSystem();
      const server = createMockServer();
      registerSystemTools(server as any, mockClient);

      const handler = server.getHandler("arcane_system_docker_info");
      const result = await handler({ environmentId: "env1" });

      expect(result.content[0].text).toContain("29.2.1");
    });
  });
```

- [ ] **Step 6: Ver que fallan**

Run: `npx vitest run src/__tests__/tools.test.ts -t "system tools (F2)"`
Expected: FAIL con `handler is not a function` — `getHandler` devuelve `undefined` porque
esas tools todavía no están registradas

- [ ] **Step 7: Añadir las 4 tools a `src/tools/system.ts`**

Añadir los imports `import { z } from "zod";` y `import { resolveEnvironmentId } from "./resolve";`, y estas tools dentro de `registerSystemTools`, tras `arcane_version`:

```ts
  server.tool(
    "arcane_system_docker_info",
    "Get Docker daemon and host information: versions, container and image counts, storage driver, resources.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
    },
    async ({ environmentId, environmentName }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        const result = await client.system.dockerInfo(envId);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "arcane_system_health",
    "Check whether the Docker system of an environment is healthy.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
    },
    async ({ environmentId, environmentName }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        const { ok, status } = await client.system.health(envId);
        if (!ok) {
          return {
            content: [{ type: "text", text: `System is not healthy (HTTP ${status})` }],
            isError: true,
          };
        }
        return { content: [{ type: "text", text: `System is healthy (HTTP ${status})` }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "arcane_system_prune",
    "Prune unused Docker resources. You must explicitly choose which resources to prune; nothing is pruned by default.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      buildCache: z.string().optional().describe("Prune build cache with this mode, e.g. dangling or all"),
      images: z.string().optional().describe("Prune images with this mode, e.g. dangling or all"),
      containers: z.string().optional().describe("Prune stopped containers with this mode"),
      volumes: z.string().optional().describe("Prune unused volumes with this mode"),
      networks: z.string().optional().describe("Prune unused networks with this mode"),
    },
    async ({ environmentId, environmentName, buildCache, images, containers, volumes, networks }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        // Sin recurso explicito no se poda nada: un cuerpo vacio podria
        // interpretarse como "poda todo", que es justo lo que no se quiere.
        const opciones: Record<string, { mode: string }> = {};
        if (buildCache) opciones.buildCache = { mode: buildCache };
        if (images) opciones.images = { mode: images };
        if (containers) opciones.containers = { mode: containers };
        if (volumes) opciones.volumes = { mode: volumes };
        if (networks) opciones.networks = { mode: networks };
        if (Object.keys(opciones).length === 0) {
          return {
            content: [{
              type: "text",
              text: "Error: choose at least one resource to prune (buildCache, images, containers, volumes or networks).",
            }],
            isError: true,
          };
        }
        const result = await client.system.prune(envId, opciones);
        return { content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "arcane_system_convert",
    "Convert a docker run command into a Docker Compose service definition.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      dockerRunCommand: z.string().describe("The full docker run command to convert"),
    },
    async ({ environmentId, environmentName, dockerRunCommand }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        const result = await client.system.convert(envId, dockerRunCommand);
        const lines = [
          `Service: ${result.serviceName}`,
          "",
          result.dockerCompose,
          ...(result.envVars ? ["", "Environment:", result.envVars] : []),
        ];
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );
```

- [ ] **Step 8: Ver que pasan y regenerar la tabla**

Run: `npx vitest run src/__tests__/tools.test.ts -t "system tools (F2)" && npm run gen-tools-table && npm test && npm run type-check`
Expected: los 6 tests en verde; `81 tools`; suite completa en verde

- [ ] **Step 9: Commit**

```bash
git add src/arcane-client.ts src/tools/system.ts src/__tests__ README.md
git commit -m "feat(tools): system - docker info, health, prune y convert

system_prune no poda nada sin que se elija recurso explicitamente: un cuerpo
vacio podria interpretarse como 'poda todo'. health usa requestHead porque el
endpoint es HEAD y no devuelve cuerpo."
```

---

### Task 6: E2E contra la instancia real

**Files:**
- Create: `src/__e2e__/observabilidad.e2e.ts`

**Interfaces:**
- Consumes: `e2eClient()` e `IDEMPOTENT_STACK` de `src/__e2e__/helpers.ts`, y todo lo producido por las tareas 2–5.
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Escribir el fichero e2e**

```ts
import { describe, it, expect } from "vitest";
import { e2eClient } from "./helpers";

/**
 * Comprobacion contra la instancia real de los cuatro dominios de F2.
 *
 * Las mutantes siguen la regla del proyecto: cada test es dueño del sujeto que
 * muta, o la mutacion es idempotente. Prohibido podar imagenes, volumenes o
 * contenedores; cambiar intervalos reales; cancelar activities ajenas al test.
 */
describe("observabilidad (e2e, Arcane 2.8.0)", () => {
  const client = e2eClient();
  const envId = "0";

  it("activities.list devuelve el sobre paginado", async () => {
    const r = await client.activities.list(envId, { limit: 5 });
    expect(r.success).toBe(true);
    expect(Array.isArray(r.data ?? [])).toBe(true);
  });

  it("activities.get resuelve un activityId real y trae sus mensajes", async () => {
    const lista = await client.activities.list(envId, { limit: 1 });
    const primera = (lista.data ?? [])[0];
    // Sin datos el test falla, no se salta: un e2e verde tiene que significar
    // que la tool funciona, no que no habia nada que probar.
    expect(primera).toBeDefined();

    const detalle = await client.activities.get(envId, primera.id);
    expect(detalle.data.activity.id).toBe(primera.id);
    expect(detalle.data).toHaveProperty("messages");
  });

  it("activities.cancel sobre una activity terminada devuelve un ActionResponse", async () => {
    // Sujeto: una activity ya terminada, donde cancelar es un no-op controlado.
    // Cancelar una en curso no es determinista (terminan en segundos), asi que
    // lo que se verifica aqui es que la ruta EXISTE y responde con la forma
    // esperada: si el endpoint no existiera, request() lanzaria ArcaneApiError.
    // Las dos ramas de veredicto (exito y success:false) las cubre el unitario.
    const lista = await client.activities.list(envId, { limit: 1, status: "success" });
    const terminada = (lista.data ?? [])[0];
    expect(terminada).toBeDefined();

    const r = await client.activities.cancel(envId, terminada.id, "e2e");
    expect(r).toHaveProperty("success");
    expect(r).toHaveProperty("message");
    expect(typeof r.success).toBe("boolean");
  });

  it("events.list global devuelve eventos", async () => {
    const r = await client.events.list({ limit: 5 });
    expect(r.success).toBe(true);
  });

  it("events.list filtrado por entorno usa la ruta por entorno", async () => {
    const r = await client.events.list({ environmentId: envId, limit: 5 });
    expect(r.success).toBe(true);
  });

  it("events.stats devuelve los cinco recuentos", async () => {
    const r = await client.events.stats();
    expect(r.data).toHaveProperty("total");
    expect(r.data).toHaveProperty("error");
    expect(typeof r.data.total).toBe("number");
  });

  it("jobs.list devuelve el sobre {jobs}, no el paginado", async () => {
    const r = await client.jobs.list(envId);
    expect(Array.isArray(r.jobs ?? [])).toBe(true);
    expect(r).not.toHaveProperty("pagination");
    expect((r.jobs ?? []).length).toBeGreaterThan(0);
  });

  it("jobs.run sobre un job con prerequisitos sin cumplir no llega a actuar", async () => {
    const lista = await client.jobs.list(envId);
    const inocuo = (lista.jobs ?? []).find(
      (j) => j.canRunManually && (j.prerequisites ?? []).some((p) => !p.isMet),
    );
    // Si no hay candidato inocuo el test falla: significa que la premisa de
    // seguridad del e2e ya no se cumple y hay que revisarla, no ignorarla.
    expect(inocuo).toBeDefined();

    const r = await client.jobs.run(envId, inocuo!.id);
    expect(r).toHaveProperty("message");
    expect(typeof r.success).toBe("boolean");
  });

  it("jobs.updateSchedules reescribe los mismos valores (escritura identidad)", async () => {
    const antes = await client.jobs.getSchedules(envId);
    const r = await client.jobs.updateSchedules(envId, { autoHealInterval: antes.autoHealInterval });
    expect(r.success).not.toBe(false);

    const despues = await client.jobs.getSchedules(envId);
    expect(despues.autoHealInterval).toBe(antes.autoHealInterval);
  });

  it("system.dockerInfo devuelve datos del demonio", async () => {
    const r = await client.system.dockerInfo(envId);
    expect(typeof r.ServerVersion).toBe("string");
    expect(typeof r.Containers).toBe("number");
  });

  it("system.health responde sano", async () => {
    const r = await client.system.health(envId);
    expect(r.ok).toBe(true);
    expect(r.status).toBe(200);
  });

  it("system.prune poda SOLO la cache de build", async () => {
    // Unico recurso admitido en e2e. Nunca images, volumes ni containers.
    const r = await client.system.prune(envId, { buildCache: { mode: "dangling" } });
    expect(r.data.success).toBe(true);
    expect(r.data.imagesDeleted ?? []).toEqual([]);
    expect(r.data.volumesDeleted ?? []).toEqual([]);
    expect(r.data.containersPruned ?? []).toEqual([]);
  });

  it("system.convert traduce un docker run a compose", async () => {
    const r = await client.system.convert(envId, "docker run -d --name web -p 8080:80 nginx:alpine");
    expect(r.success).toBe(true);
    expect(r.dockerCompose).toContain("nginx:alpine");
    expect(r.serviceName.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Ejecutar los e2e**

```bash
set -a; . ./.dev.vars; set +a
ARCANE_BASE_URL=http://192.168.180.210:3552 npm run test:e2e
```

Expected: `Test Files 3 passed (3)`, `Tests 19 passed (19)` (6 previos + 13 nuevos)

Si aparece `ECONNREFUSED`, es la red intermitente: reintenta antes de diagnosticar. Si un fichero sale como `skipped`, es que abortó al importar por el corte de red — vuelve a lanzarlo con `--reporter=verbose` para distinguirlo de un salto real.

- [ ] **Step 3: Commit**

```bash
git add src/__e2e__/observabilidad.e2e.ts
git commit -m "test(e2e): verificar los cuatro dominios de F2 contra la instancia real

Las mutantes usan sujeto inocuo: prune solo buildCache, updateSchedules
reescribe los mismos valores leidos, y jobs.run elige un job con prerequisitos
sin cumplir."
```

---

### Task 7: Cierre de la fase

**Files:**
- Create: `docs/balances/2026-08-16-f2.md`
- Modify: `docs/README.md`

- [ ] **Step 1: Verificación completa**

```bash
npm test
npm run type-check
npm run gen-tools-table -- --check
node scripts/audit-schema-drift.mjs | tail -3
set -a; . ./.dev.vars; set +a
ARCANE_BASE_URL=http://192.168.180.210:3552 npm run test:e2e
```

Expected: suite unitaria en verde; `tsc` sin salida; `OK: la tabla del README.md está al día (81 tools).`; auditoría con **0 hallazgos graves**; e2e `19 passed`.

- [ ] **Step 2: Medir la cobertura real alcanzada**

No copiar la cifra del spec: medirla. Contar las combinaciones método+ruta que usa el cliente y contrastarlas contra `openapi.txt`, extrayendo los pares con el compilador de TypeScript (no con expresiones regulares: las plantillas del cliente llevan backticks anidados dentro de las interpolaciones y una regex los parte mal).

Expected: 77 de 347 operaciones, 0 ausentes en el spec.

- [ ] **Step 3: Escribir el balance de la fase**

Crear `docs/balances/2026-08-16-f2.md` con: qué se entregó, qué apareció y no estaba en el plan, las cifras **medidas** (tests, tools, cobertura, drift), y lo que queda pendiente. Añadir su enlace a `docs/README.md`.

- [ ] **Step 4: Actualizar el bloque de cifras del README**

`README.md` publica en su cabecera el número de tools, de tests y de rutas verificadas. Actualizarlo con lo medido en el Step 2. Estas cifras ya se han quedado obsoletas dos veces en este proyecto.

- [ ] **Step 5: Commit y merge**

```bash
git add docs/ README.md
git commit -m "docs(balance): cerrar F2 con las cifras medidas"
git checkout main
git merge --no-ff feat/f2-observabilidad -m "merge: F2 - observabilidad y nucleo del host"
git push origin main && git push github main
```

- [ ] **Step 6: Verificar el despliegue automático**

Tras el push, GitOps sincroniza y redespliega solo (intervalo de 5 minutos). Comprobar **dentro del contenedor**, no por el estado del sync:

```bash
ssh VM-Control 'docker exec arcane-mcp-server sh -c "grep -c arcane_activity_get /app/src/tools/activities.ts"'
```

Expected: `1` o más. Si da `0`, el sync aún no había llegado cuando se reconstruyó.

---

## Self-Review

**Cobertura del spec:** las 13 tools de las secciones 3.1–3.4 están en las tareas 2–5; `requestHead()` (4.1) en la Task 1; los tipos y el `MAP` (4.2) en la Task 1; el registro en `index.ts` (4.3) en las tareas 2–4; las reglas heredadas (4.4) están en Global Constraints y aplicadas en el código de cada tool; la tabla de verificación (5) es la Task 6; los criterios de aceptación (6) son la Task 7.

**Desviación consciente respecto al spec:** la sección 4.2 del spec lista 9 tipos para el `MAP`; el plan mete 10, porque `ActivityMessage` también es un payload auditable y excluirlo dejaría un hueco. `JobListResponse`, `JobSchedulesUpdate`, `SystemPruneRequest` y `ActivityStartedBy` se declaran pero **no** entran en el `MAP`: los tres primeros son sobres o cuerpos de petición que construimos nosotros, y ese es justo el criterio que ya excluye a los `*Create`/`*Update` de la auditoría.

**Cuentas comprobadas:** 68 tools de partida + 3 + 2 + 4 + 4 = **81**. Tests unitarios:
111 + 2 (`requestHead`) + 3 + 3 (activities) + 3 + 2 (events) + 4 + 4 (jobs) + 4 + 6 (system)
= **142**. E2E: 6 + 13 = **19**. Operaciones cubiertas: 63 + 14 = **77**.
