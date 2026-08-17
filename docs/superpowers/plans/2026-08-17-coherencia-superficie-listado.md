# Coherencia de la superficie de listado — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que las 13 tools de listado de `arcane-mcp` acepten el juego de parámetros que `openapi.txt` declara para su endpoint y devuelvan la paginación, para que un modelo nunca reciba una lista truncada creyéndola completa.

**Architecture:** Tres helpers nuevos y sin tools dentro (`withErrors` y `listResponse` en `src/tools/respond.ts`, `collectAllPages` en `src/tools/paging.ts`) más un constructor de query compartido en el cliente. Las tools de listado declaran sus parámetros con una constante `LIST_PARAMS` local a cada fichero, envuelven su handler en `withErrors` y devuelven su salida con `listResponse`. Los cuatro resolvers nombre→id dejan de mirar solo la primera página.

**Tech Stack:** TypeScript `strict`, Zod, `@modelcontextprotocol/sdk`, Vitest, Bun. Instancia real de Arcane 2.8.0 en `http://192.168.180.210:3552`.

## Global Constraints

- **`openapi.txt` es la fuente de verdad, por encima de este plan.** Antes de escribir código en cualquier tarea que declare un tipo o un parámetro, verifica el schema contra `openapi.txt`. En F2 el plan falló cinco veces en fidelidad al spec y las cinco las cazó la revisión.
- **Ninguna cifra publicada puede venir de un documento.** Solo de un comando ejecutado. Esto incluye las cifras de este plan.
- **Regla dura:** ningún cambio de comportamiento se da por terminado sin test unitario con `fetch` mockeado **y** comprobación e2e contra la instancia real.
- **Mutantes con sujeto inocuo:** cada test es dueño de lo que muta, o la mutación es idempotente. En este plan no hay mutaciones: todo es lectura.
- **Commits firmados, siempre en rama.** Nunca `--no-gpg-sign`. Si `git commit` falla con `failed to fill whole buffer`, 1Password se ha autobloqueado: pide al usuario que lo desbloquee y reintenta.
- **`scripts/gen-tools-table.mjs` aborta ante cualquier fichero nuevo de `src/tools/` que no esté registrado.** Las tareas 1 y 2 lo tienen en cuenta explícitamente.
- **En los e2e, un fichero que aborta al importar sale como `skipped`, no como fallo.** Se cuenta con `--reporter=verbose`, uno a uno. `3 passed | 3 skipped` no es verde.
- Credenciales: `set -a; . ./.dev.vars; set +a` y luego `ARCANE_BASE_URL=http://192.168.180.210:3552 npm run test:e2e`.
- **No tocar la instancia de Arcane** (imagen, `image_update_check`): lo lleva otra sesión en paralelo.

**Línea base medida el 2026-08-17 sobre `ccabb12`:** 152 tests unitarios (3 ficheros), 19 e2e, 81 tools, `type-check` limpio, drift con 0 hallazgos graves.

**Rama de trabajo:** `feat/coherencia-superficie-listado` (ya existe, con el spec commiteado en `272409b`).

---

## Estructura de ficheros

| Fichero | Responsabilidad | Tarea |
|---|---|---|
| `src/tools/respond.ts` | **Crear.** Cómo contesta una tool: `ToolResult`, `withErrors`, `textResponse`, `listResponse` | 1 |
| `src/__tests__/respond.test.ts` | **Crear.** Tests de los anteriores | 1 |
| `src/tools/paging.ts` | **Crear.** Cómo se consume una colección paginada entera: `collectAllPages` | 2 |
| `src/__tests__/paging.test.ts` | **Crear.** Tests del anterior | 2 |
| `scripts/gen-tools-table.mjs` | **Modificar.** Lista de excepciones de ficheros sin tools | 1, 2 |
| `scripts/audit-schema-drift.mjs` | **Modificar.** `MAP` con las tres interfaces de `counts` | 3 |
| `src/arcane-client.ts` | **Modificar.** Tipos de `counts`, opciones de listado por dominio, `appendListParams`, y los 9 métodos `list()` | 3, 4, 5 |
| `src/tools/{containers,images,volumes,networks}.ts` | **Modificar.** `LIST_PARAMS`, `withErrors`, `listResponse` | 7 |
| `src/tools/{stacks,templates,environments,activities,events}.ts` | Íd. | 8 |
| `src/tools/{git-repositories,gitops-syncs,volume-backups,jobs}.ts` | Íd. | 9 |
| `src/tools/resolve.ts` | **Modificar.** Los tres resolvers con `collectAllPages` | 10 |
| `src/__e2e__/paginacion.e2e.ts` | **Crear.** Invariantes de paginación contra la instancia real | 6 |
| Resto de `src/tools/*.ts` | **Modificar.** `withErrors` en las tools que no son de listado | 11 |
| `README.md` | **Modificar.** Tabla regenerada y cifras medidas | 12 |

---

### Task 1: `respond.ts` — cómo contesta una tool

**Files:**
- Create: `src/tools/respond.ts`
- Create: `src/__tests__/respond.test.ts`
- Modify: `scripts/gen-tools-table.mjs:123`

**Interfaces:**
- Consumes: `PaginatedResponse<T>` de `src/arcane-client.ts` (ya existe, no se modifica en esta tarea).
- Produces:
  - `type ToolResult = { content: Array<{ type: "text"; text: string }>; isError?: boolean }`
  - `withErrors<A>(handler: (args: A) => Promise<ToolResult>): (args: A) => Promise<ToolResult>`
  - `textResponse(text: string): ToolResult`
  - `listResponse<T>(result: PaginatedResponse<T> & { counts?: unknown }, noun: string): ToolResult`

**Contexto que el implementador necesita:** la inferencia de tipos de `withErrors` a través de `server.tool(...)` **ya está comprobada** bajo `strict` — TypeScript infiere `A` como `ShapeOutput<...>` del shape Zod y detecta campos inexistentes dentro del handler envuelto. No hace falta anotar el parámetro del handler a mano.

- [ ] **Step 1: Escribir el fichero de test, que falla porque el módulo no existe**

Crear `src/__tests__/respond.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { withErrors, textResponse, listResponse } from "../tools/respond";
import type { PaginatedResponse } from "../arcane-client";

const pagina = <T>(data: T[], p: Partial<PaginatedResponse<T>["pagination"]> = {}): PaginatedResponse<T> => ({
  success: true,
  data,
  pagination: { totalItems: data.length, totalPages: 1, currentPage: 1, itemsPerPage: 20, ...p },
});

describe("withErrors", () => {
  it("devuelve tal cual el resultado cuando el handler resuelve", async () => {
    const envuelto = withErrors(async (args: { n: number }) => textResponse(`ok ${args.n}`));
    const r = await envuelto({ n: 7 });
    expect(r).toEqual({ content: [{ type: "text", text: "ok 7" }] });
    expect(r.isError).toBeUndefined();
  });

  it("convierte un Error lanzado en isError con su message", async () => {
    const envuelto = withErrors(async () => {
      throw new Error("boom");
    });
    const r = await envuelto({});
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toBe("Error: boom");
  });

  it("convierte en isError algo lanzado que no es un Error", async () => {
    const envuelto = withErrors(async () => {
      throw "un string pelado";
    });
    const r = await envuelto({});
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toBe("Error: un string pelado");
  });
});

describe("listResponse", () => {
  it("con una sola pagina no antepone ninguna linea en prosa", () => {
    const r = listResponse(pagina([{ id: "a" }, { id: "b" }]), "volumes");
    expect(r.content[0].text.startsWith("{")).toBe(true);
    const body = JSON.parse(r.content[0].text);
    expect(body.pagination.totalItems).toBe(2);
    expect(body.data).toHaveLength(2);
    expect(body).not.toHaveProperty("counts");
  });

  it("con varias paginas antepone el aviso y sugiere el siguiente start", () => {
    const veinte = Array.from({ length: 20 }, (_, i) => ({ id: `v${i}` }));
    const r = listResponse(pagina(veinte, { totalItems: 32, totalPages: 2, currentPage: 1, itemsPerPage: 20 }), "volumes");
    const [primera] = r.content[0].text.split("\n");
    expect(primera).toBe("Showing 20 of 32 volumes (page 1 of 2). Pass start=20 to see the rest.");
  });

  it("en la ultima pagina avisa del total pero no sugiere un start que no existe", () => {
    const doce = Array.from({ length: 12 }, (_, i) => ({ id: `v${i}` }));
    const r = listResponse(pagina(doce, { totalItems: 32, totalPages: 2, currentPage: 2, itemsPerPage: 20 }), "volumes");
    const [primera] = r.content[0].text.split("\n");
    expect(primera).toBe("Showing 12 of 32 volumes (page 2 of 2).");
    expect(primera).not.toContain("Pass start=");
  });

  it("trata data:null como lista vacia y nunca emite el texto 'null'", () => {
    const r = listResponse({ ...pagina<{ id: string }>([]), data: null }, "jobs");
    const body = JSON.parse(r.content[0].text);
    expect(body.data).toEqual([]);
    expect(r.content[0].text).not.toMatch(/^\s*null\s*$/m);
  });

  it("incluye counts cuando el endpoint lo trae", () => {
    const r = listResponse({ ...pagina([{ id: "a" }]), counts: { inuse: 8, unused: 24, total: 32 } }, "volumes");
    const body = JSON.parse(r.content[0].text);
    expect(body.counts).toEqual({ inuse: 8, unused: 24, total: 32 });
  });
});
```

- [ ] **Step 2: Ejecutar el test y comprobar que falla**

```bash
npx vitest run src/__tests__/respond.test.ts
```

Esperado: FAIL, `Failed to resolve import "../tools/respond"`.

- [ ] **Step 3: Crear `src/tools/respond.ts`**

```ts
import type { PaginatedResponse } from "../arcane-client";

/** Lo que devuelve el handler de una tool MCP. */
export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

/**
 * Envuelve el handler de una tool para que ningun fallo escape como excepcion:
 * toda tool devuelve `isError: true` cuando falla, nunca lanza.
 *
 * Se envuelve el handler y no el registro a proposito. Asi la llamada sigue
 * siendo `server.tool(nombre, desc, shape, handler)`, que es la forma exacta que
 * `scripts/gen-tools-table.mjs` reconoce para contar las tools del README.
 */
export function withErrors<A>(
  handler: (args: A) => Promise<ToolResult>,
): (args: A) => Promise<ToolResult> {
  return async (args: A): Promise<ToolResult> => {
    try {
      return await handler(args);
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  };
}

/** Respuesta de texto plano. */
export function textResponse(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

/**
 * Salida comun de toda tool de listado.
 *
 * Emite `{pagination, counts?, data}` y, SOLO cuando hay mas de una pagina,
 * antepone una linea en prosa. Lo estructurado da uniformidad; la frase da
 * relevancia, porque un campo anidado es facil de saltarse leyendo y una lista
 * truncada en silencio es justo lo que hace concluir algo falso.
 */
export function listResponse<T>(
  result: PaginatedResponse<T> & { counts?: unknown },
  noun: string,
): ToolResult {
  const items = result.data ?? [];
  const p = result.pagination;

  const body: Record<string, unknown> = { pagination: p };
  if (result.counts !== undefined) body.counts = result.counts;
  body.data = items;

  let text = JSON.stringify(body, null, 2);

  if (p && p.totalPages > 1) {
    const base = `Showing ${items.length} of ${p.totalItems} ${noun} (page ${p.currentPage} of ${p.totalPages}).`;
    const hint =
      p.currentPage < p.totalPages ? ` Pass start=${p.currentPage * p.itemsPerPage} to see the rest.` : "";
    text = `${base}${hint}\n${text}`;
  }

  return { content: [{ type: "text", text }] };
}
```

- [ ] **Step 4: Ejecutar el test y comprobar que pasa**

```bash
npx vitest run src/__tests__/respond.test.ts
```

Esperado: PASS, 8 tests.

- [ ] **Step 5: Comprobar que el generador de la tabla ahora aborta**

```bash
npm run gen-tools-table -- --check
```

Esperado: FALLA con `ERROR: ficheros de src/tools/ sin sección asignada: respond.ts`. Este fallo es correcto y hay que arreglarlo en el paso siguiente.

- [ ] **Step 6: Convertir la excepción literal del generador en un conjunto**

En `scripts/gen-tools-table.mjs`, sustituir la línea 123:

```js
const present = readdirSync("src/tools").filter(f => f.endsWith(".ts") && f !== "resolve.ts");
```

por:

```js
// Ficheros de src/tools/ que no registran tools: helpers compartidos.
// `resolve.ts` resuelve nombre->id; `respond.ts` construye la respuesta de una
// tool; `paging.ts` recorre colecciones paginadas.
const NON_TOOL_FILES = new Set(["resolve.ts", "respond.ts", "paging.ts"]);
const present = readdirSync("src/tools").filter(f => f.endsWith(".ts") && !NON_TOOL_FILES.has(f));
```

Actualizar también el comentario de `GROUPS` en la línea 21, que hoy dice `// \`resolve.ts\` no registra tools: son helpers de resolución nombre->id.`, por:

```js
// Los ficheros sin tools estan en NON_TOOL_FILES, mas abajo.
```

- [ ] **Step 7: Comprobar que el generador vuelve a estar en verde y que la cuenta no ha cambiado**

```bash
npm run gen-tools-table -- --check
npm test
npm run type-check
```

Esperado: `OK: la tabla del README.md está al día (81 tools).` — la cuenta sigue siendo **81** porque aún no se ha tocado ninguna tool. `npm test` da **160 passed** (152 de partida + 8 nuevos). `type-check` sin salida.

- [ ] **Step 8: Commit**

```bash
git add src/tools/respond.ts src/__tests__/respond.test.ts scripts/gen-tools-table.mjs
git commit -m "feat(tools): withErrors y listResponse, la respuesta comun de una tool

listResponse emite {pagination, counts?, data} y antepone una linea en prosa
solo cuando hay mas de una pagina. data:null pasa a ser lista vacia, no el
texto 'null'.

La excepcion de ficheros sin tools del generador de la tabla deja de ser un
literal y pasa a ser un conjunto, para admitir los helpers nuevos sin tocar
el extractor.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `paging.ts` — recorrer una colección entera

**Files:**
- Create: `src/tools/paging.ts`
- Create: `src/__tests__/paging.test.ts`

**Interfaces:**
- Consumes: `PaginatedResponse<T>` de `src/arcane-client.ts`. `NON_TOOL_FILES` de la Task 1 ya incluye `paging.ts`.
- Produces:
  - `const PAGE_SIZE = 200`, `const MAX_PAGES = 10`
  - `interface CollectedPages<T> { items: T[]; complete: boolean; totalItems: number }`
  - `collectAllPages<T>(fetchPage: (start: number, limit: number) => Promise<PaginatedResponse<T>>): Promise<CollectedPages<T>>`

- [ ] **Step 1: Escribir el fichero de test, que falla porque el módulo no existe**

Crear `src/__tests__/paging.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { collectAllPages, PAGE_SIZE, MAX_PAGES } from "../tools/paging";
import type { PaginatedResponse } from "../arcane-client";

/** Sirve `total` elementos en paginas del tamaño que le pidan. */
const servidor = (total: number) =>
  vi.fn(async (start: number, limit: number): Promise<PaginatedResponse<{ id: number }>> => {
    const data = Array.from({ length: Math.max(0, Math.min(limit, total - start)) }, (_, i) => ({ id: start + i }));
    return {
      success: true,
      data,
      pagination: {
        totalItems: total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        currentPage: Math.floor(start / limit) + 1,
        itemsPerPage: limit,
      },
    };
  });

describe("collectAllPages", () => {
  it("agota en una sola peticion cuando todo cabe en una pagina", async () => {
    const fetchPage = servidor(32);
    const r = await collectAllPages(fetchPage);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith(0, PAGE_SIZE);
    expect(r.items).toHaveLength(32);
    expect(r.complete).toBe(true);
    expect(r.totalItems).toBe(32);
  });

  it("recorre varias paginas y concatena en orden", async () => {
    const fetchPage = servidor(450);
    const r = await collectAllPages(fetchPage);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage).toHaveBeenNthCalledWith(2, PAGE_SIZE, PAGE_SIZE);
    expect(r.items).toHaveLength(450);
    expect(r.items[0].id).toBe(0);
    expect(r.items[449].id).toBe(449);
    expect(r.complete).toBe(true);
  });

  it("se detiene en el tope y lo declara con complete:false", async () => {
    const fetchPage = servidor(PAGE_SIZE * MAX_PAGES + 1);
    const r = await collectAllPages(fetchPage);
    expect(fetchPage).toHaveBeenCalledTimes(MAX_PAGES);
    expect(r.items).toHaveLength(PAGE_SIZE * MAX_PAGES);
    expect(r.complete).toBe(false);
    expect(r.totalItems).toBe(PAGE_SIZE * MAX_PAGES + 1);
  });

  it("corta ante un servidor que promete mas elementos de los que sirve", async () => {
    // totalItems miente: dice 1000 y devuelve una pagina vacia en la segunda
    // llamada. Sin esta guarda, el bucle daria vueltas hasta el tope.
    const fetchPage = vi.fn(async (start: number): Promise<PaginatedResponse<{ id: number }>> => ({
      success: true,
      data: start === 0 ? [{ id: 1 }] : [],
      pagination: { totalItems: 1000, totalPages: 5, currentPage: 1, itemsPerPage: PAGE_SIZE },
    }));
    const r = await collectAllPages(fetchPage);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(r.items).toHaveLength(1);
    expect(r.complete).toBe(true);
  });

  it("trata data:null como pagina vacia sin reventar", async () => {
    const fetchPage = vi.fn(async (): Promise<PaginatedResponse<{ id: number }>> => ({
      success: true,
      data: null,
      pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: PAGE_SIZE },
    }));
    const r = await collectAllPages(fetchPage);
    expect(r.items).toEqual([]);
    expect(r.complete).toBe(true);
  });
});
```

- [ ] **Step 2: Ejecutar el test y comprobar que falla**

```bash
npx vitest run src/__tests__/paging.test.ts
```

Esperado: FAIL, `Failed to resolve import "../tools/paging"`.

- [ ] **Step 3: Crear `src/tools/paging.ts`**

```ts
import type { PaginatedResponse } from "../arcane-client";

/** Elementos por peticion al recorrer una coleccion entera. */
export const PAGE_SIZE = 200;

/** Tope duro de paginas. 10 x 200 = 2.000 elementos. */
export const MAX_PAGES = 10;

export interface CollectedPages<T> {
  items: T[];
  /** false si se alcanzo MAX_PAGES: la coleccion NO se ha visto entera. */
  complete: boolean;
  totalItems: number;
}

/**
 * Recorre una coleccion paginada hasta agotarla.
 *
 * En el caso normal es UNA sola peticion: el bucle solo continua si de verdad
 * hay mas elementos de los que caben en una pagina. Quien lo llama debe mirar
 * `complete` antes de concluir que algo no existe: decir "no existe" habiendo
 * mirado solo una parte es la conclusion falsa que este helper evita.
 */
export async function collectAllPages<T>(
  fetchPage: (start: number, limit: number) => Promise<PaginatedResponse<T>>,
): Promise<CollectedPages<T>> {
  const items: T[] = [];
  let totalItems = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetchPage(items.length, PAGE_SIZE);
    const batch = res.data ?? [];
    totalItems = res.pagination?.totalItems ?? items.length + batch.length;
    items.push(...batch);

    // Pagina vacia: el servidor no tiene mas que dar, diga lo que diga
    // totalItems. Sin esta guarda, un totalItems inflado agotaria el tope.
    if (batch.length === 0) return { items, complete: true, totalItems };
    if (items.length >= totalItems) return { items, complete: true, totalItems };
  }

  return { items, complete: false, totalItems };
}
```

- [ ] **Step 4: Ejecutar el test y comprobar que pasa**

```bash
npx vitest run src/__tests__/paging.test.ts
npm run type-check
npm run gen-tools-table -- --check
```

Esperado: 5 tests PASS (**165 passed** en total); `type-check` sin salida; `OK: la tabla del README.md está al día (81 tools).` — `paging.ts` ya estaba en `NON_TOOL_FILES` desde la Task 1.

- [ ] **Step 5: Commit**

```bash
git add src/tools/paging.ts src/__tests__/paging.test.ts
git commit -m "feat(tools): collectAllPages, recorrer una coleccion paginada entera

Una sola peticion en el caso normal; solo pagina si hay truncamiento real.
Devuelve complete:false al alcanzar el tope, para que quien llame no afirme
que algo no existe habiendo mirado solo una parte.

Corta ante una pagina vacia aunque totalItems prometa mas, que es la guarda
contra un servidor que informa mal.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: tipos de `counts` y auditoría de drift

**Files:**
- Modify: `src/arcane-client.ts` (zona de tipos, junto a `PaginatedResponse` en la línea 254)
- Modify: `scripts/audit-schema-drift.mjs:15-44` (el `MAP`)

**Interfaces:**
- Produces:
  - `interface PaginatedResponseWithCounts<T, C> extends PaginatedResponse<T> { counts: C }`
  - `interface ContainerStatusCounts { runningContainers: number; stoppedContainers: number; totalContainers: number }`
  - `interface VolumeUsageCounts { inuse: number; unused: number; total: number }`
  - `interface NetworkUsageCounts { inuse: number; unused: number; total: number }`

**Verificación previa obligatoria.** Antes de escribir los tipos, confirma los tres schemas contra el spec:

```bash
node -e "
const s=JSON.parse(require('fs').readFileSync('openapi.txt','utf8'));
for (const n of ['ContainerStatusCounts','DockerVolumeVolumeUsageCountsData','NetworkUsageCounts'])
  console.log(n, '->', JSON.stringify(s.components.schemas[n]));"
```

Esperado: los tres con `required` completo — `ContainerStatusCounts` con `runningContainers`, `stoppedContainers`, `totalContainers`; los otros dos con `inuse`, `unused`, `total`. **Todos los campos son obligatorios: van sin `?`.**

- [ ] **Step 1: Añadir los tipos en `src/arcane-client.ts`**

Justo detrás de `export interface PaginatedResponse<T>` (línea 254-258), añadir:

```ts
/**
 * Sobre paginado que ademas trae agregados de la coleccion filtrada.
 *
 * El spec lo separa igual: `BasePaginated...` frente a
 * `BasePaginatedWithCounts...`. `counts` va sin `?` porque openapi.txt lo
 * declara en `required` en los tres schemas que lo usan.
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
```

- [ ] **Step 2: Registrar los tres tipos en la auditoría de drift**

En `scripts/audit-schema-drift.mjs`, dentro del objeto `MAP` (líneas 15-44), añadir tras la línea `DockerInfo: "DockerinfoInfo",`:

```js
  ContainerStatusCounts: "ContainerStatusCounts",
  VolumeUsageCounts: "DockerVolumeVolumeUsageCountsData",
  NetworkUsageCounts: "NetworkUsageCounts",
```

- [ ] **Step 3: Ejecutar la auditoría — es la que verifica que los tipos son fieles**

```bash
node scripts/audit-schema-drift.mjs
```

Esperado: sigue con **0 hallazgos graves**. Si alguno de los tres tipos apareciera como `FALTA-EN-TS` de un campo obligatorio, el tipo está mal copiado: corrígelo contra `openapi.txt`, no contra este plan.

- [ ] **Step 4: Comprobar que nada más se ha roto**

```bash
npm run type-check
npm test
```

Esperado: `type-check` sin salida; **165 passed**, igual que al terminar la Task 2 — esta tarea no añade tests, porque quien verifica la fidelidad de los tipos es la auditoría de drift del paso anterior, no un test unitario.

- [ ] **Step 5: Commit**

