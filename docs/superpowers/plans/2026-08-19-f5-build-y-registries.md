# F5 — build y registries: plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: usa `superpowers:subagent-driven-development`
> (recomendada) o `superpowers:executing-plans` para ejecutar este plan tarea a tarea.
> Los pasos usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** exponer 17 tools sobre 17 de las 22 operaciones de registros y build de
Arcane, sin que ninguna credencial llegue al contexto del modelo.

**Arquitectura:** cuatro ficheros de tools nuevos en `src/tools/`, cuatro clases de
métodos nuevas en `src/arcane-client.ts`, y tres huecos de transporte que hay que tapar
antes de escribir la primera tool: respuestas 204 sin cuerpo, el NDJSON de build con su
propio resumidor acotado, y la lectura de ficheros en base64.

**Stack:** TypeScript, vitest, zod, MCP SDK. Instalación con `bun`, ejecución con `node`.

**Spec:** [`2026-08-19-f5-build-y-registries-design.md`](../specs/2026-08-19-f5-build-y-registries-design.md).
Ante cualquier duda manda `openapi.txt` sobre este plan, y **la medición contra la
instancia manda sobre `openapi.txt`**.

---

## Restricciones globales

Se aplican a **todas** las tareas. No se repiten en cada una.

1. **Nada de cifras predichas.** Ninguna tarea escribe en un documento un número de
   tests, tools, drift o cobertura que no venga de un comando ejecutado en esa misma
   sesión. Si el plan predice algo y la medición dice otra cosa, **manda la medición** y
   se reporta la discrepancia.
2. **Regla dura de verificación.** Ninguna tool se da por terminada sin test unitario con
   `fetch` mockeado **y** comprobación e2e contra la instancia real.
3. **Dos tests por parámetro opcional**, uno con él y otro sin él, **asertando la URL
   literal completa**. `toHaveBeenCalledWith` considera iguales una clave ausente y una
   clave con valor `undefined`: enumerar `sort: undefined` no comprueba nada.
   **Esto vale para TODOS los parámetros opcionales del método, no solo para los que
   aparezcan en el código de ejemplo de la tarea.** Si el ejemplo cubre `search` y `sort`
   y el método acepta además `order`, `start` y `limit`, faltan tests: manda esta
   restricción, no el ejemplo. Incluye siempre el borde **`start=0`**, que es un valor
   válido y no una ausencia — este proyecto ya ha tenido ese bug tres veces.
3b. **Cada handler de tool necesita al menos un test que compruebe que pasa sus
   parámetros al cliente.** Los tests de `arcane-client.test.ts` prueban la clase
   cliente y los e2e llaman al cliente directamente: **ninguna de las dos capas toca el
   handler MCP**, así que sin este test el cableado de la tool no lo verifica nadie y una
   mutación que deje de pasar un parámetro no rompe nada. Sigue el patrón de los tests
   que ya existen en `tools.test.ts` (`arcane_environment_list calls client.environments.list
   with correct params`).
4. **Fixtures que el percent-encoding cambie.** Nada de identificadores como `ign-1`, que
   codificados son idénticos. Usa valores con `#`, `/` o `..`.
5. **Falsabilidad demostrada.** Antes de dar una tarea por hecha, muta el código de
   producción y enseña que el test cae. Un test que solo comprueba que algo «no explota»
   o que un campo existe no cuenta como test.
6. **`encodeURIComponent` en los cuatro ids nuevos** (`{id}` de registros, `{buildId}`,
   `{projectId}`), **nunca `segmentoDeRuta()`**: ese helper existe solo para que el
   `sha256:` de una imagen viaje con los dos puntos crudos, y estos cuatro son UUID.
7. **Los avisos dicen lo observable y no inventan la causa.** Este proyecto lo ha pagado
   cuatro veces.
8. **Toda tool devuelve `isError: true` cuando falla; nunca lanza.** Usa `withErrors`.
9. **Cada fichero nuevo de `src/tools/` se registra en `GROUPS`** de
   `scripts/gen-tools-table.mjs` en la misma tarea que lo crea, o el script aborta.
10. **Commits firmados, siempre en la rama `f5-build-y-registries`.** Nunca
    `--no-gpg-sign`: si la firma falla, 1Password está bloqueado — para y pídelo.
11. **Los e2e se ejecutan con `scripts/e2e-remoto.sh`** (Tarea 1), no desde el Mac.
12. **`skipped` no es verde.** Cuenta las marcas `✓` una a una con `--reporter=verbose`;
    un fichero que aborta al importar sale como `skipped`.

### Comandos de referencia

```bash
bun install
npm test
npm run type-check
npm run gen-tools-table -- --check
node scripts/audit-schema-drift.mjs
./scripts/e2e-remoto.sh
```

---

## Estructura de ficheros

| Fichero | Responsabilidad |
|---|---|
| `scripts/e2e-remoto.sh` | **crear** — ejecuta la suite e2e desde `vm-control` |
| `src/arcane-client.ts` | **modificar** — `requestSinCuerpo()`, `summarizeBuildStream()`, cuatro clases de métodos y sus tipos |
| `src/tools/container-registries.ts` | **crear** — 4 tools de registros de contenedor |
| `src/tools/template-registries.ts` | **crear** — 4 tools de registros de plantillas |
| `src/tools/build-workspace.ts` | **crear** — 5 tools del workspace de builds |
| `src/tools/image-builds.ts` | **crear** — 4 tools de build |
| `src/index.ts` | **modificar** — registrar las cuatro funciones |
| `src/__tests__/arcane-client.test.ts` | **modificar** — tests de URL, codificación y traversal (`fetch` mockeado) |
| `src/__tests__/tools.test.ts` | **modificar** — tests de comportamiento de tool (cliente mockeado) |
| `src/__e2e__/helpers.ts` | **modificar** — siembra de registros y descubrimiento de entorno con workspace |
| `src/__e2e__/registries.e2e.ts` | **crear** — e2e de los dos tipos de registro |
| `src/__e2e__/builds.e2e.ts` | **crear** — e2e de workspace y build |
| `scripts/gen-tools-table.mjs` | **modificar** — cuatro entradas en `GROUPS` |
| `scripts/audit-schema-drift.mjs` | **modificar** — tipos nuevos en `MAP` |

**Convención de tests, importante:** los tests que asertan **URL y codificación** van en
`arcane-client.test.ts`, que mockea `fetch`. Los que asertan **comportamiento de tool**
(`isError`, prosa, enmascarado visible) van en `tools.test.ts`, que mockea el *cliente*.
El enmascarado de `buildArgs` vive en el cliente, así que **su test va en
`arcane-client.test.ts`**.

---

## Tarea 1: El runner remoto de e2e

Va primera porque **todas las demás dependen de poder verificar**. Sin esto, cada corrida
e2e cuesta entre 3 y 22 intentos.

**Ficheros:**
- Crear: `scripts/e2e-remoto.sh`
- Modificar: `docs/README.md` (tabla de operación), `docs/desarrollo/anadir-una-tool.md` (§5)

**Interfaces:**
- Produce: `./scripts/e2e-remoto.sh` — sin argumentos; sale 0 si la suite pasa entera.

- [ ] **Paso 1: Crear el script**

```bash
#!/usr/bin/env bash
# Ejecuta la suite e2e desde vm-control, en la misma LAN que Arcane, en vez de
# a traves de Tailscale. Medido 2026-08-19: desde el Mac se cae el 16,7% de las
# peticiones (50 de 60); desde vm-control, 0 de 120.
#
# Se instala con bun (bun.lock es el unico lockfile del proyecto) pero se
# EJECUTA con node: bajo el runtime de bun, `zod` no resuelve y
# src/tools/gitops-syncs.ts revienta al importar con
# "undefined is not an object (evaluating 'z.string')".
set -uo pipefail

REMOTO=VM-Control
DESTINO=/root/arcane-mcp-e2e
IMG_INSTALL=oven/bun:1-alpine
IMG_RUN=node:24-alpine

reintenta() {
  local intentos=$1; shift
  local i
  for ((i = 1; i <= intentos; i++)); do
    if "$@"; then return 0; fi
    echo ">> intento $i/$intentos fallido, reintentando" >&2
    sleep 2
  done
  echo ">> agotados $intentos intentos" >&2
  return 1
}

copia() {
  # Se borra src/ antes de copiar: si un fichero se renombra o se elimina en
  # local, el tar por si solo dejaria el viejo ahi y la suite correria codigo
  # que ya no existe.
  ssh -o ConnectTimeout=20 "$REMOTO" "rm -rf '$DESTINO/src' && mkdir -p '$DESTINO'" || return 1
  # COPYFILE_DISABLE y --exclude='._*': el tar de macOS emite ficheros
  # AppleDouble que vitest intenta transformar y reporta como suites rotas.
  # node_modules se excluye ademas por arquitectura: el de macOS trae
  # binarios de esbuild para darwin que no corren en el contenedor.
  COPYFILE_DISABLE=1 tar --exclude='._*' --exclude=node_modules --exclude=.git --exclude=.wrangler -cf - . \
    | ssh -o ConnectTimeout=20 "$REMOTO" "tar -xf - -C '$DESTINO'" || return 1
  # El tar conserva el 0644 del Mac y .dev.vars lleva la clave de API.
  ssh -o ConnectTimeout=20 "$REMOTO" "chmod 600 '$DESTINO/.dev.vars'"
}

instala() {
  ssh -o ConnectTimeout=20 "$REMOTO" "docker run --rm --network host \
    -v '$DESTINO':/app -w /app $IMG_INSTALL \
    sh -lc 'bun install --frozen-lockfile'" >/dev/null
}

echo ">> Copiando el arbol de trabajo a $REMOTO:$DESTINO"
reintenta 10 copia || exit 1

echo ">> Instalando dependencias con $IMG_INSTALL"
reintenta 10 instala || exit 1

echo ">> Ejecutando la suite dentro de $IMG_RUN (red del host)"

# La corrida NO se reintenta cuando la suite ha llegado a ejecutarse: repetirla
# enmascararia un fallo real. Solo se reintenta cuando ssh ni siquiera logro
# conectar (exit 255 y ninguna linea de resumen de vitest), que es una caida
# del enlace y no un resultado.
for intento in 1 2 3 4 5 6 7 8 9 10; do
  salida=$(ssh -o ConnectTimeout=20 "$REMOTO" "docker run --rm --network host \
    -v '$DESTINO':/app -w /app \
    -e ARCANE_BASE_URL=http://localhost:3552 \
    $IMG_RUN sh -lc '
      set -a; . ./.dev.vars; set +a
      npx vitest run --config vitest.e2e.config.ts --reporter=verbose
    '" 2>&1)
  rc=$?
  if [ "$rc" -ne 255 ] || printf '%s' "$salida" | grep -q "Test Files"; then
    printf '%s\n' "$salida"
    exit "$rc"
  fi
  echo ">> ssh no llego a conectar (intento $intento/10), la suite no llego a correr" >&2
  sleep 2
done
echo ">> agotados 10 intentos de conexion" >&2
exit 1
```

- [ ] **Paso 2: Hacerlo ejecutable y traer la imagen de bun**

```bash
chmod +x scripts/e2e-remoto.sh
ssh VM-Control 'docker pull oven/bun:1-alpine'
```

Esperado: `Status: Downloaded newer image for oven/bun:1-alpine` (o `Image is up to date`).

- [ ] **Paso 3: Ejecutar la suite actual y contar las marcas una a una**

```bash
./scripts/e2e-remoto.sh 2>&1 | tee /tmp/e2e-tarea1.txt | tail -5
grep -c "✓" /tmp/e2e-tarea1.txt
```

Esperado: `Test Files 7 passed (7)`, `Tests 59 passed (59)`, y el `grep -c` da **59**.

**Si sale 58 con `resolvers.e2e.ts` fallando**, es un defecto previo conocido —el test
del último contenedor ordenado por nombre falla ~2 de cada 12 corridas—, **no lo arregles
en esta fase**: repite la corrida y anótalo. Si falla cualquier otra cosa, para y
diagnostica.

- [ ] **Paso 4: Documentarlo**

En `docs/README.md`, en la tabla de «Operación», añade la fila:

```markdown
| `./scripts/e2e-remoto.sh` | Ejecuta la suite e2e desde `vm-control`, en la LAN de Arcane (evita el 16,7 % de caídas de Tailscale) |
```

En `docs/desarrollo/anadir-una-tool.md`, al final del §5, añade:

```markdown
**Ejecuta los e2e desde dentro de la LAN, no por Tailscale.** Medido el 2026-08-19:
desde el Mac se cae el 16,7 % de las peticiones (50 de 60); desde `vm-control`, 0 de 120.
`./scripts/e2e-remoto.sh` copia el árbol, instala con bun y ejecuta con node en
contenedores sobre `vm-control`. Instala con bun pero **ejecuta con node**: bajo el
runtime de bun, `zod` no resuelve y `src/tools/gitops-syncs.ts` revienta al importar.
```

- [ ] **Paso 5: Commit**

```bash
git add scripts/e2e-remoto.sh docs/README.md docs/desarrollo/anadir-una-tool.md
git commit -m "test(e2e): ejecuta la suite desde la LAN en vez de por Tailscale"
```

---

