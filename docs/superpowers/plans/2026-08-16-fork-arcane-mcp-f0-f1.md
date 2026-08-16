# Fork `arcane-mcp` — Plan de implementación F0 (Cimientos) + F1 (Visibilidad)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec de origen:** [`docs/superpowers/specs/2026-08-16-fork-arcane-mcp-f0-f1-design.md`](../specs/2026-08-16-fork-arcane-mcp-f0-f1-design.md)

**Goal:** Dejar el fork `arcane-mcp` en estado verificable (suite de tests en verde, fix NDJSON en producción, spec de API al día, drift de campos medido y corregido) y visiblemente mantenido (README de fork, PR quirúrgico al upstream).

**Architecture:** Todo el trabajo ocurre en ramas; `main` auto-despliega por GitOps y solo se toca en tres merges deliberados y verificados. El runner de tests se repara sustituyendo el pool de Cloudflare Workers por el pool `node` por defecto (ningún test necesita runtime de Workers), lo que desbloquea la verificación de todo lo demás. La auditoría de drift se automatiza con un script que compara las interfaces TypeScript de `src/arcane-client.ts` contra los schemas del `openapi.txt` usando el compilador de TypeScript.

**Tech Stack:** TypeScript 5.9.3 · Cloudflare Workers (`wrangler` 4.x) · `@modelcontextprotocol/sdk` · `zod` 4 · `vitest` 4 · `bun` (gestor de dependencias, igual que el `Dockerfile`) · Arcane API v2.7.0

---

## Global Constraints

Estas reglas aplican a **todas** las tareas:

1. **`main` auto-despliega.** El proyecto está gestionado por GitOps de Arcane con `autoSync=True` sobre `main`. Cualquier push a `main` reconstruye y reinicia el contenedor de producción. Nunca hacer commits sueltos en `main`; solo merges deliberados en los tres puntos que marca este plan (final de Tarea 3, Tarea 6 y Tarea 8).
2. **Todo el trabajo va en ramas.** Nombres de rama exactos indicados en cada tarea.
3. **Fuente de verdad = el spec en vivo v2.7.0**, descargado de `http://192.168.180.210:3552/api/openapi.json`. Nunca el código de `RandomSynergy17/Arcane-MCP-Server` (apunta a Arcane v1.17.0).
4. **Regla dura de verificación:** ninguna tool nueva o modificada sin (a) test unitario con `fetch` mockeado **y** (b) comprobación contra la instancia v2.7.0 real. Las mutantes, solo sobre stacks idempotentes (`ical-bridge`).
5. **Convención de nombres de tools:** `arcane_<dominio>_<acción>`.
6. **Endpoints NDJSON son ciudadanos de primera.** Todo endpoint que devuelva `application/x-json-stream` va por `requestNdjson()` + un agregador tipo `summarizeComposeStream()`. Se detectan en el spec porque declaran `content` vacío. Shape conocido: `{type,activityId}` / `{log}` / `{done:true}` / `{error}`.
7. **Gestor de dependencias: `bun`.** El `Dockerfile` hace `bun install` contra `bun.lock`. Si se toca `package.json`, hay que regenerar `bun.lock` con `bun install`. No commitear `package-lock.json`.
8. **Fuera de alcance:** migrar a RS, adoptar su código, incorporar dominios nuevos de tools (eso es F2–F5), rediseñar el cliente o el transporte MCP, arreglar `cougz`.

### Remotos

| Remoto | URL |
|---|---|
| `origin` | `Gitea:taiko-solutions/arcane-mcp.git` |
| `github` | `https://github.com/marcoaperez/arcane-mcp-server.git` |
| `upstream` | `https://github.com/cougz/arcane-mcp-server.git` |

Los pushes de ramas de trabajo van a `origin` **y** `github`. `upstream` es solo lectura salvo en la Tarea 9.

### Estado ya verificado (no re-investigar)

Estos hechos se comprobaron al redactar este plan, el 2026-08-16:

- La instancia real responde `GET http://192.168.180.210:3552/api/openapi.json` → **v2.7.0, 268 paths**. `openapi.txt` en el repo está en **v1.14.1, 140 paths**.
- `GET /api/app-version` es público (sin API key) y devuelve `{"currentVersion":"v2.7.0", ...}`.
- `npm test` falla con `Error: Runner @cloudflare/vitest-pool-workers is not supported`. Causa: `vitest` y `@cloudflare/vitest-pool-workers` están declarados como `"*"` en `package.json` y resuelven a `vitest@4.1.10` + `@cloudflare/vitest-pool-workers@0.21.3`; vitest 4 eliminó el mecanismo de pools personalizados que usa ese paquete.
- **Ningún fichero de test importa `cloudflare:test`.** Los tres (`arcane-client.test.ts`, `resolve.test.ts`, `tools.test.ts`) son tests unitarios puros con `vi.spyOn(globalThis, "fetch")`. No necesitan runtime de Workers.
- Con el pool `node` por defecto y sobre la rama `fix/up-redeploy-ndjson-parsing`, la suite pasa **88/88**. Sobre `main` fallan 38 (las correcciones de esos tests viven en la rama del fix).
- `upstream/main` (commit `9089bd0`, mensaje literal `test`) **no contiene `requestNdjson` en absoluto**: `/pull`, `/up` y `/redeploy` están rotos allí.
- Nuestro `main` ya arregla `/pull` (`StacksMethods.pull` y `ProjectAdditionalMethods.pullImages` usan `requestNdjson`). Lo que falta en `main` es el fix de `/up` y `/redeploy`.
- Hay tres ficheros basura de 0 bytes versionados en la raíz: `test`, `file`, `testfile`.
- Una auditoría de drift preliminar contra v2.7.0 arroja **65 desalineaciones** en 8 interfaces. Ejemplos reales: `NetworkSummary` declara `internal`, `attachable`, `ingress` e `ipam`, que **no existen** en v2.7.0, y le faltan `inUse`, `isDefault`, `labels` y `options` (los cuatro obligatorios); `Volume` no declara `id`, `inUse`, `scope`, `containers`, `labels` ni `options` (los seis obligatorios).

---

## Estructura de ficheros

| Fichero | Responsabilidad | Tarea |
|---|---|---|
| `vitest.config.ts` | Config de la suite unitaria (pool node) — **modificar** | 1 |
| `package.json` | Versiones fijadas, scripts `test`, `test:e2e`, `update-api-spec` — **modificar** | 1, 2, 4 |
| `.gitignore` | Excluir `package-lock.json` — **modificar** | 1 |
| `vitest.e2e.config.ts` | Config de la suite e2e contra Arcane real — **crear** | 2 |
| `src/__e2e__/helpers.ts` | Construcción del cliente e2e desde variables de entorno — **crear** | 2 |
| `src/__e2e__/stack-lifecycle.e2e.ts` | e2e de `/up` y `/redeploy` sobre stack idempotente — **crear** | 2 |
| `scripts/update-api-spec.mjs` | Descarga y valida el spec en vivo a `openapi.txt` — **crear** | 4 |
| `scripts/audit-schema-drift.mjs` | Compara interfaces TS contra schemas del spec — **crear** | 5 |
| `docs/auditorias/2026-08-16-drift-campos-v2.7.0.md` | Informe de drift — **crear** | 5 |
| `src/arcane-client.ts` | Interfaces alineadas con v2.7.0 — **modificar** | 6 |
| `docs/desarrollo/anadir-una-tool.md` | Patrón de trabajo para F2–F5 — **crear** | 7 |
| `docs/README.md` | Índice de documentación — **crear** | 7 |
| `README.md` | README de fork mantenido — **modificar** | 8 |

### Estrategia de ramas

```
fix/up-redeploy-ndjson-parsing (eb866b6, ya publicada)
  └── f0/cimientos            ← Tareas 1, 2
        └── MERGE 1 → main    ← Tarea 3 (despliega el fix NDJSON a producción)
              └── f0/spec-y-drift   ← Tareas 4, 5, 6
                    └── MERGE 2 → main
                          └── f1/docs-fork   ← Tareas 7, 8
                                └── MERGE 3 → main

upstream/main (9089bd0)
  └── upstream-pr/ndjson-streaming  ← Tarea 9 (PR a cougz; NUNCA se mergea a nuestro main)
```

---

## Tarea 1: Reparar el runner de tests

**Objetivo (F0.4):** que un único comando ejecute toda la suite unitaria en verde. Es prerrequisito duro de todo lo demás — sin esto no hay forma de verificar el merge a producción de la Tarea 3.

**Decisión de diseño:** se elimina `@cloudflare/vitest-pool-workers` en vez de fijar `vitest` a `~3.2`. Ningún test importa `cloudflare:test` ni necesita runtime de Workers, así que el pool solo aporta una restricción de versiones que ya rompió el proyecto una vez. YAGNI: si en F2–F5 aparece un test que sí necesite runtime de Workers, se reintroduce entonces en un segundo proyecto de vitest. Se aprovecha además para sustituir los `"*"` de `devDependencies` por rangos fijados: los comodines son la causa raíz de esta clase de rotura.

**Files:**
- Modify: `vitest.config.ts` (fichero completo, 19 líneas)
- Modify: `package.json:5-12` (scripts) y `package.json:19-26` (devDependencies)
- Modify: `.gitignore`
- Delete: `test`, `file`, `testfile` (ficheros basura de 0 bytes en la raíz)
- Regenerate: `bun.lock`

**Interfaces:**
- Consumes: nada.
- Produces: el comando `npm test` en verde (88/88). Las Tareas 2–9 dependen de él.

- [ ] **Step 1: Crear la rama de trabajo desde la rama del fix**

```bash
git fetch origin
git checkout fix/up-redeploy-ndjson-parsing
git checkout -b f0/cimientos
```

- [ ] **Step 2: Reproducir el fallo y anotar el error exacto**

```bash
bun install
npm test
```

Esperado: falla sin ejecutar ningún test, con tres errores idénticos:

```
Error: Runner @cloudflare/vitest-pool-workers is not supported. Test files: .../arcane-client.test.ts
 Test Files  no tests
      Tests  no tests
     Errors  3 errors
```

- [ ] **Step 3: Reescribir `vitest.config.ts` para usar el pool node**

