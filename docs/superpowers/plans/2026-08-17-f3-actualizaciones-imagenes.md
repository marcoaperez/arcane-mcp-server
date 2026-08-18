# F3 — Actualizaciones de imágenes — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un modelo pueda responder «qué está desactualizado y qué se rompería si lo actualizo», y aplicar una actualización acotada a recursos concretos.

**Architecture:** Dos ficheros de tools nuevos (`image-updates.ts`, `updater.ts`) sobre dos clases de métodos nuevas del cliente. Se reutilizan los helpers existentes `withErrors`, `textResponse` y `listResponse`. La única tool mutante exige el objetivo y se verifica con `dryRun`. Se cierran además tres deudas que F2 difirió a esta fase.

**Tech Stack:** TypeScript `strict`, Zod, `@modelcontextprotocol/sdk`, Vitest, Bun. Instancia real de Arcane 2.8.0 en `http://192.168.180.210:3552`, entorno `0`.

## Global Constraints

- **`openapi.txt` es la fuente de verdad, por encima de este plan.** Antes de escribir un tipo o un parámetro, verifícalo contra el spec. En F2 el plan falló cinco veces en fidelidad y las cinco las cazó la revisión.
- **Ninguna cifra publicada puede venir de un documento.** Solo de un comando ejecutado. Esto incluye las cifras de este plan, que son previsiones.
- **Regla dura:** ningún cambio de comportamiento se cierra sin test unitario con `fetch` mockeado **y** comprobación e2e contra la instancia real.
- **`toHaveBeenCalledWith` iguala clave ausente y clave `undefined`.** Una aserción que enumere `sort: undefined` no comprueba nada. Invoca siempre con valores reales lo que digas comprobar.
- **Commits firmados, siempre en rama.** Nunca `--no-gpg-sign`. Si `git commit` falla con `failed to fill whole buffer`, el gestor de credenciales se ha bloqueado: para y reporta BLOCKED.
- **`scripts/gen-tools-table.mjs` aborta** ante ficheros de `src/tools/` no registrados en `GROUPS` (tools) o en `NON_TOOL_FILES` (helpers).
- **e2e:** `set -a; . ./.dev.vars; set +a` y `ARCANE_BASE_URL=http://192.168.180.210:3552 npm run test:e2e -- --reporter=verbose`. Cuenta las líneas `✓` a mano: un fichero que aborta al importar sale como `skipped`, y `skipped` no es verde.
- **La red va por Tailscale y tira entre un 10% y un 30% de las conexiones**, en cualquier puerto. Un fallo aislado no significa nada: reintenta antes de concluir. Pueden hacer falta 9 corridas para una e2e limpia.
- **El constructor es `ArcaneApiError(status: number, message: string)`**, en ese orden.

**Línea base medida el 2026-08-17 sobre `193c602`:** 231 tests unitarios (5 ficheros), 36 e2e (5 ficheros), 81 tools, `type-check` limpio, drift 23 desalineaciones y **0 graves**.

**Rama de trabajo:** `feat/f3-actualizaciones-imagenes` (ya existe, con el spec commiteado).

---

## Estructura de ficheros

| Fichero | Responsabilidad | Tarea |
|---|---|---|
| `src/arcane-client.ts` | **Modificar.** 9 tipos nuevos, 2 campos diferidos, `ImageUpdatesMethods`, `UpdaterMethods`, el filtro `updates` | 1, 2, 3, 4 |
| `scripts/audit-schema-drift.mjs` | **Modificar.** `MAP` con los 9 tipos | 1 |
| `src/__e2e__/actualizaciones.e2e.ts` | **Crear.** Invariantes contra la instancia real | 5 |
| `src/tools/image-updates.ts` | **Crear.** 4 tools de estado de actualizaciones | 6 |
| `src/tools/updater.ts` | **Crear.** 3 tools de aplicación, con la heurística de truncamiento | 7 |
| `src/tools/{images,containers,stacks}.ts` | **Modificar.** El parámetro `updates` | 8 |
| `scripts/gen-tools-table.mjs` | **Modificar.** `GROUPS` con los dos ficheros nuevos | 6, 7 |
| `src/index.ts` | **Modificar.** Registrar las dos funciones nuevas | 6, 7 |
| `README.md`, `docs/balances/` | **Modificar/crear.** Cifras medidas y balance | 9 |

---

### Task 1: tipos, campos diferidos y auditoría de drift

**Files:**
- Modify: `src/arcane-client.ts` (zona de tipos; `ImageSummary` y `Project`)
- Modify: `scripts/audit-schema-drift.mjs` (el `MAP`)

**Interfaces:**
- Produces: `ImageUpdateResponse`, `ImageUpdateInfo`, `ImageUpdateSummary`, `ImageUsedBy`, `ProjectUpdateInfo`, `UpdaterResult`, `UpdaterResourceResult`, `UpdaterStatus`, `AutoUpdateRecord`; y los campos `ImageSummary.usedBy`, `Project.updateInfo`.

**Verificación previa obligatoria.** Antes de escribir una línea de TypeScript, vuelca los nueve schemas y compáralos campo a campo:

```bash
node -e "
const s=JSON.parse(require('fs').readFileSync('openapi.txt','utf8'));
const tipo=p=>{ if(p.\$ref) return p.\$ref.split('/').pop();
  const t=Array.isArray(p.type)?p.type.join('|'):p.type;
  if(t&&t.includes('array')) return (p.items?.\$ref?p.items.\$ref.split('/').pop():p.items?.type)+'[]'+(t.includes('null')?'|null':'');
  return t; };
for(const n of ['ImageupdateResponse','ImageUpdateInfo','ImageupdateSummary','ImageUsedBy','ProjectUpdateInfo','UpdaterResult','UpdaterResourceResult','UpdaterStatus','AutoUpdateRecord']){
  const x=s.components.schemas[n]; const req=new Set(x.required||[]);
  console.log('=== '+n+' ===');
  for(const [k,v] of Object.entries(x.properties||{})){ if(k==='\$schema')continue;
    console.log('  '+k+(req.has(k)?'':'?')+': '+tipo(v)); }
}"
```

**Lo que el spec liste en `required` va SIN `?`.** Ojo a dos trampas medidas: `ImageupdateResponse` e `ImageUpdateInfo` tienen los mismos campos pero **distinta opcionalidad** (`currentDigest`, `latestDigest`, `latestVersion` y `error` son obligatorios solo en el segundo); y `ImageUsedBy.id` es opcional mientras `name` y `type` no lo son.