## Tarea 2: `lanzaSiFalla()` y `requestSinCuerpo()` — el hueco del 204

**Ficheros:**
- Modificar: `src/arcane-client.ts` (junto a `requestHead`, sobre la línea 2218)
- Test: `src/__tests__/arcane-client.test.ts`

**Interfaces:**
- Produce:
  - `lanzaSiFalla(response: Response): Promise<void>` — funcion de modulo, no exportada
  - `ArcaneClient.requestSinCuerpo(method: string, path: string, body?: unknown): Promise<void>`

**Esta tarea hace dos cosas, y el refactor va primero.** El bloque de extraccion de
`detail` esta repetido literalmente **cuatro veces** en `src/arcane-client.ts` (lineas
2052, 2203, 2245, 2273). F5 añadiria dos mas. Decision del propietario: extraer un helper
compartido y aplicarlo a los seis sitios. Toca codigo que funciona, asi que **la suite
entera tiene que quedar en verde antes de tocar nada mas**.

**Por qué existe `requestSinCuerpo`:** `request()` termina en `response.json()`, que
revienta con un cuerpo vacío. Medido el 2026-08-19: `POST /builds/browse/mkdir` y `DELETE /builds/browse`
devuelven **204 sin cuerpo**. Las Tareas 5 y 6 lo consumen.

El parámetro `body` es opcional desde el principio: la Tarea 6 lo necesita para
`POST /builds/browse/upload`, que envía `{uploadId}` y tampoco devuelve cuerpo.

- [ ] **Paso 1: Fijar la linea base antes de tocar codigo que funciona**

```bash
npm test 2>&1 | tail -3
```

**Anota el numero exacto de tests que pasan.** El refactor del Paso 2 no puede cambiarlo:
si baja, has roto algo; si sube sin que hayas añadido tests, algo raro pasa.

- [ ] **Paso 2: Extraer el helper y aplicarlo a los cuatro sitios existentes**

En `src/arcane-client.ts`, a nivel de modulo (no dentro de la clase, porque
`VolumeBackupsMethods.download()` tambien lo usa y no tiene acceso a los privados):

```ts
/**
 * Lanza ArcaneApiError si la respuesta no es correcta, usando el `detail` del
 * cuerpo de error cuando lo hay.
 *
 * Extraido en F5: el mismo bloque estaba repetido literalmente en request(),
 * requestMultipart(), requestNdjson() y VolumeBackupsMethods.download(), y la
 * fase añadia dos sitios mas.
 */
async function lanzaSiFalla(response: Response): Promise<void> {
  if (response.ok) return;
  let message = response.statusText;
  try {
    const err = (await response.json()) as { detail?: string };
    if (err.detail) message = err.detail;
  } catch {}
  throw new ArcaneApiError(response.status, message);
}
```

Sustituye los cuatro bloques existentes por `await lanzaSiFalla(response);`. Son las
lineas 2052, 2203, 2245 y 2273 **antes** de editar: localizalas con

```bash
grep -n "if (err.detail) message = err.detail" src/arcane-client.ts
```

y trabaja de abajo arriba para que los numeros no se te muevan.

- [ ] **Paso 3: Comprobar que el refactor no cambio nada**

```bash
npm test 2>&1 | tail -3
npm run type-check
grep -c "if (err.detail) message = err.detail" src/arcane-client.ts
```

Esperado: **el mismo numero de tests del Paso 1**, type-check limpio, y el `grep -c` da
**1** — la unica ocurrencia que queda es la del cuerpo del propio `lanzaSiFalla()`.

**Falsabilidad:** cambia `if (response.ok) return;` por `return;` y comprueba que caen
los tests existentes que asertan errores de la API. Revierte.

Commitea el refactor por separado, antes de seguir:

```bash
git add src/arcane-client.ts
git commit -m "refactor(client): extrae lanzaSiFalla() de los cuatro sitios que lo repetian"
```

- [ ] **Paso 4: Escribir los tests que fallan**

En `src/__tests__/arcane-client.test.ts`, dentro del `describe("request() internals")`:

```ts
it("requestSinCuerpo() no intenta parsear el cuerpo de un 204", async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    status: 204,
    json: async () => { throw new Error("no debe llamarse"); },
  } as unknown as Response);

  await expect(client.requestSinCuerpo("POST", "/algo")).resolves.toBeUndefined();
});

it("requestSinCuerpo() lanza ArcaneApiError con el detail del error", async () => {
  mockFetch.mockResolvedValue({
    ok: false,
    status: 500,
    statusText: "Internal Server Error",
    json: async () => ({ detail: "invalid path: path traversal not allowed" }),
  } as unknown as Response);

  await expect(client.requestSinCuerpo("DELETE", "/algo")).rejects.toThrow(
    "invalid path: path traversal not allowed",
  );
});

it("requestSinCuerpo() sin body no envia Content-Type", async () => {
  mockFetch.mockResolvedValue({ ok: true, status: 204 } as unknown as Response);

  await client.requestSinCuerpo("POST", "/ruta");

  expect(mockFetch).toHaveBeenCalledWith(
    "http://localhost:3552/api/ruta",
    expect.objectContaining({
      method: "POST",
      headers: { "X-API-Key": "test-api-key" },
    }),
  );
});

it("requestSinCuerpo() con body lo serializa y anade Content-Type", async () => {
  mockFetch.mockResolvedValue({ ok: true, status: 204 } as unknown as Response);

  await client.requestSinCuerpo("POST", "/ruta", { uploadId: "up1" });

  expect(mockFetch).toHaveBeenCalledWith(
    "http://localhost:3552/api/ruta",
    expect.objectContaining({
      method: "POST",
      headers: { "X-API-Key": "test-api-key", "Content-Type": "application/json" },
      body: JSON.stringify({ uploadId: "up1" }),
    }),
  );
});
```

Los dos últimos son el par obligatorio de la restricción global 3: sin el de «sin body»,
una mutación que pusiera `Content-Type` siempre pasaría inadvertida.

- [ ] **Paso 5: Verificar que fallan**

```bash
npx vitest run src/__tests__/arcane-client.test.ts -t "requestSinCuerpo"
```

Esperado: FAIL — `client.requestSinCuerpo is not a function`.

- [ ] **Paso 6: Implementar**

En `src/arcane-client.ts`, justo después de `requestHead()`:

```ts
  /**
   * Como `request<T>`, pero para endpoints que responden 204 sin cuerpo.
   *
   * `request()` termina en `response.json()`, que con un cuerpo vacio lanza.
   * Medido el 2026-08-19: POST /builds/browse/mkdir y DELETE /builds/browse
   * devuelven 204 y ningun byte.
   *
   * A diferencia de `requestHead()`, aqui un estado de error SI lanza: alli el
   * codigo era el dato ("el sistema no esta sano" es una respuesta valida),
   * aqui "no pude crear el directorio" es un fallo de la llamada.
   */
  async requestSinCuerpo(method: string, path: string, body?: unknown): Promise<void> {
    const response = await this._fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "X-API-Key": this.apiKey,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    await lanzaSiFalla(response);
  }
```

- [ ] **Paso 7: Verificar que pasan y demostrar falsabilidad**

```bash
npx vitest run src/__tests__/arcane-client.test.ts -t "requestSinCuerpo"
npm run type-check
```

Esperado: 4 passed, type-check sin salida.

**Falsabilidad:** quita el `await lanzaSiFalla(response)` y comprueba que el segundo test
cae. Después pon el `Content-Type` incondicional y comprueba que cae el tercero. Revierte.

- [ ] **Paso 8: Commit**

```bash
git add src/arcane-client.ts src/__tests__/arcane-client.test.ts
git commit -m "feat(client): requestSinCuerpo() para los endpoints que devuelven 204"
```

---

## Tarea 3: Registros de contenedor — 4 tools

**Ficheros:**
- Modificar: `src/arcane-client.ts` (tipos + `ContainerRegistriesMethods` + wiring)
- Crear: `src/tools/container-registries.ts`
- Modificar: `src/index.ts`, `scripts/gen-tools-table.mjs`
- Test: `src/__tests__/arcane-client.test.ts`, `src/__tests__/tools.test.ts`
- Crear: `src/__e2e__/registries.e2e.ts`
- Modificar: `src/__e2e__/helpers.ts`

**Interfaces:**
- Consume: nada de tareas anteriores.
- Produce:
  - `ContainerRegistry`, `RegistryPullUsage`, `RegistryPullUsageResponse`, `MessageResponse`
  - `client.containerRegistries.list(opts?: ListOptionsWithSort): Promise<PaginatedResponse<ContainerRegistry>>`
  - `client.containerRegistries.get(id: string): Promise<{ success: boolean; data: ContainerRegistry }>`
  - `client.containerRegistries.pullUsage(): Promise<{ success: boolean; data: RegistryPullUsageResponse }>`
  - `client.containerRegistries.test(id: string): Promise<MessageResponse>`
  - `registerContainerRegistryTools(server, client): void`
  - En `helpers.ts`: `siembraRegistroDeContenedor()`, `borraRegistroDeContenedor(id)`

**Medido el 2026-08-19, y es el motivo de que estas cuatro entren y las otras cuatro no:**
ninguna lectura devuelve `token` ni `awsSecretAccessKey` — el campo no existe en la
respuesta, ni enmascarado. Se comprobó con sondas `generic` y `ecr`.

- [ ] **Paso 1: Escribir los tests de cliente que fallan**

En `src/__tests__/arcane-client.test.ts`:

```ts
describe("containerRegistries", () => {
  it(".list() sin opciones - GET /container-registries sin query", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [], pagination: {} }),
    } as Response);

    await client.containerRegistries.list();

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3552/api/container-registries",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it(".list({search, sort}) - GET /container-registries con la query literal", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [], pagination: {} }),
    } as Response);

    await client.containerRegistries.list({ search: "docker hub", sort: "url" });

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3552/api/container-registries?search=docker+hub&sort=url",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it(".get(id) codifica el id en la ruta y no permite traversal", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: {} }),
    } as Response);

    await client.containerRegistries.get("../../system/containers/stop-all#");

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3552/api/container-registries/..%2F..%2Fsystem%2Fcontainers%2Fstop-all%23",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it(".pullUsage() - GET /container-registries/pull-usage", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { registries: [] } }),
    } as Response);

    await client.containerRegistries.pullUsage();

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3552/api/container-registries/pull-usage",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it(".test(id) - POST /container-registries/{id}/test, con el id codificado", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { message: "ok" } }),
    } as Response);

    await client.containerRegistries.test("reg#1");

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3552/api/container-registries/reg%231/test",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
```

El fixture `reg#1` no es capricho: `reg-1` codificado es idéntico a sí mismo, así que
borrar el `encodeURIComponent` no rompería nada y el test no probaría nada.

- [ ] **Paso 2: Verificar que fallan**

```bash
npx vitest run src/__tests__/arcane-client.test.ts -t "containerRegistries"
```

Esperado: FAIL — `Cannot read properties of undefined (reading 'list')`.

- [ ] **Paso 3: Implementar tipos y métodos**

En `src/arcane-client.ts`, junto al resto de tipos:

```ts
/**
 * Registro de contenedor. Medido el 2026-08-19 contra Arcane 2.8.0 con sondas
 * `generic` y `ecr`: la respuesta NO incluye `token` ni `awsSecretAccessKey`
 * -no es que vengan enmascarados, es que el campo no existe-, y por eso las
 * lecturas se exponen. `awsAccessKeyId` si viene: es un identificador.
 */
export interface ContainerRegistry {
  id: string;
  url: string;
  username: string;
  insecure: boolean;
  enabled: boolean;
  registryType: string;
  repositoryNames: string[] | null;
  createdAt: string;
  updatedAt: string;
  description?: string;
  awsAccessKeyId?: string;
  awsRegion?: string;
}

export interface RegistryPullUsage {
  registryId: string;
  provider: string;
  registry: string;
  displayName: string;
  observedPulls: number;
  authMethod: string;
  checkedAt: string;
  authUsername?: string;
  error?: string;
  limit?: number;
  remaining?: number;
  repository?: string;
  source?: string;
  used?: number;
  windowSeconds?: number;
}

export interface RegistryPullUsageResponse {
  registries: RegistryPullUsage[] | null;
}

/**
 * Respuesta de los endpoints que devuelven un mensaje. NO es `ActionResponse`:
 * medido, el mensaje viene anidado bajo `data`, no en la raiz.
 */
export interface MessageResponse {
  success: boolean;
  data: { message: string };
}
```

Y la clase, junto a las demás:

```ts
class ContainerRegistriesMethods {
  constructor(private client: ArcaneClient) {}

  async list(opts?: ListOptionsWithSort): Promise<PaginatedResponse<ContainerRegistry>> {
    const params = new URLSearchParams();
    appendListParams(params, opts);
    const query = params.toString();
    return this.client.request<PaginatedResponse<ContainerRegistry>>(
      "GET",
      `/container-registries${query ? `?${query}` : ""}`,
    );
  }

  async get(id: string): Promise<{ success: boolean; data: ContainerRegistry }> {
    return this.client.request<{ success: boolean; data: ContainerRegistry }>(
      "GET",
      `/container-registries/${encodeURIComponent(id)}`,
    );
  }

  async pullUsage(): Promise<{ success: boolean; data: RegistryPullUsageResponse }> {
    return this.client.request<{ success: boolean; data: RegistryPullUsageResponse }>(
      "GET",
      "/container-registries/pull-usage",
    );
  }

  async test(id: string): Promise<MessageResponse> {
    return this.client.request<MessageResponse>(
      "POST",
      `/container-registries/${encodeURIComponent(id)}/test`,
    );
  }
}
```