Contenido completo del fichero (sustituye todo lo que había):

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Los tests son unitarios puros: mockean `globalThis.fetch` y no tocan
    // ninguna API de Workers (nadie importa "cloudflare:test"). El pool node
    // por defecto basta y nos libera de la restricción de versiones que
    // imponía @cloudflare/vitest-pool-workers.
    include: ["src/__tests__/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 4: Ejecutar la suite y verificar que ahora arranca y pasa**

```bash
npm test
```

Esperado:

```
 Test Files  3 passed (3)
      Tests  88 passed (88)
```

Si aparecen 38 fallos con `http://placeholder/api/...` frente a `http://localhost:3552/api/...`, estás sobre `main` y no sobre la rama del fix. Vuelve al Step 1.

- [ ] **Step 5: Fijar versiones y limpiar `package.json`**

Sustituye los bloques `scripts` y `devDependencies` por:

```json
  "scripts": {
    "deploy": "wrangler deploy",
    "dev": "wrangler dev",
    "start": "wrangler dev",
    "cf-typegen": "wrangler types",
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@cloudflare/workers-oauth-provider": "^0.2.3",
    "agents": "^0.5.0",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^5.20260816.1",
    "@types/node": "^26.2.0",
    "typescript": "5.9.3",
    "vitest": "^4.1.10",
    "wrangler": "^4.98.0"
  }
```

Cambios respecto al original: se elimina `@cloudflare/vitest-pool-workers`, y `@cloudflare/workers-types`, `@types/node` y `vitest` pasan de `"*"` a rangos fijados. **`wrangler` se deja en `^4.98.0`**: subirlo es el runtime de producción y queda fuera del alcance de F0.

- [ ] **Step 6: Regenerar `bun.lock` y volver a pasar la suite**

```bash
rm -rf node_modules package-lock.json
bun install
npm test
```

Esperado: `Test Files 3 passed (3)` · `Tests 88 passed (88)`. `bun.lock` aparece modificado en `git status`.

- [ ] **Step 7: Verificar que el type-check sigue limpio**

```bash
npm run type-check
```

Esperado: sin salida y código de salida 0.

- [ ] **Step 8: Commit del runner**

```bash
git add vitest.config.ts package.json bun.lock
git commit -m "fix(test): sustituir el pool de Workers por el pool node y fijar versiones

vitest 4 eliminó el mecanismo de pools personalizados que usa
@cloudflare/vitest-pool-workers, de modo que 'npm test' no arrancaba
('Runner @cloudflare/vitest-pool-workers is not supported').

Ningún test importa cloudflare:test ni necesita runtime de Workers:
los tres ficheros mockean globalThis.fetch. Se elimina el pool y se
usa el pool node por defecto.

Se sustituyen además los comodines \"*\" de devDependencies por rangos
fijados: son la causa raíz de esta clase de rotura.

Suite: 88/88 en verde."
```

- [ ] **Step 9: Ignorar `package-lock.json` y borrar los ficheros basura**

`.gitignore` — añadir al final:

```
package-lock.json
```

Y eliminar los tres ficheros vacíos versionados por error en la raíz:

```bash
git rm test file testfile
```

- [ ] **Step 10: Verificar que la limpieza no ha roto nada**

```bash
npm test && npm run type-check
```

Esperado: `Tests 88 passed (88)` y type-check sin salida.

- [ ] **Step 11: Commit de la limpieza**

```bash
git add .gitignore
git commit -m "chore: ignorar package-lock.json y borrar ficheros basura de la raíz

'test', 'file' y 'testfile' son ficheros de 0 bytes versionados por
error. El proyecto usa bun (bun.lock, igual que el Dockerfile), así
que un package-lock.json suelto solo genera lockfiles divergentes."
```

- [ ] **Step 12: Publicar la rama en los dos remotos**

```bash
git push -u origin f0/cimientos
git push github f0/cimientos
```

---

## Tarea 2: Harness de tests e2e contra la instancia Arcane real

**Objetivo:** dar cuerpo a la regla dura de verificación del spec (constraint global #4) con un comando reproducible, y disponer de la comprobación e2e que la Tarea 3 necesita para validar el despliegue de producción.

**Decisión de diseño:** los e2e viven en `src/__e2e__/` con su propia config de vitest y su propio script npm, **excluidos de `npm test`**. Motivo: tocan una instancia real, requieren credenciales y son lentos; la suite unitaria debe seguir siendo ejecutable sin red ni secretos. `vitest.config.ts` ya restringe `include` a `src/__tests__/`, así que la exclusión es automática.

**Files:**
- Create: `vitest.e2e.config.ts`
- Create: `src/__e2e__/helpers.ts`
- Create: `src/__e2e__/stack-lifecycle.e2e.ts`
- Modify: `package.json` (añadir el script `test:e2e`)

**Interfaces:**
- Consumes: de la Tarea 1, `npm test` en verde y el pool node. De `src/arcane-client.ts`:
  - `new ArcaneClient(apiKey: string, fetcherOrBaseUrl?: Fetcher | string)` — al pasar un string se activa el modo local y `baseUrl` pasa a ser `<string>/api`.
  - `client.environments.list(opts?: ListOptions): Promise<PaginatedResponse<Environment>>`
  - `client.stacks.list(envId: string, opts?: ListOptions): Promise<PaginatedResponse<Project>>`
  - `client.stacks.start(envId: string, stackId: string): Promise<ActionResponse>`
  - `client.projectAdditional.redeploy(envId: string, projectId: string): Promise<ActionResponse>`
  - `client.system.version(): Promise<{ currentVersion: string; displayVersion: string; ... }>` — objeto plano, **no** envuelto en `{success, data}`.
- Produces:
  - `npm run test:e2e` — comando de verificación contra la instancia real.
  - `e2eClient(): ArcaneClient` y `IDEMPOTENT_STACK: string` exportados desde `src/__e2e__/helpers.ts`, reutilizables por los e2e de F2–F5.

- [ ] **Step 1: Crear la config de vitest para e2e**

Crear `vitest.e2e.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Suite separada de la unitaria: toca una instancia Arcane real, necesita
    // credenciales y es lenta. `npm test` no la ejecuta nunca.
    include: ["src/__e2e__/**/*.e2e.ts"],
    environment: "node",
    // Un `docker compose up` que recrea contenedores puede tardar bastante.
    testTimeout: 180_000,
    hookTimeout: 180_000,
    // Las acciones mutantes sobre el mismo stack no pueden solaparse.
    fileParallelism: false,
  },
});
```

- [ ] **Step 2: Crear el helper de construcción del cliente**

Crear `src/__e2e__/helpers.ts`:

```ts
import { ArcaneClient } from "../arcane-client";

/**
 * Construye un ArcaneClient apuntando a la instancia real.
 * Falla con un mensaje accionable si faltan las variables de entorno,
 * en vez de dar un error de red críptico 30 segundos después.
 */
export function e2eClient(): ArcaneClient {
  const baseUrl = process.env.ARCANE_BASE_URL;
  const apiKey = process.env.ARCANE_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error(
      "Faltan ARCANE_BASE_URL y/o ARCANE_API_KEY.\n" +
        "Ejemplo:\n" +
        "  ARCANE_BASE_URL=http://192.168.180.210:3552 \\\n" +
        "  ARCANE_API_KEY=<clave> \\\n" +
        "  npm run test:e2e",
    );
  }
  return new ArcaneClient(apiKey, baseUrl);
}

/**
 * Stack sobre el que es seguro ejecutar acciones mutantes: levantarlo o
 * redesplegarlo repetidamente no tiene efectos observables fuera de sí mismo.
 */
export const IDEMPOTENT_STACK = process.env.ARCANE_E2E_STACK ?? "ical-bridge";
```

- [ ] **Step 3: Escribir el e2e del ciclo de vida del stack**

Crear `src/__e2e__/stack-lifecycle.e2e.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import type { ArcaneClient, Project } from "../arcane-client";
import { e2eClient, IDEMPOTENT_STACK } from "./helpers";

describe("e2e: ciclo de vida de un stack contra Arcane real", () => {
  let client: ArcaneClient;
  let envId: string;
  let stackId: string;

  beforeAll(async () => {
    client = e2eClient();

    const envs = await client.environments.list();
    const first = envs.data?.[0];
    if (!first) throw new Error("La instancia no tiene ningún entorno");
    envId = first.id;

    const stacks = await client.stacks.list(envId, { search: IDEMPOTENT_STACK });
    const stack = stacks.data?.find((s: Project) => s.name === IDEMPOTENT_STACK);
    if (!stack) {
      throw new Error(
        `No existe el stack '${IDEMPOTENT_STACK}' en el entorno '${envId}'. ` +
          "Ajusta ARCANE_E2E_STACK a un stack idempotente existente.",
      );
    }
    stackId = stack.id;
  });

  it("la instancia corre Arcane v2.x", async () => {
    const version = await client.system.version();
    expect(version.currentVersion).toMatch(/^v2\./);
  });

  it("stacks.start() parsea el NDJSON de /up y devuelve éxito", async () => {
    const result = await client.stacks.start(envId, stackId);

    // Regresión del bug original: response.json() sobre un cuerpo NDJSON
    // reventaba con "Unexpected non-whitespace character after JSON...".
    expect(result.message).not.toMatch(/Unexpected non-whitespace/);
    expect(result.success).toBe(true);
  });

  it("projectAdditional.redeploy() parsea el NDJSON de /redeploy y devuelve éxito", async () => {
    const result = await client.projectAdditional.redeploy(envId, stackId);

    expect(result.message).not.toMatch(/Unexpected non-whitespace/);
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 4: Añadir el script `test:e2e` a `package.json`**

En el bloque `scripts`, tras `"test:watch"`:

```json
    "test:watch": "vitest",
    "test:e2e": "vitest run --config vitest.e2e.config.ts"
```

- [ ] **Step 5: Comprobar que `npm test` sigue ignorando los e2e**

```bash
npm test
```

Esperado: `Test Files 3 passed (3)` · `Tests 88 passed (88)`. Si aparecen 4 ficheros, `include` de `vitest.config.ts` está mal.

- [ ] **Step 6: Comprobar que el harness falla de forma accionable sin credenciales**

```bash
npm run test:e2e
```

Esperado: falla en `beforeAll` con el mensaje `Faltan ARCANE_BASE_URL y/o ARCANE_API_KEY.` y el ejemplo de invocación.

- [ ] **Step 7: Ejecutar los e2e contra la instancia real**

Coge la API key de Arcane del `.dev.vars` local o del entorno del contenedor desplegado (`ARCANE_API_KEY`). Nunca la escribas en un fichero versionado.

```bash
ARCANE_BASE_URL=http://192.168.180.210:3552 ARCANE_API_KEY="$ARCANE_API_KEY" npm run test:e2e
```

Esperado: `Test Files 1 passed (1)` · `Tests 3 passed (3)`.

Si el test de versión falla mostrando algo distinto de `v2.x`, **para y avisa**: la instancia ha cambiado de versión mayor y este plan asume v2.7.0.

- [ ] **Step 8: Verificar el type-check**

```bash
npm run type-check
```

Esperado: sin salida, código de salida 0.

- [ ] **Step 9: Commit**

```bash
git add vitest.e2e.config.ts src/__e2e__/helpers.ts src/__e2e__/stack-lifecycle.e2e.ts package.json
git commit -m "test(e2e): harness de verificación contra la instancia Arcane real

Añade una suite e2e separada (npm run test:e2e) que ejecuta /up y
/redeploy contra un stack idempotente de la instancia v2.7.0 real.

Da cuerpo a la regla dura del spec: toda tool nueva o modificada
necesita test unitario con fetch mockeado Y comprobación contra la
instancia real. Queda excluida de 'npm test' porque necesita red y
credenciales."
```

- [ ] **Step 10: Publicar**

```bash
git push origin f0/cimientos
git push github f0/cimientos
```

---

## Tarea 3: Merge a `main`, despliegue GitOps y verificación en producción

**Objetivo (F0.1):** llevar el fix NDJSON de `/up` y `/redeploy` a producción. Es el primer punto de F0 del spec: la rama está publicada desde hace tiempo pero producción sigue con el bug.

> ⚠️ **Este es el primero de los tres merges a `main` del plan.** `main` tiene `autoSync=True`: el push dispara la reconstrucción del contenedor de producción. Ejecuta los pasos en orden y no sigas si alguno falla.

**Files:** ninguno nuevo. Solo operaciones de git y verificación.

**Interfaces:**
- Consumes: `f0/cimientos` con `npm test` en verde (Tarea 1) y `npm run test:e2e` funcionando (Tarea 2).
- Produces: `main` desplegado con el fix. Las Tareas 4–8 parten de este `main`.

- [ ] **Step 1: Registrar el estado de producción ANTES del merge**

Sirve de línea base para saber si el despliegue ha ocurrido de verdad.

```bash
git log -1 --format="%H %s" origin/main
docker ps --filter name=arcane-mcp --format "{{.Names}}\t{{.Status}}\t{{.Image}}"
```

Anota el hash de `origin/main` y el `Status` (tiempo de arranque) del contenedor.

- [ ] **Step 2: Verificar por última vez que la rama está en verde**

```bash
git checkout f0/cimientos
npm test && npm run type-check
```

Esperado: `Tests 88 passed (88)` y type-check limpio. **Si algo falla, no continúes.**

- [ ] **Step 3: Mergear a `main` sin push todavía**

```bash
git checkout main
git pull origin main
git merge --no-ff f0/cimientos -m "merge: F0 cimientos — fix NDJSON de /up y /redeploy + runner de tests

Lleva a producción el fix de parseo NDJSON de los endpoints /up
(arcane_stack_start) y /redeploy (arcane_project_redeploy), que
estaban rotos desde eb866b6 sin llegar a main.

Incluye la reparación del runner de tests (pool node en vez de
@cloudflare/vitest-pool-workers) y el harness e2e contra la
instancia real."
```

- [ ] **Step 4: Verificar la suite sobre el `main` ya mergeado**

```bash
npm test && npm run type-check
```

Esperado: `Tests 88 passed (88)`, type-check limpio.

- [ ] **Step 5: Empujar a `main` — esto despliega**

```bash
git push origin main
git push github main
```

- [ ] **Step 6: Esperar y confirmar que GitOps ha desplegado**

Espera a que Arcane sincronice y reconstruya (típicamente 1–3 minutos), y comprueba que el contenedor se ha reiniciado comparando con la línea base del Step 1:

```bash
docker ps --filter name=arcane-mcp --format "{{.Names}}\t{{.Status}}\t{{.Image}}"
docker logs --tail 30 arcane-mcp-server
```

Esperado: `Status` muestra un arranque reciente (segundos/minutos, no el valor anotado en el Step 1) y los logs muestran `wrangler dev` levantando sin errores.

Si tras 5 minutos el contenedor no se ha reiniciado, revisa el estado de sincronización del proyecto en la UI de Arcane antes de seguir.

- [ ] **Step 7: Verificar el fix contra producción**

```bash
ARCANE_BASE_URL=http://192.168.180.210:3552 ARCANE_API_KEY="$ARCANE_API_KEY" npm run test:e2e
```

Esperado: `Tests 3 passed (3)`.

- [ ] **Step 8: Verificar la tool desplegada extremo a extremo**

Desde un cliente MCP conectado al servidor desplegado, invoca `arcane_stack_start` sobre `ical-bridge`.

Esperado: un texto del tipo `Stack 'ical-bridge' started successfully in environment '<env>'. Container ical-bridge Recreated | ... | Container ical-bridge Healthy`.

Comprobación de que el fix está realmente en producción: el mensaje **no** debe contener `Unexpected non-whitespace character after JSON`, y **sí** debe incluir las líneas de progreso de compose (antes del fix la tool reventaba antes de llegar a producirlas).

- [ ] **Step 9: Borrar las ramas ya integradas**

```bash
git push origin --delete f0/cimientos
git push github --delete f0/cimientos
git branch -d f0/cimientos
```

La rama `fix/up-redeploy-ndjson-parsing` **se conserva**: la Tarea 9 la usa como referencia para el PR al upstream.

---

## Tarea 4: Refrescar `openapi.txt` a v2.7.0 con un script repetible

**Objetivo (F0.2):** que la fuente de verdad del repo sea el spec de la instancia real. `openapi.txt` está en v1.14.1 (140 paths) mientras producción corre v2.7.0 (268 paths). Codificar contra un spec tres versiones viejo es exactamente el fallo que hundió a RS.

**Files:**
- Create: `scripts/update-api-spec.mjs`
- Modify: `package.json` (script `update-api-spec`)
- Modify: `openapi.txt` (regenerado desde la instancia)

**Interfaces:**
- Consumes: `main` desplegado tras la Tarea 3.
- Produces: `openapi.txt` con `info.version = "v2.7.0"` y 268 paths. La Tarea 5 lo consume.

- [ ] **Step 1: Crear la rama de trabajo**

```bash
git checkout main
git pull origin main
git checkout -b f0/spec-y-drift
```

- [ ] **Step 2: Escribir el script de actualización del spec**

Crear `scripts/update-api-spec.mjs`:

```js
#!/usr/bin/env node
/**
 * Descarga el spec OpenAPI de una instancia Arcane real y lo escribe en
 * openapi.txt, que es la fuente de verdad del repo para los shapes de la API.
 *
 * Uso:
 *   npm run update-api-spec
 *   ARCANE_BASE_URL=http://otra-instancia:3552 npm run update-api-spec
 *
 * El endpoint /api/openapi.json de Arcane es público: no necesita API key.
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";

const BASE_URL = process.env.ARCANE_BASE_URL ?? "http://192.168.180.210:3552";
const OUTPUT = "openapi.txt";
const url = `${BASE_URL.replace(/\/+$/, "")}/api/openapi.json`;

function describe(spec) {
  return {
    version: spec?.info?.version ?? "(desconocida)",
    paths: Object.keys(spec?.paths ?? {}).length,
    schemas: Object.keys(spec?.components?.schemas ?? {}).length,
  };
}

let previous = null;
if (existsSync(OUTPUT)) {
  try {
    previous = describe(JSON.parse(readFileSync(OUTPUT, "utf8")));
  } catch (err) {
    console.warn(
      `AVISO: no se pudo leer el ${OUTPUT} existente (${err.message}). Se continúa igualmente porque se va a sobreescribir.`,
    );
  }
}

console.log(`Descargando ${url} ...`);
let response;
try {
  response = await fetch(url);
} catch (err) {
  console.error(`ERROR: no se pudo conectar con ${url} (${err.message}).`);
  process.exit(1);
}

if (!response.ok) {
  console.error(`ERROR: ${response.status} ${response.statusText}`);
  process.exit(1);
}

let spec;
try {
  spec = await response.json();
} catch (err) {
  console.error(`ERROR: la respuesta de ${url} no es JSON válido (${err.message}).`);
  process.exit(1);
}

if (!spec?.info?.version || !spec?.paths) {
  console.error("ERROR: la respuesta no parece un spec OpenAPI (falta info.version o paths).");
  process.exit(1);
}

const next = describe(spec);
writeFileSync(OUTPUT, JSON.stringify(spec));

if (previous) {
  console.log(`Antes:   ${previous.version} — ${previous.paths} paths, ${previous.schemas} schemas`);
}
console.log(`Ahora:   ${next.version} — ${next.paths} paths, ${next.schemas} schemas`);
console.log(`Escrito en ${OUTPUT}.`);
console.log("\nSiguiente paso obligatorio: reauditar el drift de campos con");
console.log("  node scripts/audit-schema-drift.mjs");
```

- [ ] **Step 3: Registrar el script en `package.json`**

En el bloque `scripts`, tras `"test:e2e"`:

```json
    "test:e2e": "vitest run --config vitest.e2e.config.ts",
    "update-api-spec": "node scripts/update-api-spec.mjs"
```

- [ ] **Step 4: Ejecutar el script**

```bash
npm run update-api-spec
```

Esperado:

```
Descargando http://192.168.180.210:3552/api/openapi.json ...
Antes:   v1.14.1 — 140 paths, 324 schemas
Ahora:   2.7.0 — 268 paths, 628 schemas
Escrito en openapi.txt.
```

Nota de formato: el spec v1 declaraba la versión con prefijo (`v1.14.1`); el v2 la declara **sin** prefijo (`2.7.0`). No es un error. Lo que confirma la identidad del spec es el número de paths.

Si `Ahora` no dice `2.7.0` **con 268 paths**, **para y avisa**: la instancia ha cambiado de versión y las cifras de este plan dejan de aplicar.

- [ ] **Step 5: Verificar el fichero escrito de forma independiente**

```bash
node -e "const s=JSON.parse(require('fs').readFileSync('openapi.txt','utf8')); console.log(s.info.version, Object.keys(s.paths).length)"
```

Esperado: `2.7.0 268`.

- [ ] **Step 6: Confirmar que nada del código se rompe**

```bash
npm test && npm run type-check
```

Esperado: `Tests 88 passed (88)` y type-check limpio. (`openapi.txt` es documentación, no se importa desde `src/`; este paso confirma esa suposición.)

- [ ] **Step 7: Commit**

```bash
git add scripts/update-api-spec.mjs package.json openapi.txt
git commit -m "feat(spec): refrescar openapi.txt a Arcane v2.7.0 y añadir update-api-spec

openapi.txt estaba en v1.14.1 (140 paths) mientras la instancia corre
v2.7.0 (268 paths). Codificar contra un spec tres versiones viejo es
exactamente el fallo que degradó a RandomSynergy17/Arcane-MCP-Server.

El script scripts/update-api-spec.mjs deja el procedimiento
documentado y repetible, y recuerda reauditar el drift después."
```

---

## Tarea 5: Auditoría automatizada del drift de campos v1→v2

**Objetivo (F0.3, primera mitad):** medir las desalineaciones entre las interfaces TypeScript de `src/arcane-client.ts` y los schemas de v2.7.0, y dejarlas por escrito. Los *paths* ya están validados (37/37); lo que no está validado son los *shapes*, y el fallo de RS fue de campos (`names`, contadores, `driver`), no de rutas.

**Decisión de diseño:** el script usa el compilador de TypeScript (`typescript` ya es devDependency) para leer los miembros de las interfaces, en vez de regex. Parsear TypeScript con expresiones regulares da falsos negativos en cuanto aparece un tipo con llaves anidadas.

**Files:**
- Create: `scripts/audit-schema-drift.mjs`
- Create: `docs/auditorias/2026-08-16-drift-campos-v2.7.0.md`

**Interfaces:**
- Consumes: `openapi.txt` en v2.7.0 (Tarea 4); las interfaces exportadas de `src/arcane-client.ts`.
- Produces: `node scripts/audit-schema-drift.mjs` (tabla Markdown) y `--json` (salida estructurada). La Tarea 6 corrige lo que este informe lista.

**Estados que emite el script:**

| Estado | Significado | Gravedad |
|---|---|---|
| `SOBRA-EN-TS` | El campo está en la interfaz pero **no existe** en el spec | Alta — el código puede leer `undefined` creyendo que hay dato |
| `FALTA-EN-TS-REQUERIDO` | El spec lo marca obligatorio y la interfaz no lo declara | Alta — dato real invisible para el código |
| `OPCIONAL-PERO-REQUERIDO` | Declarado con `?` pese a ser obligatorio | Media — obliga a comprobaciones inútiles |
| `OBLIGATORIO-PERO-OPCIONAL` | Declarado sin `?` pese a ser opcional | Media — el tipo miente, riesgo de `undefined` en runtime |
| `FALTA-EN-TS-OPCIONAL` | Campo nuevo opcional del spec no declarado | Baja — funcionalidad no expuesta |

- [ ] **Step 1: Escribir el script de auditoría**

Crear `scripts/audit-schema-drift.mjs`:

```js
#!/usr/bin/env node
/**
 * Audita el drift entre las interfaces TypeScript de src/arcane-client.ts
 * y los schemas del spec OpenAPI de Arcane (openapi.txt).
 *
 * Uso:
 *   node scripts/audit-schema-drift.mjs          # tabla Markdown
 *   node scripts/audit-schema-drift.mjs --json   # salida estructurada
 */
import { readFileSync } from "node:fs";
import ts from "typescript";

// Interfaz TS -> schema del spec. Solo los tipos que representan payloads
// de la API (no los *Create/*Update, que son cuerpos de petición nuestros).
const MAP = {
  Environment: "EnvironmentEnvironment",
  Project: "ProjectDetails",
  ContainerSummary: "ContainerSummary",
  ImageSummary: "ImageSummary",
  Volume: "VolumeVolume",
  NetworkSummary: "NetworkSummary",
  NetworkInspect: "NetworkInspect",
  Pagination: "BasePaginationResponse",
  VersionInfo: "VersionInfo",
  ContainerDetails: "ContainerDetails",
  GitRepository: "GitopsGitRepository",
  GitOpsSync: "GitopsGitOpsSync",
  Template: "TemplateTemplate",
  VolumeBackup: "VolumeBackup",
};

function tsInterfaceProps(file) {
  const src = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const out = {};
  src.forEachChild((node) => {
    if (!ts.isInterfaceDeclaration(node)) return;
    out[node.name.text] = node.members
      .filter(ts.isPropertySignature)
      .map((m) => ({ name: m.name.getText(src), optional: !!m.questionToken }));
  });
  return out;
}

const iface = tsInterfaceProps("src/arcane-client.ts");
const spec = JSON.parse(readFileSync("openapi.txt", "utf8"));
const schemas = spec.components.schemas;

const findings = [];
for (const [tsName, schemaName] of Object.entries(MAP)) {
  const schema = schemas[schemaName];
  if (!schema) {
    findings.push({ tsName, schemaName, field: "*", status: "SCHEMA-AUSENTE" });
    continue;
  }
  const members = iface[tsName];
  if (!members) {
    findings.push({ tsName, schemaName, field: "*", status: "INTERFAZ-AUSENTE" });
    continue;
  }

  const specProps = schema.properties ?? {};
  const required = new Set(schema.required ?? []);

  for (const m of members) {
    if (!(m.name in specProps)) {
      findings.push({ tsName, schemaName, field: m.name, status: "SOBRA-EN-TS" });
    } else if (required.has(m.name) && m.optional) {
      findings.push({ tsName, schemaName, field: m.name, status: "OPCIONAL-PERO-REQUERIDO" });
    } else if (!required.has(m.name) && !m.optional) {
      findings.push({ tsName, schemaName, field: m.name, status: "OBLIGATORIO-PERO-OPCIONAL" });
    }
  }

  const tsNames = new Set(members.map((m) => m.name));
  for (const p of Object.keys(specProps)) {
    if (!tsNames.has(p)) {
      findings.push({
        tsName,
        schemaName,
        field: p,
        status: required.has(p) ? "FALTA-EN-TS-REQUERIDO" : "FALTA-EN-TS-OPCIONAL",
      });
    }
  }
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ specVersion: spec.info.version, findings }, null, 2));
} else {
  console.log(`Spec: Arcane API ${spec.info.version} (${Object.keys(spec.paths).length} paths)\n`);
  console.log("| Interfaz TS | Schema spec | Campo | Estado |");
  console.log("|---|---|---|---|");
  for (const f of findings) {
    console.log(`| \`${f.tsName}\` | \`${f.schemaName}\` | \`${f.field}\` | ${f.status} |`);
  }
  console.log(`\nTotal: ${findings.length} desalineaciones.`);
}
```

- [ ] **Step 2: Ejecutar la auditoría**

```bash
node scripts/audit-schema-drift.mjs
```

Esperado: una tabla Markdown encabezada por `Spec: Arcane API 2.7.0 (268 paths)`, con del orden de **118 desalineaciones** (55 graves, sin contar `FALTA-EN-TS-OPCIONAL`) y `VersionInfo` marcado como `INTERFAZ-AUSENTE`.

Hallazgos que deben aparecer sí o sí (comprobados al redactar el plan):

```
| `NetworkSummary` | `NetworkSummary` | `internal`   | SOBRA-EN-TS |
| `NetworkSummary` | `NetworkSummary` | `attachable` | SOBRA-EN-TS |
| `NetworkSummary` | `NetworkSummary` | `ingress`    | SOBRA-EN-TS |
| `NetworkSummary` | `NetworkSummary` | `ipam`       | SOBRA-EN-TS |
| `NetworkSummary` | `NetworkSummary` | `inUse`      | FALTA-EN-TS-REQUERIDO |
| `Volume`         | `VolumeVolume`   | `id`         | FALTA-EN-TS-REQUERIDO |
| `Volume`         | `VolumeVolume`   | `inUse`      | FALTA-EN-TS-REQUERIDO |
| `Volume`         | `VolumeVolume`   | `scope`      | FALTA-EN-TS-REQUERIDO |
```

Si `INTERFAZ-AUSENTE` no aparece para `VersionInfo`, es que ya existe la interfaz — perfecto, sigue igualmente.

- [ ] **Step 3: Comprobar que `ContainerSummary.names` sigue presente en v2.7.0**

Es el campo concreto que rompió a RS (`container_list` devolvía nombres `undefined`) y del que depende `resolveContainerId` en [`src/tools/resolve.ts:82`](../../../src/tools/resolve.ts).

```bash
node -e "const s=JSON.parse(require('fs').readFileSync('openapi.txt','utf8')); const c=s.components.schemas.ContainerSummary; console.log('names en props:', 'names' in c.properties, '| requerido:', c.required.includes('names'))"
```

Esperado: `names en props: true | requerido: true`. Si diera `false`, `arcane_container_*` con `containerName` está roto en producción y hay que escalarlo antes de seguir.

- [ ] **Step 4: Volcar el informe a documentación**

```bash
mkdir -p docs/auditorias
{
  echo "# Auditoría de drift de campos — interfaces TS vs Arcane v2.7.0"
  echo
  echo "- **Fecha:** 2026-08-16"
  echo "- **Generado por:** \`node scripts/audit-schema-drift.mjs\`"
  echo "- **Spec:** \`openapi.txt\` (descargado de la instancia con \`npm run update-api-spec\`)"
  echo
  echo "## Contexto"
  echo
  echo "Los *paths* del fork ya estaban validados (37/37 contra v2.7.0). Lo que no lo estaba"
  echo "son los *shapes*: el fallo que degradó a RandomSynergy17/Arcane-MCP-Server fue de"
  echo "campos (\`names\`, contadores, \`driver\`), no de rutas. Esta auditoría los mide."
  echo
  echo "## Leyenda de estados"
  echo
  echo "| Estado | Significado | Gravedad |"
  echo "|---|---|---|"
  echo "| \`SOBRA-EN-TS\` | El campo está en la interfaz pero no existe en el spec | Alta |"
  echo "| \`FALTA-EN-TS-REQUERIDO\` | El spec lo marca obligatorio y la interfaz no lo declara | Alta |"
  echo "| \`OPCIONAL-PERO-REQUERIDO\` | Declarado con \`?\` pese a ser obligatorio | Media |"
  echo "| \`OBLIGATORIO-PERO-OPCIONAL\` | Declarado sin \`?\` pese a ser opcional | Media |"
  echo "| \`FALTA-EN-TS-OPCIONAL\` | Campo nuevo opcional del spec no declarado | Baja |"
  echo "| \`INTERFAZ-AUSENTE\` | El tipo se declara inline en vez de como interfaz auditable | Media |"
  echo
  echo "## Resultado"
  echo
  node scripts/audit-schema-drift.mjs
  echo
  echo "## Reproducir"
  echo
  echo '```bash'
  echo "npm run update-api-spec          # refresca openapi.txt desde la instancia"
  echo "node scripts/audit-schema-drift.mjs"
  echo '```'
} > docs/auditorias/2026-08-16-drift-campos-v2.7.0.md
```

- [ ] **Step 5: Revisar el informe generado**

```bash
head -40 docs/auditorias/2026-08-16-drift-campos-v2.7.0.md
```

Esperado: cabecera correcta, leyenda y la tabla de hallazgos. Sin líneas vacías donde debería haber tabla.

- [ ] **Step 6: Commit**

```bash
git add scripts/audit-schema-drift.mjs docs/auditorias/2026-08-16-drift-campos-v2.7.0.md
git commit -m "docs(auditoria): medir el drift de campos entre las interfaces TS y Arcane v2.7.0