- [ ] **Step 1: Añadir los nueve tipos en `src/arcane-client.ts`**

Junto al resto de tipos de payload:

```ts
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
  newImages?: Record<string, unknown>;
  oldImages?: Record<string, unknown>;
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
```

- [ ] **Step 2: Añadir los dos campos diferidos**

En `ImageSummary`, añadir:

```ts
  /**
   * Que usa esta imagen. La instancia ya lo devolvia y el tipo lo descartaba:
   * era una de las desalineaciones FALTA-EN-TS-OPCIONAL de la auditoria.
   * Es lo que separa "esta imagen tiene actualizacion" de "actualizarla
   * reinicia el proyecto arcane-mcp".
   */
  usedBy?: ImageUsedBy[] | null;
```

En `Project`, añadir:

```ts
  /** Estado de actualizacion del proyecto (spec: ProjectDetails.updateInfo). */
  updateInfo?: ProjectUpdateInfo;
```

- [ ] **Step 3: Registrar los nueve tipos en la auditoría de drift**

En `scripts/audit-schema-drift.mjs`, dentro del `MAP`:

```js
  ImageUpdateResponse: "ImageupdateResponse",
  ImageUpdateInfo: "ImageUpdateInfo",
  ImageUpdateSummary: "ImageupdateSummary",
  ImageUsedBy: "ImageUsedBy",
  ProjectUpdateInfo: "ProjectUpdateInfo",
  UpdaterResult: "UpdaterResult",
  UpdaterResourceResult: "UpdaterResourceResult",
  UpdaterStatus: "UpdaterStatus",
  AutoUpdateRecord: "AutoUpdateRecord",
```

**Ojo a los nombres del spec:** tres de ellos usan minúscula interna (`Imageupdate…`), y no coinciden con el nombre de la interfaz TS. Un emparejamiento cruzado entre dos schemas de forma parecida pasaría la auditoría en silencio.

- [ ] **Step 4: Ejecutar la auditoría — es la que verifica que los tipos son fieles**

```bash
node scripts/audit-schema-drift.mjs
```

Esperado: **0 hallazgos graves**, y el total de desalineaciones **BAJA de 23**, porque `usedBy` y `updateInfo` dejan de faltar. Si no baja, los campos no se añadieron donde tocaba. Si aparece un hallazgo grave sobre los tipos nuevos, están mal copiados: corrígelos contra `openapi.txt`, no contra este plan.

- [ ] **Step 5: Comprobar que nada se ha roto**

```bash
npm run type-check
npm test
```

Esperado: `type-check` sin salida; **231 passed** — esta tarea no añade tests, porque quien verifica la fidelidad es la auditoría.

- [ ] **Step 6: Commit**

```bash
git add src/arcane-client.ts scripts/audit-schema-drift.mjs
git commit -m "feat(client): tipos de actualizaciones y los dos campos diferidos de F2

Nueve tipos nuevos bajo auditoria de drift, y se cierran ImageSummary.usedBy y
Project.updateInfo, diferidos a proposito desde F2. usedBy ya lo devolvia la
instancia y el tipo lo tiraba.

ImageUpdateResponse e ImageUpdateInfo NO se unifican: el spec les da distinta
opcionalidad en currentDigest, latestDigest, latestVersion y error.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: cliente — `ImageUpdatesMethods`

**Files:**
- Modify: `src/arcane-client.ts` (clase nueva + registro en `ArcaneClient`)
- Modify: `src/__tests__/arcane-client.test.ts`

**Interfaces:**
- Consumes: los tipos de la Task 1; `appendListParams` no aplica aquí (ninguno de estos endpoints pagina).
- Produces:
  - `summary(envId): Promise<{ success: boolean; data: ImageUpdateSummary }>`
  - `byRefs(envId, imageRefs: string[]): Promise<{ success: boolean; data: Record<string, ImageUpdateInfo> }>`
  - `check(envId, opts: { imageRef?: string; imageId?: string }): Promise<{ success: boolean; data: ImageUpdateResponse }>`
  - `checkBatch(envId, imageRefs: string[]): Promise<{ success: boolean; data: Record<string, ImageUpdateResponse> }>`
  - `client.imageUpdates` en `ArcaneClient`

**Nota sobre `byRefs`:** el spec declara `imageRefs` como **una cadena separada por comas**, no como parámetro repetido. El método recibe un array y lo une con comas.

- [ ] **Step 1: Escribir los tests, que fallan**

Añadir a `src/__tests__/arcane-client.test.ts`, dentro del `describe("ArcaneClient", ...)`:

```ts
  describe("ImageUpdatesMethods", () => {
    const ok = (data: unknown) =>
      ({ ok: true, json: async () => ({ success: true, data }) }) as Response;

    it("summary(envId) - GET /environments/{envId}/image-updates/summary", async () => {
      mockFetch.mockResolvedValue(ok({ totalImages: 18, imagesWithUpdates: 4, digestUpdates: 4, errorsCount: 2 }));
      const r = await client.imageUpdates.summary("env1");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/image-updates/summary",
        expect.objectContaining({ method: "GET" }),
      );
      expect(r.data.imagesWithUpdates).toBe(4);
    });

    it("byRefs(envId, refs) une las referencias con comas en un solo parametro", async () => {
      mockFetch.mockResolvedValue(ok({}));
      await client.imageUpdates.byRefs("env1", ["nginx:latest", "redis:7"]);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/image-updates/by-refs?imageRefs=nginx%3Alatest%2Credis%3A7",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("check(envId, {imageRef}) usa el endpoint por referencia", async () => {
      mockFetch.mockResolvedValue(ok({ checkTime: "t", currentVersion: "1", hasUpdate: true, responseTimeMs: 5, updateType: "digest" }));
      await client.imageUpdates.check("env1", { imageRef: "nginx:latest" });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/image-updates/check?imageRef=nginx%3Alatest",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("check(envId, {imageId}) usa el endpoint por ID", async () => {
      mockFetch.mockResolvedValue(ok({ checkTime: "t", currentVersion: "1", hasUpdate: false, responseTimeMs: 5, updateType: "digest" }));
      await client.imageUpdates.check("env1", { imageId: "sha256:abc" });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/image-updates/check/sha256%3Aabc",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("check(envId, {}) sin referencia ni ID lanza sin llamar a la API", async () => {
      await expect(client.imageUpdates.check("env1", {})).rejects.toThrow(/imageRef o imageId/);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("checkBatch(envId, refs) manda la lista en el cuerpo", async () => {
      mockFetch.mockResolvedValue(ok({}));
      await client.imageUpdates.checkBatch("env1", ["nginx:latest"]);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/image-updates/check-batch",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ imageRefs: ["nginx:latest"] }) }),
      );
    });
  });