Wiring en `ArcaneClient`: declara `readonly containerRegistries: ContainerRegistriesMethods;`
y en el constructor `this.containerRegistries = new ContainerRegistriesMethods(this);`.

- [ ] **Paso 4: Verificar que pasan**

```bash
npx vitest run src/__tests__/arcane-client.test.ts -t "containerRegistries"
npm run type-check
```

Esperado: 5 passed.

**Falsabilidad:** cambia `encodeURIComponent(id)` por `id` a secas y comprueba que los
tests de `.get` y `.test` caen. Revierte.

- [ ] **Paso 5: Crear el fichero de tools**

`src/tools/container-registries.ts`:

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArcaneClient } from "../arcane-client";
import { withErrors, listResponse, textResponse } from "./respond";

const LIST_PARAMS = {
  search: z.string().optional().describe("Free-text search over registry URLs and usernames"),
  sort: z.string().optional().describe("Column to sort by, e.g. url, registryType"),
  order: z.string().optional().describe("Sort direction: asc or desc"),
  start: z.number().int().min(0).optional().describe("Start index for pagination (server default: 0)"),
  limit: z.number().int().min(1).optional().describe("Items per page (server default: 20)"),
};

export function registerContainerRegistryTools(server: McpServer, client: ArcaneClient): void {
  server.tool(
    "arcane_container_registry_list",
    "List the container registries Arcane pulls images from. Credentials are never returned by this API: tokens and AWS secret keys are absent from the response, so what you get is configuration only.",
    { ...LIST_PARAMS },
    withErrors(async ({ search, sort, order, start, limit }) => {
      const result = await client.containerRegistries.list({ search, sort, order, start, limit });
      return listResponse(result, "container registries");
    }),
  );

  server.tool(
    "arcane_container_registry_get",
    "Get one container registry by ID. Credentials are never returned by this API.",
    { registryId: z.string().describe("Registry ID") },
    withErrors(async ({ registryId }) => {
      const result = await client.containerRegistries.get(registryId);
      return textResponse(JSON.stringify(result.data, null, 2));
    }),
  );

  server.tool(
    "arcane_container_registry_pull_usage",
    "Report pull-rate usage per registry: observed pulls, and the remaining quota when the provider exposes one.",
    {},
    withErrors(async () => {
      const result = await client.containerRegistries.pullUsage();
      const cuerpo = { registries: result.data.registries ?? [] };
      return textResponse(JSON.stringify(cuerpo, null, 2));
    }),
  );

  server.tool(
    "arcane_container_registry_test",
    "Test connectivity and authentication to a container registry. Does not change any state. On failure the error text is the registry login output, which names the host and the reason.",
    { registryId: z.string().describe("Registry ID") },
    withErrors(async ({ registryId }) => {
      const result = await client.containerRegistries.test(registryId);
      return textResponse(result.data.message);
    }),
  );
}
```

`registries ?? []` no es cosmético: el spec declara el array anulable, y sin esto se
serializaría el texto `"null"`, que no es ni una lista vacía ni un error. Es la misma
deuda que tuvo `arcane_job_list`.

- [ ] **Paso 6: Registrar la tool en los tres sitios**

En `src/index.ts`: `import { registerContainerRegistryTools } from "./tools/container-registries";`
y `registerContainerRegistryTools(this.server, client);` junto a las demás.

En `scripts/gen-tools-table.mjs`, en `GROUPS`:

```js
  ["container-registries.ts", "Container registries"],
```

- [ ] **Paso 7: Tests de tool**

En `src/__tests__/tools.test.ts`, añade `containerRegistries` al `createMockClient()`:

```ts
      containerRegistries: {
        list: vi.fn().mockResolvedValue({
          success: true,
          data: [],
          pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 20 },
        }),
        get: vi.fn().mockResolvedValue({ success: true, data: { id: "r1", url: "reg.example" } }),
        pullUsage: vi.fn().mockResolvedValue({ success: true, data: { registries: null } }),
        test: vi.fn().mockResolvedValue({ success: true, data: { message: "Registry reachable" } }),
      },
```

y los tests:

```ts
describe("registerContainerRegistryTools", () => {
  it("arcane_container_registry_pull_usage convierte registries:null en lista vacia", async () => {
    const server = new McpServer({ name: "t", version: "1" });
    const client = createMockClient();
    registerContainerRegistryTools(server, client as unknown as ArcaneClient);

    const res = await (server as any)._registeredTools["arcane_container_registry_pull_usage"].callback({});

    expect(JSON.parse(res.content[0].text)).toEqual({ registries: [] });
  });

  it("arcane_container_registry_test devuelve isError cuando la API falla", async () => {
    const server = new McpServer({ name: "t", version: "1" });
    const client = createMockClient();
    client.containerRegistries.test.mockRejectedValue(
      new ArcaneApiError(400, "Registry test failed: registry login failed: no such host"),
    );
    registerContainerRegistryTools(server, client as unknown as ArcaneClient);

    const res = await (server as any)._registeredTools["arcane_container_registry_test"].callback({ registryId: "r1" });

    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("no such host");
  });
});
```

Comprueba antes cómo acceden los tests existentes al callback de una tool y **usa ese
mismo mecanismo**, no el de este ejemplo, si difiere.

- [ ] **Paso 8: Siembra e2e en helpers**

En `src/__e2e__/helpers.ts`:

```ts
/**
 * Crea un registro de contenedor sonda por fetch directo, no por tool.
 *
 * F5 decidio NO exponer las escrituras de registro -el modelo tendria que
 * redactar el secreto para invocarlas- pero las lecturas necesitan datos y la
 * instancia tiene cero registros. La suite no es el modelo, asi que siembra
 * por la API cruda.
 *
 * Sujeto inocuo: URL .invalid (nunca resuelve) y enabled:false, para que nada
 * intente usarlo en un pull real.
 */