Añade scripts/audit-schema-drift.mjs, que compara las interfaces de
src/arcane-client.ts contra los schemas del spec usando el compilador
de TypeScript, y vuelca el informe a docs/auditorias/.

Los paths ya estaban validados (37/37); los shapes no. El fallo que
degradó a RS fue de campos, no de rutas."
```

---

## Tarea 6: Corregir las interfaces desalineadas

**Objetivo (F0.3, segunda mitad):** dejar `src/arcane-client.ts` alineado con v2.7.0 en los estados de gravedad alta y media, y cerrar F0 con un merge a `main`.

**Criterio de alcance:** se corrigen **todos** los hallazgos salvo los `FALTA-EN-TS-OPCIONAL` que pertenecen a dominios de F2–F5 (`vulnerabilityScan`, `updateInfo`, `projectFiles`, `includeFiles`, `runtimeServices`, `services`, `directoryFiles`). Añadirlos ahora sería declarar tipos que ninguna tool consume: eso es F2–F5. Todo lo que se deja fuera se anota en el informe.

**Files:**
- Modify: `src/arcane-client.ts` (interfaces `Environment`, `Project`, `ContainerSummary`, `ImageSummary`, `Volume`, `NetworkSummary`, `NetworkInspect`; extraer `VersionInfo`)
- Modify: `src/__tests__/arcane-client.test.ts` (test de `VersionInfo`)
- Modify: `docs/auditorias/2026-08-16-drift-campos-v2.7.0.md` (sección de resolución)

**Interfaces:**
- Consumes: el informe de la Tarea 5.
- Produces: interfaces alineadas. `VersionInfo` pasa a ser un tipo exportado:

```ts
export interface VersionInfo {
  currentVersion: string;
  displayVersion: string;
  goVersion: string;
  revision: string;
  shortRevision: string;
  isSemverVersion: boolean;
  updateAvailable: boolean;
  buildTime?: string;
  newestVersion?: string;
  releaseUrl?: string;
}
```

y `SystemMethods.version()` pasa a devolver `Promise<VersionInfo>`.

- [ ] **Step 1: Escribir el test que falla — `VersionInfo` debe ser un tipo exportado y auditable**

Añadir en `src/__tests__/arcane-client.test.ts`, dentro del `describe("system", ...)`:

```ts
    it(".version() devuelve un VersionInfo tipado con currentVersion", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          currentVersion: "v2.7.0",
          displayVersion: "v2.7.0",
          goVersion: "go1.26.5",
          revision: "a4a84fe5",
          shortRevision: "a4a84fe5",
          isSemverVersion: true,
          updateAvailable: true,
        }),
      } as Response);

      const info: VersionInfo = await client.system.version();

      expect(info.currentVersion).toBe("v2.7.0");
      expect(info.updateAvailable).toBe(true);
    });