```bash
git add src/arcane-client.ts scripts/audit-schema-drift.mjs
git commit -m "feat(client): tipos de counts bajo auditoria de drift

containers, volumes y networks devuelven un objeto counts que el fork tiraba
entero. Se declara PaginatedResponseWithCounts, con el mismo reparto que hace
el spec entre BasePaginated y BasePaginatedWithCounts, y las tres interfaces
de agregados entran en el MAP de la auditoria.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: el cliente — los cuatro listados que no aceptaban nada

**Files:**
- Modify: `src/arcane-client.ts` — helper nuevo, tipos de opciones, y los métodos `list()` de las líneas 914, 945, 965, 985
- Modify: `src/__tests__/arcane-client.test.ts` — tests nuevos

**Interfaces:**
- Consumes: `ListOptionsWithSort` (línea 369, sin cambios), `PaginatedResponseWithCounts`, `ContainerStatusCounts`, `VolumeUsageCounts`, `NetworkUsageCounts` de la Task 3.
- Produces:
  - `function appendListParams(params: URLSearchParams, opts?: ListOptionsWithSort): void`
  - `interface ContainerListOptions extends ListOptionsWithSort { includeInternal?: boolean; standalone?: string }`
  - `interface ImageListOptions extends ListOptionsWithSort { inUse?: string }`
  - `interface VolumeListOptions extends ListOptionsWithSort { inUse?: string; includeInternal?: boolean }`
  - `interface NetworkListOptions extends ListOptionsWithSort { inUse?: string }`
  - `containers.list(envId, opts?): Promise<PaginatedResponseWithCounts<ContainerSummary, ContainerStatusCounts>>`
  - `images.list(envId, opts?): Promise<PaginatedResponse<ImageSummary>>`
  - `volumes.list(envId, opts?): Promise<PaginatedResponseWithCounts<Volume, VolumeUsageCounts>>`
  - `networks.list(envId, opts?): Promise<PaginatedResponseWithCounts<NetworkSummary, NetworkUsageCounts>>`

**Verificación previa obligatoria.** Los tipos de los filtros propios de cada endpoint no son los que uno supondría: `includeInternal` es booleano, pero `inUse` y `standalone` son **cadenas** (`"true"`/`"false"`) en el spec. Confírmalo:

```bash
node -e "
const s=JSON.parse(require('fs').readFileSync('openapi.txt','utf8'));
for (const p of ['/environments/{id}/containers','/environments/{id}/images','/environments/{id}/volumes','/environments/{id}/networks']) {
  console.log('===',p);
  for (const x of (s.paths[p].get.parameters||[])) if(x.in==='query') console.log('  ',x.name, x.schema.type, x.schema.default!==undefined?('default='+x.schema.default):'');
}"
```

- [ ] **Step 1: Escribir los tests, que fallan porque los métodos ignoran las opciones**

Añadir al final de `src/__tests__/arcane-client.test.ts`, dentro del `describe("ArcaneClient", ...)`:

```ts
  describe("Parametros de listado (containers, images, volumes, networks)", () => {
    const okVacio = () =>
      ({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          counts: {},
          pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
        }),
      }) as Response;

    it("containers.list envia los cinco comunes mas includeInternal y standalone", async () => {
      mockFetch.mockResolvedValue(okVacio());
      await client.containers.list("env1", {
        search: "web", sort: "name", order: "asc", start: 20, limit: 50,
        includeInternal: true, standalone: "false",
      });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/containers?search=web&sort=name&order=asc&start=20&limit=50&includeInternal=true&standalone=false",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("containers.list sin opciones no anade query string", async () => {
      mockFetch.mockResolvedValue(okVacio());
      await client.containers.list("env1");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/containers",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("start=0 se envia (es un valor valido, no una ausencia)", async () => {
      mockFetch.mockResolvedValue(okVacio());
      await client.containers.list("env1", { start: 0 });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/containers?start=0",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("images.list envia los cinco comunes mas inUse", async () => {
      mockFetch.mockResolvedValue(okVacio());
      await client.images.list("env1", { search: "nginx", sort: "size", order: "desc", start: 10, limit: 5, inUse: "true" });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/images?search=nginx&sort=size&order=desc&start=10&limit=5&inUse=true",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("volumes.list envia los cinco comunes mas inUse e includeInternal", async () => {
      mockFetch.mockResolvedValue(okVacio());
      await client.volumes.list("env1", { limit: 200, inUse: "false", includeInternal: true });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/volumes?limit=200&inUse=false&includeInternal=true",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("networks.list envia los cinco comunes mas inUse", async () => {
      mockFetch.mockResolvedValue(okVacio());
      await client.networks.list("env1", { search: "bridge", inUse: "true" });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/networks?search=bridge&inUse=true",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("volumes.list devuelve el objeto counts que trae la API", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          counts: { inuse: 8, unused: 24, total: 32 },
          pagination: { totalItems: 32, totalPages: 2, currentPage: 1, itemsPerPage: 20 },
        }),
      } as Response);
      const r = await client.volumes.list("env1");
      expect(r.counts).toEqual({ inuse: 8, unused: 24, total: 32 });
      expect(r.pagination.totalItems).toBe(32);
    });
  });
```

- [ ] **Step 2: Ejecutar los tests y comprobar que fallan**

```bash
npx vitest run src/__tests__/arcane-client.test.ts -t "Parametros de listado"
```

Esperado: FAIL. Los de query string fallan porque la URL llega sin parámetros; el de `counts` falla en compilación o en tiempo de ejecución porque `PaginatedResponse` no declara `counts`.

- [ ] **Step 3: Añadir el constructor de query compartido**

En `src/arcane-client.ts`, justo detrás de la declaración de `ListOptionsWithSort` (línea 369-373), añadir:

```ts
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
}

export interface ImageListOptions extends ListOptionsWithSort {
  /** El spec lo declara string: "true" | "false". */
  inUse?: string;
}

export interface VolumeListOptions extends ListOptionsWithSort {
  inUse?: string;
  includeInternal?: boolean;
}

export interface NetworkListOptions extends ListOptionsWithSort {
  inUse?: string;
}
```

- [ ] **Step 4: Reescribir los cuatro métodos `list()`**

Sustituir el método de la línea 914 (`ContainersMethods.list`) por:

```ts
  async list(envId: string, opts?: ContainerListOptions): Promise<PaginatedResponseWithCounts<ContainerSummary, ContainerStatusCounts>> {
    const params = new URLSearchParams();
    appendListParams(params, opts);
    if (opts?.includeInternal !== undefined) params.set("includeInternal", String(opts.includeInternal));
    if (opts?.standalone) params.set("standalone", opts.standalone);
    const query = params.toString();
    return this.client.request<PaginatedResponseWithCounts<ContainerSummary, ContainerStatusCounts>>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/containers${query ? `?${query}` : ""}`
    );
  }
```

El de la línea 945 (`ImagesMethods.list`) por:

```ts
  async list(envId: string, opts?: ImageListOptions): Promise<PaginatedResponse<ImageSummary>> {
    const params = new URLSearchParams();
    appendListParams(params, opts);
    if (opts?.inUse) params.set("inUse", opts.inUse);
    const query = params.toString();
    return this.client.request<PaginatedResponse<ImageSummary>>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/images${query ? `?${query}` : ""}`
    );
  }
```

El de la línea 965 (`VolumesMethods.list`) por:

```ts
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
```

El de la línea 985 (`NetworksMethods.list`) por:

```ts
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
```

- [ ] **Step 5: Ejecutar los tests y comprobar que pasan**

```bash
npx vitest run src/__tests__/arcane-client.test.ts -t "Parametros de listado"
npm test
npm run type-check
```

Esperado: los 7 tests nuevos PASS; **172 passed** en total; `type-check` sin salida.

Si `type-check` protesta en `src/tools/resolve.ts:80` o en los tests de `tools.test.ts` por el `counts` obligatorio de `PaginatedResponseWithCounts`, **no relajes el tipo**: es correcto que `counts` sea obligatorio. Ajusta el mock para que incluya `counts`.

- [ ] **Step 6: Commit**

```bash
git add src/arcane-client.ts src/__tests__/arcane-client.test.ts
git commit -m "feat(client): containers, images, volumes y networks aceptan opciones

Los cuatro listaban sin admitir un solo parametro, asi que el servidor
aplicaba su limite por defecto de 20 y no habia forma de pedir el resto.
Ahora envian los cinco comunes mas los filtros propios de cada endpoint, con
los tipos que declara openapi.txt: includeInternal es boolean, inUse y
standalone son string.

appendListParams centraliza los cinco comunes. start se compara con undefined
porque start=0 es un valor valido, no una ausencia.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: el cliente — los cinco listados que descartaban parámetros

**Files:**
- Modify: `src/arcane-client.ts` — métodos de las líneas 824 (`environments.list`), 855 (`projects.list`), 1008 (`templates.list`), 1068 (`activities.list`), 1119 (`events.list`)
- Modify: `src/__tests__/arcane-client.test.ts`

**Interfaces:**
- Consumes: `appendListParams` de la Task 4.
- Produces:
  - `interface EnvironmentListOptions extends ListOptionsWithSort { type?: string }`
  - `interface ProjectListOptions extends ListOptionsWithSort { status?: string; archived?: string; tags?: string }`
  - `interface TemplateListOptions extends ListOptionsWithSort { type?: string }`
  - `ActivityListOptions` y `EventListOptions` no cambian de forma (ya heredan de `ListOptionsWithSort`); cambia que sus métodos **sí reenvíen** `sort`, `order` y `start`.

**Lo que se está arreglando aquí.** `projects.list` y `templates.list` escriben en la query **solo `search`**, mientras sus tools declaran `limit` y se lo pasan: quien pide 50 recibe 20. `activities.list` y `events.list` heredan `sort`/`order`/`start` de `ListOptionsWithSort` y no los reenvían.

- [ ] **Step 1: Escribir los tests, que fallan**

Añadir a `src/__tests__/arcane-client.test.ts`:

```ts
  describe("Parametros de listado descartados en silencio", () => {
    const okVacio = () =>
      ({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
        }),
      }) as Response;

    it("stacks.list envia limit, que hasta ahora tiraba", async () => {
      mockFetch.mockResolvedValue(okVacio());
      await client.stacks.list("env1", { search: "app", limit: 50 });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/projects?search=app&limit=50",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("stacks.list envia tambien sort, order, start y los filtros propios", async () => {
      mockFetch.mockResolvedValue(okVacio());
      await client.stacks.list("env1", {
        sort: "name", order: "desc", start: 20, limit: 10,
        status: "running", archived: "all", tags: "prod,web",
      });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/projects?sort=name&order=desc&start=20&limit=10&status=running&archived=all&tags=prod%2Cweb",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("templates.list envia limit, que hasta ahora tiraba", async () => {
      mockFetch.mockResolvedValue(okVacio());
      await client.templates.list({ search: "nginx", limit: 50, type: "compose" });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/templates?search=nginx&limit=50&type=compose",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("environments.list envia sort, order, start y type", async () => {
      mockFetch.mockResolvedValue(okVacio());
      await client.environments.list({ sort: "name", order: "asc", start: 5, limit: 10, type: "local" });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments?sort=name&order=asc&start=5&limit=10&type=local",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("activities.list reenvia sort, order y start, que declaraba y no mandaba", async () => {
      mockFetch.mockResolvedValue(okVacio());
      await client.activities.list("env1", { sort: "createdAt", order: "desc", start: 50, limit: 10, status: "failed" });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/environments/env1/activities?sort=createdAt&order=desc&start=50&limit=10&status=failed",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("events.list reenvia sort, order y start en la ruta global", async () => {
      mockFetch.mockResolvedValue(okVacio());
      await client.events.list({ sort: "timestamp", order: "desc", start: 20, limit: 5, severity: "error" });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/events?sort=timestamp&order=desc&start=20&limit=5&severity=error",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("events.list reenvia sort, order y start en la ruta por entorno", async () => {
      mockFetch.mockResolvedValue(okVacio());
      await client.events.list({ environmentId: "env1", sort: "timestamp", start: 10 });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3552/api/events/environment/env1?sort=timestamp&start=10",
        expect.objectContaining({ method: "GET" }),
      );
    });
  });
```

- [ ] **Step 2: Ejecutar los tests y comprobar que fallan**

```bash
npx vitest run src/__tests__/arcane-client.test.ts -t "descartados en silencio"
```

Esperado: FAIL en los 7, con URLs a las que les faltan parámetros.

- [ ] **Step 3: Declarar los tipos de opciones que faltan**

En `src/arcane-client.ts`, junto a los de la Task 4:

```ts
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
}

export interface TemplateListOptions extends ListOptionsWithSort {
  type?: string;
}
```

- [ ] **Step 4: Reescribir los cinco métodos**

`EnvironmentsMethods.list` (línea 824):

```ts
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
```

`StacksMethods.list` (línea 855):

```ts
  async list(envId: string, opts?: ProjectListOptions): Promise<PaginatedResponse<Project>> {
    const params = new URLSearchParams();
    appendListParams(params, opts);
    if (opts?.status) params.set("status", opts.status);
    if (opts?.archived) params.set("archived", opts.archived);
    if (opts?.tags) params.set("tags", opts.tags);
    const query = params.toString();
    return this.client.request<PaginatedResponse<Project>>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/projects${query ? `?${query}` : ""}`
    );
  }