export async function siembraRegistroDeContenedor(): Promise<string> {
  const res = await fetch(`${process.env.ARCANE_BASE_URL}/api/container-registries`, {
    method: "POST",
    headers: { "X-API-Key": process.env.ARCANE_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({
      url: "arcane-mcp-e2e.invalid",
      username: "e2e",
      token: "no-es-un-secreto-real",
      description: "sonda e2e de arcane-mcp - borrar si sobrevive",
      insecure: false,
      enabled: false,
      registryType: "generic",
      repositoryNames: [],
      awsAccessKeyId: "",
      awsSecretAccessKey: "",
      awsRegion: "",
    }),
  });
  if (!res.ok) throw new Error(`No se pudo sembrar el registro: HTTP ${res.status} ${await res.text()}`);
  return (await res.json()).data.id;
}

/**
 * Borra el registro sembrado. AVISA en vez de fallar: si el borrado no
 * funciona, tumbar la suite no elimina el residuo, solo esconde el resto de
 * los resultados. Mismo trato que la limpieza de ignores en F4.
 */
export async function borraRegistroDeContenedor(id: string): Promise<void> {
  const res = await fetch(`${process.env.ARCANE_BASE_URL}/api/container-registries/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "X-API-Key": process.env.ARCANE_API_KEY! },
  });
  if (!res.ok) {
    console.error(
      `\n[e2e] RESIDUO: el registro de contenedor ${id} no se pudo borrar (HTTP ${res.status}).\n` +
      `[e2e] Borralo a mano:\n` +
      `[e2e]   curl -X DELETE -H "X-API-Key: $ARCANE_API_KEY" \\\n` +
      `[e2e]     "$ARCANE_BASE_URL/api/container-registries/${id}"\n`,
    );
  }
}
```

`registryType` solo admite `generic` y `ecr`: medido, cualquier otro valor da
`400 Registry type must be one of: generic, ecr`. El spec lo declara `string` libre.

- [ ] **Paso 9: e2e**

`src/__e2e__/registries.e2e.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { e2eClient, siembraRegistroDeContenedor, borraRegistroDeContenedor } from "./helpers";

const client = e2eClient();

describe("e2e: registros de contenedor contra Arcane real", () => {
  let registroId: string;

  beforeAll(async () => {
    registroId = await siembraRegistroDeContenedor();
  });

  afterAll(async () => {
    if (registroId) await borraRegistroDeContenedor(registroId);
  });

  it("list() encuentra el registro sembrado y NO devuelve credenciales", async () => {
    const res = await client.containerRegistries.list({ limit: 100, sort: "url" });
    const sonda = (res.data ?? []).find(r => r.id === registroId);
    expect(sonda).toBeDefined();
    expect(sonda!.url).toBe("arcane-mcp-e2e.invalid");
    // La razon por la que estas lecturas se exponen: el secreto no vuelve.
    expect(JSON.stringify(sonda)).not.toContain("no-es-un-secreto-real");
    expect(Object.keys(sonda!)).not.toContain("token");
    expect(Object.keys(sonda!)).not.toContain("awsSecretAccessKey");
  });

  it("get() devuelve el mismo registro, tampoco con credenciales", async () => {
    const res = await client.containerRegistries.get(registroId);
    expect(res.data.id).toBe(registroId);
    expect(JSON.stringify(res.data)).not.toContain("no-es-un-secreto-real");
  });

  it("pullUsage() incluye el registro sembrado", async () => {
    const res = await client.containerRegistries.pullUsage();
    const ids = (res.data.registries ?? []).map(r => r.registryId);
    expect(ids).toContain(registroId);
  });

  it("test() falla contra un host inexistente y el error nombra el host", async () => {
    // Zona no vista declarada: el camino de EXITO no se puede ejercitar,
    // porque no hay credenciales reales de ningun registro en esta instancia.
    await expect(client.containerRegistries.test(registroId)).rejects.toThrow(
      /arcane-mcp-e2e\.invalid/,
    );
  });
});
```

- [ ] **Paso 10: Verificar todo**

```bash
npm test
npm run type-check
npm run gen-tools-table -- --check
./scripts/e2e-remoto.sh 2>&1 | tee /tmp/e2e-tarea3.txt | tail -5
grep -c "✓" /tmp/e2e-tarea3.txt
```

Esperado: unitarios en verde, type-check limpio, `gen-tools-table` dice OK con el número
de tools que haya (**no lo predigas: léelo**), y la suite e2e con 4 tests más que la
corrida de la Tarea 1.

- [ ] **Paso 11: Commit**

```bash
git add src/arcane-client.ts src/tools/container-registries.ts src/index.ts \
        scripts/gen-tools-table.mjs src/__tests__ src/__e2e__ README.md
git commit -m "feat(registries): cuatro lecturas de registros de contenedor"
```

---

## Tarea 4: Registros de plantillas — 4 tools

**Ficheros:**
- Modificar: `src/arcane-client.ts`, `src/index.ts`, `scripts/gen-tools-table.mjs`
- Crear: `src/tools/template-registries.ts`
- Test: `src/__tests__/arcane-client.test.ts`, `src/__e2e__/registries.e2e.ts`

**Interfaces:**
- Consume: `MessageResponse` (Tarea 3).
- Produce:
  - `TemplateRegistry`, `TemplateRegistryInput`
  - `client.templateRegistries.list(): Promise<{ success: boolean; data: TemplateRegistry[] | null }>`
  - `client.templateRegistries.create(dto: TemplateRegistryInput): Promise<{ success: boolean; data: TemplateRegistry }>`
  - `client.templateRegistries.update(id: string, dto: TemplateRegistryInput): Promise<MessageResponse>`
  - `client.templateRegistries.delete(id: string): Promise<MessageResponse>`
  - `registerTemplateRegistryTools(server, client): void`

**Por qué aquí sí va el CRUD completo:** medido, `TemplateTemplateRegistry` es
`{id, name, url, description, enabled, lastFetchError}` y su `Create`/`Update` solo
aceptan cuatro campos. **No hay credenciales de ninguna clase**, así que la discusión de
la Tarea 3 no aplica. Es un catálogo de URLs.

Va en fichero propio y no en `templates.ts` porque `GROUPS` mapea fichero → epígrafe del
README: `/templates/registries` es un catálogo de fuentes y `/templates` son las
plantillas.

- [ ] **Paso 1: Tests de cliente que fallan**

```ts
describe("templateRegistries", () => {
  it(".list() - GET /templates/registries", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: [] }) } as Response);
    await client.templateRegistries.list();
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3552/api/templates/registries",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it(".create(dto) - POST con el cuerpo serializado", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: {} }) } as Response);
    await client.templateRegistries.create({
      name: "catalogo", url: "https://ejemplo.invalid/t.json", description: "d", enabled: true,
    });
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3552/api/templates/registries",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "catalogo", url: "https://ejemplo.invalid/t.json", description: "d", enabled: true }),
      }),
    );
  });

  it(".update(id, dto) codifica el id y no permite traversal", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { message: "ok" } }) } as Response);
    await client.templateRegistries.update("../../system/containers/stop-all#", {
      name: "n", url: "https://ejemplo.invalid/t.json", description: "d", enabled: false,
    });
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3552/api/templates/registries/..%2F..%2Fsystem%2Fcontainers%2Fstop-all%23",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it(".delete(id) codifica el id", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { message: "ok" } }) } as Response);
    await client.templateRegistries.delete("reg#1");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3552/api/templates/registries/reg%231",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
```

- [ ] **Paso 2: Verificar que fallan**

```bash
npx vitest run src/__tests__/arcane-client.test.ts -t "templateRegistries"
```

Esperado: FAIL — `Cannot read properties of undefined (reading 'list')`.

- [ ] **Paso 3: Implementar**

```ts
/**
 * Registro de plantillas: un catalogo de plantillas por URL. A diferencia de
 * ContainerRegistry, NO guarda credenciales de ningun tipo -medido contra el
 * spec y contra la instancia-, asi que su CRUD se expone entero.
 */
export interface TemplateRegistry {
  id: string;
  enabled: boolean;
  name: string;
  description: string;
  url: string;
  lastFetchError?: string;
}

export interface TemplateRegistryInput {
  name: string;
  url: string;
  description: string;
  enabled: boolean;
}
```

```ts
class TemplateRegistriesMethods {
  constructor(private client: ArcaneClient) {}

  async list(): Promise<{ success: boolean; data: TemplateRegistry[] | null }> {
    return this.client.request<{ success: boolean; data: TemplateRegistry[] | null }>(
      "GET",
      "/templates/registries",
    );
  }

  async create(dto: TemplateRegistryInput): Promise<{ success: boolean; data: TemplateRegistry }> {
    return this.client.request<{ success: boolean; data: TemplateRegistry }>(
      "POST",
      "/templates/registries",
      dto,
    );
  }

  async update(id: string, dto: TemplateRegistryInput): Promise<MessageResponse> {
    return this.client.request<MessageResponse>(
      "PUT",
      `/templates/registries/${encodeURIComponent(id)}`,
      dto,
    );
  }

  async delete(id: string): Promise<MessageResponse> {
    return this.client.request<MessageResponse>(
      "DELETE",
      `/templates/registries/${encodeURIComponent(id)}`,
    );
  }
}
```

Wiring: `readonly templateRegistries: TemplateRegistriesMethods;` y
`this.templateRegistries = new TemplateRegistriesMethods(this);`.

- [ ] **Paso 4: Verificar que pasan**

```bash
npx vitest run src/__tests__/arcane-client.test.ts -t "templateRegistries"
npm run type-check
```

**Falsabilidad:** quita el `encodeURIComponent` de `.update` y comprueba que su test cae.

- [ ] **Paso 5: Crear el fichero de tools**

`src/tools/template-registries.ts`:

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArcaneClient } from "../arcane-client";
import { withErrors, textResponse } from "./respond";

const CAMPOS = {
  name: z.string().describe("Registry name"),
  url: z.string().describe("URL of the template catalog"),
  description: z.string().describe("Human-readable description"),
  enabled: z.boolean().describe("Whether Arcane fetches templates from this registry"),
};

export function registerTemplateRegistryTools(server: McpServer, client: ArcaneClient): void {
  server.tool(
    "arcane_template_registry_list",
    "List the template registries Arcane fetches Compose templates from. Check lastFetchError to see whether a registry is failing to load.",
    {},
    withErrors(async () => {
      const result = await client.templateRegistries.list();
      return textResponse(JSON.stringify({ data: result.data ?? [] }, null, 2));
    }),
  );

  server.tool(
    "arcane_template_registry_create",
    "Add a template registry. Template registries hold no credentials: only a name, a URL and a description.",
    { ...CAMPOS },
    withErrors(async ({ name, url, description, enabled }) => {
      const result = await client.templateRegistries.create({ name, url, description, enabled });
      return textResponse(JSON.stringify(result.data, null, 2));
    }),
  );

  server.tool(
    "arcane_template_registry_update",
    "Update a template registry. All four fields are required.",
    { registryId: z.string().describe("Registry ID"), ...CAMPOS },
    withErrors(async ({ registryId, name, url, description, enabled }) => {
      const result = await client.templateRegistries.update(registryId, { name, url, description, enabled });
      return textResponse(result.data.message);
    }),
  );

  server.tool(
    "arcane_template_registry_delete",
    "Delete a template registry.",
    { registryId: z.string().describe("Registry ID") },
    withErrors(async ({ registryId }) => {
      const result = await client.templateRegistries.delete(registryId);
      return textResponse(result.data.message);
    }),
  );
}
```

**Las descripciones no afirman nada que no esté medido.** En concreto no dicen si el
`PUT` sustituye o fusiona, ni qué pasa con las plantillas ya descargadas al borrar un
registro. Si el e2e del Paso 7 lo demuestra, añádelo entonces; si no, se queda así. Una
descripción que afirma un comportamiento no medido es el defecto exacto que F4 pagó tres
veces.

- [ ] **Paso 6: Registrar en los tres sitios**

`src/index.ts` (import + llamada) y en `GROUPS`:

```js
  ["template-registries.ts", "Template registries"],
```

- [ ] **Paso 7: e2e — CRUD autocontenido**

En `src/__e2e__/registries.e2e.ts`, añade:

```ts
describe("e2e: registros de plantillas contra Arcane real", () => {
  let id: string;

  afterAll(async () => {
    if (id) {
      try { await client.templateRegistries.delete(id); }
      catch (e) {
        console.error(`\n[e2e] RESIDUO: registro de plantillas ${id} sin borrar: ${e}\n`);
      }
    }
  });

  it("create() devuelve el registro creado", async () => {
    const res = await client.templateRegistries.create({
      name: "arcane-mcp-e2e",
      url: "https://arcane-mcp-e2e.invalid/templates.json",
      description: "sonda e2e de arcane-mcp - borrar si sobrevive",
      enabled: false,
    });
    id = res.data.id;
    expect(res.data.name).toBe("arcane-mcp-e2e");
    expect(res.data.enabled).toBe(false);
  });

  it("list() lo encuentra", async () => {
    const res = await client.templateRegistries.list();
    expect((res.data ?? []).map(r => r.id)).toContain(id);
  });

  it("update() cambia la descripcion y el cambio se ve en list()", async () => {
    await client.templateRegistries.update(id, {
      name: "arcane-mcp-e2e",
      url: "https://arcane-mcp-e2e.invalid/templates.json",
      description: "descripcion cambiada por el e2e",
      enabled: false,
    });
    const res = await client.templateRegistries.list();
    const actual = (res.data ?? []).find(r => r.id === id);
    expect(actual!.description).toBe("descripcion cambiada por el e2e");
  });
});
```

- [ ] **Paso 8: Verificar y commitear**

```bash
npm test && npm run type-check && npm run gen-tools-table -- --check
./scripts/e2e-remoto.sh 2>&1 | tee /tmp/e2e-tarea4.txt | tail -5
grep -c "✓" /tmp/e2e-tarea4.txt
git add -A && git commit -m "feat(registries): CRUD de registros de plantillas"
```

---

## Tarea 5: Workspace de builds — browse, read, mkdir, delete

**Ficheros:**
- Modificar: `src/arcane-client.ts`, `src/index.ts`, `scripts/gen-tools-table.mjs`, `src/__e2e__/helpers.ts`
- Crear: `src/tools/build-workspace.ts`, `src/__e2e__/builds.e2e.ts`
- Test: `src/__tests__/arcane-client.test.ts`, `src/__tests__/tools.test.ts`

**Interfaces:**
- Consume: `ArcaneClient.requestSinCuerpo()` (Tarea 2).
- Produce:
  - `BuildWorkspaceEntry`, `BuildFileContent`
  - `client.buildWorkspace.browse(envId: string, path?: string): Promise<{ success: boolean; data: BuildWorkspaceEntry[] | null }>`
  - `client.buildWorkspace.read(envId: string, path: string, maxBytes?: number): Promise<{ success: boolean; data: BuildFileContent }>`
  - `client.buildWorkspace.mkdir(envId: string, path: string): Promise<void>`
  - `client.buildWorkspace.delete(envId: string, path: string): Promise<void>`
  - `registerBuildWorkspaceTools(server, client): void`
  - En `helpers.ts`: `entornoConWorkspaceDeBuilds(): Promise<string>`

**Tres hechos medidos que gobiernan esta tarea:**

1. La raíz es `/builds` **dentro del contenedor del agente**, no el host. **Arcane impone
   la jaula**: `..`, `../..`, `a/../..` y `../../../../etc` dan
   `500 invalid path: path traversal not allowed`; `/etc` se re-enraíza a `/builds/etc`.
2. **Solo 1 de 6 entornos funciona.** Los otros cinco dan
   `500 failed to ensure builds directory: mkdir /builds: permission denied`.
3. `mkdir` y `DELETE` devuelven **204 sin cuerpo**, y **el listado real no trae
   `relativePath` ni `editable`** pese a que el spec los declara obligatorios.

**`path` es OBLIGATORIO en `mkdir` y en `delete`, y no vacío.** El spec lo declara
opcional en el `DELETE`, así que `DELETE /builds/browse` sin `path` es una llamada legal
cuyo efecto plausible es borrar la raíz del workspace. **No se ha medido y no se va a
medir.** El esquema de la tool lo impide.

- [ ] **Paso 1: Tests de cliente que fallan**

```ts
describe("buildWorkspace", () => {
  it(".browse(envId) sin path - GET sin query", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: [] }) } as Response);
    await client.buildWorkspace.browse("env1");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3552/api/environments/env1/builds/browse",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it(".browse(envId, path) - GET con la query literal y el path escapado", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: [] }) } as Response);
    await client.buildWorkspace.browse("env1", "sub dir/../x");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3552/api/environments/env1/builds/browse?path=sub+dir%2F..%2Fx",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it(".read(envId, path) sin maxBytes - no escribe maxBytes en la query", async () => {
    mockFetch.mockResolvedValue({
      ok: true, json: async () => ({ success: true, data: { content: "", mimeType: "text/plain" } }),
    } as Response);
    await client.buildWorkspace.read("env1", "Dockerfile");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3552/api/environments/env1/builds/browse/content?path=Dockerfile",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it(".read(envId, path, maxBytes) - escribe maxBytes", async () => {
    mockFetch.mockResolvedValue({
      ok: true, json: async () => ({ success: true, data: { content: "", mimeType: "text/plain" } }),
    } as Response);
    await client.buildWorkspace.read("env1", "Dockerfile", 4096);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3552/api/environments/env1/builds/browse/content?path=Dockerfile&maxBytes=4096",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it(".mkdir(envId, path) - POST, y no revienta con un 204 sin cuerpo", async () => {
    mockFetch.mockResolvedValue({
      ok: true, status: 204, json: async () => { throw new Error("no debe llamarse"); },
    } as unknown as Response);
    await expect(client.buildWorkspace.mkdir("env1", "ctx")).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3552/api/environments/env1/builds/browse/mkdir?path=ctx",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it(".delete(envId, path) - DELETE con el path en la query", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204 } as unknown as Response);
    await client.buildWorkspace.delete("env1", "ctx");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3552/api/environments/env1/builds/browse?path=ctx",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
```

Los dos tests de `.read` son el par obligatorio de la restricción global 3: sin el
segundo, una mutación que escriba `maxBytes=undefined` en la query pasaría inadvertida.

- [ ] **Paso 2: Verificar que fallan**

```bash
npx vitest run src/__tests__/arcane-client.test.ts -t "buildWorkspace"
```

Esperado: FAIL — `Cannot read properties of undefined (reading 'browse')`.

- [ ] **Paso 3: Implementar tipos y métodos**

```ts
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
```

```ts
class BuildWorkspaceMethods {
  constructor(private client: ArcaneClient) {}

  private ruta(envId: string, sufijo: string, params: URLSearchParams): string {
    const query = params.toString();
    return `/environments/${encodeURIComponent(envId)}/builds/browse${sufijo}${query ? `?${query}` : ""}`;
  }

  async browse(envId: string, path?: string): Promise<{ success: boolean; data: BuildWorkspaceEntry[] | null }> {
    const params = new URLSearchParams();
    if (path !== undefined) params.set("path", path);
    return this.client.request<{ success: boolean; data: BuildWorkspaceEntry[] | null }>(
      "GET",
      this.ruta(envId, "", params),
    );
  }

  async read(envId: string, path: string, maxBytes?: number): Promise<{ success: boolean; data: BuildFileContent }> {
    const params = new URLSearchParams();
    params.set("path", path);
    if (maxBytes !== undefined) params.set("maxBytes", String(maxBytes));
    return this.client.request<{ success: boolean; data: BuildFileContent }>(
      "GET",
      this.ruta(envId, "/content", params),
    );
  }

  // mkdir y delete devuelven 204 sin cuerpo: request() reventaria con res.json().
  async mkdir(envId: string, path: string): Promise<void> {
    const params = new URLSearchParams();
    params.set("path", path);
    return this.client.requestSinCuerpo("POST", this.ruta(envId, "/mkdir", params));
  }

  async delete(envId: string, path: string): Promise<void> {
    const params = new URLSearchParams();
    params.set("path", path);
    return this.client.requestSinCuerpo("DELETE", this.ruta(envId, "", params));
  }
}
```

Wiring: `readonly buildWorkspace: BuildWorkspaceMethods;` y
`this.buildWorkspace = new BuildWorkspaceMethods(this);`.

- [ ] **Paso 4: Verificar que pasan**

```bash
npx vitest run src/__tests__/arcane-client.test.ts -t "buildWorkspace"
npm run type-check
```

Esperado: 6 passed.

**Falsabilidad:** haz `params.set("maxBytes", String(maxBytes))` incondicional y comprueba
que cae el test de «sin maxBytes» (la query pasaría a llevar el literal
`maxBytes=undefined`). Después quita el `encodeURIComponent(envId)` del helper `ruta()`: si no cae ningún
test, **falta cobertura y hay que añadirla** — un `envId` de fixture como
`env/../otro` que codificado cambie. Revierte las dos mutaciones.

- [ ] **Paso 5: Crear el fichero de tools**

`src/tools/build-workspace.ts`:

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArcaneClient } from "../arcane-client";
import { resolveEnvironmentId } from "./resolve";
import { withErrors, textResponse } from "./respond";

/**
 * `path` obligatorio y no vacio en las tools que escriben.
 *
 * openapi.txt lo declara OPCIONAL en el DELETE, asi que
 * `DELETE /builds/browse` sin path es una llamada legal cuyo efecto plausible
 * es borrar la raiz del workspace. No esta medido y no se va a medir: se
 * impide desde el esquema.
 */
const RUTA_OBLIGATORIA = z
  .string()
  .min(1)
  .describe("Path relative to the builds workspace root (required, must not be empty)");

/** Tipos cuyo contenido tiene sentido volcar como texto. */
const TIPOS_TEXTUALES = ["application/json", "application/yaml", "application/x-yaml", "application/xml"];

function esTextual(mimeType: string): boolean {
  return mimeType.startsWith("text/") || TIPOS_TEXTUALES.includes(mimeType);
}

export function registerBuildWorkspaceTools(server: McpServer, client: ArcaneClient): void {
  server.tool(
    "arcane_build_workspace_browse",
    "List files and directories in the build workspace of an environment. The workspace is a directory inside the Arcane agent, not the host filesystem, and paths cannot escape it.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      path: z.string().optional().describe("Path relative to the workspace root (defaults to the root)"),
    },
    withErrors(async ({ environmentId, environmentName, path }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.buildWorkspace.browse(envId, path);
      return textResponse(JSON.stringify({ data: result.data ?? [] }, null, 2));
    }),
  );

  server.tool(
    "arcane_build_workspace_read",
    "Read a file from the build workspace. Binary files are not returned: their type and size are reported instead.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      path: RUTA_OBLIGATORIA,
      maxBytes: z.number().int().min(1).optional().describe("Maximum bytes to read"),
    },
    withErrors(async ({ environmentId, environmentName, path, maxBytes }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.buildWorkspace.read(envId, path, maxBytes);
      const bytes = Buffer.from(result.data.content, "base64");
      if (!esTextual(result.data.mimeType)) {
        return textResponse(
          `'${path}' is ${result.data.mimeType}, ${bytes.length} bytes. Binary content is not returned.`,
        );
      }
      return textResponse(bytes.toString("utf8"));
    }),
  );

  server.tool(
    "arcane_build_workspace_mkdir",
    "Create a directory in the build workspace.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      path: RUTA_OBLIGATORIA,
    },
    withErrors(async ({ environmentId, environmentName, path }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      await client.buildWorkspace.mkdir(envId, path);
      return textResponse(`Created '${path}' in the build workspace.`);
    }),
  );

  server.tool(
    "arcane_build_workspace_delete",
    "Delete a file or directory from the build workspace. A path is required: this tool cannot delete the workspace root.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      path: RUTA_OBLIGATORIA,
    },
    withErrors(async ({ environmentId, environmentName, path }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      await client.buildWorkspace.delete(envId, path);
      return textResponse(`Deleted '${path}' from the build workspace.`);
    }),
  );
}
```

**Sobre el aviso del 500 en cinco de cada seis entornos:** no lo captures ni lo
reescribas. `withErrors` propaga el `detail` de Arcane tal cual —
`failed to ensure builds directory: mkdir /builds: permission denied`—, que **es lo
observable**. No añadas una frase del tipo «este entorno no soporta builds»: no lo sabes,
y este proyecto ya ha pagado cuatro veces por inventar la causa de un fallo.

- [ ] **Paso 6: Registrar en los tres sitios**

`src/index.ts` (import + llamada) y en `GROUPS`:

```js
  ["build-workspace.ts", "Build workspace"],
```

- [ ] **Paso 7: Test de tool para binario y para texto**

En `src/__tests__/tools.test.ts`:

```ts
describe("registerBuildWorkspaceTools", () => {
  it("arcane_build_workspace_read no vuelca binarios", async () => {
    const server = new McpServer({ name: "t", version: "1" });
    const client = createMockClient();
    const binario = Buffer.from([0, 1, 2, 3]).toString("base64");
    client.buildWorkspace.read.mockResolvedValue({
      success: true,
      data: { content: binario, mimeType: "application/octet-stream" },
    });
    registerBuildWorkspaceTools(server, client as unknown as ArcaneClient);

    const res = await (server as any)._registeredTools["arcane_build_workspace_read"]
      .callback({ environmentId: "env1", path: "a.bin" });

    expect(res.content[0].text).toContain("application/octet-stream");
    expect(res.content[0].text).toContain("4 bytes");
    expect(res.content[0].text).not.toContain(binario);
  });

  it("arcane_build_workspace_read si vuelca texto", async () => {
    const server = new McpServer({ name: "t", version: "1" });
    const client = createMockClient();
    client.buildWorkspace.read.mockResolvedValue({
      success: true,
      data: { content: Buffer.from("FROM alpine:3.19\n").toString("base64"), mimeType: "text/plain" },
    });
    registerBuildWorkspaceTools(server, client as unknown as ArcaneClient);

    const res = await (server as any)._registeredTools["arcane_build_workspace_read"]
      .callback({ environmentId: "env1", path: "Dockerfile" });

    expect(res.content[0].text).toBe("FROM alpine:3.19\n");
  });
});
```

Añade `buildWorkspace: { browse: vi.fn(), read: vi.fn(), mkdir: vi.fn(), delete: vi.fn() }`
al `createMockClient()`.

- [ ] **Paso 8: El helper de descubrimiento de entorno**

En `src/__e2e__/helpers.ts`:

```ts
/**
 * Devuelve un entorno cuyo workspace de builds funciona.
 *
 * Medido el 2026-08-19: cinco de los seis entornos de esta instancia responden
 * 500 "failed to ensure builds directory: mkdir /builds: permission denied";
 * solo uno responde 200. Cablear ese id seria fabricar el defecto que ya tiene
 * resolvers.e2e.ts -un test acoplado al inventario vivo-.
 *
 * Si NINGUNO funciona, FALLA. No salta. La regla dura del proyecto dice que
 * ninguna tool se entrega sin e2e, asi que "no he podido comprobarlo" es rojo;
 * y un fichero saltado se lee como verde, que es justo el disfraz a evitar.
 */
export async function entornoConWorkspaceDeBuilds(): Promise<string> {
  const forzado = process.env.ARCANE_E2E_BUILD_ENV;
  const client = e2eClient();
  const candidatos = forzado
    ? [forzado]
    : ((await client.environments.list({ limit: 50, sort: "name" })).data ?? []).map(e => e.id);

  const fallos: string[] = [];
  for (const id of candidatos) {
    try {
      await client.buildWorkspace.browse(id);
      return id;
    } catch (e) {
      fallos.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  throw new Error(
    "Ningun entorno tiene un workspace de builds utilizable, asi que las tools de " +
      "build-workspace NO se pueden verificar contra la instancia.\n" +
      "Probados:\n  " + fallos.join("\n  ") + "\n" +
      "Fuerza uno con ARCANE_E2E_BUILD_ENV=<id> si sabes de alguno que sirva.",
  );
}
```

- [ ] **Paso 9: e2e**

`src/__e2e__/builds.e2e.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { e2eClient, entornoConWorkspaceDeBuilds } from "./helpers";

const client = e2eClient();
const DIR = "arcane-mcp-e2e";

describe("e2e: workspace de builds contra Arcane real", () => {
  let envId: string;

  beforeAll(async () => {
    envId = await entornoConWorkspaceDeBuilds();
  });

  afterAll(async () => {
    try { await client.buildWorkspace.delete(envId, DIR); }
    catch (e) { console.error(`\n[e2e] RESIDUO: no se pudo borrar '${DIR}' del workspace: ${e}\n`); }
  });

  it("mkdir() crea el directorio y browse() lo ve", async () => {
    await client.buildWorkspace.mkdir(envId, DIR);
    const res = await client.buildWorkspace.browse(envId);
    const entrada = (res.data ?? []).find(e => e.name === DIR);
    expect(entrada).toBeDefined();
    expect(entrada!.isDirectory).toBe(true);
  });

  it("browse() rechaza el traversal: la jaula la impone Arcane", async () => {
    await expect(client.buildWorkspace.browse(envId, "../..")).rejects.toThrow(/path traversal not allowed/);
  });

  it("mkdir() rechaza el traversal", async () => {
    await expect(client.buildWorkspace.mkdir(envId, "../fuera-de-la-jaula")).rejects.toThrow(
      /path traversal not allowed/,
    );
  });

  it("una ruta absoluta se re-enraiza dentro del workspace, no escapa", async () => {
    // /etc NO lista el /etc del contenedor: busca /builds/etc, que no existe.
    await expect(client.buildWorkspace.browse(envId, "/etc")).rejects.toThrow(/builds\/etc/);
  });

  it("delete() borra el directorio y browse() deja de verlo", async () => {
    await client.buildWorkspace.delete(envId, DIR);
    const res = await client.buildWorkspace.browse(envId);
    expect((res.data ?? []).map(e => e.name)).not.toContain(DIR);
  });
});
```

El `afterAll` borra otra vez a propósito: si el test de `delete` falla a medias, el
directorio no se queda. Un segundo borrado sobre algo que ya no existe solo produce el
aviso, que es el comportamiento querido.

- [ ] **Paso 10: Verificar y commitear**

```bash
npm test && npm run type-check && npm run gen-tools-table -- --check
./scripts/e2e-remoto.sh 2>&1 | tee /tmp/e2e-tarea5.txt | tail -5
grep -c "✓" /tmp/e2e-tarea5.txt
git add -A && git commit -m "feat(builds): explorar, leer, crear y borrar en el workspace de builds"
```

---

## Tarea 6: Workspace de builds — `upload`

Va aparte porque **no es una llamada, son tres**, y un revisor puede rechazarla sin
rechazar la Tarea 5.

**Ficheros:**
- Modificar: `src/arcane-client.ts`, `src/tools/build-workspace.ts`
- Test: `src/__tests__/arcane-client.test.ts`, `src/__e2e__/builds.e2e.ts`

**Interfaces:**
- Consume: `BuildWorkspaceMethods` (Tarea 5); `requestSinCuerpo(method, path, body?)` y
  `lanzaSiFalla(response)` (Tarea 2).
- Produce:
  - `UploadSession`
  - `ArcaneClient.requestBinario<T>(method: string, path: string, body: Uint8Array): Promise<T>`
  - `client.buildWorkspace.upload(envId: string, path: string, content: string): Promise<void>`

**El protocolo, según `openapi.txt`:** `POST /environments/{id}/uploads/{kind}` con
`{filename, size, chunkSize}` → devuelve `UploadSession` con `id`;
`PUT /environments/{id}/uploads/{kind}/{uploadId}/chunks/{index}` con el cuerpo en
`application/octet-stream`; y `POST /builds/browse/upload?path=…` con `{uploadId}`.

**`kind` no está medido.** El spec no enumera sus valores. **Primer paso: averiguarlo.**
No lo adivines.

- [ ] **Paso 1: Medir el valor de `kind` y el flujo completo, a mano**

```bash
set -a; . ./.dev.vars; set +a
B=http://192.168.180.210:3552/api
# El entorno con workspace utilizable, medido el 2026-08-19 (Zabbix). Confirma
# que sigue siendo ese ejecutando entornoConWorkspaceDeBuilds() si dudas.
E=8a406ef5-c7c3-4232-a1ea-9fe813f8cad3
curl -s -X POST -H "X-API-Key: $ARCANE_API_KEY" -H 'Content-Type: application/json' \
  -d '{"filename":"sonda.txt","size":5,"chunkSize":5}' "$B/environments/$E/uploads/builds"
```

Prueba `builds`, y si da error prueba los valores que sugiera el mensaje. **Anota el
valor correcto y el shape exacto de la respuesta en el mensaje del commit.** Si ningún
valor funciona, para y repórtalo: la tool no se entrega a ciegas.

- [ ] **Paso 2: Escribir los tests que fallan**

Sustituye `builds` por el `kind` medido en el Paso 1, en el código **y** en los tests.

```ts
describe("buildWorkspace.upload", () => {
  it("hace las tres llamadas del protocolo en orden", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { id: "up1", chunkSize: 1024, totalChunks: 1 } }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { id: "up1", complete: true } }) } as Response)
      .mockResolvedValueOnce({ ok: true, status: 204 } as unknown as Response);

    await client.buildWorkspace.upload("env1", "ctx/Dockerfile", "FROM alpine:3.19\n");

    expect(mockFetch).toHaveBeenNthCalledWith(1,
      "http://localhost:3552/api/environments/env1/uploads/builds",
      expect.objectContaining({ method: "POST" }));
    expect(mockFetch).toHaveBeenNthCalledWith(2,
      "http://localhost:3552/api/environments/env1/uploads/builds/up1/chunks/0",
      expect.objectContaining({ method: "PUT" }));
    expect(mockFetch).toHaveBeenNthCalledWith(3,
      "http://localhost:3552/api/environments/env1/builds/browse/upload?path=ctx%2FDockerfile",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ uploadId: "up1" }) }));
  });

  it("propaga el error si la sesion de subida no se puede crear", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false, status: 400, statusText: "Bad Request",
      json: async () => ({ detail: "invalid kind" }),
    } as unknown as Response);

    await expect(client.buildWorkspace.upload("env1", "x", "y")).rejects.toThrow("invalid kind");
  });

  it("codifica el uploadId en la ruta del chunk", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { id: "up#1" } }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: {} }) } as Response)
      .mockResolvedValueOnce({ ok: true, status: 204 } as unknown as Response);

    await client.buildWorkspace.upload("env1", "f.txt", "x");

    expect(mockFetch).toHaveBeenNthCalledWith(2,
      "http://localhost:3552/api/environments/env1/uploads/builds/up%231/chunks/0",
      expect.objectContaining({ method: "PUT" }));
  });
});
```

- [ ] **Paso 3: Verificar que fallan**

```bash
npx vitest run src/__tests__/arcane-client.test.ts -t "buildWorkspace.upload"
```

Esperado: FAIL — `client.buildWorkspace.upload is not a function`.

- [ ] **Paso 4: Implementar**

Tipo:

```ts
export interface UploadSession {
  id: string;
  filename: string;
  size: number;
  chunkSize: number;
  totalChunks: number;
  receivedChunks: number;
  complete: boolean;
  kind: string;
  createdAt: string;
}
```

`requestBinario`, junto a `requestSinCuerpo()`:

```ts
  /** PUT/POST con cuerpo binario (application/octet-stream). */
  async requestBinario<T>(method: string, path: string, body: Uint8Array): Promise<T> {
    const response = await this._fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { "X-API-Key": this.apiKey, "Content-Type": "application/octet-stream" },
      body,
    });
    await lanzaSiFalla(response);
    return response.json() as Promise<T>;
  }
```

`lanzaSiFalla()` viene de la Tarea 2. **No repitas el bloque aqui.**

Método, dentro de `BuildWorkspaceMethods` (sustituye `KIND` por el valor medido):

```ts
  /**
   * Sube un fichero al workspace de builds.
   *
   * No es una llamada, son tres: el endpoint de subida consume una sesion por
   * trozos ya completa. El multipart existe pero openapi.txt lo declara
   * deprecado, asi que se usa el camino nuevo.
   *
   * Se sube en un solo trozo: chunkSize = tamano del fichero. Los ficheros de
   * un contexto de build son Dockerfiles y scripts, no imagenes de disco.
   */
  async upload(envId: string, path: string, content: string): Promise<void> {
    const KIND = "builds";
    const bytes = Buffer.from(content, "utf8");
    const env = encodeURIComponent(envId);

    const sesion = await this.client.request<{ success: boolean; data: UploadSession }>(
      "POST",
      `/environments/${env}/uploads/${KIND}`,
      { filename: path.split("/").pop() || path, size: bytes.length, chunkSize: bytes.length },
    );

    await this.client.requestBinario(
      "PUT",
      `/environments/${env}/uploads/${KIND}/${encodeURIComponent(sesion.data.id)}/chunks/0`,
      bytes,
    );

    const params = new URLSearchParams();
    params.set("path", path);
    await this.client.requestSinCuerpo("POST", this.ruta(envId, "/upload", params), {
      uploadId: sesion.data.id,
    });
  }
```

- [ ] **Paso 5: Verificar que pasan**

```bash
npx vitest run src/__tests__/arcane-client.test.ts -t "buildWorkspace"
npm test
npm run type-check
```

Esperado: los 9 tests de `buildWorkspace` en verde.

**Falsabilidad:** quita el `encodeURIComponent` del `uploadId` y comprueba que cae el
tercer test. Revierte.

- [ ] **Paso 6: La tool**

En `src/tools/build-workspace.ts`:

```ts
  server.tool(
    "arcane_build_workspace_upload",
    "Upload a text file to the build workspace.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      path: RUTA_OBLIGATORIA,
      content: z.string().describe("File content"),
    },
    withErrors(async ({ environmentId, environmentName, path, content }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      await client.buildWorkspace.upload(envId, path, content);
      return textResponse(`Uploaded '${path}' to the build workspace.`);
    }),
  );
```

La descripción **no** dice si sobrescribe: eso lo decide el Paso 7. Si el e2e demuestra
que sustituye, añade «creating or replacing it»; si demuestra que falla, di eso.

- [ ] **Paso 7: e2e**

En `src/__e2e__/builds.e2e.ts`, dentro del `describe` del workspace:

```ts
  it("upload() escribe un fichero y read() devuelve exactamente su contenido", async () => {
    const contenido = "FROM alpine:3.19\nRUN echo arcane-mcp-e2e\n";
    await client.buildWorkspace.mkdir(envId, DIR);
    await client.buildWorkspace.upload(envId, `${DIR}/Dockerfile`, contenido);

    const res = await client.buildWorkspace.read(envId, `${DIR}/Dockerfile`);
    expect(Buffer.from(res.data.content, "base64").toString("utf8")).toBe(contenido);
  });

  it("upload() sobre un path existente lo sustituye", async () => {
    const nuevo = "FROM alpine:3.19\nRUN echo segunda-version\n";
    await client.buildWorkspace.upload(envId, `${DIR}/Dockerfile`, nuevo);

    const res = await client.buildWorkspace.read(envId, `${DIR}/Dockerfile`);
    expect(Buffer.from(res.data.content, "base64").toString("utf8")).toBe(nuevo);
  });
```

**Si el segundo test falla, no lo borres: cambia la descripción de la tool** para que diga
lo que la API hace de verdad, y convierte el test en la aserción de ese comportamiento.

- [ ] **Paso 8: Verificar y commitear**

```bash
npm test && npm run type-check && npm run gen-tools-table -- --check
./scripts/e2e-remoto.sh 2>&1 | tee /tmp/e2e-tarea6.txt | tail -5
grep -c "✓" /tmp/e2e-tarea6.txt
git add -A && git commit -m "feat(builds): subida de ficheros al workspace por sesion de trozos"
```

---

## Tarea 7: La maquinaria de build — tipos, resumidor y enmascarado

Solo cliente. La Tarea 8 pone las tools encima.

**Ficheros:**
- Modificar: `src/arcane-client.ts`
- Test: `src/__tests__/arcane-client.test.ts`

**Interfaces:**
- Produce:
  - `ImageBuildRecord`, `BuildRequest`, `ProjectBuildRequest`, `BuildListOptions`, `BuildStreamSummary`
  - `BUILD_ARG_OCULTO`, `LINEAS_DE_LOG_CONSERVADAS`
  - `client.imageBuilds.build(envId: string, req: BuildRequest): Promise<BuildStreamSummary>`
  - `client.imageBuilds.buildProject(envId: string, projectId: string, req: ProjectBuildRequest): Promise<BuildStreamSummary>`
  - `client.imageBuilds.list(envId: string, opts?: BuildListOptions): Promise<PaginatedResponse<ImageBuildRecord>>`
  - `client.imageBuilds.get(envId: string, buildId: string): Promise<{ success: boolean; data: ImageBuildRecord }>`

- [ ] **Paso 1: Tests que fallan — enmascarado y resumidor**

```ts
describe("imageBuilds", () => {
  it(".list() enmascara los valores de buildArgs y conserva las claves", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [{ id: "b1", environmentId: "0", status: "success", createdAt: "x", contextDir: "/builds",
                 noCache: false, pull: false, privileged: false, push: false, load: false, outputTruncated: false,
                 buildArgs: { NPM_TOKEN: "npm_secreto_de_verdad", OTRO: "tambien" } }],
        pagination: {},
      }),
    } as Response);

    const res = await client.imageBuilds.list("env1");

    expect(JSON.stringify(res)).not.toContain("npm_secreto_de_verdad");
    expect(JSON.stringify(res)).not.toContain("tambien");
    expect(Object.keys(res.data![0].buildArgs!)).toEqual(["NPM_TOKEN", "OTRO"]);
    expect(res.data![0].buildArgs!.NPM_TOKEN).toBe(BUILD_ARG_OCULTO);
  });

  it(".get() enmascara igual que .list(): la fuga no puede depender de la ruta", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { id: "b1", environmentId: "0", status: "success", createdAt: "x", contextDir: "/builds",
                noCache: false, pull: false, privileged: false, push: false, load: false, outputTruncated: false,
                buildArgs: { GITHUB_TOKEN: "ghp_secreto_de_verdad" } },
      }),
    } as Response);

    const res = await client.imageBuilds.get("env1", "b1");

    expect(JSON.stringify(res)).not.toContain("ghp_secreto_de_verdad");
    expect(res.data.buildArgs!.GITHUB_TOKEN).toBe(BUILD_ARG_OCULTO);
  });

  it(".get(buildId) codifica el buildId y no permite traversal", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: {} }) } as Response);
    await client.imageBuilds.get("env1", "../../system/containers/stop-all#");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3552/api/environments/env1/images/builds/..%2F..%2Fsystem%2Fcontainers%2Fstop-all%23",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it(".list() sin opciones - GET sin query", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: [], pagination: {} }) } as Response);
    await client.imageBuilds.list("env1");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3552/api/environments/env1/images/builds",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it(".list({status}) - GET con la query literal", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: [], pagination: {} }) } as Response);
    await client.imageBuilds.list("env1", { status: "failed" });
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3552/api/environments/env1/images/builds?status=failed",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it(".build() trata {done:true} como exito y expone el activityId", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () =>
        '{"type":"activity","activityId":"act-1"}\n{"log":"#1 paso"}\n{"done":true}\n',
    } as unknown as Response);

    const res = await client.imageBuilds.build("env1", { contextDir: "/builds" });

    expect(res.success).toBe(true);
    expect(res.activityId).toBe("act-1");
    expect(res.logTail).toContain("#1 paso");
  });

  it(".build() trata {error} como fallo AUNQUE el HTTP sea 200", async () => {
    // Medido el 2026-08-19: el endpoint responde 200 y el fracaso solo vive
    // dentro del stream. Es la clase de bug que tuvo arcane_project_redeploy.
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () =>
        '{"type":"activity","activityId":"act-2"}\n{"error":"build context not found: stat /x: no such file or directory"}\n',
    } as unknown as Response);

    const res = await client.imageBuilds.build("env1", { contextDir: "/x" });

    expect(res.success).toBe(false);
    expect(res.message).toContain("build context not found");
  });

  it(".build() conserva solo la cola del log y dice cuantas lineas descarto", async () => {
    const lineas = Array.from({ length: 250 }, (_, i) => `{"log":"linea ${i}"}`).join("\n");
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => `{"type":"activity","activityId":"a"}\n${lineas}\n{"done":true}\n`,
    } as unknown as Response);

    const res = await client.imageBuilds.build("env1", { contextDir: "/builds" });

    expect(res.logTail).toHaveLength(LINEAS_DE_LOG_CONSERVADAS);
    expect(res.logTail[res.logTail.length - 1]).toBe("linea 249");
    expect(res.droppedLines).toBe(250 - LINEAS_DE_LOG_CONSERVADAS);
  });

  it(".buildProject() codifica el projectId y usa el mismo resumidor", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => '{"type":"activity","activityId":"a"}\n{"error":"project not found"}\n',
    } as unknown as Response);

    const res = await client.imageBuilds.buildProject("env1", "p#1", {});

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3552/api/environments/env1/projects/p%231/build",
      expect.objectContaining({ method: "POST" }),
    );
    expect(res.success).toBe(false);
    expect(res.message).toContain("project not found");
  });
});
```

- [ ] **Paso 2: Verificar que fallan**

```bash
npx vitest run src/__tests__/arcane-client.test.ts -t "imageBuilds"
```

Esperado: FAIL — `imageBuilds` no existe y `BUILD_ARG_OCULTO` no está exportado.

- [ ] **Paso 3: Implementar tipos**

```ts
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
```

- [ ] **Paso 4: Implementar enmascarado y resumidor**

Junto a `summarizeComposeStream`:

```ts
export const BUILD_ARG_OCULTO = "<hidden by arcane-mcp>";
export const LINEAS_DE_LOG_CONSERVADAS = 100;

/**
 * Sustituye los valores de buildArgs y conserva las claves.
 *
 * Va en el CLIENTE y no en la capa de tool a proposito: en la tool, una
 * segunda tool futura sobre el mismo endpoint reintroduciria la fuga sin que
 * nada fallara. Es exactamente como se desplego rota arcane_image_update_check
 * en F3, por una rama que nadie ejercito.
 */
function enmascaraBuildArgs<T extends { buildArgs?: Record<string, string> }>(registro: T): T {
  if (!registro.buildArgs) return registro;
  const ocultos: Record<string, string> = {};
  for (const clave of Object.keys(registro.buildArgs)) ocultos[clave] = BUILD_ARG_OCULTO;
  return { ...registro, buildArgs: ocultos };
}

/**
 * Agrega el NDJSON de una build.
 *
 * No reutiliza summarizeComposeStream porque aquel une TODOS los logs en un
 * solo `message`: un compose up produce unas lineas, una build produce
 * cientos, sin cota. Comparte `extractStreamError`, que es lo unico igual.
 */
function summarizeBuildStream(events: ComposeStreamEvent[], action: string): BuildStreamSummary {
  const activityId = events.find(e => typeof e.activityId === "string")?.activityId;
  const logs = events
    .filter(e => typeof e.log === "string")
    .map(e => (e.log as string).trimEnd())
    .filter(l => l.length > 0);
  const logTail = logs.slice(-LINEAS_DE_LOG_CONSERVADAS);
  const droppedLines = logs.length - logTail.length;

  const errors = events.map(extractStreamError).filter((e): e is string => typeof e === "string");
  if (errors.length > 0) {
    return { success: false, message: `${action} failed: ${errors.join("; ")}`, activityId, logTail, droppedLines };
  }

  const done = events.some(e => e.done === true);
  return {
    success: done,
    message: done ? `${action} finished` : `${action} ended without a completion event`,
    activityId,
    logTail,
    droppedLines,
  };
}
```

- [ ] **Paso 5: Implementar la clase de métodos**

```ts
class ImageBuildsMethods {
  constructor(private client: ArcaneClient) {}

  // El endpoint transmite NDJSON (application/x-json-stream) y devuelve
  // HTTP 200 aunque la build falle: el fracaso solo vive dentro del stream.
  async build(envId: string, req: BuildRequest): Promise<BuildStreamSummary> {
    const events = await this.client.requestNdjson<ComposeStreamEvent>(
      "POST",
      `/environments/${encodeURIComponent(envId)}/images/build`,
      req,
    );
    return summarizeBuildStream(events, "Build");
  }

  async buildProject(envId: string, projectId: string, req: ProjectBuildRequest): Promise<BuildStreamSummary> {
    const events = await this.client.requestNdjson<ComposeStreamEvent>(
      "POST",
      `/environments/${encodeURIComponent(envId)}/projects/${encodeURIComponent(projectId)}/build`,
      req,
    );
    return summarizeBuildStream(events, "Project build");
  }

  async list(envId: string, opts?: BuildListOptions): Promise<PaginatedResponse<ImageBuildRecord>> {
    const params = new URLSearchParams();
    appendListParams(params, opts);
    if (opts?.status) params.set("status", opts.status);
    if (opts?.provider) params.set("provider", opts.provider);
    const query = params.toString();
    const res = await this.client.request<PaginatedResponse<ImageBuildRecord>>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/images/builds${query ? `?${query}` : ""}`,
    );
    return { ...res, data: res.data ? res.data.map(enmascaraBuildArgs) : res.data };
  }

  async get(envId: string, buildId: string): Promise<{ success: boolean; data: ImageBuildRecord }> {
    const res = await this.client.request<{ success: boolean; data: ImageBuildRecord }>(
      "GET",
      `/environments/${encodeURIComponent(envId)}/images/builds/${encodeURIComponent(buildId)}`,
    );
    return { ...res, data: enmascaraBuildArgs(res.data) };
  }
}
```

Wiring: `readonly imageBuilds: ImageBuildsMethods;` y
`this.imageBuilds = new ImageBuildsMethods(this);`.

- [ ] **Paso 6: Verificar y demostrar falsabilidad**

```bash
npx vitest run src/__tests__/arcane-client.test.ts -t "imageBuilds"
npm run type-check
```

Esperado: 9 passed.

**Falsabilidad, tres mutaciones obligatorias:**
1. Quita `enmascaraBuildArgs` de `.get()` (déjalo en `.list()`) → debe caer el test de
   `.get()`. Es la comprobación de que el enmascarado no depende de una sola ruta.
2. Cambia `success: done` por `success: true` → debe caer el test de `{error}` con 200.
3. Cambia `logs.slice(-LINEAS_DE_LOG_CONSERVADAS)` por `logs` → debe caer el test de la
   cola.

Revierte las tres.

- [ ] **Paso 7: Commit**

```bash
git add src/arcane-client.ts src/__tests__/arcane-client.test.ts
git commit -m "feat(client): maquinaria de build con buildArgs enmascarados y log acotado"
```

---

## Tarea 8: Las cuatro tools de build

**Ficheros:**
- Crear: `src/tools/image-builds.ts`
- Modificar: `src/index.ts`, `scripts/gen-tools-table.mjs`, `src/__e2e__/helpers.ts`
- Test: `src/__tests__/tools.test.ts`, `src/__e2e__/builds.e2e.ts`

**Interfaces:**
- Consume: todo lo que produce la Tarea 7, y `entornoConWorkspaceDeBuilds()` (Tarea 5).
- Produce: `registerImageBuildTools(server, client): void`

- [ ] **Paso 1: Comprobar que existe `resolveProjectId`**

```bash
grep -n "export async function resolve" src/tools/resolve.ts
```

Si no existe `resolveProjectId(client, envId, id?, name?)`, escríbelo siguiendo el patrón
exacto de los resolvers vecinos de ese fichero, con `collectAllPages` y `sort` explícito:
paginar sin `sort` devuelve conjuntos incompletos en esta versión de Arcane, y un resolver
que decide «no existe» a partir de una página incompleta es justo el fallo que ese módulo
existe para evitar.

- [ ] **Paso 2: Crear el fichero de tools**

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArcaneClient, BuildStreamSummary } from "../arcane-client";
import { LINEAS_DE_LOG_CONSERVADAS } from "../arcane-client";
import { resolveEnvironmentId, resolveProjectId } from "./resolve";
import { withErrors, listResponse, textResponse } from "./respond";
import type { ToolResult } from "./respond";

function respuestaDeBuild(resumen: BuildStreamSummary): ToolResult {
  const partes: string[] = [resumen.message];
  if (resumen.activityId) partes.push(`Activity: ${resumen.activityId}`);
  if (resumen.droppedLines > 0) {
    partes.push(
      `Showing the last ${LINEAS_DE_LOG_CONSERVADAS} log lines; ${resumen.droppedLines} earlier lines omitted.`,
    );
  }
  partes.push(resumen.logTail.join("\n"));
  const texto = partes.join("\n");
  return resumen.success
    ? textResponse(texto)
    : { content: [{ type: "text", text: texto }], isError: true };
}

export function registerImageBuildTools(server: McpServer, client: ArcaneClient): void {
  server.tool(
    "arcane_image_build",
    "Build a Docker image with BuildKit. Note that load:false does NOT discard the image: it is still created and tagged. Build arguments are stored by Arcane and readable afterwards, so do not pass secrets.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      contextDir: z.string().min(1).describe("Build context directory or Git URL"),
      dockerfile: z.string().optional().describe("Dockerfile path within the context"),
      dockerfileInline: z.string().optional().describe("Inline Dockerfile content, instead of a path"),
      tags: z.array(z.string()).optional().describe("Image tags to apply"),
      buildArgs: z.record(z.string()).optional().describe("Build arguments. Stored by Arcane and readable later: never pass secrets"),
      target: z.string().optional().describe("Target stage in a multi-stage Dockerfile"),
      noCache: z.boolean().optional().describe("Disable the build cache"),
      pull: z.boolean().optional().describe("Always pull referenced base images"),
      push: z.boolean().optional().describe("Push the image to its registry"),
    },
    withErrors(async ({ environmentId, environmentName, ...req }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      return respuestaDeBuild(await client.imageBuilds.build(envId, req));
    }),
  );

  server.tool(
    "arcane_project_build",
    "Build the Compose services of a project that declare a build directive. Do not rely on the project's hasBuildDirective field to decide: it reports false even for projects that do have one.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      projectId: z.string().optional().describe("Project ID (use if known)"),
      projectName: z.string().optional().describe("Project name (alternative to ID)"),
      services: z.array(z.string()).optional().describe("Service names to build (defaults to all buildable services)"),
      push: z.boolean().optional().describe("Push the built images"),
      load: z.boolean().optional().describe("Load the built images into Docker"),
    },
    withErrors(async ({ environmentId, environmentName, projectId, projectName, ...req }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const projId = await resolveProjectId(client, envId, projectId, projectName);
      return respuestaDeBuild(await client.imageBuilds.buildProject(envId, projId, req));
    }),
  );

  server.tool(
    "arcane_image_build_list",
    "List the image build history of an environment. Build argument values are hidden; their names are kept. The environmentId recorded on each build is the agent's own local id, not the environment you queried.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      search: z.string().optional().describe("Free-text search over build records"),
      sort: z.string().optional().describe("Column to sort by, e.g. createdAt, status"),
      order: z.string().optional().describe("Sort direction: asc or desc"),
      start: z.number().int().min(0).optional().describe("Start index for pagination (server default: 0)"),
      limit: z.number().int().min(1).optional().describe("Items per page (server default: 20)"),
      status: z.string().optional().describe("Filter by status, e.g. success or failed"),
      provider: z.string().optional().describe("Filter by build provider"),
    },
    withErrors(async ({ environmentId, environmentName, ...opts }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.imageBuilds.list(envId, opts);
      return listResponse(result, "image builds");
    }),
  );

  server.tool(
    "arcane_image_build_get",
    "Get one build record with its full build log. Build argument values are hidden, but the log itself is returned verbatim and contains whatever the build printed, including anything it echoed by mistake.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      buildId: z.string().describe("Build ID"),
    },
    withErrors(async ({ environmentId, environmentName, buildId }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.imageBuilds.get(envId, buildId);
      const aviso = result.data.outputTruncated
        ? "This build log is TRUNCATED by the server: it is not the complete output.\n"
        : "";
      return textResponse(
        `${aviso}Build argument values are hidden; their names are kept.\n` +
          JSON.stringify(result.data, null, 2),
      );
    }),
  );
}
```