```

Y añadir `VersionInfo` al import del principio del fichero:

```ts
import { ArcaneClient, ArcaneApiError, type VersionInfo } from "../arcane-client";
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

```bash
npm test -- src/__tests__/arcane-client.test.ts
```

Esperado: fallo de compilación del tipo, `"VersionInfo" is not exported by "src/arcane-client.ts"`.

- [ ] **Step 3: Extraer `VersionInfo` en `src/arcane-client.ts`**

Añadir la interfaz junto a las demás (por ejemplo tras `ActionResponse`):

```ts
/** Respuesta de GET /app-version. Endpoint público: no requiere API key. */
export interface VersionInfo {
  currentVersion: string;
  displayVersion: string;
  goVersion: string;
  revision: string;
  shortRevision: string;
  isSemverVersion: boolean;
  updateAvailable: boolean;
  buildTime?: string;
  newestVersion?: string;
  releaseUrl?: string;
}
```

Y sustituir el tipo de retorno inline de `SystemMethods.version()`:

```ts
class SystemMethods {
  constructor(private client: ArcaneClient) {}

  async version(): Promise<VersionInfo> {
    return this.client.request<VersionInfo>("GET", "/app-version");
  }
}
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

```bash
npm test -- src/__tests__/arcane-client.test.ts
```

Esperado: el nuevo test en verde; el total sube a 89.

- [ ] **Step 5: Corregir `NetworkSummary` (el caso más grave: 4 campos inventados)**

Sustituir la interfaz por:

```ts
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
```

Los campos `internal`, `attachable`, `ingress` e `ipam` **no existen** en `NetworkSummary` de v2.7.0 (siguen existiendo en `NetworkInspect`) — se eliminan. `created` pasa de opcional a obligatorio.

- [ ] **Step 6: Corregir `Volume` (6 campos obligatorios ausentes)**

Sustituir la interfaz por:

```ts
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
```

`createdAt` y `size` pasan de opcionales a obligatorios (el spec los marca `required`).

- [ ] **Step 7: Corregir `NetworkInspect`**

Añadir los campos obligatorios de v2.7.0 y ajustar `created`:

```ts
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
```

- [ ] **Step 8: Corregir los estados de opcionalidad restantes en `Environment`, `Project`, `ContainerSummary` e `ImageSummary`**

Aplica exactamente lo que diga el informe para estas cuatro interfaces:

- `Environment.name` está declarado obligatorio pero el spec lo marca opcional → pasa a `name?: string`.
- Añade los campos con estado `FALTA-EN-TS-REQUERIDO` que liste el informe (para `Project`, al menos `isArchived: boolean`).
- Añade los `FALTA-EN-TS-OPCIONAL` que **no** pertenezcan a dominios de F2–F5 — típicamente `iconDarkUrl?: string`, `iconLightUrl?: string`, `redeployDisabled?: boolean`, `relativePath?: string`, `overrideContent?: string`, `overrideFileName?: string`, `isDiscovered?: boolean`.
- **No** añadas `updateInfo`, `vulnerabilityScan`, `usedBy`, `projectFiles`, `includeFiles`, `runtimeServices`, `services` ni `directoryFiles`: son dominios de F2–F5.

- [ ] **Step 9: Verificar que la auditoría ya solo reporta lo diferido**

```bash
node scripts/audit-schema-drift.mjs
```

Esperado: cero hallazgos con estado `SOBRA-EN-TS`, `FALTA-EN-TS-REQUERIDO`, `OPCIONAL-PERO-REQUERIDO`, `OBLIGATORIO-PERO-OPCIONAL` o `INTERFAZ-AUSENTE`. Solo deben quedar `FALTA-EN-TS-OPCIONAL` de los dominios diferidos.

Comprobación asistida:

```bash
node scripts/audit-schema-drift.mjs --json \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const {findings}=JSON.parse(d);const graves=findings.filter(f=>f.status!=='FALTA-EN-TS-OPCIONAL');console.log('graves restantes:',graves.length);console.log(graves)})"
```

Esperado: `graves restantes: 0`.

- [ ] **Step 10: Verificar la suite completa y el type-check**

```bash
npm test && npm run type-check
```

Esperado: `Tests 89 passed (89)` y type-check limpio.

Si el type-check falla en `src/tools/*.ts`, es porque algún handler leía un campo que ya no existe (p. ej. `network.internal`). **Eso es exactamente el bug que buscábamos**: arregla el handler, no revivas el campo.

- [ ] **Step 11: Verificar los shapes corregidos contra la instancia real**

```bash
ARCANE_BASE_URL=http://192.168.180.210:3552 ARCANE_API_KEY="$ARCANE_API_KEY" npm run test:e2e
```

Esperado: `Tests 3 passed (3)`.

Comprobación adicional de que los campos nuevos vienen realmente poblados:

```bash
curl -s -H "X-API-Key: $ARCANE_API_KEY" \
  "http://192.168.180.210:3552/api/environments/0/networks" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const n=JSON.parse(d).data?.[0];console.log(Object.keys(n??{}))})"
```

Esperado: la lista de claves coincide con la interfaz `NetworkSummary` del Step 5 (`id`, `name`, `driver`, `scope`, `created`, `inUse`, `isDefault`, `labels`, `options`) y **no** incluye `internal`, `attachable`, `ingress` ni `ipam`. Si el entorno `0` no existe, sustitúyelo por el id que devuelva `GET /api/environments`.

- [ ] **Step 12: Anotar la resolución en el informe**

Añadir al final de `docs/auditorias/2026-08-16-drift-campos-v2.7.0.md`:

```markdown
## Resolución (2026-08-16)

Corregidos en `src/arcane-client.ts` todos los hallazgos de gravedad alta y media:

- `NetworkSummary`: eliminados `internal`, `attachable`, `ingress` e `ipam` (no existen
  en v2.7.0; siguen existiendo en `NetworkInspect`). Añadidos `inUse`, `isDefault`,
  `labels` y `options`. `created` pasa a obligatorio.
- `Volume`: añadidos `id`, `inUse`, `scope`, `containers`, `labels` y `options`;
  `createdAt` y `size` pasan a obligatorios.
- `NetworkInspect`: añadidos los campos obligatorios de v2.7.0.
- `Environment`, `Project`, `ContainerSummary`, `ImageSummary`: ajustada la opcionalidad
  y añadidos los campos obligatorios ausentes.
- `VersionInfo`: extraída como interfaz exportada (antes era un tipo inline no auditable).

### Diferido a F2–F5 (intencionadamente)

Campos opcionales que pertenecen a dominios aún no implementados y que no se declaran
porque ninguna tool los consume todavía:

| Campo | Fase que lo necesita |
|---|---|
| `ImageSummary.updateInfo`, `ProjectDetails.updateInfo` | F3 — actualizaciones de imágenes |
| `ImageSummary.vulnerabilityScan` | F4 — vulnerability scanning |
| `ImageSummary.usedBy` | F3 |
| `ProjectDetails.projectFiles`, `includeFiles`, `directoryFiles` | F5 — build |
| `ProjectDetails.runtimeServices`, `services` | F2 — system |

Al abordar cada fase, volver a ejecutar `node scripts/audit-schema-drift.mjs` y
declarar los campos correspondientes.
```

- [ ] **Step 13: Commit**

```bash
git add src/arcane-client.ts src/__tests__/arcane-client.test.ts docs/auditorias/2026-08-16-drift-campos-v2.7.0.md
git commit -m "fix(client): alinear las interfaces con los schemas de Arcane v2.7.0

Corrige los 4 campos inventados de NetworkSummary (internal, attachable,
ingress, ipam: no existen en v2.7.0) y los 6 campos obligatorios que
faltaban en Volume (id, inUse, scope, containers, labels, options),
además de la opcionalidad de Environment, Project, ContainerSummary,
ImageSummary y NetworkInspect.

Extrae VersionInfo como interfaz exportada para que sea auditable.

La auditoría queda sin hallazgos graves. Los opcionales que quedan
pertenecen a dominios de F2-F5 y están documentados como diferidos."
```

- [ ] **Step 14: Publicar la rama**

```bash
git push -u origin f0/spec-y-drift
git push github f0/spec-y-drift
```

- [ ] **Step 15: MERGE 2 — llevar F0 completo a `main`**

> ⚠️ Segundo merge a `main`: dispara despliegue.

```bash
docker ps --filter name=arcane-mcp --format "{{.Names}}\t{{.Status}}"   # línea base
git checkout main
git pull origin main
git merge --no-ff f0/spec-y-drift -m "merge: F0 — spec v2.7.0 y drift de campos corregido

Refresca openapi.txt de v1.14.1 a v2.7.0 con un script repetible,
mide el drift de shapes con una auditoría automatizada y corrige
las 8 interfaces desalineadas de src/arcane-client.ts."
npm test && npm run type-check
git push origin main
git push github main
```

- [ ] **Step 16: Verificar el despliegue**

```bash
docker ps --filter name=arcane-mcp --format "{{.Names}}\t{{.Status}}"
docker logs --tail 30 arcane-mcp-server
ARCANE_BASE_URL=http://192.168.180.210:3552 ARCANE_API_KEY="$ARCANE_API_KEY" npm run test:e2e
```

Esperado: contenedor reiniciado (Status reciente frente a la línea base), logs sin errores, `Tests 3 passed (3)`.

- [ ] **Step 17: Limpiar la rama**

```bash
git push origin --delete f0/spec-y-drift
git push github --delete f0/spec-y-drift
git branch -d f0/spec-y-drift
```

---

## Tarea 7: Documentar el patrón "cómo añadir una tool"

**Objetivo (F0.5):** dejar por escrito el flujo que seguirán F2–F5, para que cada fase no reinvente el procedimiento.

**Files:**
- Create: `docs/README.md` (índice de documentación)
- Create: `docs/desarrollo/anadir-una-tool.md`

**Interfaces:**
- Consumes: `npm test`, `npm run test:e2e`, `npm run update-api-spec`, `scripts/audit-schema-drift.mjs` (Tareas 1, 2, 4, 5); `e2eClient()` e `IDEMPOTENT_STACK` de `src/__e2e__/helpers.ts`.
- Produces: documentación. No la consume ninguna tarea de este plan.

- [ ] **Step 1: Crear la rama**

```bash
git checkout main
git pull origin main
git checkout -b f1/docs-fork
```

- [ ] **Step 2: Escribir la guía**

Crear `docs/desarrollo/anadir-una-tool.md`:

````markdown
# Cómo añadir una tool a `arcane-mcp`

Procedimiento estándar para F2–F5. Cada tool nueva pasa por los seis pasos.

## 0. Precondiciones

```bash
bun install
npm test          # debe dar verde antes de empezar
npm run type-check
```

Si `openapi.txt` lleva tiempo sin tocarse, refréscalo y reaudita:

```bash
npm run update-api-spec
node scripts/audit-schema-drift.mjs
```

## 1. Localizar el endpoint en el spec

`openapi.txt` es la fuente de verdad, no el código de otros forks.

```bash
node -e "const s=JSON.parse(require('fs').readFileSync('openapi.txt','utf8')); console.log(Object.keys(s.paths).filter(p=>p.includes('<dominio>')))"
```

Para ver el schema de respuesta de un path concreto:

```bash
node -e "const s=JSON.parse(require('fs').readFileSync('openapi.txt','utf8')); console.log(JSON.stringify(s.paths['<path>'], null, 2))"
```

**Detección de endpoints NDJSON:** si la respuesta `200` declara `content` vacío
(`"content": {}`) en vez de `application/json`, el endpoint **transmite NDJSON**
(`application/x-json-stream`). Ver el paso 3.

## 2. Declarar el tipo en `src/arcane-client.ts`

Copia el shape del schema del spec, campo por campo. Respeta la opcionalidad:
lo que el spec liste en `required` va **sin** `?`.

Si el tipo representa un payload de la API, añádelo al mapa `MAP` de
`scripts/audit-schema-drift.mjs` para que quede bajo auditoría permanente:

```js
const MAP = {
  // ...
  MiTipoNuevo: "SchemaDelSpec",
};
```

## 3. Añadir el método al cliente

Endpoint normal (JSON único):

```ts
async list(envId: string): Promise<PaginatedResponse<MiTipo>> {
  return this.client.request<PaginatedResponse<MiTipo>>("GET", `/environments/${envId}/mi-recurso`);
}
```

Endpoint NDJSON — **nunca uses `request()`**, revienta con
`Unexpected non-whitespace character after JSON`:

```ts
async miAccion(envId: string, id: string): Promise<ActionResponse> {
  // El endpoint transmite NDJSON (application/x-json-stream), no un JSON único.
  const events = await this.client.requestNdjson<ComposeStreamEvent>(
    "POST",
    `/environments/${envId}/mi-recurso/${id}/accion`
  );
  return summarizeComposeStream(events, "MiAcción");
}
```

Shape conocido del stream de compose:
`{type,activityId}` → `{log}`\* → `{done:true}`, o `{error}` en caso de fallo.

## 4. Registrar la tool MCP

Un fichero por dominio en `src/tools/`. Nombre según la convención
`arcane_<dominio>_<acción>`. Patrón:

```ts
server.tool(
  "arcane_<dominio>_<acción>",
  "Descripción en una línea, en inglés, orientada al cliente MCP.",
  {
    environmentId: z.string().optional().describe("Environment ID (use if known)"),
    environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
  },
  async ({ environmentId, environmentName }) => {
    try {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.miDominio.miAccion(envId);
      return { content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }] };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  },
);
```

Reglas:

- Acepta siempre `*Id` **y** `*Name`, y resuelve con los helpers de `src/tools/resolve.ts`.
- Toda tool devuelve `isError: true` cuando falla; nunca lanza.
- Para acciones que devuelven `ActionResponse`, comprueba `result.success === false`
  y devuelve `isError: true` con `result.message`. Un `success:false` silenciado es
  el bug que tuvo `arcane_project_redeploy`.
- Registra la función `register<Dominio>Tools` en `src/index.ts`.

## 5. Verificar — regla dura, sin excepciones

Ninguna tool se da por terminada sin **las dos** comprobaciones.

**(a) Test unitario con `fetch` mockeado** en `src/__tests__/`:

```ts
it(".miAccion(envId) - POST /environments/{envId}/mi-recurso/accion", async () => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) } as Response);
  await client.miDominio.miAccion("env123");
  expect(mockFetch).toHaveBeenCalledWith(
    "http://localhost:3552/api/environments/env123/mi-recurso/accion",
    expect.objectContaining({ method: "POST" })
  );
});
```

Para endpoints NDJSON, mockea `text:` en vez de `json:` y verifica al menos:
stream de éxito con `{done:true}`, stream con `{error}`, y el fallback de objeto único.

**(b) e2e contra la instancia v2.7.0 real** en `src/__e2e__/`:

```ts
import { e2eClient, IDEMPOTENT_STACK } from "./helpers";
```

Tools de lectura: e2e directo, sin restricciones.
Tools mutantes: **solo** sobre stacks idempotentes (`ical-bridge` por defecto,
configurable con `ARCANE_E2E_STACK`).

```bash
npm test
ARCANE_BASE_URL=http://192.168.180.210:3552 ARCANE_API_KEY=<clave> npm run test:e2e
npm run type-check
```

## 6. Documentar y publicar

- Añade la fila a la tabla de tools del `README.md`.
- Commit en rama. **Nunca commits sueltos en `main`.**
- Push a `origin` y a `github`.
- El merge a `main` es deliberado: `main` tiene `autoSync=True` y despliega
  automáticamente. Tras el merge, verifica que el contenedor se ha reiniciado y
  vuelve a pasar los e2e contra producción.
````

- [ ] **Step 3: Crear el índice de documentación**

Crear `docs/README.md`:

```markdown
# Documentación de `arcane-mcp`

Punto de entrada a la documentación del fork. Toda documentación nueva se
enlaza desde aquí.

## Desarrollo

- [Cómo añadir una tool](desarrollo/anadir-una-tool.md) — procedimiento estándar
  para F2–F5: localizar el endpoint en el spec, tipar, implementar, registrar,
  verificar (unitario + e2e) y publicar.

## Auditorías

- [Drift de campos vs Arcane v2.7.0 (2026-08-16)](auditorias/2026-08-16-drift-campos-v2.7.0.md)
  — desalineaciones entre las interfaces TypeScript y los schemas del spec, y su resolución.

## Specs y planes

- [Spec F0 + F1 (2026-08-16)](superpowers/specs/2026-08-16-fork-arcane-mcp-f0-f1-design.md)
  — decisión de no migrar a RandomSynergy17/Arcane-MCP-Server, y alcance de
  F0 (cimientos) y F1 (visibilidad).
- [Plan F0 + F1 (2026-08-16)](superpowers/plans/2026-08-16-fork-arcane-mcp-f0-f1.md)

## Operación

| Comando | Para qué |
|---|---|
| `npm test` | Suite unitaria (sin red ni credenciales) |
| `npm run test:e2e` | Verificación contra la instancia Arcane real |
| `npm run type-check` | Comprobación de tipos |
| `npm run update-api-spec` | Refresca `openapi.txt` desde la instancia |
| `node scripts/audit-schema-drift.mjs` | Audita el drift de campos |
```

- [ ] **Step 4: Verificar que todos los enlaces del índice resuelven**

```bash
for f in docs/desarrollo/anadir-una-tool.md \
         docs/auditorias/2026-08-16-drift-campos-v2.7.0.md \
         docs/superpowers/specs/2026-08-16-fork-arcane-mcp-f0-f1-design.md \
         docs/superpowers/plans/2026-08-16-fork-arcane-mcp-f0-f1.md; do
  [ -f "$f" ] && echo "OK   $f" || echo "ROTO $f"
done
```

Esperado: cuatro líneas `OK`.

- [ ] **Step 5: Commit**

```bash
git add docs/README.md docs/desarrollo/anadir-una-tool.md
git commit -m "docs: patrón 'cómo añadir una tool' e índice de documentación

Deja por escrito el flujo que seguirán F2-F5: localizar el endpoint en
openapi.txt (incluida la detección de endpoints NDJSON por su 'content'
vacío), tipar contra el schema, implementar en el cliente, registrar la
tool y verificar con la regla dura (unitario + e2e contra la instancia
real)."
```

---

## Tarea 8: README de fork mantenido

**Objetivo (F1.1):** que desde fuera se vea que el fork está vivo, es compatible con Arcane v2.x, en qué diverge del upstream y cómo se despliega.

**Files:**
- Modify: `README.md` (añadir cabecera de fork y sección de divergencias; actualizar la sección de desarrollo local)

**Interfaces:**
- Consumes: `docs/README.md` (Tarea 7) para enlazarlo.
- Produces: README publicado. Referencia para el PR de la Tarea 9.

- [ ] **Step 1: Insertar la cabecera de fork al principio del `README.md`**

Justo debajo del título `# Arcane Docker MCP Server`, antes del primer párrafo:

```markdown
> **Fork mantenido activamente por [Taiko Solutions](https://taikosolutions.com).**
> Verificado contra **Arcane v2.7.0** (37/37 rutas válidas). Origen del fork:
> [`cougz/arcane-mcp-server`](https://github.com/cougz/arcane-mcp-server), inactivo
> desde marzo de 2026.
>
> | | |
> |---|---|
> | **Compatibilidad** | Arcane v2.x (probado contra v2.7.0) |
> | **Spec de referencia** | [`openapi.txt`](openapi.txt) — descargado de la instancia con `npm run update-api-spec` |
> | **Tools** | 68 |
> | **Documentación** | [`docs/`](docs/README.md) |
```

- [ ] **Step 2: Añadir la sección de divergencias respecto al upstream**

Insertar tras la sección `## What This Project Is`:

```markdown
## En qué diverge este fork del upstream

| Área | `cougz/arcane-mcp-server` | Este fork |
|---|---|---|
| Endpoints NDJSON (`/pull`, `/up`, `/redeploy`) | Rotos: parsean el cuerpo con `response.json()` y revientan con `Unexpected non-whitespace character after JSON` en la segunda línea del stream | `requestNdjson()` + agregación a `ActionResponse`, con los errores del stream propagados a la tool |
| Path de `arcane_stack_pull` | `/pull-project-images`, inexistente en Arcane v2.x → 404 | `/pull`, según el spec v2.7.0 |
| Compatibilidad de shapes | Escrito contra Arcane v1.x | Interfaces alineadas con v2.7.0 y auditadas por `scripts/audit-schema-drift.mjs` |
| Despliegue | Solo Cloudflare Workers | Cloudflare Workers **o** contenedor Docker autoalojado (`docker-compose.yml` + `wrangler.local.jsonc`) |
| Cliente | `baseUrl` fijo hacia el binding VPC | Modo dual: binding VPC en Workers, URL real en local/Docker |
| Verificación | Sin runner de tests funcional | 89 tests unitarios + suite e2e contra una instancia Arcane real |

El fix de los endpoints NDJSON se ha ofrecido al upstream como PR autocontenido.
```

- [ ] **Step 3: Documentar los comandos de desarrollo y verificación**

Añadir tras la sección `## Local Development Setup`:

```markdown
### Comandos

| Comando | Para qué |
|---|---|
| `bun install` | Instalar dependencias (el `Dockerfile` usa el mismo gestor) |
| `npm test` | Suite unitaria — sin red ni credenciales |
| `npm run test:e2e` | Verificación contra una instancia Arcane real (requiere `ARCANE_BASE_URL` y `ARCANE_API_KEY`) |
| `npm run type-check` | Comprobación de tipos |
| `npm run update-api-spec` | Refrescar `openapi.txt` desde la instancia |
| `node scripts/audit-schema-drift.mjs` | Auditar el drift entre las interfaces TS y el spec |

### Despliegue

Este fork se despliega como contenedor Docker mediante GitOps de Arcane, con
`autoSync` sobre `main`: **un push a `main` reconstruye y reinicia producción.**
Todo el trabajo va en ramas y los merges a `main` son deliberados y verificados.

Para desplegar en Cloudflare Workers en su lugar, usa `npm run deploy`
(`wrangler.jsonc`, con binding de servicio VPC hacia Arcane).

Para contribuir, lee [cómo añadir una tool](docs/desarrollo/anadir-una-tool.md).
```

- [ ] **Step 4: Verificar el conteo de tools declarado en el README**

```bash
grep -rho 'server\.tool(\s*$\|server\.tool(' src/tools/*.ts | wc -l
grep -rc '"arcane_' src/tools/*.ts | awk -F: '{s+=$2} END {print s}'
```

Ajusta la cifra de la tabla de la cabecera al número real de tools registradas. Si el conteo no da 68, usa el valor real: un README que miente es peor que uno incompleto.

- [ ] **Step 5: Verificar que no se ha roto nada**

```bash
npm test && npm run type-check
```

Esperado: `Tests 89 passed (89)` y type-check limpio.

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs(readme): declarar el fork como mantenido y compatible con Arcane v2.x

Añade cabecera de fork con compatibilidad verificada (v2.7.0), tabla de
divergencias respecto a cougz/arcane-mcp-server, comandos de desarrollo
y verificación, y la advertencia de que main auto-despliega por GitOps."
```

- [ ] **Step 7: Publicar la rama**

```bash
git push -u origin f1/docs-fork
git push github f1/docs-fork
```

- [ ] **Step 8: MERGE 3 — llevar la documentación a `main`**

> ⚠️ Tercer y último merge a `main`. Es un cambio solo de documentación, pero
> igualmente dispara la reconstrucción del contenedor.

```bash
docker ps --filter name=arcane-mcp --format "{{.Names}}\t{{.Status}}"   # línea base
git checkout main
git pull origin main
git merge --no-ff f1/docs-fork -m "merge: F1 — documentación de fork mantenido

README de fork con compatibilidad Arcane v2.x y divergencias respecto
al upstream, patrón 'cómo añadir una tool' para F2-F5, e índice de
documentación."
npm test && npm run type-check
git push origin main
git push github main
```

- [ ] **Step 9: Verificar el despliegue y limpiar**

```bash
docker ps --filter name=arcane-mcp --format "{{.Names}}\t{{.Status}}"
docker logs --tail 20 arcane-mcp-server
git push origin --delete f1/docs-fork
git push github --delete f1/docs-fork
git branch -d f1/docs-fork
```

Esperado: contenedor reiniciado, logs sin errores.

---

## Tarea 9: PR quirúrgico al upstream `cougz`

**Objetivo (F1.2):** publicar un PR autocontenido con el fix NDJSON de `/pull`, `/up` y `/redeploy`, como señal pública de actividad.

**Expectativa declarada por el spec: no se va a mergear.** `cougz` no ha atendido contribuciones desde marzo de 2026. El valor es la señal y quedar como fork de referencia. Por eso el PR es pequeño y autocontenido: un PR gigante con dominios nuevos nadie lo revisa.

**Decisión de diseño:** la rama del PR se construye **desde `upstream/main`**, no cherry-pickeando `eb866b6`. Motivo: nuestra rama del fix asume `requestNdjson()` (que el upstream no tiene) y arrastra los cambios de modo local/Docker del cliente, que no pertenecen a este PR. Se lleva únicamente lo que arregla el bug.

**Un segundo bug que el PR también arregla, y hay que declarar:** el upstream apunta `StacksMethods.pull` a `POST /environments/{envId}/projects/{stackId}/pull-project-images`. **Ese path no existe en Arcane v2.x** — el spec v2.7.0 solo declara `/environments/{id}/projects/{projectId}/pull`. Es decir, `arcane_stack_pull` da 404 en el upstream antes siquiera de llegar al bug de parseo. El PR corrige las dos cosas, porque arreglar solo el parseo dejaría la tool igual de rota; el cuerpo del PR lo dice explícitamente en vez de colarlo.

**Files (todos relativos a la rama `upstream-pr/ndjson-streaming`):**
- Modify: `src/arcane-client.ts` — añadir `requestNdjson()`, `ComposeStreamEvent`, `summarizeComposeStream()`; reescribir `StacksMethods.pull`, `StacksMethods.start`, `ProjectAdditionalMethods.pullImages`, `ProjectAdditionalMethods.redeploy`
- Modify: `src/tools/projects-additional.ts` — propagar `success:false` en `redeploy` y `pullImages`
- Modify: `src/tools/stacks.ts` — propagar `success:false` en `start` y `pull`
- Modify: `src/__tests__/arcane-client.test.ts` — tests de los tres streams

**Interfaces:**
- Consumes: `main` de nuestro fork como referencia de implementación (ya contiene las cuatro correcciones tras la Tarea 3).
- Produces: un PR abierto en `cougz/arcane-mcp-server`. **Nada de esta rama se mergea a nuestro `main`.**

- [ ] **Step 1: Crear la rama desde el upstream**

```bash
git fetch upstream
git checkout -b upstream-pr/ndjson-streaming upstream/main
```

- [ ] **Step 2: Confirmar el punto de partida**

```bash
git log -1 --format="%H %s"
grep -c "requestNdjson" src/arcane-client.ts || echo "0 - confirmado: el upstream no tiene requestNdjson"
```

Esperado: commit `9089bd0` con mensaje `test`, y `0` ocurrencias de `requestNdjson`.

- [ ] **Step 3: Portar los cambios del cliente desde nuestro `main`**

Trae solo el fichero del cliente y quédate con lo relevante:

```bash
git checkout main -- src/arcane-client.ts
```

Después **revierte manualmente** lo que no pertenece a este PR, dejando la clase `ArcaneClient` como estaba en el upstream salvo por el método nuevo.

**(a) Restaura el constructor original.** Sustituye nuestra versión de modo dual por la del upstream, exactamente:

```ts
  constructor(apiKey: string, fetcher?: Fetcher) {
    this.baseUrl = "http://placeholder/api";
    this.apiKey = apiKey;
    this._fetch = fetcher ? fetcher.fetch.bind(fetcher) : fetch;
    this.environments = new EnvironmentsMethods(this);
    // ... el resto de asignaciones, sin cambios
  }
```

**(b) Restaura las interfaces al estado del upstream**, incluidas las que corregimos en la Tarea 6 (`NetworkSummary`, `Volume`, `NetworkInspect`, `VersionInfo`, etc.): son correcciones de compatibilidad con v2.x, no parte de este fix, y meterlas aquí convierte el PR en algo que nadie revisa. La única interfaz nueva que se conserva es `ComposeStreamEvent`.

```bash
git diff upstream/main -- src/arcane-client.ts | grep -E "^[-+].*(NetworkSummary|VersionInfo|isDefault|activityId\?)" | head
```

Esperado: sin salida (salvo el `activityId?` que forma parte de `ComposeStreamEvent`).

**(c) Restaura también `SystemMethods.version()`** al estado del upstream: el cambio de `/version` a `/app-version` es otra corrección de compatibilidad v2.x, ajena a este PR.

**(d) Conserva:** `requestNdjson()`, `ComposeStreamEvent`, `summarizeComposeStream()`, y los cuatro métodos corregidos (`stacks.pull`, `stacks.start`, `projectAdditional.pullImages`, `projectAdditional.redeploy`). En `stacks.pull`, el path corregido `/pull` (el upstream tiene `/pull-project-images`, inexistente en v2.x) va incluido y se declara en el cuerpo del PR.

Comprobación de que la rama del PR no arrastra nuestro modo local:

```bash
git diff upstream/main -- src/arcane-client.ts | grep -c "fetcherOrBaseUrl"
```

Esperado: `0`.

- [ ] **Step 4: Portar los cambios de las tools**

```bash
git checkout main -- src/tools/stacks.ts src/tools/projects-additional.ts
git diff upstream/main --stat -- src/tools/
```

Esperado: solo las líneas de propagación de `success:false` y los mensajes enriquecidos con `result.message`. Si aparece cualquier otra cosa, revierte ese trozo.

- [ ] **Step 5: Portar los tests**

```bash
git checkout main -- src/__tests__/arcane-client.test.ts
```

Elimina de ese fichero los tests que dependan de cosas nuestras que no van en el PR:

- El test `"sets baseUrl from the provided host in local mode"` (modo local: no va).
- Deja el constructor de tests como el del upstream y ajusta las URLs esperadas a `http://placeholder/api/...`.

Conserva íntegro el bloque `describe("NDJSON /up and /redeploy streams", ...)` y añade la cobertura equivalente para `/pull`, que es el tercer endpoint roto en el upstream:

```ts
    it("pull() apunta a /pull y parsea el NDJSON sin reventar con JSON.parse", async () => {
      const pullStream = [
        '{"status":"Pulling from library/nginx","id":"latest"}',
        '{"status":"Downloading","id":"a1b2c3"}',
        '{"status":"Status: Downloaded newer image for nginx:latest"}',
        '{"status":"complete"}',
      ].join("\n");
      mockFetch.mockResolvedValue({ ok: true, text: async () => pullStream } as Response);

      const result = await client.stacks.pull("env123", "stack1");

      // El upstream apuntaba a /pull-project-images, que no existe en Arcane v2.x.
      expect(mockFetch).toHaveBeenCalledWith(
        "http://placeholder/api/environments/env123/projects/stack1/pull",
        expect.objectContaining({ method: "POST" })
      );
      expect(result.success).toBe(true);
      expect(result.message).toContain("Downloaded newer image");
    });

    it("pull() reporta fallo cuando el stream contiene un error", async () => {
      const errStream = [
        '{"status":"Pulling from library/nginx","id":"latest"}',
        '{"error":"manifest unknown: manifest tagged by \\"nope\\" is not found"}',
      ].join("\n");
      mockFetch.mockResolvedValue({ ok: true, text: async () => errStream } as Response);

      const result = await client.stacks.pull("env123", "stack1");

      expect(result.success).toBe(false);
      expect(result.message).toContain("manifest unknown");
    });
```

- [ ] **Step 6: Ejecutar los tests en la rama del PR**

El upstream no tiene el runner arreglado, así que ejecútalos con una config temporal **que no se commitea**:

```bash
cat > /tmp/vitest.pr.config.ts <<'EOF'
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["src/__tests__/**/*.test.ts"], environment: "node" } });
EOF
cp /tmp/vitest.pr.config.ts ./vitest.pr.config.ts
npx vitest run --config vitest.pr.config.ts
rm -f vitest.pr.config.ts
```

Esperado: `Test Files 3 passed (3)`, todos los tests en verde.

Si algún test falla por la URL `http://placeholder/api/...` frente a `http://localhost:3552/api/...`, ajusta la expectativa del test — no el cliente: en el PR el constructor es el del upstream.