```

`TemplatesMethods.list` (línea 1008):

```ts
  async list(opts?: TemplateListOptions): Promise<PaginatedResponse<Template>> {
    const params = new URLSearchParams();
    appendListParams(params, opts);
    if (opts?.type) params.set("type", opts.type);
    const query = params.toString();
    return this.client.request<PaginatedResponse<Template>>("GET", `/templates${query ? `?${query}` : ""}`);
  }
```

`ActivitiesMethods.list` (línea 1068):

```ts
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
```

`EventsMethods.list` (línea 1119):

```ts
  async list(opts?: EventListOptions): Promise<PaginatedResponse<Event>> {
    const params = new URLSearchParams();
    appendListParams(params, opts);
    if (opts?.severity) params.set("severity", opts.severity);
    if (opts?.type) params.set("type", opts.type);
    const query = params.toString();
    const base = opts?.environmentId ? `/events/environment/${encodeURIComponent(opts.environmentId)}` : "/events";
    return this.client.request<PaginatedResponse<Event>>("GET", `${base}${query ? `?${query}` : ""}`);
  }
```

**Ojo con el orden de los parámetros.** `appendListParams` escribe primero los cinco comunes y después van los propios de cada endpoint. Los tests asertan la URL exacta, así que ese orden importa.

- [ ] **Step 5: Ejecutar los tests y comprobar que pasan**

```bash
npx vitest run src/__tests__/arcane-client.test.ts -t "descartados en silencio"
npm test
npm run type-check
```

Esperado: los 7 nuevos PASS; **179 passed**; `type-check` limpio.

- [ ] **Step 6: Commit**

```bash
git add src/arcane-client.ts src/__tests__/arcane-client.test.ts
git commit -m "fix(client): dejar de descartar parametros de listado en silencio

projects.list y templates.list escribian solo search en la query, mientras
sus tools declaraban limit y se lo pasaban: quien pedia 50 recibia 20.
activities.list y events.list heredaban sort/order/start de
ListOptionsWithSort y no los reenviaban.

Los cinco metodos pasan por appendListParams y anaden despues sus filtros
propios, con los nombres y tipos que declara openapi.txt.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: e2e — los invariantes de paginación contra la instancia real

**Files:**
- Create: `src/__e2e__/paginacion.e2e.ts`

**Interfaces:**
- Consumes: `e2eClient()` de `src/__e2e__/helpers.ts`; los métodos `list()` de las tareas 4 y 5.

**Por qué aquí y no al final.** Esta tarea verifica el cliente contra la API real **antes** de reescribir 13 tools encima. Si `start` o `counts` no se comportan como dice el spec, se descubre ahora.

**Sin cifras clavadas.** Los tests no afirman "32 volúmenes": afirman invariantes que siguen siendo verdad con 32 o con 300.

- [ ] **Step 1: Crear el fichero e2e**

```ts
import { describe, it, expect } from "vitest";
import { e2eClient } from "./helpers";

/**
 * Invariantes de la superficie de listado contra la instancia real.
 *
 * Todo es lectura: ninguna de estas comprobaciones muta nada.
 *
 * No se afirma ninguna cantidad concreta. Un test que dijera "32 volumenes"
 * empezaria a fallar el dia que se cree el volumen 33, sin que nada este roto.
 */
describe("paginacion (e2e, Arcane 2.8.0)", () => {
  const client = e2eClient();
  const envId = "0";

  it("containers.list trae counts y cuadra con la paginacion", async () => {
    const r = await client.containers.list(envId);
    expect(r.counts).toBeDefined();
    expect(r.counts.totalContainers).toBe(r.pagination.totalItems);
  });

  it("volumes.list trae counts y cuadra con la paginacion", async () => {
    const r = await client.volumes.list(envId);
    expect(r.counts).toBeDefined();
    expect(r.counts.total).toBe(r.pagination.totalItems);
    expect(r.counts.inuse + r.counts.unused).toBe(r.counts.total);
  });

  it("networks.list trae counts y cuadra con la paginacion", async () => {
    const r = await client.networks.list(envId);
    expect(r.counts).toBeDefined();
    expect(r.counts.total).toBe(r.pagination.totalItems);
  });

  it("start recorre la coleccion entera sin repetir ni perder elementos", async () => {
    // limit=5 fuerza la paginacion en cualquier recurso con 6 o mas elementos.
    const limit = 5;
    const primera = await client.volumes.list(envId, { limit, start: 0 });
    const total = primera.pagination.totalItems;

    // Si hubiera menos de 6 volumenes no habria nada que paginar y el test no
    // probaria nada: entonces falla, en vez de pasar vacio.
    expect(total).toBeGreaterThan(limit);
    expect(primera.pagination.totalPages).toBeGreaterThan(1);

    const nombres: string[] = [];
    for (let start = 0; start < total; start += limit) {
      const pagina = await client.volumes.list(envId, { limit, start });
      expect(pagina.pagination.currentPage).toBe(Math.floor(start / limit) + 1);
      nombres.push(...(pagina.data ?? []).map((v) => v.name));
    }

    expect(nombres).toHaveLength(total);
    expect(new Set(nombres).size).toBe(total);
  });

  it("limit por encima del total lo devuelve todo en una pagina", async () => {
    const r = await client.volumes.list(envId, { limit: 1000 });
    expect(r.pagination.totalPages).toBe(1);
    expect(r.data ?? []).toHaveLength(r.pagination.totalItems);
  });

  it("stacks.list respeta el limit que antes se descartaba", async () => {
    const r = await client.stacks.list(envId, { limit: 1 });
    expect(r.pagination.itemsPerPage).toBe(1);
    expect((r.data ?? []).length).toBeLessThanOrEqual(1);
  });

  it("activities.list acepta sort, order y start", async () => {
    const r = await client.activities.list(envId, { sort: "createdAt", order: "desc", start: 0, limit: 3 });
    expect(r.success).toBe(true);
    expect((r.data ?? []).length).toBeLessThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Ejecutar los e2e y contar uno a uno**

```bash
set -a; . ./.dev.vars; set +a
ARCANE_BASE_URL=http://192.168.180.210:3552 npm run test:e2e -- --reporter=verbose
```

Esperado: **26 passed** (19 de partida + 7 nuevos), **0 skipped**. Cuenta las líneas con `✓` una a una: un fichero que aborta al importar aparece como `skipped`, no como fallo, y `skipped` no es verde.

Si `stacks.list` con `limit: 1` devolviera `itemsPerPage: 20`, el arreglo de la Task 5 no ha llegado: vuelve atrás en vez de relajar el test.

- [ ] **Step 3: Commit**

```bash
git add src/__e2e__/paginacion.e2e.ts
git commit -m "test(e2e): invariantes de paginacion contra la instancia real

Sin cifras clavadas: se afirma que counts cuadra con totalItems y que start
recorre la coleccion sin repetir ni perder elementos, lo que sigue siendo
verdad con 32 volumenes o con 300.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: tools de listado — containers, images, volumes, networks

**Files:**
- Modify: `src/tools/containers.ts:7-30`, `src/tools/images.ts:7-30`, `src/tools/volumes.ts:7-30`, `src/tools/networks.ts:7-30`
- Modify: `src/__tests__/tools.test.ts`

**Interfaces:**
- Consumes: `withErrors`, `listResponse` de `src/tools/respond.ts` (Task 1); los métodos `list()` de la Task 4.
- Produces: las cuatro tools con `LIST_PARAMS` y el contrato de salida nuevo.

**Nota sobre la inferencia de tipos:** está comprobada. `server.tool(nombre, desc, { ...LIST_PARAMS }, withErrors(async ({ search, start }) => ...))` compila bajo `strict` con los tipos correctos, y el extractor del generador resuelve el spread. No anotes el parámetro del handler a mano.

- [ ] **Step 1: Escribir los tests, que fallan**

Añadir a `src/__tests__/tools.test.ts`, dentro del `describe("MCP Tools", ...)`:

```ts
  describe("Superficie de listado — containers, images, volumes, networks", () => {
    it("arcane_volume_list pasa los parametros de paginacion al cliente", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerVolumeTools(server as any, mockClient);

      (mockClient.volumes.list as any).mockResolvedValue({
        success: true,
        data: [],
        counts: { inuse: 0, unused: 0, total: 0 },
        pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
      });

      const handler = server.getHandler("arcane_volume_list");
      await handler({ environmentId: "env1", search: "data", sort: "name", order: "asc", start: 20, limit: 50, inUse: "true" });

      expect(mockClient.volumes.list).toHaveBeenCalledWith("env1", {
        search: "data", sort: "name", order: "asc", start: 20, limit: 50,
        inUse: "true", includeInternal: undefined,
      });
    });

    it("arcane_volume_list avisa en prosa cuando la lista viene truncada", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerVolumeTools(server as any, mockClient);

      (mockClient.volumes.list as any).mockResolvedValue({
        success: true,
        data: Array.from({ length: 20 }, (_, i) => ({ name: `vol${i}` })),
        counts: { inuse: 8, unused: 24, total: 32 },
        pagination: { totalItems: 32, totalPages: 2, currentPage: 1, itemsPerPage: 20 },
      });

      const handler = server.getHandler("arcane_volume_list");
      const result = await handler({ environmentId: "env1" });

      const [primera] = result.content[0].text.split("\n");
      expect(primera).toBe("Showing 20 of 32 volumes (page 1 of 2). Pass start=20 to see the rest.");
      expect(result.isError).toBeUndefined();
    });

    it("arcane_volume_list incluye counts y pagination en el cuerpo", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerVolumeTools(server as any, mockClient);

      (mockClient.volumes.list as any).mockResolvedValue({
        success: true,
        data: [{ name: "vol1" }],
        counts: { inuse: 1, unused: 0, total: 1 },
        pagination: { totalItems: 1, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
      });

      const handler = server.getHandler("arcane_volume_list");
      const result = await handler({ environmentId: "env1" });
      const body = JSON.parse(result.content[0].text);

      expect(body.counts).toEqual({ inuse: 1, unused: 0, total: 1 });
      expect(body.pagination.totalItems).toBe(1);
      expect(body.data).toEqual([{ name: "vol1" }]);
    });

    it("arcane_container_list sigue devolviendo isError cuando el cliente falla", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerContainerTools(server as any, mockClient);

      (mockClient.containers.list as any).mockRejectedValue(new ArcaneApiError("boom", 500));

      const handler = server.getHandler("arcane_container_list");
      const result = await handler({ environmentId: "env1" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("boom");
    });

    it("arcane_image_list pasa inUse y los cinco comunes", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerImageTools(server as any, mockClient);

      (mockClient.images.list as any).mockResolvedValue({
        success: true,
        data: [],
        pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
      });

      const handler = server.getHandler("arcane_image_list");
      await handler({ environmentId: "env1", inUse: "false", limit: 10 });

      expect(mockClient.images.list).toHaveBeenCalledWith("env1", {
        search: undefined, sort: undefined, order: undefined, start: undefined,
        limit: 10, inUse: "false",
      });
    });

    it("arcane_network_list pasa inUse y los cinco comunes", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerNetworkTools(server as any, mockClient);

      (mockClient.networks.list as any).mockResolvedValue({
        success: true,
        data: [],
        counts: { inuse: 0, unused: 0, total: 0 },
        pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
      });

      const handler = server.getHandler("arcane_network_list");
      await handler({ environmentId: "env1", inUse: "true" });

      expect(mockClient.networks.list).toHaveBeenCalledWith("env1", {
        search: undefined, sort: undefined, order: undefined, start: undefined,
        limit: undefined, inUse: "true",
      });
    });
  });
```

- [ ] **Step 2: Ejecutar los tests y comprobar que fallan**

```bash
npx vitest run src/__tests__/tools.test.ts -t "Superficie de listado"
```

Esperado: FAIL — las tools no aceptan esos parámetros y devuelven el array pelado.

- [ ] **Step 3: Reescribir `src/tools/volumes.ts`**

Cabecera del fichero, tras los `import` existentes:

```ts
import { withErrors, listResponse } from "./respond";

const LIST_PARAMS = {
  search: z.string().optional().describe("Free-text search over volume names and drivers"),
  sort: z.string().optional().describe("Column to sort by, e.g. name, createdAt, size"),
  order: z.string().optional().describe("Sort direction: asc or desc"),
  start: z.number().int().min(0).optional().describe("Start index for pagination (server default: 0)"),
  limit: z.number().int().min(1).optional().describe("Items per page (server default: 20)"),
};
```