- [ ] **Paso 3: Registrar en los tres sitios**

`src/index.ts` (import + llamada) y en `GROUPS`:

```js
  ["image-builds.ts", "Image builds"],
```

- [ ] **Paso 4: Tests de tool**

Añade `imageBuilds: { build: vi.fn(), buildProject: vi.fn(), list: vi.fn(), get: vi.fn() }`
al `createMockClient()`, y:

```ts
describe("registerImageBuildTools", () => {
  it("arcane_image_build devuelve isError cuando el stream trae {error}", async () => {
    const server = new McpServer({ name: "t", version: "1" });
    const client = createMockClient();
    client.imageBuilds.build.mockResolvedValue({
      success: false, message: "Build failed: build context not found",
      activityId: "a1", logTail: [], droppedLines: 0,
    });
    registerImageBuildTools(server, client as unknown as ArcaneClient);

    const res = await (server as any)._registeredTools["arcane_image_build"]
      .callback({ environmentId: "env1", contextDir: "/x" });

    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("build context not found");
  });

  it("arcane_image_build dice cuantas lineas de log omitio", async () => {
    const server = new McpServer({ name: "t", version: "1" });
    const client = createMockClient();
    client.imageBuilds.build.mockResolvedValue({
      success: true, message: "Build finished", activityId: "a1",
      logTail: ["ultima"], droppedLines: 150,
    });
    registerImageBuildTools(server, client as unknown as ArcaneClient);

    const res = await (server as any)._registeredTools["arcane_image_build"]
      .callback({ environmentId: "env1", contextDir: "/builds" });

    expect(res.isError).toBeUndefined();
    expect(res.content[0].text).toContain("150 earlier lines omitted");
  });

  it("arcane_image_build NO dice nada de lineas omitidas cuando no omitio ninguna", async () => {
    const server = new McpServer({ name: "t", version: "1" });
    const client = createMockClient();
    client.imageBuilds.build.mockResolvedValue({
      success: true, message: "Build finished", activityId: "a1",
      logTail: ["unica"], droppedLines: 0,
    });
    registerImageBuildTools(server, client as unknown as ArcaneClient);

    const res = await (server as any)._registeredTools["arcane_image_build"]
      .callback({ environmentId: "env1", contextDir: "/builds" });

    expect(res.content[0].text).not.toContain("earlier lines omitted");
  });

  it("arcane_image_build_get avisa cuando el servidor trunco el log", async () => {
    const server = new McpServer({ name: "t", version: "1" });
    const client = createMockClient();
    client.imageBuilds.get.mockResolvedValue({
      success: true,
      data: { id: "b1", outputTruncated: true, output: "x", environmentId: "0", status: "success",
              createdAt: "x", contextDir: "/builds", noCache: false, pull: false, privileged: false,
              push: false, load: false },
    });
    registerImageBuildTools(server, client as unknown as ArcaneClient);

    const res = await (server as any)._registeredTools["arcane_image_build_get"]
      .callback({ environmentId: "env1", buildId: "b1" });

    expect(res.content[0].text).toContain("TRUNCATED");
  });
});
```