- [ ] **Step 7: Verificar que el diff del PR es realmente quirúrgico**

```bash
git add -A
git diff --cached upstream/main --stat
```

Esperado: **4 ficheros**, del orden de 150–200 líneas añadidas. Si aparecen `Dockerfile`, `docker-compose.yml`, `entrypoint.sh`, `wrangler.local.jsonc`, `.env.example`, `docs/` o `package.json`, sácalos:

```bash
git restore --staged <fichero> && git checkout upstream/main -- <fichero>
```

- [ ] **Step 8: Commit**

```bash
git commit -m "fix: compose action endpoints fail against a real Arcane server

The compose action endpoints stream application/x-json-stream (NDJSON),
one JSON object per line. Parsing the whole body with response.json()
throws 'Unexpected non-whitespace character after JSON at position N'
as soon as the stream emits its second line, so arcane_stack_pull,
arcane_stack_start and arcane_project_redeploy always fail against a
real Arcane server.

Adds ArcaneClient.requestNdjson(), which parses the body line by line,
and summarizeComposeStream(), which aggregates the events into the
ActionResponse the tools already expect. Stream errors now surface to
the caller instead of being swallowed.

Observed event shape (Arcane v2.7.0):
  {\"type\":\"activity\",\"activityId\":\"...\"}
  {\"log\":\" Container app Recreated \"}
  {\"done\":true}
  {\"error\":\"...\"}        // emitted instead of done on failure

Separately, StacksMethods.pull posted to /pull-project-images, a route
that no longer exists in Arcane v2.x, so arcane_stack_pull 404s before
it can even reach the parsing bug. Fixed to /pull.

Includes a defensive fallback: if an endpoint answers with a single
{success,message} object instead of a stream, it is passed through
unchanged.

Tests: 3 test files, all green, covering success streams, error
streams and the single-object fallback for all three endpoints."
```