Y la tool de listado pasa a:

```ts
  server.tool(
    "arcane_volume_list",
    "List Docker volumes in an environment. Returns pagination and in-use counts; if the response says there are more pages, pass start to see the rest before drawing conclusions about what exists.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      ...LIST_PARAMS,
      inUse: z.string().optional().describe("Filter by in-use status: true or false"),
      includeInternal: z.boolean().optional().describe("Include internal volumes (server default: false)"),
    },
    withErrors(async ({ environmentId, environmentName, search, sort, order, start, limit, inUse, includeInternal }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.volumes.list(envId, { search, sort, order, start, limit, inUse, includeInternal });
      return listResponse(result, "volumes");
    }),
  );
```

- [ ] **Step 4: Reescribir `src/tools/containers.ts`**

```ts
import { withErrors, listResponse } from "./respond";

const LIST_PARAMS = {
  search: z.string().optional().describe("Free-text search over container names and images"),
  sort: z.string().optional().describe("Column to sort by, e.g. name, state, created"),
  order: z.string().optional().describe("Sort direction: asc or desc"),
  start: z.number().int().min(0).optional().describe("Start index for pagination (server default: 0)"),
  limit: z.number().int().min(1).optional().describe("Items per page (server default: 20)"),
};
```

```ts
  server.tool(
    "arcane_container_list",
    "List Docker containers in an environment. Returns pagination and running/stopped counts; if the response says there are more pages, pass start to see the rest before drawing conclusions about what exists.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      ...LIST_PARAMS,
      includeInternal: z.boolean().optional().describe("Include internal containers (server default: false)"),
      standalone: z.string().optional().describe("Filter standalone containers only: true or false"),
    },
    withErrors(async ({ environmentId, environmentName, search, sort, order, start, limit, includeInternal, standalone }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.containers.list(envId, { search, sort, order, start, limit, includeInternal, standalone });
      return listResponse(result, "containers");
    }),
  );
```

- [ ] **Step 5: Reescribir `src/tools/images.ts`**

```ts
import { withErrors, listResponse } from "./respond";

const LIST_PARAMS = {
  search: z.string().optional().describe("Free-text search over image repositories and tags"),
  sort: z.string().optional().describe("Column to sort by, e.g. repository, size, created"),
  order: z.string().optional().describe("Sort direction: asc or desc"),
  start: z.number().int().min(0).optional().describe("Start index for pagination (server default: 0)"),
  limit: z.number().int().min(1).optional().describe("Items per page (server default: 20)"),
};
```

```ts
  server.tool(
    "arcane_image_list",
    "List Docker images in an environment. Returns pagination; if the response says there are more pages, pass start to see the rest before drawing conclusions about what exists.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      ...LIST_PARAMS,
      inUse: z.string().optional().describe("Filter by in-use status: true or false"),
    },
    withErrors(async ({ environmentId, environmentName, search, sort, order, start, limit, inUse }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.images.list(envId, { search, sort, order, start, limit, inUse });
      return listResponse(result, "images");
    }),
  );
```

- [ ] **Step 6: Reescribir `src/tools/networks.ts`**

```ts
import { withErrors, listResponse } from "./respond";

const LIST_PARAMS = {
  search: z.string().optional().describe("Free-text search over network names and drivers"),
  sort: z.string().optional().describe("Column to sort by, e.g. name, driver, created"),
  order: z.string().optional().describe("Sort direction: asc or desc"),
  start: z.number().int().min(0).optional().describe("Start index for pagination (server default: 0)"),
  limit: z.number().int().min(1).optional().describe("Items per page (server default: 20)"),
};
```

```ts
  server.tool(
    "arcane_network_list",
    "List Docker networks in an environment. Returns pagination and in-use counts; if the response says there are more pages, pass start to see the rest before drawing conclusions about what exists.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      ...LIST_PARAMS,
      inUse: z.string().optional().describe("Filter by in-use status: true or false"),
    },
    withErrors(async ({ environmentId, environmentName, search, sort, order, start, limit, inUse }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.networks.list(envId, { search, sort, order, start, limit, inUse });
      return listResponse(result, "networks");
    }),
  );
```

- [ ] **Step 7: Ejecutar los tests y regenerar la tabla**

```bash
npx vitest run src/__tests__/tools.test.ts -t "Superficie de listado"
npm test
npm run type-check
npm run gen-tools-table -- --check
```

Esperado: los 6 nuevos PASS; **185 passed**; `type-check` limpio; y `gen-tools-table --check` **FALLA** diciendo que la tabla está desactualizada — es la señal correcta de que los parámetros nuevos llegaron a las cuatro tools.

```bash
npm run gen-tools-table
npm run gen-tools-table -- --check
```

Esperado tras regenerar: `OK: la tabla del README.md está al día (81 tools).` La cuenta sigue siendo 81: han cambiado los parámetros, no el número de tools.

- [ ] **Step 8: Commit**

```bash
git add src/tools/containers.ts src/tools/images.ts src/tools/volumes.ts src/tools/networks.ts src/__tests__/tools.test.ts README.md
git commit -m "feat(tools): paginacion y filtros en los cuatro listados de Docker

Las cuatro tools no aceptaban un solo parametro y devolvian un array pelado,
asi que una lista truncada era indistinguible de una completa. Hoy mismo
arcane_volume_list devolvia 20 de 32 volumenes sin decirlo.

Ahora aceptan los cinco comunes mas sus filtros propios, y devuelven
{pagination, counts, data} con un aviso en prosa cuando falta algo.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: tools de listado — stacks, templates, environments, activities, events

**Files:**
- Modify: `src/tools/stacks.ts:7-30`, `src/tools/templates.ts:6-27`, `src/tools/environments.ts:7-25`, `src/tools/activities.ts:7-31`, `src/tools/events.ts:11-32`
- Modify: `src/__tests__/tools.test.ts`

**Interfaces:**
- Consumes: `withErrors`, `listResponse` (Task 1); los métodos `list()` de la Task 5.

**Se retira el `.max(100)`.** Estas tools declaran hoy `limit: z.number().int().min(1).max(100).optional().default(50)`. El `.max(100)` no lo declara `openapi.txt` y el servidor no lo aplica (con `limit=1000` responde `itemsPerPage: 1000`). El `.default(50)` también se retira: el valor por defecto lo pone el servidor, y anunciar 50 cuando el servidor aplica 20 fue parte del problema.

- [ ] **Step 1: Escribir los tests, que fallan**

Añadir a `src/__tests__/tools.test.ts`:

```ts
  describe("Superficie de listado — stacks, templates, environments, activities, events", () => {
    it("arcane_stack_list pasa limit al cliente y ya no lo pierde", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerStackTools(server as any, mockClient);

      const handler = server.getHandler("arcane_stack_list");
      await handler({ environmentId: "env1", search: "app", limit: 50, status: "running" });

      expect(mockClient.stacks.list).toHaveBeenCalledWith("env1", {
        search: "app", sort: undefined, order: undefined, start: undefined,
        limit: 50, status: "running", archived: undefined, tags: undefined,
      });
    });

    it("arcane_stack_list ya no impone un limit por defecto propio", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerStackTools(server as any, mockClient);

      const handler = server.getHandler("arcane_stack_list");
      await handler({ environmentId: "env1" });

      expect(mockClient.stacks.list).toHaveBeenCalledWith("env1", expect.objectContaining({ limit: undefined }));
    });

    it("arcane_activity_list pasa sort, order y start", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerActivityTools(server as any, mockClient);

      (mockClient.activities.list as any).mockResolvedValue({
        success: true,
        data: [],
        pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 50 },
      });

      const handler = server.getHandler("arcane_activity_list");
      await handler({ environmentId: "env1", sort: "createdAt", order: "desc", start: 50, status: "failed" });

      expect(mockClient.activities.list).toHaveBeenCalledWith("env1", {
        search: undefined, sort: "createdAt", order: "desc", start: 50, limit: undefined,
        status: "failed", type: undefined, resourceType: undefined,
      });
    });

    it("arcane_event_list pasa sort, order y start", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerEventTools(server as any, mockClient);

      (mockClient.events.list as any).mockResolvedValue({
        success: true,
        data: [],
        pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
      });

      const handler = server.getHandler("arcane_event_list");
      await handler({ sort: "timestamp", order: "desc", start: 20, severity: "error" });

      expect(mockClient.events.list).toHaveBeenCalledWith({
        environmentId: undefined, search: undefined, sort: "timestamp", order: "desc",
        start: 20, limit: undefined, severity: "error", type: undefined,
      });
    });

    it("arcane_environment_list devuelve el sobre con paginacion", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerEnvironmentTools(server as any, mockClient);

      (mockClient.environments.list as any).mockResolvedValue({
        success: true,
        data: [{ id: "env1", name: "local" }],
        pagination: { totalItems: 1, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
      });

      const handler = server.getHandler("arcane_environment_list");
      const result = await handler({});
      const body = JSON.parse(result.content[0].text);

      expect(body.pagination.totalItems).toBe(1);
      expect(body.data).toHaveLength(1);
    });

    it("arcane_template_list avisa en prosa cuando la lista viene truncada", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerTemplateTools(server as any, mockClient);

      (mockClient.templates.list as any).mockResolvedValue({
        success: true,
        data: Array.from({ length: 20 }, (_, i) => ({ id: `t${i}` })),
        pagination: { totalItems: 45, totalPages: 3, currentPage: 1, itemsPerPage: 20 },
      });

      const handler = server.getHandler("arcane_template_list");
      const result = await handler({});
      const [primera] = result.content[0].text.split("\n");

      expect(primera).toBe("Showing 20 of 45 templates (page 1 of 3). Pass start=20 to see the rest.");
    });
  });
```

- [ ] **Step 2: Ejecutar los tests y comprobar que fallan**

```bash
npx vitest run src/__tests__/tools.test.ts -t "stacks, templates, environments"
```

Esperado: FAIL.

- [ ] **Step 3: Reescribir `src/tools/stacks.ts`**

```ts
import { withErrors, listResponse } from "./respond";

const LIST_PARAMS = {
  search: z.string().optional().describe("Free-text search over stack names"),
  sort: z.string().optional().describe("Column to sort by, e.g. name, status, createdAt"),
  order: z.string().optional().describe("Sort direction: asc or desc"),
  start: z.number().int().min(0).optional().describe("Start index for pagination (server default: 0)"),
  limit: z.number().int().min(1).optional().describe("Items per page (server default: 20)"),
};
```

```ts
  server.tool(
    "arcane_stack_list",
    "List Docker Compose stacks (projects) in an environment. Returns pagination; if the response says there are more pages, pass start to see the rest before drawing conclusions about what exists.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      ...LIST_PARAMS,
      status: z.string().optional().describe("Filter by status, comma-separated: running, stopped, partially running"),
      archived: z.string().optional().describe("Archived filter: 'true' for only archived, 'all' to include them. Excluded by default"),
      tags: z.string().optional().describe("Filter by tag names, comma-separated, OR semantics"),
    },
    withErrors(async ({ environmentId, environmentName, search, sort, order, start, limit, status, archived, tags }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.stacks.list(envId, { search, sort, order, start, limit, status, archived, tags });
      return listResponse(result, "stacks");
    }),
  );
```

- [ ] **Step 4: Reescribir `src/tools/templates.ts`**

```ts
import { withErrors, listResponse } from "./respond";

const LIST_PARAMS = {
  search: z.string().optional().describe("Free-text search over template names"),
  sort: z.string().optional().describe("Column to sort by, e.g. name, createdAt"),
  order: z.string().optional().describe("Sort direction: asc or desc"),
  start: z.number().int().min(0).optional().describe("Start index for pagination (server default: 0)"),
  limit: z.number().int().min(1).optional().describe("Items per page (server default: 20)"),
};
```

```ts
  server.tool(
    "arcane_template_list",
    "List Docker Compose templates. Returns pagination; if the response says there are more pages, pass start to see the rest before drawing conclusions about what exists.",
    {
      ...LIST_PARAMS,
      type: z.string().optional().describe("Filter by template type"),
    },
    withErrors(async ({ search, sort, order, start, limit, type }) => {
      const result = await client.templates.list({ search, sort, order, start, limit, type });
      return listResponse(result, "templates");
    }),
  );