- [ ] **Paso 5: e2e**

En `src/__e2e__/builds.e2e.ts`, añade un `describe` nuevo. Importa además
`IDEMPOTENT_STACK` de `./helpers` y `resolveProjectId` de `../tools/resolve`.

```ts
describe("e2e: builds contra Arcane real", () => {
  let envId: string;
  const TAG = "arcane-mcp-e2e:build";
  // Valor falso y ESTABLE: el historial de builds no se puede borrar, asi que
  // cada corrida acumula una fila. Con el mismo par siempre, lo que se acumula
  // son filas identicas e inocuas.
  const ARG = { ARCANE_MCP_E2E_ARG: "valor-de-prueba-no-secreto" };
  let buildId: string;

  beforeAll(async () => {
    envId = await entornoConWorkspaceDeBuilds();
  });

  afterAll(async () => {
    try {
      const imgs = await client.images.list(envId, { limit: 200, sort: "repo" });
      const sonda = (imgs.data ?? []).find(i => JSON.stringify(i.repoTags ?? []).includes("arcane-mcp-e2e"));
      if (sonda) await client.images.remove(envId, sonda.id);
    } catch (e) {
      console.error(`\n[e2e] RESIDUO: no se pudo borrar la imagen ${TAG}: ${e}\n`);
    }
  });

  it("build() construye y devuelve done con activityId", async () => {
    const res = await client.imageBuilds.build(envId, {
      contextDir: "/builds",
      dockerfileInline: "FROM alpine:3.19\nARG ARCANE_MCP_E2E_ARG\nRUN echo e2e-ok\n",
      tags: [TAG],
      buildArgs: ARG,
      load: false,
      push: false,
    });
    expect(res.success).toBe(true);
    expect(res.activityId).toBeTruthy();
    expect(res.logTail.join("\n")).toContain("e2e-ok");
  });

  it("build() con un contextDir inexistente falla, aunque el HTTP sea 200", async () => {
    const res = await client.imageBuilds.build(envId, { contextDir: "/no-existe-arcane-mcp-e2e" });
    expect(res.success).toBe(false);
    expect(res.message).toContain("build context not found");
  });

  it("list() encuentra la build y NO devuelve el valor del build arg", async () => {
    const res = await client.imageBuilds.list(envId, { limit: 20, sort: "createdAt", order: "desc" });
    const mia = (res.data ?? []).find(b => JSON.stringify(b.tags ?? []).includes("arcane-mcp-e2e"));
    expect(mia).toBeDefined();
    buildId = mia!.id;
    expect(JSON.stringify(res)).not.toContain("valor-de-prueba-no-secreto");
    expect(Object.keys(mia!.buildArgs ?? {})).toContain("ARCANE_MCP_E2E_ARG");
  });

  it("get() devuelve el log y tampoco el valor del build arg", async () => {
    const res = await client.imageBuilds.get(envId, buildId);
    expect(res.data.output).toContain("e2e-ok");
    expect(JSON.stringify(res)).not.toContain("valor-de-prueba-no-secreto");
  });

  it("buildProject() sobre el stack idempotente construye sus servicios", async () => {
    // IDEMPOTENT_STACK es 'ical-bridge', y su compose.yaml tiene `build: .`
    // (verificado el 2026-08-19 leyendo el compose desplegado). arcane-mcp
    // tambien lo tiene y esta VETADO como sujeto: construirlo recrea el
    // contenedor que atiende este canal MCP.
    //
    // El id se RESUELVE por nombre, no se cablea: un id fijo es la misma
    // fragilidad que hace fallar a resolvers.e2e.ts 2 de cada 12 corridas.
    const projId = await resolveProjectId(client, "0", undefined, IDEMPOTENT_STACK);
    const res = await client.imageBuilds.buildProject("0", projId, {});
    expect(res.success).toBe(true);
  });
});
```