```

- [ ] **Step 2: Ejecutar los tests y comprobar que fallan**

```bash
npx vitest run src/__tests__/arcane-client.test.ts -t "ImageUpdatesMethods"
```

Esperado: FAIL — `client.imageUpdates` no existe.

- [ ] **Step 3: Implementar la clase**

En `src/arcane-client.ts`, junto al resto de clases de métodos:

```ts
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
        `${base}/check/${encodeURIComponent(opts.imageId)}`
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
```

- [ ] **Step 4: Registrar `imageUpdates` en `ArcaneClient`**

Junto a las demás propiedades `readonly` (sobre la línea 1583) y su inicialización en el constructor, siguiendo el patrón exacto de `jobs` o `activities`.

- [ ] **Step 5: Ejecutar los tests**

```bash
npx vitest run src/__tests__/arcane-client.test.ts -t "ImageUpdatesMethods"
npm test
npm run type-check
```

Esperado: los 6 nuevos PASS; **237 passed**; `type-check` limpio.

- [ ] **Step 6: Commit**

```bash
git add src/arcane-client.ts src/__tests__/arcane-client.test.ts
git commit -m "feat(client): ImageUpdatesMethods

summary y byRefs leen informacion persistida sin tocar los registros; check y
checkBatch consultan en vivo. check acepta referencia o ID y lanza si no recibe
ninguna de las dos, antes de llamar a la API.

check-all queda fuera a proposito: es el barrido masivo, y ya lo hace el job
horario image-polling.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: cliente — `UpdaterMethods`, con la puerta de `dryRun`

**Files:**
- Modify: `src/arcane-client.ts`
- Modify: `src/__tests__/arcane-client.test.ts`

**Interfaces:**
- Produces:
  - `status(envId): Promise<{ success: boolean; data: UpdaterStatus }>`
  - `history(envId, limit?: number): Promise<{ success: boolean; data: AutoUpdateRecord[] | null }>`
  - `run(envId, opts: { resourceIds: string[]; type?: string; dryRun?: boolean; forceUpdate?: boolean }): Promise<{ success: boolean; data: UpdaterResult }>`
  - `client.updater` en `ArcaneClient`

**`resourceIds` es obligatorio en la firma del método**, aunque `UpdaterOptions` lo declare opcional. La restricción vive en el cliente y se refuerza en la tool.

- [ ] **Step 1 (PUERTA): comprobar que `dryRun` no muta, ANTES de escribir código**

Todo el diseño de la tool mutante se apoya en que `dryRun: true` permite un e2e real sin efectos. **Si esto falla, para y reporta: hay que replantear, no seguir.**

```bash
set -a; . ./.dev.vars; set +a
B=http://192.168.180.210:3552/api
# 1) Estado ANTES: imagen y momento de arranque de un contenedor concreto
curl -s -H "X-API-Key: $ARCANE_API_KEY" "$B/environments/0/containers?limit=200" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);
const c=(j.data||[]).find(x=>(x.names||[]).some(n=>n.includes('arcane-mcp')));
console.log('ANTES id='+c.id.slice(0,12)+' image='+c.image+' created='+c.created);})"

# 2) dryRun sobre ESE contenedor
curl -s -X POST -H "X-API-Key: $ARCANE_API_KEY" -H "Content-Type: application/json" \
  -d '{"resourceIds":["<id-del-paso-1>"],"type":"container","dryRun":true}' \
  "$B/environments/0/updater/run"

# 3) Estado DESPUES: repetir el comando del paso 1
```

Esperado: `image` y `created` **idénticos** antes y después, y ningún reinicio. Si `created` cambia, `dryRun` sí actúa: **BLOCKED**.

- [ ] **Step 2: Escribir los tests, que fallan**

```ts
  describe("UpdaterMethods", () => {
    const ok = (data: unknown) =>
      ({ ok: true, json: async () => ({ success: true, data }) }) as Response;

    it("status(envId) - GET /environments/{envId}/updater/status", async () => {
      mockFetch.mockResolvedValue(ok({ updatingContainers: 0, updatingProjects: 0, containerIds: [], projectIds: [] }));
      await client.updater.status("env1");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/updater/status",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("history(envId, limit) envia el limit", async () => {
      mockFetch.mockResolvedValue(ok([]));
      await client.updater.history("env1", 10);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/updater/history?limit=10",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("history(envId) sin limit no anade query string", async () => {
      mockFetch.mockResolvedValue(ok([]));
      await client.updater.history("env1");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/updater/history",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("run(envId, opts) manda resourceIds, type y dryRun en el cuerpo", async () => {
      mockFetch.mockResolvedValue(ok({ checked: 1, updated: 0, skipped: 1, failed: 0, duration: "1s", items: [] }));
      await client.updater.run("env1", { resourceIds: ["c1"], type: "container", dryRun: true });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/updater/run",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ resourceIds: ["c1"], type: "container", dryRun: true }),
        }),
      );
    });

    it("run(envId, {resourceIds: []}) lanza sin llamar a la API", async () => {
      await expect(client.updater.run("env1", { resourceIds: [] })).rejects.toThrow(/resourceIds/);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
```

- [ ] **Step 3: Ejecutar los tests y comprobar que fallan**

```bash
npx vitest run src/__tests__/arcane-client.test.ts -t "UpdaterMethods"
```

Esperado: FAIL — `client.updater` no existe.

- [ ] **Step 4: Implementar la clase**

```ts
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
```

- [ ] **Step 5: Registrar `updater` en `ArcaneClient`** siguiendo el patrón de las demás.

- [ ] **Step 6: Ejecutar los tests**

```bash
npx vitest run src/__tests__/arcane-client.test.ts -t "UpdaterMethods"
npm test
npm run type-check
```

Esperado: los 5 nuevos PASS; **242 passed**; `type-check` limpio.

- [ ] **Step 7: Commit**