```

- [ ] **Step 5: Reescribir `src/tools/environments.ts`**

```ts
import { withErrors, listResponse } from "./respond";

const LIST_PARAMS = {
  search: z.string().optional().describe("Free-text search over environment names"),
  sort: z.string().optional().describe("Column to sort by, e.g. name, status"),
  order: z.string().optional().describe("Sort direction: asc or desc"),
  start: z.number().int().min(0).optional().describe("Start index for pagination (server default: 0)"),
  limit: z.number().int().min(1).optional().describe("Items per page (server default: 20)"),
};
```

```ts
  server.tool(
    "arcane_environment_list",
    "List Docker environments managed by Arcane. Returns environment IDs, names, connection status and pagination; if the response says there are more pages, pass start to see the rest.",
    {
      ...LIST_PARAMS,
      type: z.string().optional().describe("Filter by environment type"),
    },
    withErrors(async ({ search, sort, order, start, limit, type }) => {
      const result = await client.environments.list({ search, sort, order, start, limit, type });
      return listResponse(result, "environments");
    }),
  );
```

- [ ] **Step 6: Reescribir `src/tools/activities.ts`**

```ts
import { withErrors, listResponse } from "./respond";

const LIST_PARAMS = {
  search: z.string().optional().describe("Free-text search over activity names and resources"),
  sort: z.string().optional().describe("Column to sort by, e.g. createdAt, status, type"),
  order: z.string().optional().describe("Sort direction: asc or desc"),
  start: z.number().int().min(0).optional().describe("Start index for pagination (server default: 0)"),
  limit: z.number().int().min(1).optional().describe("Items per page (server default: 50)"),
};
```

```ts
  server.tool(
    "arcane_activity_list",
    "List background activities (deployments, pulls, scans) with optional filters. Returns pagination; if the response says there are more pages, pass start to see the rest before concluding an activity did not happen.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      ...LIST_PARAMS,
      status: z.string().optional().describe("Filter by status, e.g. running, success, failed"),
      type: z.string().optional().describe("Filter by activity type, e.g. image_update_check"),
      resourceType: z.string().optional().describe("Filter by resource type, e.g. images, volume"),
    },
    withErrors(async ({ environmentId, environmentName, search, sort, order, start, limit, status, type, resourceType }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.activities.list(envId, { search, sort, order, start, limit, status, type, resourceType });
      return listResponse(result, "activities");
    }),
  );
```

Las otras dos tools del fichero (`arcane_activity_get` y `arcane_activity_cancel`) solo cambian para envolverse en `withErrors` y perder su `catch`. `arcane_activity_cancel` **conserva** su comprobación de `result.success === false`:

```ts
    withErrors(async ({ environmentId, environmentName, activityId, requestedBy }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.activities.cancel(envId, activityId, requestedBy);
      if (result.success === false) {
        return {
          content: [{ type: "text" as const, text: `Error: ${result.data?.error || "Cancel failed"}` }],
          isError: true,
        };
      }
      // El mensaje sale del estado real de la activity, no de un `message` inexistente.
      return textResponse(`Activity ${activityId} is now '${result.data.status}'`);
    }),
```

Añade `textResponse` al import de `./respond` en este fichero.

- [ ] **Step 7: Reescribir `src/tools/events.ts`**

```ts
import { withErrors, listResponse } from "./respond";

const LIST_PARAMS = {
  search: z.string().optional().describe("Free-text search over event messages"),
  sort: z.string().optional().describe("Column to sort by, e.g. timestamp, severity"),
  order: z.string().optional().describe("Sort direction: asc or desc"),
  start: z.number().int().min(0).optional().describe("Start index for pagination (server default: 0)"),
  limit: z.number().int().min(1).optional().describe("Items per page (server default: 20)"),
};
```

```ts
  server.tool(
    "arcane_event_list",
    "List audit log events. Returns pagination; if the response says there are more pages, pass start to see the rest before concluding an event was not recorded.",
    {
      environmentId: z.string().optional().describe("Filter events to one environment"),
      ...LIST_PARAMS,
      severity: z.string().optional().describe("Filter by severity: info, success, warning, error"),
      type: z.string().optional().describe("Filter by event type"),
    },
    withErrors(async ({ environmentId, search, sort, order, start, limit, severity, type }) => {
      const result = await client.events.list({ environmentId, search, sort, order, start, limit, severity, type });
      return listResponse(result, "events");
    }),
  );
```

`arcane_event_stats` solo se envuelve en `withErrors`.

- [ ] **Step 8: Ejecutar todo y regenerar la tabla**

```bash
npx vitest run src/__tests__/tools.test.ts -t "stacks, templates, environments"
npm test
npm run type-check
npm run gen-tools-table
npm run gen-tools-table -- --check
```

Esperado: los 6 nuevos PASS; **191 passed**; `type-check` limpio; `OK: la tabla del README.md está al día (81 tools).`

Ojo: algunos tests preexistentes de `tools.test.ts` asertan la salida vieja (array pelado) o el `limit: 50` por defecto de `arcane_stack_list`. **Actualízalos al contrato nuevo**, no revierta el cambio. Si un test preexistente asertaba `expect(result.content[0].text).toBe("[]")`, ahora debe asertar el sobre.

- [ ] **Step 9: Commit**

```bash
git add src/tools/stacks.ts src/tools/templates.ts src/tools/environments.ts src/tools/activities.ts src/tools/events.ts src/__tests__/tools.test.ts README.md
git commit -m "feat(tools): completar la superficie de listado de las cinco tools parciales

stacks y templates anunciaban limit y lo perdian por el camino; activities y
events declaraban sort/order/start heredados y no los reenviaban. Las cinco
pasan al contrato de salida comun.

Se retira el .max(100) y el .default(50): openapi.txt no declara maximo, el
servidor acepta limit=1000, y anunciar un default de 50 cuando el servidor
aplica 20 era parte del problema.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: tools de listado — git-repositories, gitops-syncs, volume-backups, jobs

**Files:**
- Modify: `src/tools/git-repositories.ts:6-28`, `src/tools/gitops-syncs.ts:44-70`, `src/tools/volume-backups.ts:31-58`, `src/tools/jobs.ts:20-40`
- Modify: `src/__tests__/tools.test.ts`

**Interfaces:**
- Consumes: `withErrors`, `listResponse`, `textResponse` de `src/tools/respond.ts`.

**Qué cambia aquí y qué no.** Las tres primeras **ya aceptan** los cinco parámetros y el cliente ya los envía: no hay que tocar el cliente. Cambia solo el contrato de salida (pasan por `listResponse`), se retira el `.max(100)` y el `.default(50)` por lo mismo que en la Task 8, y se les añade `.min(0)` a `start`.

`arcane_job_list` es el caso aparte: su endpoint devuelve `{jobs: [...]}`, no `{data, pagination}`, y no admite parámetros de query. **No** pasa por `listResponse`. Lo único que se le arregla es que con `jobs: null` devolvía literalmente el texto `"null"`.

- [ ] **Step 1: Escribir los tests, que fallan**

```ts
  describe("Superficie de listado — git, gitops, backups y jobs", () => {
    it("arcane_git_repository_list devuelve el sobre con paginacion", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerGitRepositoryTools(server as any, mockClient);

      (mockClient.gitRepositories.list as any).mockResolvedValue({
        success: true,
        data: [{ id: "r1", name: "infra" }],
        pagination: { totalItems: 1, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
      });

      const handler = server.getHandler("arcane_git_repository_list");
      const body = JSON.parse((await handler({})).content[0].text);

      expect(body.pagination.totalItems).toBe(1);
      expect(body.data).toHaveLength(1);
    });

    it("arcane_git_repository_list ya no impone un limit por defecto propio", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerGitRepositoryTools(server as any, mockClient);

      (mockClient.gitRepositories.list as any).mockResolvedValue({
        success: true, data: [], pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
      });

      const handler = server.getHandler("arcane_git_repository_list");
      await handler({});

      expect(mockClient.gitRepositories.list).toHaveBeenCalledWith(expect.objectContaining({ limit: undefined }));
    });

    it("arcane_job_list con jobs:null devuelve una lista vacia, no el texto 'null'", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerJobTools(server as any, mockClient);

      (mockClient.jobs.list as any).mockResolvedValue({ success: true, jobs: null });

      const handler = server.getHandler("arcane_job_list");
      const result = await handler({ environmentId: "env1" });

      expect(result.content[0].text.trim()).not.toBe("null");
      expect(JSON.parse(result.content[0].text)).toEqual([]);
    });

    it("arcane_job_list con jobs devuelve la lista tal cual", async () => {
      const mockClient = createMockClient();
      const server = createMockServer();
      registerJobTools(server as any, mockClient);

      (mockClient.jobs.list as any).mockResolvedValue({ success: true, jobs: [{ id: "j1", name: "image_update_check" }] });

      const handler = server.getHandler("arcane_job_list");
      const result = await handler({ environmentId: "env1" });

      expect(JSON.parse(result.content[0].text)).toEqual([{ id: "j1", name: "image_update_check" }]);
    });
  });
```

Añade al principio del fichero los imports que falten: `registerGitRepositoryTools` de `../tools/git-repositories` y `registerGitOpsSyncTools` de `../tools/gitops-syncs`, si no estaban ya.

- [ ] **Step 2: Ejecutar los tests y comprobar que fallan**

```bash
npx vitest run src/__tests__/tools.test.ts -t "git, gitops, backups y jobs"
```

Esperado: FAIL.

- [ ] **Step 3: Reescribir la tool de listado de `src/tools/git-repositories.ts`**

```ts
import { withErrors, listResponse } from "./respond";

const LIST_PARAMS = {
  search: z.string().optional().describe("Free-text search over repository names and URLs"),
  sort: z.string().optional().describe("Column to sort by, e.g. name, url, createdAt"),
  order: z.string().optional().describe("Sort direction: asc or desc"),
  start: z.number().int().min(0).optional().describe("Start index for pagination (server default: 0)"),
  limit: z.number().int().min(1).optional().describe("Items per page (server default: 20)"),
};
```

```ts
  server.tool(
    "arcane_git_repository_list",
    "List git repositories configured in Arcane. Returns repository IDs, names, URLs, authentication details and pagination; if the response says there are more pages, pass start to see the rest.",
    { ...LIST_PARAMS },
    withErrors(async ({ search, sort, order, start, limit }) => {
      const result = await client.gitRepositories.list({ search, sort, order, start, limit });
      return listResponse(result, "git repositories");
    }),
  );
```

- [ ] **Step 4: Reescribir la tool de listado de `src/tools/gitops-syncs.ts`**

```ts
import { withErrors, listResponse } from "./respond";

const LIST_PARAMS = {
  search: z.string().optional().describe("Free-text search over sync names"),
  sort: z.string().optional().describe("Column to sort by, e.g. name, lastSyncAt, status"),
  order: z.string().optional().describe("Sort direction: asc or desc"),
  start: z.number().int().min(0).optional().describe("Start index for pagination (server default: 0)"),
  limit: z.number().int().min(1).optional().describe("Items per page (server default: 20)"),
};
```

```ts
  server.tool(
    "arcane_gitops_sync_list",
    "List GitOps syncs in an environment. Returns pagination; if the response says there are more pages, pass start to see the rest.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      ...LIST_PARAMS,
    },
    withErrors(async ({ environmentId, environmentName, search, sort, order, start, limit }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.gitOpsSyncs.list(envId, { search, sort, order, start, limit });
      return listResponse(result, "GitOps syncs");
    }),
  );
```

- [ ] **Step 5: Reescribir la tool de listado de `src/tools/volume-backups.ts`**

```ts
import { withErrors, listResponse } from "./respond";

const LIST_PARAMS = {
  search: z.string().optional().describe("Free-text search over backup names"),
  sort: z.string().optional().describe("Column to sort by, e.g. createdAt, size"),
  order: z.string().optional().describe("Sort direction: asc or desc"),
  start: z.number().int().min(0).optional().describe("Start index for pagination (server default: 0)"),
  limit: z.number().int().min(1).optional().describe("Items per page (server default: 20)"),
};
```

```ts
  server.tool(
    "arcane_volume_backup_list",
    "List backups of a Docker volume. Returns pagination; if the response says there are more pages, pass start to see the rest.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      volumeName: z.string().describe("Volume name"),
      ...LIST_PARAMS,
    },
    withErrors(async ({ environmentId, environmentName, volumeName, search, sort, order, start, limit }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.volumeBackups.list(envId, volumeName, { search, sort, order, start, limit });
      return listResponse(result, "volume backups");
    }),
  );
```