La build de `ical-bridge` recrea su imagen. Es el stack designado como idempotente por el
proyecto, así que es el sujeto correcto, pero **confirma que sigue arriba** después de la
corrida:

```bash
set -a; . ./.dev.vars; set +a
curl -s -H "X-API-Key: $ARCANE_API_KEY" \
  "http://192.168.180.210:3552/api/environments/0/projects?search=ical-bridge&sort=name" \
  | grep -o '"status":"[^"]*"'
```

- [ ] **Paso 6: Verificar y commitear**

```bash
npm test && npm run type-check && npm run gen-tools-table -- --check
./scripts/e2e-remoto.sh 2>&1 | tee /tmp/e2e-tarea8.txt | tail -5
grep -c "✓" /tmp/e2e-tarea8.txt
git add -A && git commit -m "feat(builds): cuatro tools de construccion de imagenes y proyectos"
```

---

## Tarea 9: Cierre de fase

**Ficheros:**
- Modificar: `scripts/audit-schema-drift.mjs`, `docs/arquitectura/criterio-exposicion.md`,
  `docs/README.md`, `README.md`
- Crear: `docs/balances/AAAA-MM-DD-f5.md` y
  `docs/auditorias/AAAA-MM-DD-has-build-directive-upstream.md`, con la fecha del día de cierre