- [ ] **Step 9: Publicar la rama en nuestro remoto de GitHub**

```bash
git push -u github upstream-pr/ndjson-streaming
```

- [ ] **Step 10: Abrir el PR contra `cougz`**

```bash
gh pr create \
  --repo cougz/arcane-mcp-server \
  --base main \
  --head marcoaperez:upstream-pr/ndjson-streaming \
  --title "fix: compose action endpoints (/pull, /up, /redeploy) fail against a real server" \
  --body "$(cat <<'EOF'
## Problem

`arcane_stack_pull`, `arcane_stack_start` and `arcane_project_redeploy` fail against
any real Arcane server. There are two independent causes.

### 1. NDJSON responses parsed as a single JSON object

Those three endpoints stream `application/x-json-stream` (NDJSON) — one JSON object
per line — but the client parses the response with `response.json()`, which throws as
soon as the stream emits its second line:

```
Unexpected non-whitespace character after JSON at position 57
```

Because the throw happens before any result is produced, the tools report a generic
error and there is no way for the caller to tell a failed deploy from a parse bug.

## Reproduction

Against Arcane (reproduced on v2.7.0):

```
POST /api/environments/{envId}/projects/{projectId}/up
Content-Type: application/x-json-stream

{"type":"activity","activityId":"195296d1-f692-401e-b56f-0d6421c8bb9d"}
{"log":" Container app Recreate "}
{"log":" Container app Recreated "}
{"log":" Container app Started "}
{"log":" Container app Healthy "}
{"done":true}
```

`response.json()` on that body throws. Same for `/pull` and `/redeploy`.

### 2. `StacksMethods.pull` points at a path that no longer exists

`pull()` posts to `/environments/{envId}/projects/{stackId}/pull-project-images`.
That route is gone in Arcane v2.x — the current OpenAPI spec only declares
`/environments/{id}/projects/{projectId}/pull` — so `arcane_stack_pull` 404s before
it can even hit the parsing bug. Fixing only the parsing would leave the tool just as
broken, so this PR fixes the path too. It is the one behavioural change here beyond
the parsing, and it is called out rather than slipped in.

## Fix

- `ArcaneClient.requestNdjson<T>()` — parses the body line by line, skipping blank
  and unparseable lines, and returns one entry per event.
- `summarizeComposeStream()` — aggregates the events into the `ActionResponse` the
  tools already expect: `{"done":true}` means success, and any `{"error":...}` event
  is surfaced in the message instead of being swallowed.
- The four affected client methods now go through it.
- `StacksMethods.pull` posts to `/pull` instead of `/pull-project-images`.
- The tools propagate `success: false` as `isError: true` rather than reporting
  success unconditionally.

There is a defensive fallback: if an endpoint answers with a single
`{success,message}` object instead of a stream, it is passed through unchanged.

## Tests

3 test files, all green. Coverage for each endpoint: success stream, error stream,
and the single-object fallback — plus an assertion that `pull()` requests the `/pull`
path.

The repo's test runner does not currently start (`vitest` and
`@cloudflare/vitest-pool-workers` are both declared as `"*"` and resolve to
incompatible majors), so I ran the suite with the default node pool. That is a
separate issue and deliberately not part of this PR.

## Scope

Four files, no new dependencies, no API surface changes. Nothing else is touched.
EOF
)"
```