- [ ] **Step 6: Arreglar `arcane_job_list` en `src/tools/jobs.ts`**

Este fichero necesita `textResponse` además de `withErrors`, porque su listado no
pasa por `listResponse`:

```ts
import { withErrors, textResponse } from "./respond";
```

```ts
    withErrors(async ({ environmentId, environmentName }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.jobs.list(envId);
      // Este endpoint devuelve {jobs:[...]}, no el sobre paginado del resto de
      // la API, asi que no pasa por listResponse. `jobs: null` se emitia como
      // el texto "null", que no es una lista vacia ni un error: era ruido.
      return textResponse(JSON.stringify(result.jobs ?? [], null, 2));
    }),
```

- [ ] **Step 7: Envolver el resto de tools de estos cuatro ficheros en `withErrors`**

Las demás tools de `git-repositories.ts`, `gitops-syncs.ts`, `volume-backups.ts` y `jobs.ts` pierden su `try`/`catch` y se envuelven en `withErrors`. Las que comprueban `result.success === false` **conservan esa comprobación**: solo desaparece el `catch`.

- [ ] **Step 8: Ejecutar todo y regenerar la tabla**

```bash
npm test
npm run type-check
npm run gen-tools-table
npm run gen-tools-table -- --check
```

Esperado: **195 passed**; `type-check` limpio; `OK: la tabla del README.md está al día (81 tools).`

- [ ] **Step 9: Commit**

```bash
git add src/tools/git-repositories.ts src/tools/gitops-syncs.ts src/tools/volume-backups.ts src/tools/jobs.ts src/__tests__/tools.test.ts README.md
git commit -m "feat(tools): contrato de salida comun en los cuatro listados restantes

Los tres que ya aceptaban los cinco parametros pasan a devolver el sobre con
paginacion. arcane_job_list no lo usa (su endpoint devuelve {jobs:[...]}),
pero deja de emitir el texto 'null' cuando la lista viene vacia.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: los cuatro resolvers dejan de mirar solo la primera página

**Files:**
- Modify: `src/tools/resolve.ts` (los tres resolvers, líneas 3-102)
- Modify: `src/tools/gitops-syncs.ts:5-35` (`resolveGitOpsSyncId`)
- Modify: `src/__tests__/resolve.test.ts`

**Interfaces:**
- Consumes: `collectAllPages`, `CollectedPages` de `src/tools/paging.ts` (Task 2).
- Produces: `function listaDisponibles(nombres: string[]): string` — helper local de `resolve.ts`, exportado para que `gitops-syncs.ts` lo use.

**El fallo que se corrige.** Los cuatro resolvers listan y filtran en cliente sobre la primera página. Cuando el elemento buscado cae fuera, el error afirma que no existe y adjunta una lista de "disponibles" también truncada, que confirma la conclusión falsa. `resolveContainerId` es el más expuesto: llama a `containers.list(envId)` sin parámetro alguno, y el host tiene 16 contenedores con el corte del servidor en 20.

- [ ] **Step 1: Escribir los tests, que fallan**

Añadir a `src/__tests__/resolve.test.ts`:

```ts
describe("resolvers y truncamiento", () => {
  /** Sirve `total` contenedores paginados, el buscado en la posicion `donde`. */
  const containersPaginados = (total: number, donde: number, nombre: string) =>
    vi.fn(async (envId: string, opts?: { start?: number; limit?: number }) => {
      const start = opts?.start ?? 0;
      const limit = opts?.limit ?? 20;
      const data = Array.from({ length: Math.max(0, Math.min(limit, total - start)) }, (_, i) => {
        const idx = start + i;
        return { id: `c${idx}`, names: [`/${idx === donde ? nombre : `relleno${idx}`}`] };
      });
      return {
        success: true,
        data,
        counts: { runningContainers: total, stoppedContainers: 0, totalContainers: total },
        pagination: {
          totalItems: total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
          currentPage: Math.floor(start / limit) + 1,
          itemsPerPage: limit,
        },
      };
    });

  it("encuentra un contenedor que cae fuera de la primera pagina", async () => {
    const list = containersPaginados(500, 350, "buscado");
    const mockClient = { containers: { list } } as unknown as ArcaneClient;

    const id = await resolveContainerId(mockClient, "env1", undefined, "buscado");
    expect(id).toBe("c350");
    expect(list.mock.calls.length).toBeGreaterThan(1);
  });

  it("cuando agota el tope, el error dice que no ha mirado todo", async () => {
    const list = containersPaginados(5000, 4999, "buscado");
    const mockClient = { containers: { list } } as unknown as ArcaneClient;

    await expect(resolveContainerId(mockClient, "env1", undefined, "buscado")).rejects.toThrow(
      /among the first 2000 of 5000 containers/,
    );
  });

  it("cuando la busqueda fue completa, el error dice que no existe", async () => {
    const list = containersPaginados(30, -1, "buscado");
    const mockClient = { containers: { list } } as unknown as ArcaneClient;

    await expect(resolveContainerId(mockClient, "env1", undefined, "buscado")).rejects.toThrow(
      /No container found with name 'buscado'/,
    );
  });

  it("la lista de disponibles se capa y declara cuantos oculta", async () => {
    const list = containersPaginados(100, -1, "buscado");
    const mockClient = { containers: { list } } as unknown as ArcaneClient;

    await expect(resolveContainerId(mockClient, "env1", undefined, "buscado")).rejects.toThrow(/and 70 more/);
  });
});
```

- [ ] **Step 2: Ejecutar los tests y comprobar que fallan**

```bash
npx vitest run src/__tests__/resolve.test.ts -t "truncamiento"
```

Esperado: FAIL — el primero porque solo mira la primera página, los demás porque los mensajes no existen.

- [ ] **Step 3: Añadir el helper de listado en `src/tools/resolve.ts`**

```ts
import { collectAllPages } from "./paging";

/** Cuantos nombres se listan como maximo en un mensaje de "no encontrado". */
const MAX_DISPONIBLES = 30;

/**
 * Lista nombres para un mensaje de error, capada.
 *
 * Sin cap, un entorno con 2.000 contenedores produciria un mensaje de error de
 * miles de nombres.
 */