```bash
git add src/arcane-client.ts src/__tests__/arcane-client.test.ts
git commit -m "feat(client): UpdaterMethods con resourceIds obligatorio

run() exige al menos un resourceId aunque UpdaterOptions lo declare opcional:
sin el, una llamada actualizaria y reiniciaria todo el entorno, incluido el
contenedor que atiende la peticion.

Verificado antes de implementar que dryRun no muta nada.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: cliente — el filtro `updates`

**Files:**
- Modify: `src/arcane-client.ts` (`ContainerListOptions`, `ImageListOptions`, `ProjectListOptions` y sus tres `list()`)
- Modify: `src/__tests__/arcane-client.test.ts`

**Verificación previa obligatoria.** Los valores admitidos difieren por endpoint:

```bash
node -e "
const s=JSON.parse(require('fs').readFileSync('openapi.txt','utf8'));
for (const p of ['/environments/{id}/containers','/environments/{id}/images','/environments/{id}/projects'])
  for (const x of (s.paths[p].get.parameters||[]))
    if (x.name==='updates') console.log(p, '->', x.schema.type, '|', x.description);
"
```

Esperado: los tres de tipo `string`; containers y projects con `has_update, up_to_date, error, unknown`; images con `true/false`.

- [ ] **Step 1: Escribir los tests, que fallan**

```ts
  describe("El filtro updates", () => {
    const okVacio = () =>
      ({ ok: true, json: async () => ({ success: true, data: [], counts: {}, pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 20 } }) }) as Response;

    it("containers.list envia updates", async () => {
      mockFetch.mockResolvedValue(okVacio());
      await client.containers.list("env1", { updates: "has_update" });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/containers?updates=has_update",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("images.list envia updates junto a los demas filtros", async () => {
      mockFetch.mockResolvedValue(okVacio());
      await client.images.list("env1", { inUse: "true", updates: "true" });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/images?inUse=true&updates=true",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("stacks.list envia updates", async () => {
      mockFetch.mockResolvedValue(okVacio());
      await client.stacks.list("env1", { updates: "up_to_date" });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/projects?updates=up_to_date",
        expect.objectContaining({ method: "GET" }),
      );
    });
  });
```

- [ ] **Step 2: Ejecutar y comprobar que fallan**

```bash
npx vitest run src/__tests__/arcane-client.test.ts -t "El filtro updates"
```

Esperado: FAIL — las URLs llegan sin `updates`.

- [ ] **Step 3: Añadir el campo a los tres tipos de opciones**

```ts
// En ContainerListOptions y ProjectListOptions:
  /** has_update | up_to_date | error | unknown */
  updates?: string;

// En ImageListOptions:
  /** "true" | "false" — en images es booleano expresado como cadena, no el enumerado de los otros */
  updates?: string;
```

- [ ] **Step 4: Enviarlo en los tres métodos `list()`**

En cada uno, junto a los demás filtros propios y **después** de `appendListParams`:

```ts
    if (opts?.updates) params.set("updates", opts.updates);
```

**Ojo al orden:** los tests asertan la URL exacta. En `images.list` va después de `inUse`; en `containers.list`, después de `includeInternal` y `standalone`; en `stacks.list`, después de `status`, `archived` y `tags`. Comprueba el orden real del código antes de insertarlo, y ajusta los tests si el orden natural difiere del que asertan.

- [ ] **Step 5: Ejecutar los tests**

```bash
npx vitest run src/__tests__/arcane-client.test.ts -t "El filtro updates"
npm test
npm run type-check
```

Esperado: los 3 nuevos PASS; **245 passed**; `type-check` limpio.

- [ ] **Step 6: Commit**

```bash
git add src/arcane-client.ts src/__tests__/arcane-client.test.ts
git commit -m "feat(client): filtro updates en containers, images y projects

Diferido a proposito desde F2. La asimetria es del spec y se respeta: en
containers y projects es un enumerado (has_update, up_to_date, error, unknown);
en images, un booleano expresado como cadena.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: e2e del cliente contra la instancia real

**Files:**
- Create: `src/__e2e__/actualizaciones.e2e.ts`

**Interfaces:**
- Consumes: `e2eClient()` de `./helpers`; los métodos de las tareas 2, 3 y 4.

**Por qué aquí:** verifica el cliente contra la API real **antes** de construir siete tools encima.

**Todo es lectura salvo un `dryRun`**, que la Task 3 ya comprobó que no muta.

- [ ] **Step 1: Crear el fichero**

```ts
import { describe, it, expect } from "vitest";
import { e2eClient } from "./helpers";

/**
 * Invariantes de las actualizaciones de imagenes contra la instancia real.
 *
 * Sin cifras clavadas: la instancia cambia. Se afirman relaciones que siguen
 * siendo verdad con 18 imagenes o con 300.
 */
describe("actualizaciones (e2e, Arcane 2.8.0)", () => {
  const client = e2eClient();
  const envId = "0";

  it("summary devuelve recuentos coherentes entre si", async () => {
    const r = await client.imageUpdates.summary(envId);
    expect(r.success).toBe(true);
    expect(r.data.totalImages).toBeGreaterThan(0);
    expect(r.data.imagesWithUpdates).toBeLessThanOrEqual(r.data.totalImages);
    expect(r.data.digestUpdates).toBeLessThanOrEqual(r.data.imagesWithUpdates);
  });

  it("el filtro updates cuadra con el recuento del summary", async () => {
    // Cruza la mitad nueva de la fase con la enriquecida: si una de las dos
    // miente, este test lo ve y los tests aislados no.
    const resumen = await client.imageUpdates.summary(envId);
    const conUpdate = await client.images.list(envId, { updates: "true", limit: 500 });
    expect(conUpdate.pagination.totalItems).toBe(resumen.data.imagesWithUpdates);
  });

  it("images.list devuelve usedBy, el campo que estaba diferido", async () => {
    const r = await client.images.list(envId, { limit: 200 });
    const enUso = (r.data ?? []).find((i) => i.inUse);
    expect(enUso).toBeDefined();
    expect(Array.isArray(enUso!.usedBy ?? [])).toBe(true);
    expect((enUso!.usedBy ?? []).length).toBeGreaterThan(0);
    expect(typeof enUso!.usedBy![0].type).toBe("string");
    expect(typeof enUso!.usedBy![0].name).toBe("string");
  });

  it("byRefs devuelve informacion persistida de las referencias pedidas", async () => {
    const imgs = await client.images.list(envId, { limit: 5 });
    const refs = (imgs.data ?? []).flatMap((i) => i.repoTags ?? []).slice(0, 2);
    expect(refs.length).toBeGreaterThan(0);

    const r = await client.imageUpdates.byRefs(envId, refs);
    expect(r.success).toBe(true);
    expect(typeof r.data).toBe("object");
    expect(Array.isArray(r.data)).toBe(false); // es un mapa, no un array
  });

  it("check en vivo responde para una imagen de un registro publico", async () => {
    // NO se usa ghcr.io/getarcaneapp/arcane: esta observado que devuelve
    // toomanyrequests de forma intermitente. Un fallo aqui debe significar que
    // la tool esta rota, no que el registro estaba limitando.
    const r = await client.imageUpdates.check(envId, { imageRef: "gitea/gitea:1.25.5" });
    expect(r.success).toBe(true);
    expect(typeof r.data.hasUpdate).toBe("boolean");
    expect(typeof r.data.updateType).toBe("string");
  });

  it("updater.status responde con los recuentos y sus listas", async () => {
    const r = await client.updater.status(envId);
    expect(r.success).toBe(true);
    expect(r.data.updatingContainers).toBe((r.data.containerIds ?? []).length);
    expect(r.data.updatingProjects).toBe((r.data.projectIds ?? []).length);
  });

  it("updater.history respeta el limit, que es el unico control que ofrece", async () => {
    const uno = await client.updater.history(envId, 1);
    expect((uno.data ?? []).length).toBeLessThanOrEqual(1);
  });

  it("updater.run exige resourceIds y no llega a llamar a la API sin ellos", async () => {
    await expect(client.updater.run(envId, { resourceIds: [] })).rejects.toThrow(/resourceIds/);
  });
});
```