- [ ] **Step 11: Registrar el PR**

Anota la URL del PR. Añádela a `docs/README.md` en una entrada nueva bajo `## Upstream`, en la rama de documentación correspondiente (o en un commit de seguimiento a `f1/docs-fork` si aún no se ha mergeado):

```markdown
## Upstream

- PR al upstream `cougz/arcane-mcp-server`: <URL> — fix NDJSON de `/pull`, `/up` y
  `/redeploy`. Abierto 2026-08-16. **Expectativa declarada: no se mergeará** (el
  mantenedor no atiende contribuciones desde marzo de 2026); el valor es la señal
  pública de actividad.
```

- [ ] **Step 12: Volver a `main` y confirmar que la rama del PR no lo ha contaminado**

```bash
git checkout main
git status
git log --oneline -3
```

Esperado: árbol limpio y el último commit es el MERGE 3 de la Tarea 8. La rama `upstream-pr/ndjson-streaming` se conserva en el remoto `github` mientras el PR siga abierto, y **nunca** se mergea a nuestro `main`.

---

## Cobertura del spec

| Requisito del spec | Tarea |
|---|---|
| F0.1 · Fix NDJSON a producción, verificado contra stack idempotente | 3 (con el harness de la 2) |
| F0.2 · `openapi.txt` a v2.7.0 + script `update-api-spec` | 4 |
| F0.3 · Auditoría de drift + corrección | 5, 6 |
| F0.4 · Reparar el runner de tests | 1 |
| F0.5 · Documentar "cómo añadir una tool" | 7 |
| F1.1 · README de fork mantenido | 8 |
| F1.2 · PR quirúrgico a `cougz` (`/up`, `/redeploy` y `/pull`) | 9 — incluye además el path roto de `stacks.pull`, declarado explícitamente en el PR |
| F1.3 · Publicación en GitHub | ✅ ya hecho (2026-08-16), sin tarea |
| Riesgo · `main` auto-despliega | Constraint global #1; tres merges controlados (Tareas 3, 6, 8) |
| Riesgo · Drift de campos antes de construir encima | Tareas 5 y 6, antes de cualquier tool nueva |
| Riesgo · Sin runner no hay verificación | Tarea 1, primera del plan |
| Riesgo · El spec live cambia al actualizar Arcane | Tarea 4 (script) + recordatorio de reauditar en la Tarea 7 |
| Decisión · NDJSON ciudadano de primera | Constraint global #6; documentado en la Tarea 7 |
| Decisión · Convención `arcane_<dominio>_<acción>` | Constraint global #5; documentado en la Tarea 7 |
| Decisión · Regla dura de verificación | Constraint global #4; harness en la Tarea 2, documentado en la Tarea 7 |

## Fuera de alcance de este plan

- F2 (System + Events/Jobs), F3 (actualizaciones de imágenes), F4 (vulnerability
  scanning) y F5 (build + registries) — cada una con su propio spec.
- Retirada de `~/docker/arcane-mcp-server` (copia previa de trabajo): decisión
  pendiente, ajena a F0/F1.
- Subir `wrangler` por encima de `^4.98.0`.