export function listaDisponibles(nombres: string[]): string {
  if (nombres.length === 0) return "none";
  if (nombres.length <= MAX_DISPONIBLES) return nombres.join(", ");
  const sobran = nombres.length - MAX_DISPONIBLES;
  return `${nombres.slice(0, MAX_DISPONIBLES).join(", ")} …and ${sobran} more`;
}
```

- [ ] **Step 4: Reescribir `resolveContainerId`**

```ts
export async function resolveContainerId(
  client: ArcaneClient,
  envId: string,
  containerId?: string,
  containerName?: string
): Promise<string> {
  if (containerId) {
    return containerId;
  }

  if (!containerName) {
    throw new Error("Either containerId or containerName must be provided");
  }

  const { items, complete, totalItems } = await collectAllPages((start, limit) =>
    client.containers.list(envId, { start, limit })
  );

  const matches = items.filter((container) =>
    container.names?.some((name) => name === `/${containerName}` || name === containerName)
  );

  if (matches.length === 0) {
    // Decir "no existe" habiendo mirado solo una parte es una conclusion falsa.
    if (!complete) {
      throw new Error(
        `No container found with name '${containerName}' among the first ${items.length} of ${totalItems} ` +
          `containers in environment '${envId}'. Use the container ID instead.`
      );
    }
    const available = listaDisponibles(
      items.flatMap((container) => container.names ?? []).map((name) => name.replace(/^\//, ""))
    );
    throw new Error(
      `No container found with name '${containerName}' in environment '${envId}'. Available containers: ${available}`
    );
  }

  if (matches.length > 1) {
    const matchingIds = matches.map((container) => container.id).join(", ");
    throw new Error(
      `Multiple containers found with name '${containerName}' in environment '${envId}'. Please use the container ID instead. Matching IDs: ${matchingIds}`
    );
  }

  return matches[0].id;
}
```

- [ ] **Step 5: Reescribir `resolveEnvironmentId` y `resolveStackId` con la misma forma**

```ts
export async function resolveEnvironmentId(
  client: ArcaneClient,
  envId?: string,
  envName?: string
): Promise<string> {
  if (envId) {
    return envId;
  }

  if (!envName) {
    throw new Error("Either environmentId or environmentName must be provided");
  }

  const { items, complete, totalItems } = await collectAllPages((start, limit) =>
    client.environments.list({ search: envName, start, limit })
  );

  const matches = items.filter((env) => env.name === envName);

  if (matches.length === 0) {
    if (!complete) {
      throw new Error(
        `No environment found with name '${envName}' among the first ${items.length} of ${totalItems} ` +
          `environments. Use the environment ID instead.`
      );
    }
    throw new Error(
      `No environment found with name '${envName}'. Available environments: ${listaDisponibles(items.map((env) => env.name))}`
    );
  }

  if (matches.length > 1) {
    const matchingIds = matches.map((env) => env.id).join(", ");
    throw new Error(
      `Multiple environments found with name '${envName}'. Please use the environment ID instead. Matching IDs: ${matchingIds}`
    );
  }

  return matches[0].id;
}

export async function resolveStackId(
  client: ArcaneClient,
  envId: string,
  stackId?: string,
  stackName?: string
): Promise<string> {
  if (stackId) {
    return stackId;
  }

  if (!stackName) {
    throw new Error("Either stackId or stackName must be provided");
  }

  const { items, complete, totalItems } = await collectAllPages((start, limit) =>
    client.stacks.list(envId, { search: stackName, start, limit })
  );

  const matches = items.filter((stack) => stack.name === stackName);

  if (matches.length === 0) {
    if (!complete) {
      throw new Error(
        `No stack found with name '${stackName}' among the first ${items.length} of ${totalItems} ` +
          `stacks in environment '${envId}'. Use the stack ID instead.`
      );
    }
    throw new Error(
      `No stack found with name '${stackName}' in environment '${envId}'. Available stacks: ${listaDisponibles(items.map((stack) => stack.name))}`
    );
  }

  if (matches.length > 1) {
    const matchingIds = matches.map((stack) => stack.id).join(", ");
    throw new Error(
      `Multiple stacks found with name '${stackName}' in environment '${envId}'. Please use the stack ID instead. Matching IDs: ${matchingIds}`
    );
  }

  return matches[0].id;
}
```

**Ojo:** `resolveEnvironmentId` y `resolveStackId` conservan el `search` que ya usaban — es filtrado en servidor y reduce el trabajo. `resolveContainerId` **no** lleva `search`: la semántica del `search` de ese endpoint no está documentada en `openapi.txt` y el resolver hace un match exacto contra `names[]` con y sin barra inicial. Paginar lo hace correcto sin cambiar qué cuenta como coincidencia.

- [ ] **Step 6: Reescribir `resolveGitOpsSyncId` en `src/tools/gitops-syncs.ts`**

```ts
import { collectAllPages } from "./paging";
import { listaDisponibles } from "./resolve";

export async function resolveGitOpsSyncId(
  client: ArcaneClient,
  envId: string,
  syncId?: string,
  syncName?: string
): Promise<string> {
  if (syncId) {
    return syncId;
  }

  if (!syncName) {
    throw new Error("Either syncId or syncName must be provided");
  }

  const { items, complete, totalItems } = await collectAllPages((start, limit) =>
    client.gitOpsSyncs.list(envId, { search: syncName, start, limit })
  );

  const matches = items.filter((sync) => sync.name === syncName);

  if (matches.length === 0) {
    if (!complete) {
      throw new Error(
        `No GitOps sync found with name '${syncName}' among the first ${items.length} of ${totalItems} ` +
          `syncs in environment '${envId}'. Use the sync ID instead.`
      );
    }
    throw new Error(
      `No GitOps sync found with name '${syncName}' in environment '${envId}'. Available syncs: ${listaDisponibles(items.map((sync) => sync.name))}`
    );
  }

  if (matches.length > 1) {
    const matchingIds = matches.map((sync) => sync.id).join(", ");
    throw new Error(
      `Multiple GitOps syncs found with name '${syncName}' in environment '${envId}'. Please use the sync ID instead. Matching IDs: ${matchingIds}`
    );
  }

  return matches[0].id;
}
```

- [ ] **Step 7: Ejecutar los tests**

```bash
npx vitest run src/__tests__/resolve.test.ts
npm test
npm run type-check
```

Esperado: los 4 nuevos PASS y **199 passed** en total.

Los tests preexistentes de `resolve.test.ts` asertan `toHaveBeenCalledWith({ search: "production", limit: 50 })`. Ahora la llamada es `{ search: "production", start: 0, limit: 200 }`. **Actualiza la aserción**, no el código: `PAGE_SIZE` vale 200 y `collectAllPages` empieza en `start: 0`.

- [ ] **Step 8: Comprobar contra la instancia real que la resolución por nombre sigue funcionando**

```bash
set -a; . ./.dev.vars; set +a
ARCANE_BASE_URL=http://192.168.180.210:3552 npm run test:e2e -- --reporter=verbose
```

Esperado: **26 passed**, 0 skipped. Los e2e existentes de `stack-lifecycle` y `volume-workspace` resuelven stacks y volúmenes por nombre; si el cambio de los resolvers rompiera algo, saltan aquí.

- [ ] **Step 9: Commit**

```bash
git add src/tools/resolve.ts src/tools/gitops-syncs.ts src/__tests__/resolve.test.ts
git commit -m "fix(tools): los resolvers dejan de concluir 'no existe' sobre una pagina

Los cuatro resolvers nombre->id listaban y filtraban en cliente sobre la
primera pagina. Cuando el elemento caia fuera, el error afirmaba que no
existia y adjuntaba una lista de disponibles tambien truncada, que confirmaba
la conclusion falsa. resolveContainerId era el mas expuesto: listaba sin un
solo parametro, con el corte del servidor en 20.

Ahora recorren la coleccion con collectAllPages y, si agotan el tope, el
mensaje dice 'among the first N of M' en vez de negar la existencia. La lista
de disponibles se capa a 30 mas el recuento de las que oculta.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: `withErrors` en las tools que no son de listado

**Files:**
- Modify: `src/tools/containers.ts`, `containers-additional.ts`, `environments.ts`, `images.ts`, `networks.ts`, `projects-additional.ts`, `stacks.ts`, `system.ts`, `templates.ts`, `volume-backups.ts`, `volume-files.ts`, `volumes.ts`, `activities.ts`, `events.ts`, `jobs.ts`, `git-repositories.ts`, `gitops-syncs.ts` — las tools que aún conservan su `try`/`catch`

**Interfaces:**
- Consumes: `withErrors`, `textResponse` de `src/tools/respond.ts`.

**Transformación mecánica, con una regla que no se puede saltar.** Para cada tool que aún tenga `try { ... } catch (err) { ... }`:

1. El handler `async ({...}) => { try { CUERPO } catch (err) { ... } }` pasa a `withErrors(async ({...}) => { CUERPO })`.
2. **Las comprobaciones de `result.success === false` se conservan intactas.** `withErrors` atrapa excepciones; no convierte un `success:false` en error. Un `success:false` silenciado fue el bug de `arcane_project_redeploy` y el de `arcane_system_prune` en F2.

- [ ] **Step 1: Contar cuántos `catch` quedan antes de empezar**

```bash
grep -c 'err instanceof Error ? err.message : String(err)' src/tools/*.ts | awk -F: '{s+=$2} END {print "catch restantes:",s}'
```

Anota el número. Al final tiene que ser **0**.

- [ ] **Step 2: Contar cuántas comprobaciones de `success` hay que preservar**

```bash
grep -rn 'success === false\|result.success' src/tools/*.ts | wc -l
```

Anota el número. Al final tiene que ser **el mismo**: `withErrors` no debe llevarse por delante ninguna.

- [ ] **Step 3: Aplicar la transformación fichero a fichero**

Ejemplo real, `arcane_stack_start` en `src/tools/stacks.ts`. Antes:

```ts
    async ({ environmentId, environmentName, stackId, stackName }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        const id = await resolveStackId(client, envId, stackId, stackName);
        const result = await client.stacks.start(envId, id);
        if (result.success === false) {
          return { content: [{ type: "text", text: `Error: ${result.message}` }], isError: true };
        }
        return { content: [{ type: "text", text: result.message }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
```

Después:

```ts
    withErrors(async ({ environmentId, environmentName, stackId, stackName }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const id = await resolveStackId(client, envId, stackId, stackName);
      const result = await client.stacks.start(envId, id);
      if (result.success === false) {
        return { content: [{ type: "text" as const, text: `Error: ${result.message}` }], isError: true };
      }
      return textResponse(result.message);
    }),
```

Fíjate en el `as const` de `type: "text"` cuando el objeto se construye a mano dentro de una rama: sin él, TypeScript ensancha el tipo a `string` y no encaja con `ToolResult`. Usando `textResponse()` no hace falta.

- [ ] **Step 4: Comprobar que no queda ningún `catch` ni se ha perdido ninguna comprobación**

```bash
grep -c 'err instanceof Error ? err.message : String(err)' src/tools/*.ts | awk -F: '{s+=$2} END {print "catch restantes:",s}'
grep -rn 'success === false\|result.success' src/tools/*.ts | wc -l
grep -c 'withErrors(' src/tools/*.ts | awk -F: '{s+=$2} END {print "handlers envueltos:",s}'
```

Esperado: **catch restantes: 1** — el único que queda es el de dentro de `withErrors` en `src/tools/respond.ts`. Comprobaciones de `success`: el mismo número que en el Step 2. Handlers envueltos: **exactamente 81**, uno por tool. La declaración de `respond.ts` no cuenta en ese `grep`, porque es `withErrors<A>(` y no `withErrors(`; las líneas de `import` tampoco, porque son `withErrors,`.

- [ ] **Step 5: Ejecutar todo**

```bash
npm test
npm run type-check
npm run gen-tools-table -- --check
```

Esperado: **199 passed** (la Task 11 no añade tests, solo transforma); `type-check` limpio; `OK: la tabla del README.md está al día (81 tools).` La cuenta de 81 es la prueba de que la transformación no ha roto el reconocimiento de ninguna tool.

- [ ] **Step 6: Commit**

```bash
git add src/tools/
git commit -m "refactor(tools): un solo sobre de error para las 81 tools

El bloque catch estaba copiado 81 veces, identico, uno por tool. Ahora el
handler va envuelto en withErrors y el cuerpo de cada tool es solo el camino
feliz.

Las comprobaciones de success:false se conservan: withErrors atrapa
excepciones, no convierte un success:false en error. Silenciar uno fue el bug
de arcane_project_redeploy y el de arcane_system_prune.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: README, cifras medidas y balance

**Files:**
- Modify: `README.md`
- Create: `docs/balances/2026-08-17-coherencia-listado.md`

**Ninguna cifra de esta tarea puede venir de este plan.** Los números que aparecen arriba (199 tests, 26 e2e) son **previsiones**, no mediciones. El README publicó una vez 107 tests cuando eran 105 y 58 rutas cuando eran 63 por copiar de un documento.

- [ ] **Step 1: Medir todo, de verdad**

```bash
npm test 2>&1 | tail -5
npm run type-check
npm run gen-tools-table -- --check
node scripts/audit-schema-drift.mjs 2>&1 | tail -3
set -a; . ./.dev.vars; set +a
ARCANE_BASE_URL=http://192.168.180.210:3552 npm run test:e2e -- --reporter=verbose 2>&1 | tail -30
```

Anota: número exacto de tests unitarios, de ficheros de test, de e2e contados uno a uno (líneas con `✓`), de skipped (tiene que ser 0), de tools, y el resultado de la auditoría de drift.

- [ ] **Step 2: Medir la cobertura de operaciones**

```bash
node scripts/audit-schema-drift.mjs
```

y el script ad hoc de cobertura descrito en el balance de F2, sección 3.2. **La cobertura no debería cambiar** (este trabajo no añade rutas nuevas, solo parámetros a rutas existentes). Si cambia, averigua por qué antes de publicar el número.

- [ ] **Step 3: Actualizar el README con las cifras medidas**

Revisa además los ejemplos de salida del README: las tools de listado ya no devuelven un array pelado sino `{pagination, counts?, data}`. Cualquier ejemplo que muestre la salida vieja está desactualizado.

- [ ] **Step 4: Escribir el balance**

Crear `docs/balances/2026-08-17-coherencia-listado.md` siguiendo la estructura del balance de F2: resumen en una frase, tabla de cifras **con el comando exacto de cada una**, lo entregado, lo que apareció y no estaba en el plan, y lo que queda pendiente.

Debe recoger al menos:

- Los cuatro defectos que la sesión de diseño encontró midiendo y que no estaban en el encargo inicial: el `limit` descartado en `stacks` y `templates`, el `resolveGitOpsSyncId` que nadie había contado como resolver, el objeto `counts` que se tiraba entero, y que `ListOptionsWithSort` **no** era un tipo aspiracional (los tres métodos que lo usan directamente sí enviaban `sort`/`order`/`start`; los que no, heredaban de él).
- Que el `.max(100)` de seis tools era invención del fork: `openapi.txt` no declara `maximum` y el servidor acepta `limit=1000`.
- Que la inferencia de tipos de `withErrors` a través de `server.tool` se verificó compilando antes de escribir el plan, con una prueba falsable (un campo inexistente dentro del handler envuelto tiene que dar error de compilación).

- [ ] **Step 5: Commit**

```bash
git add README.md docs/balances/2026-08-17-coherencia-listado.md
git commit -m "docs: cifras medidas y balance de la coherencia de listado

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Merge deliberado a `main` y push**

```bash
git checkout main
git merge --no-ff feat/coherencia-superficie-listado
git push origin main
git push github main
```

- [ ] **Step 7: Verificar el despliegue DENTRO del contenedor**

Espera al sync (≤5 min) y comprueba, nunca por el estado del sync:

```bash
ssh VM-Control 'docker exec arcane-mcp-server sh -c "grep -c collectAllPages /app/src/tools/paging.ts"'
ssh VM-Control 'docker exec arcane-mcp-server sh -c "grep -c withErrors /app/src/tools/respond.ts"'
```

Esperado: ambos mayores que 0. Si `paging.ts` no existe, el despliegue no ha llegado: espera y repite. Un `lastSyncStatus: success` con la imagen vieja fue el modo de fallo silencioso de este proyecto durante todo F0/F1.

- [ ] **Step 8: Ejercitar la tool contra la instancia desplegada**

Llama a `arcane_volume_list` sin parámetros contra la instancia real y comprueba el comportamiento **nuevo**, no solo que no falle:

- Debe empezar con una línea `Showing 20 of NN volumes (page 1 of 2). Pass start=20 to see the rest.`
- Debe incluir `counts` con `inuse`, `unused` y `total`.
- Llamándola con `start=20` debe devolver el resto, y `currentPage: 2`.

Antes de este trabajo devolvía 20 de 32 volúmenes en un array pelado, sin decir nada.

---

## Self-review de este plan

**Cobertura del spec.** Cada sección del spec tiene tarea asignada: §4.1 tipos → Task 3; §4.2 contrato de salida → Task 1 (helper) + Tasks 7-9 (aplicación); §4.3 parámetros en las tools → Tasks 7-9, con el cliente en Tasks 4-5; §4.4 `withErrors` → Task 1 (helper) + Task 11 (resto); §4.5 resolvers → Task 2 (helper) + Task 10; §4.6 excepción del generador → Task 1; §5.1 unitarios → repartidos por tarea; §5.2 e2e → Task 6; §5.3 regresiones → Tasks 7-9 y 11; §5.4 despliegue → Task 12.

**Riesgo verificado antes de escribir el plan.** La inferencia de tipos de `withErrors` a través de `server.tool` bajo `strict`, y la resolución del spread de `LIST_PARAMS` por el extractor del generador. Ambas comprobadas compilando y ejecutando el algoritmo del extractor, con prueba falsable en el primer caso. Si cualquiera hubiera fallado, la Task 1 y las Tasks 7-9 habrían necesitado otro diseño.

**Cifras previstas frente a medidas.** Los totales de tests que aparecen como "esperado" en cada tarea son aritmética sobre la línea base de 152, no mediciones. Si un total no cuadra, la causa más probable es que haya tests preexistentes que asertaban el contrato viejo y hubo que actualizarlos (las Tasks 8 y 10 lo avisan explícitamente). **La Task 12 no copia ninguno de estos números: los vuelve a medir.**