- [ ] **Step 2: Ejecutar y contar a mano**

```bash
set -a; . ./.dev.vars; set +a
ARCANE_BASE_URL=http://192.168.180.210:3552 npm run test:e2e -- --reporter=verbose
```

Esperado: **44 passed** (36 de partida + 8 nuevos), **0 skipped**. Cuenta las líneas `✓` una a una. La red es inestable: si algo falla con `ECONNREFUSED`, reintenta — pueden hacer falta varias corridas.

**Si el test del filtro `updates` falla con cifras que no cuadran, NO lo relajes:** significa que el filtro o el summary no dicen lo mismo, y eso es un hallazgo, no un test que ajustar.

- [ ] **Step 3: Commit**

```bash
git add src/__e2e__/actualizaciones.e2e.ts
git commit -m "test(e2e): invariantes de actualizaciones contra la instancia real

Incluye el cruce entre las dos mitades de la fase: el filtro updates=true debe
devolver tantas imagenes como imagesWithUpdates declara el summary.

El check en vivo evita deliberadamente ghcr.io/getarcaneapp/arcane, que devuelve
toomanyrequests de forma intermitente: un fallo ahi diria mas del registro que
de la tool.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: tools de `image-updates`

**Files:**
- Create: `src/tools/image-updates.ts`
- Modify: `src/index.ts`, `scripts/gen-tools-table.mjs` (`GROUPS`)
- Modify: `src/__tests__/tools.test.ts`

**Interfaces:**
- Consumes: `withErrors`, `textResponse` de `./respond`; `resolveEnvironmentId` de `./resolve`; `client.imageUpdates`.
- Produces: `registerImageUpdateTools(server, client)`.

**Estas cuatro tools no usan `listResponse`:** `summary` devuelve un objeto, y `byRefs`/`checkBatch` devuelven mapas. Nada de esto es una colección paginada.

- [ ] **Step 1: Escribir los tests, que fallan**

```ts
  describe("Tools de image-updates", () => {
    const clienteConUpdates = () => {
      const mockClient = createMockClient() as any;
      mockClient.imageUpdates = {
        summary: vi.fn().mockResolvedValue({ success: true, data: { totalImages: 18, imagesWithUpdates: 4, digestUpdates: 4, errorsCount: 2 } }),
        byRefs: vi.fn().mockResolvedValue({ success: true, data: {} }),
        check: vi.fn().mockResolvedValue({ success: true, data: { checkTime: "t", currentVersion: "1", hasUpdate: true, responseTimeMs: 5, updateType: "digest" } }),
        checkBatch: vi.fn().mockResolvedValue({ success: true, data: {} }),
      };
      return mockClient;
    };

    it("arcane_image_update_summary devuelve los recuentos", async () => {
      const mockClient = clienteConUpdates();
      const server = createMockServer();
      registerImageUpdateTools(server as any, mockClient);

      const result = await server.getHandler("arcane_image_update_summary")({ environmentId: "env1" });
      expect(JSON.parse(result.content[0].text).imagesWithUpdates).toBe(4);
    });

    it("arcane_image_update_status pasa las referencias como array al cliente", async () => {
      const mockClient = clienteConUpdates();
      const server = createMockServer();
      registerImageUpdateTools(server as any, mockClient);

      await server.getHandler("arcane_image_update_status")({ environmentId: "env1", imageRefs: "nginx:latest,redis:7" });
      expect(mockClient.imageUpdates.byRefs).toHaveBeenCalledWith("env1", ["nginx:latest", "redis:7"]);
    });

    it("arcane_image_update_check acepta imageRef", async () => {
      const mockClient = clienteConUpdates();
      const server = createMockServer();
      registerImageUpdateTools(server as any, mockClient);

      await server.getHandler("arcane_image_update_check")({ environmentId: "env1", imageRef: "nginx:latest" });
      expect(mockClient.imageUpdates.check).toHaveBeenCalledWith("env1", { imageRef: "nginx:latest", imageId: undefined });
    });

    it("arcane_image_update_check devuelve isError si el cliente falla", async () => {
      const mockClient = clienteConUpdates();
      mockClient.imageUpdates.check.mockRejectedValue(new ArcaneApiError(500, "registry down"));
      const server = createMockServer();
      registerImageUpdateTools(server as any, mockClient);

      const result = await server.getHandler("arcane_image_update_check")({ environmentId: "env1", imageRef: "nginx:latest" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("registry down");
    });

    it("arcane_image_update_check_batch parte la lista separada por comas", async () => {
      const mockClient = clienteConUpdates();
      const server = createMockServer();
      registerImageUpdateTools(server as any, mockClient);

      await server.getHandler("arcane_image_update_check_batch")({ environmentId: "env1", imageRefs: "a:1, b:2" });
      expect(mockClient.imageUpdates.checkBatch).toHaveBeenCalledWith("env1", ["a:1", "b:2"]);
    });
  });
```

Añade al principio del fichero el import `registerImageUpdateTools` de `../tools/image-updates`.

- [ ] **Step 2: Ejecutar y comprobar que fallan**

```bash
npx vitest run src/__tests__/tools.test.ts -t "Tools de image-updates"
```

Esperado: FAIL — el módulo no existe.

- [ ] **Step 3: Crear `src/tools/image-updates.ts`**

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArcaneClient } from "../arcane-client";
import { resolveEnvironmentId } from "./resolve";
import { withErrors, textResponse } from "./respond";

/** Parte una lista separada por comas, tolerando espacios alrededor. */
const partirRefs = (refs: string): string[] =>
  refs.split(",").map((r) => r.trim()).filter((r) => r.length > 0);

export function registerImageUpdateTools(server: McpServer, client: ArcaneClient): void {
  server.tool(
    "arcane_image_update_summary",
    "Get the aggregate image update counts for an environment: how many images there are, how many have updates available, and how many failed to check. Cheap: reads stored results, does not query any registry.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
    },
    withErrors(async ({ environmentId, environmentName }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.imageUpdates.summary(envId);
      return textResponse(JSON.stringify(result.data, null, 2));
    }),
  );

  server.tool(
    "arcane_image_update_status",
    "Get the STORED update information for specific image references. Does not query any registry, so it is fast and safe to call repeatedly. Use arcane_image_update_check instead when you need a fresh answer.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      imageRefs: z.string().describe("Image references, comma-separated, e.g. 'nginx:latest,redis:7'"),
    },
    withErrors(async ({ environmentId, environmentName, imageRefs }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.imageUpdates.byRefs(envId, partirRefs(imageRefs));
      return textResponse(JSON.stringify(result.data, null, 2));
    }),
  );

  server.tool(
    "arcane_image_update_check",
    "Check ONE image for updates by querying its registry LIVE. Slower than arcane_image_update_status and subject to registry rate limits, so prefer the stored status unless you need a fresh answer. Accepts an image reference or an image ID.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      imageRef: z.string().optional().describe("Image reference, e.g. 'nginx:latest'"),
      imageId: z.string().optional().describe("Image ID (alternative to imageRef)"),
    },
    withErrors(async ({ environmentId, environmentName, imageRef, imageId }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.imageUpdates.check(envId, { imageRef, imageId });
      return textResponse(JSON.stringify(result.data, null, 2));
    }),
  );

  server.tool(
    "arcane_image_update_check_batch",
    "Check a specific LIST of images for updates by querying their registries LIVE. Requires the list: checking every image at once is not exposed, because a scheduled job already does that sweep hourly.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      imageRefs: z.string().describe("Image references to check, comma-separated"),
    },
    withErrors(async ({ environmentId, environmentName, imageRefs }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.imageUpdates.checkBatch(envId, partirRefs(imageRefs));
      return textResponse(JSON.stringify(result.data, null, 2));
    }),
  );
}
```

- [ ] **Step 4: Registrar el fichero en los dos sitios**

En `src/index.ts`: el import y la llamada `registerImageUpdateTools(this.server, client);` junto a las demás.

En `scripts/gen-tools-table.mjs`, en `GROUPS`:

```js
  ["image-updates.ts", "Image updates"],
```

- [ ] **Step 5: Ejecutar y regenerar la tabla**

```bash
npx vitest run src/__tests__/tools.test.ts -t "Tools de image-updates"
npm test
npm run type-check
npm run gen-tools-table
npm run gen-tools-table -- --check
```

Esperado: los 5 nuevos PASS; **250 passed**; `type-check` limpio; y la tabla pasa a **85 tools**.

- [ ] **Step 6: Commit**

```bash
git add src/tools/image-updates.ts src/index.ts scripts/gen-tools-table.mjs src/__tests__/tools.test.ts README.md
git commit -m "feat(tools): cuatro tools de estado de actualizaciones de imagenes

Las descripciones distinguen explicitamente lo persistido de lo consultado en
vivo: un modelo que no sepa la diferencia consultara registros para responder
algo que ya estaba guardado, y los registros aplican limites de tasa.

check-all no se expone: el barrido masivo ya lo hace el job horario.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: tools de `updater`, con la heurística de truncamiento

**Files:**
- Create: `src/tools/updater.ts`
- Modify: `src/index.ts`, `scripts/gen-tools-table.mjs` (`GROUPS`)
- Modify: `src/__tests__/tools.test.ts`

**Interfaces:**
- Consumes: `withErrors`, `textResponse`; `resolveEnvironmentId`; `client.updater`.
- Produces: `registerUpdaterTools(server, client)`.

- [ ] **Step 1: Escribir los tests, que fallan**

```ts
  describe("Tools de updater", () => {
    const clienteConUpdater = () => {
      const mockClient = createMockClient() as any;
      mockClient.updater = {
        status: vi.fn().mockResolvedValue({ success: true, data: { updatingContainers: 0, updatingProjects: 0, containerIds: [], projectIds: [] } }),
        history: vi.fn().mockResolvedValue({ success: true, data: [] }),
        run: vi.fn().mockResolvedValue({ success: true, data: { checked: 1, updated: 0, skipped: 1, failed: 0, duration: "1s", items: [] } }),
      };
      return mockClient;
    };

    it("arcane_updater_history avisa cuando devuelve exactamente lo pedido", async () => {
      const mockClient = clienteConUpdater();
      mockClient.updater.history.mockResolvedValue({
        success: true,
        data: Array.from({ length: 5 }, (_, i) => ({ id: `r${i}` })),
      });
      const server = createMockServer();
      registerUpdaterTools(server as any, mockClient);

      const result = await server.getHandler("arcane_updater_history")({ environmentId: "env1", limit: 5 });
      const [primera] = result.content[0].text.split("\n");
      expect(primera).toBe(
        "This history may be truncated: exactly 5 records were requested and 5 were returned, and this endpoint reports no total. Raise limit to find out.",
      );
    });

    it("arcane_updater_history no avisa cuando devuelve menos de lo pedido", async () => {
      const mockClient = clienteConUpdater();
      mockClient.updater.history.mockResolvedValue({ success: true, data: [{ id: "r0" }] });
      const server = createMockServer();
      registerUpdaterTools(server as any, mockClient);

      const result = await server.getHandler("arcane_updater_history")({ environmentId: "env1", limit: 5 });
      expect(result.content[0].text.startsWith("[")).toBe(true);
      expect(result.content[0].text).not.toContain("may be truncated");
    });

    it("arcane_updater_history trata data:null como lista vacia, nunca el texto 'null'", async () => {
      const mockClient = clienteConUpdater();
      mockClient.updater.history.mockResolvedValue({ success: true, data: null });
      const server = createMockServer();
      registerUpdaterTools(server as any, mockClient);

      const result = await server.getHandler("arcane_updater_history")({ environmentId: "env1" });
      expect(JSON.parse(result.content[0].text)).toEqual([]);
    });

    it("arcane_updater_run parte resourceIds y pasa dryRun", async () => {
      const mockClient = clienteConUpdater();
      const server = createMockServer();
      registerUpdaterTools(server as any, mockClient);

      await server.getHandler("arcane_updater_run")({ environmentId: "env1", resourceIds: "c1, c2", type: "container", dryRun: true });
      expect(mockClient.updater.run).toHaveBeenCalledWith("env1", {
        resourceIds: ["c1", "c2"], type: "container", dryRun: true, forceUpdate: undefined,
      });
    });

    it("arcane_updater_run devuelve isError si el cliente rechaza por falta de objetivo", async () => {
      const mockClient = clienteConUpdater();
      mockClient.updater.run.mockRejectedValue(new Error("run() necesita al menos un elemento en resourceIds"));
      const server = createMockServer();
      registerUpdaterTools(server as any, mockClient);

      const result = await server.getHandler("arcane_updater_run")({ environmentId: "env1", resourceIds: "" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("resourceIds");
    });
  });
```

Añade el import `registerUpdaterTools` de `../tools/updater`.

- [ ] **Step 2: Ejecutar y comprobar que fallan**

```bash
npx vitest run src/__tests__/tools.test.ts -t "Tools de updater"
```

Esperado: FAIL — el módulo no existe.

- [ ] **Step 3: Crear `src/tools/updater.ts`**

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArcaneClient } from "../arcane-client";
import { resolveEnvironmentId } from "./resolve";
import { withErrors, textResponse } from "./respond";

/** Limit que aplica el servidor cuando no se pide ninguno. */
const LIMIT_POR_DEFECTO_DEL_SERVIDOR = 50;

const partirIds = (ids: string): string[] =>
  ids.split(",").map((s) => s.trim()).filter((s) => s.length > 0);

export function registerUpdaterTools(server: McpServer, client: ArcaneClient): void {
  server.tool(
    "arcane_updater_status",
    "Report which containers and projects are being updated right now.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
    },
    withErrors(async ({ environmentId, environmentName }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.updater.status(envId);
      return textResponse(JSON.stringify(result.data, null, 2));
    }),
  );

  server.tool(
    "arcane_updater_history",
    "List past automatic update runs. This endpoint reports no total count and cannot be paged, so the list may be incomplete: raise limit if you need to be sure you are seeing everything.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      limit: z.number().int().min(1).optional().describe("Number of entries to return (server default: 50)"),
    },
    withErrors(async ({ environmentId, environmentName, limit }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.updater.history(envId, limit);
      const registros = result.data ?? [];
      const texto = JSON.stringify(registros, null, 2);

      // Este endpoint devuelve un array pelado: ni total, ni start. Si sirve
      // exactamente tantos registros como se le pidieron, lo mas probable es que
      // haya mas. Se dice como sospecha y no como certeza, porque la API no
      // permite distinguirlo: prometer lo contrario seria el defecto que
      // arcane_volume_browse tenia al anunciar "the full file tree".
      const pedidos = limit ?? LIMIT_POR_DEFECTO_DEL_SERVIDOR;
      if (registros.length === pedidos) {
        return textResponse(
          `This history may be truncated: exactly ${pedidos} records were requested and ` +
            `${registros.length} were returned, and this endpoint reports no total. ` +
            `Raise limit to find out.\n${texto}`,
        );
      }
      return textResponse(texto);
    }),
  );

  server.tool(
    "arcane_updater_run",
    "Apply pending updates to SPECIFIC containers or projects, recreating them. You must name the targets: updating everything at once is deliberately not available. Pass dryRun to see what would happen without changing anything.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      resourceIds: z.string().describe("IDs of the containers or projects to update, comma-separated. Required: this tool will not update everything at once"),
      type: z.string().optional().describe("Resource type, e.g. container or project"),
      dryRun: z.boolean().optional().describe("Report what would be updated without applying anything"),
      forceUpdate: z.boolean().optional().describe("Apply even if no update is detected"),
    },
    withErrors(async ({ environmentId, environmentName, resourceIds, type, dryRun, forceUpdate }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.updater.run(envId, {
        resourceIds: partirIds(resourceIds),
        type,
        dryRun,
        forceUpdate,
      });
      return textResponse(JSON.stringify(result.data, null, 2));
    }),
  );
}
```

- [ ] **Step 4: Registrar el fichero en `src/index.ts` y en `GROUPS`**

```js
  ["updater.ts", "Updater"],
```

- [ ] **Step 5: Ejecutar y regenerar la tabla**

```bash
npx vitest run src/__tests__/tools.test.ts -t "Tools de updater"
npm test
npm run type-check
npm run gen-tools-table
npm run gen-tools-table -- --check
```

Esperado: los 5 nuevos PASS; **255 passed**; `type-check` limpio; la tabla pasa a **88 tools**.

- [ ] **Step 6: Commit**

```bash
git add src/tools/updater.ts src/index.ts scripts/gen-tools-table.mjs src/__tests__/tools.test.ts README.md
git commit -m "feat(tools): tres tools de updater, con resourceIds obligatorio

arcane_updater_run exige nombrar los objetivos: actualizar todo el entorno de
una llamada no es expresable, porque arcane-mcp-server es uno de los
contenedores que el updater puede reiniciar.

arcane_updater_history avisa cuando SOSPECHA truncamiento. Su endpoint devuelve
un array pelado sin total ni start, asi que la certeza no es posible y no se
promete.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: el filtro `updates` en las tres tools de listado

**Files:**
- Modify: `src/tools/images.ts`, `src/tools/containers.ts`, `src/tools/stacks.ts`
- Modify: `src/__tests__/tools.test.ts`

**Interfaces:**
- Consumes: el filtro `updates` del cliente (Task 4).

- [ ] **Step 1: Escribir los tests, que fallan**

```ts
  describe("El filtro updates en las tools de listado", () => {
    it("arcane_image_list pasa updates al cliente", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerImageTools(server as any, mockClient);
      (mockClient.images.list as any).mockResolvedValue({
        success: true, data: [], pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
      });

      await server.getHandler("arcane_image_list")({ environmentId: "env1", updates: "true" });
      expect(mockClient.images.list).toHaveBeenCalledWith("env1", expect.objectContaining({ updates: "true" }));
    });

    it("arcane_container_list pasa updates al cliente", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerContainerTools(server as any, mockClient);
      (mockClient.containers.list as any).mockResolvedValue({
        success: true, data: [], counts: { runningContainers: 0, stoppedContainers: 0, totalContainers: 0 },
        pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
      });

      await server.getHandler("arcane_container_list")({ environmentId: "env1", updates: "has_update" });
      expect(mockClient.containers.list).toHaveBeenCalledWith("env1", expect.objectContaining({ updates: "has_update" }));
    });

    it("arcane_stack_list pasa updates al cliente", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerStackTools(server as any, mockClient);

      await server.getHandler("arcane_stack_list")({ environmentId: "env1", updates: "up_to_date" });
      expect(mockClient.stacks.list).toHaveBeenCalledWith("env1", expect.objectContaining({ updates: "up_to_date" }));
    });
  });
```

- [ ] **Step 2: Ejecutar y comprobar que fallan**

```bash
npx vitest run src/__tests__/tools.test.ts -t "El filtro updates en las tools"
```

Esperado: FAIL — las tools no aceptan `updates`.

- [ ] **Step 3: Añadir el parámetro a las tres tools**

En `src/tools/images.ts`, dentro del shape de `arcane_image_list`, junto a `inUse`:

```ts
      updates: z.string().optional().describe("Filter by update availability: true or false"),
```

En `src/tools/containers.ts`, junto a `standalone`:

```ts
      updates: z.string().optional().describe("Filter by update status: has_update, up_to_date, error or unknown"),
```

En `src/tools/stacks.ts`, junto a `tags`:

```ts
      updates: z.string().optional().describe("Filter by update status: has_update, up_to_date, error or unknown"),
```

Y en los tres handlers, añadir `updates` al destructuring y al objeto que se pasa al cliente.

- [ ] **Step 4: Ejecutar y regenerar la tabla**

```bash
npx vitest run src/__tests__/tools.test.ts -t "El filtro updates en las tools"
npm test
npm run type-check
npm run gen-tools-table
npm run gen-tools-table -- --check
```

Esperado: los 3 nuevos PASS; **258 passed**; la tabla sigue con **88 tools** (cambian parámetros, no el número).

- [ ] **Step 5: Commit**

```bash
git add src/tools/images.ts src/tools/containers.ts src/tools/stacks.ts src/__tests__/tools.test.ts README.md
git commit -m "feat(tools): filtro updates en image_list, container_list y stack_list

Cierra la ultima de las tres deudas que F2 difirio a esta fase. Cada describe()
enumera los valores de SU endpoint: en images es true/false y en los otros dos
un enumerado de cuatro valores.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: cifras medidas, balance y despliegue

**Files:**
- Modify: `README.md`
- Create: `docs/balances/2026-08-17-f3.md`

**Ninguna cifra de esta tarea puede venir de este plan.** Los totales que aparecen arriba (258 tests, 44 e2e) son **previsiones aritméticas**, no mediciones.

- [ ] **Step 1: Medir todo**

```bash
npm test 2>&1 | tail -5
npm run type-check
npm run gen-tools-table -- --check
node scripts/audit-schema-drift.mjs 2>&1 | tail -3
set -a; . ./.dev.vars; set +a
ARCANE_BASE_URL=http://192.168.180.210:3552 npm run test:e2e -- --reporter=verbose 2>&1 | tail -40
```

Anota: tests unitarios, ficheros, e2e contados uno a uno, skipped (debe ser 0), tools, y el total de desalineaciones de drift — que **debe haber bajado** respecto a las 23 de partida.

- [ ] **Step 2: Medir la cobertura de operaciones**

Este trabajo **sí añade rutas nuevas** (7 endpoints), así que la cobertura debe subir de 78. Mide con el script AST descrito en el balance de la fase de coherencia, sección 3.3, y publica el resultado sobre el **denominador de 249**, no sobre 347, según fija
[el criterio de exposición](../../arquitectura/criterio-exposicion.md).

- [ ] **Step 3: Actualizar el README con las cifras medidas**

- [ ] **Step 4: Escribir el balance**

`docs/balances/2026-08-17-f3.md`, con la estructura del balance anterior: resumen en una frase, tabla de cifras **con el comando exacto de cada una**, lo entregado, lo que apareció y no estaba en el plan, y lo pendiente.

Debe recoger, al menos:

- El resultado de la puerta de `dryRun` de la Task 3: qué se comprobó y qué se observó.
- Que la heurística de truncamiento de `arcane_updater_history` es una **sospecha declarada**, no una certeza, y por qué la API no permite más.
- Que `check-all` y `updater/run` sin objetivo quedan fuera por el mismo criterio.
- Si la cobertura subió y a cuánto, sobre 249.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/balances/2026-08-17-f3.md
git commit -m "docs: cifras medidas y balance de F3

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Merge, publicación y verificación del despliegue**

El merge a `main` y el push los decide el propietario del proyecto. Una vez hechos, esperar al sync (≤5 min) y verificar **dentro del contenedor**, nunca por el estado del sync:

```bash
ssh VM-Control 'docker exec arcane-mcp-server sh -c "grep -c registerUpdaterTools /app/src/index.ts; wc -c < /app/src/tools/image-updates.ts"'
```

Después, ejercitar `arcane_image_update_summary` contra la instancia desplegada y comprobar que responde con los recuentos reales.

**Nota:** el push a `origin` puede fallar con `Connection refused` por Tailscale. Reintenta antes de diagnosticar credenciales.

---

## Self-review de este plan

**Cobertura del spec.** §2.1 image-updates → Task 2 (cliente) + Task 6 (tools); §2.2 updater → Task 3 + Task 7; §2.3 exclusiones → respetadas en 2 y 3, y documentadas en los mensajes de commit; §3 heurística de `updater/history` → Task 7 Step 3 con sus tres tests; §4.1 `usedBy` y §4.2 `updateInfo` → Task 1 Step 2; §4.3 filtro `updates` → Task 4 (cliente) + Task 8 (tools); §4.4 tipos en el `MAP` → Task 1 Step 3; §5.1 unitarios → repartidos; §5.2 e2e y la puerta de `dryRun` → Task 3 Step 1 y Task 5; §5.3 regresiones → Tasks 6-8; §5.4 despliegue → Task 9.

**Riesgo que el plan no puede resolver por sí solo.** La puerta de `dryRun` (Task 3, Step 1) puede tumbar `arcane_updater_run`. Está colocada **antes** de escribir su código, no después, para que el coste de descubrirlo sea una comprobación con `curl` y no una tarea entera.

**Cifras previstas frente a medidas.** Los totales de tests que aparecen como "esperado" son aritmética sobre la línea base de 231, no mediciones. Si un total no cuadra, la causa más probable es un test preexistente que hubo que ajustar. **La Task 9 no copia ninguno: los vuelve a medir.**