- [ ] **Paso 1: Tipos nuevos bajo auditoría de drift**

En el `MAP` de `scripts/audit-schema-drift.mjs`:

```js
  ContainerRegistry: "ContainerregistryContainerRegistry",
  RegistryPullUsage: "ContainerregistryPullUsage",
  TemplateRegistry: "TemplateTemplateRegistry",
  BuildWorkspaceEntry: "WorkspaceFileEntry",
  BuildFileContent: "BuildFileContentResponse",
  ImageBuildRecord: "ImageBuildRecord",
  UploadSession: "UploadSession",
```

- [ ] **Paso 2: Medir el drift y demostrar que la auditoría vigila lo nuevo**

```bash
node scripts/audit-schema-drift.mjs
```

**Anota el número que salga. No lo predigas.**

`BuildWorkspaceEntry` **debe** aparecer con `relativePath` y `editable` marcados: el spec
los declara obligatorios y la instancia no los devuelve. **Eso es correcto.** No lo
«arregles».

Demuestra que la auditoría vigila lo nuevo: quita `url` de `ContainerRegistry`, ejecuta,
comprueba que aparece `FALTA-EN-TS-REQUERIDO` y que el total sube en uno. Revierte y
comprueba que vuelve al número anterior.

- [ ] **Paso 3: Actualizar el criterio de exposición**

En `docs/arquitectura/criterio-exposicion.md`:

- Cabecera: **Última revisión: la fecha de cierre**.
- Nueva subsección **§2.5, «El modelo tendría que redactar el secreto — 4 operaciones»**,
  con las cuatro escrituras de `container-registries`, el hecho medido de que las
  lecturas **no** devuelven credenciales, y los tres agravantes (`sync` masivo, `update`
  que puede vaciar la credencial, `delete` irreversible por construcción).
- En **§2.3**, añade `GET /environments/{id}/builds/browse/download` como redundante con
  `/content`.
- En **§3**, sustituye el bloque del denominador por:

```
  347  operaciones en openapi.txt
 − 51  swarm (infraestructura inexistente, §2.2)
 − 47  escrituras de administración de Arcane (radio de daño, §2.1)
 −  4  escrituras de registro de contenedor (§2.5)
 −  1  builds/browse/download (redundante, §2.3)
 ────
  244  operaciones que este fork pretende poder cubrir
```

- En **§5**, añade el comando que lo reproduce:

```bash
node -e "
const s=JSON.parse(require('fs').readFileSync('openapi.txt','utf8'));
const M=['get','post','put','delete','patch','head'];
const ADMIN=['auth','oidc','users','roles','api-keys','federated-credentials'];
const dom=p=>{const g=p.split('/').filter(Boolean);return (g[0]==='environments'&&g.length>=3)?g[2]:g[0];};
const SECRETO=new Set(['POST /container-registries','PUT /container-registries/{id}','DELETE /container-registries/{id}','POST /container-registries/sync']);
const REDUNDANTE=new Set(['GET /environments/{id}/builds/browse/download']);
let total=0,swarm=0,adminE=0,secreto=0,redundante=0;
for(const p of Object.keys(s.paths)) for(const m of M){ if(!s.paths[p][m])continue; total++;
  const clave=m.toUpperCase()+' '+p, d=dom(p);
  if(d==='swarm'){swarm++;continue;}
  if(ADMIN.includes(d)&&!(m==='get'||m==='head')){adminE++;continue;}
  if(SECRETO.has(clave))secreto++;
  if(REDUNDANTE.has(clave))redundante++;
}
console.log('denominador='+(total-swarm-adminE-secreto-redundante));
"
```

Esperado hoy: `denominador=244`. **Ejecútalo: si da otra cosa, manda el comando.**

- [ ] **Paso 4: Medir la cobertura**

Reescribe el script AST desde cero en `scripts/_tmp-audit-route-coverage.mjs` —temporal,
no se commitea— y **verifica que resuelve los tres casos que rompieron versiones
anteriores** antes de fiarte de su número: `requestNdjson` con el método como primer
argumento, el ternario de `EventsMethods.list()` con sus dos ramas, y el recorte por el
primer `?` literal en `ProjectAdditionalMethods.destroy()`.

Añade un cuarto caso propio de F5: el helper privado `ruta()` de `BuildWorkspaceMethods`,
que construye la ruta **fuera** de la llamada a `request()`. Si el script no lo resuelve,
**cuenta esas rutas a mano y dilo en el balance**.

Bórralo después de medir.

- [ ] **Paso 5: Regenerar la tabla del README**

```bash
npm run gen-tools-table
npm run gen-tools-table -- --check
```

- [ ] **Paso 6: Escribir el balance**

`docs/balances/AAAA-MM-DD-f5.md` con la fecha del día de cierre, siguiendo la estructura del balance de F4. Obligatorio:

- Tabla de cifras medidas, con **el comando exacto de cada una**.
- Lo que apareció y no estaba en el plan.
- Las predicciones del plan que resultaron falsas, si las hubo.
- Qué queda pendiente. Como mínimo:
  - El defecto de `resolvers.e2e.ts`: falla ~2 de cada 12 corridas, hipótesis del
    contenedor Trivy efímero **sin demostrar**.
  - `arcane_volume_backup_download` es una tool falsa en producción: devuelve una cadena
    fija y nunca llama al cliente.
  - `arcane-client.ts` por encima de 77 KB, pidiendo partición.
  - Los listados de `container-registries` y de `images/builds` devuelven
    `grandTotalItems: 0` con `totalItems` distinto de cero. Medido, incoherente, y
    candidato a un segundo issue upstream. Sin acción en F5.
  - Zonas no vistas: el camino de **éxito** de `container_registry_test`, que no se puede
    ejercitar sin credenciales reales de un registro; y el workspace de builds con
    jerarquías profundas, solo visto vacío y con un directorio.

- [ ] **Paso 7: Publicar el issue de `hasBuildDirective`**

Determina la causa contra el código de Arcane y publícalo, con esta reproducción: cuatro
proyectos con `build:` de servicio verificado en el fichero que la propia API declara como
su `composeFileName` —`ical-bridge`, `arcane-mcp`, `ionos-manager`, `obsidian-notify`— y
`hasBuildDirective: false` en los cuatro; ninguno de los 22 proyectos de los seis entornos
lo tiene a `true`.

Documenta el issue en `docs/auditorias/` y enlázalo desde `docs/README.md`, como se hizo
con los tres anteriores.

- [ ] **Paso 8: Enlazar en el índice**

Añade el spec, el plan, el balance y la auditoría a `docs/README.md`.

- [ ] **Paso 9: Verificación final completa**

```bash
npm test
npm run type-check
npm run gen-tools-table -- --check
node scripts/audit-schema-drift.mjs
./scripts/e2e-remoto.sh 2>&1 | tee /tmp/e2e-cierre.txt | tail -5
grep -c "✓" /tmp/e2e-cierre.txt
```

Cuenta las marcas `✓` **una a una**. `54 passed | 3 skipped` no es verde.

- [ ] **Paso 10: Revisión final de rama completa**

**No la recortes.** En F4 el único hallazgo Critical —una inyección de ruta que convertía
una tool en un POST arbitrario contra cualquier endpoint de Arcane— lo cazó esta revisión,
y ninguna de las seis revisiones por tarea: la pregunta que lo destapa —«¿es este el único
segmento sin codificar de un cliente de 2.300 líneas, y qué alcanza?»— no existe desde el
alcance de una tarea.

Usa `superpowers:requesting-code-review` sobre el diff completo de la rama contra `main`.

- [ ] **Paso 11: Commit y publicación**

```bash
git add -A
git commit -m "docs(f5): balance de fase, criterio al dia y denominador 244"
git push origin f5-build-y-registries && git push github f5-build-y-registries
```

El merge a `main` **lo decide el propietario**. Recuerda que el push a `main` despliega
solo en ≤5 min, y que la verificación se hace mirando **dentro** del contenedor:

```bash
ssh VM-Control 'docker exec arcane-mcp-server sh -c "wc -c < /app/src/tools/image-builds.ts"'
```

comparándolo con el local. Un `lastSyncStatus: success` con la imagen vieja fue el modo de
fallo silencioso de este proyecto durante toda F0/F1.
