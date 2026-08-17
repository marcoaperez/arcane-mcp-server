# Spec de diseño — Coherencia de la superficie de listado

- **Fecha:** 2026-08-17
- **Fase:** deuda previa a F3. La revisión final de F2 la marcó como "antes de F3"
- **Base:** Arcane **2.8.0** (`openapi.txt`, 273 paths, 347 operaciones)
- **Punto de partida:** `ccabb12` — 81 tools, 78 operaciones cubiertas, 152 tests
  unitarios, 19 e2e
- **Alcance elegido:** coherencia completa — las 13 tools de listado aceptan el juego
  de parámetros que el spec declara para su endpoint y devuelven la paginación

---

## 1. El problema

Las tools de listado del fork mienten por omisión. Tres síntomas, los tres medidos
contra la instancia real el 2026-08-17, no deducidos del código:

1. **Listas truncadas sin aviso.** Las 13 tools de listado emiten
   `JSON.stringify(result.data, null, 2)` y descartan `result.pagination`. Con
   límites por defecto de 20 en casi todos los endpoints y 50 en activities, el
   modelo recibe una lista parcial indistinguible de una completa. Hoy mismo
   `arcane_volume_list` devuelve **20 de 32 volúmenes** y no lo dice.
2. **Parámetros que se anuncian y se tiran.** `arcane_stack_list` y
   `arcane_template_list` declaran `limit` en su schema, lo pasan al cliente, y el
   cliente no lo escribe en la query. El servidor aplica su 20 por defecto. Quien
   pide 50 recibe 20 y cree haber pedido 50.
3. **Resolvers que concluyen "no existe" sin haber mirado.** Los cuatro resolvers
   nombre→id listan y filtran en cliente sobre la primera página. Cuando el elemento
   buscado cae fuera, el error dice `No container found with name 'X'` y adjunta una
   lista de "disponibles" también truncada, que confirma la conclusión falsa.

A eso se suma un dato que el fork descarta sin saberlo: `containers`, `volumes` y
`networks` devuelven un objeto `counts` con los agregados de la colección, que hoy no
llega al modelo.

## 2. Cifras de partida, medidas

Todas salen de un comando ejecutado el 2026-08-17 contra
`http://192.168.180.210:3552`, entorno `0`. Ninguna viene de un documento.

| Recurso | Devueltos por defecto | Total real | `counts` |
|---|---|---|---|
| volumes | **20** | **32** | `{inuse:8, unused:24, total:32}` |
| containers | 16 | 16 | `{runningContainers:15, stoppedContainers:1, totalContainers:16}` |
| images | 18 | 18 | ausente |
| networks | 13 | 13 | `{inuse:12, unused:1, total:13}` |
| projects | 9 | 9 | ausente |

Comportamiento del servidor, comprobado:

- **No capea `limit`.** Con `?limit=1000` devuelve los 32 volúmenes e informa
  `itemsPerPage: 1000`. El `.max(100)` que hoy llevan `arcane_stack_list`,
  `arcane_template_list`, `arcane_environment_list`, `arcane_git_repository_list`,
  `arcane_gitops_sync_list` y `arcane_volume_backup_list` es invención del fork:
  `openapi.txt` no declara `maximum` para `limit` en ningún endpoint.
- **`start` funciona.** `?start=20` sobre volumes devuelve los 12 restantes con
  `currentPage: 2`.
- **`groupBy=project` añade una clave `groups`** a la respuesta de containers,
  aunque el schema declarado del 200 no cambie.

Duplicación del sobre de error: `grep -c 'err instanceof Error ? err.message :
String(err)' src/tools/*.ts` da **81**, y `grep -c 'server.tool('` da **81**.
Coinciden: hay exactamente un `catch` idéntico por tool.

## 3. Inventario de las 13 tools de listado

Contrastado con `openapi.txt` endpoint por endpoint.

| Tool | Endpoint | Hoy acepta | Le faltan |
|---|---|---|---|
| `arcane_container_list` | `GET /environments/{id}/containers` | nada | search, sort, order, start, limit, includeInternal, standalone |
| `arcane_image_list` | `GET /environments/{id}/images` | nada | search, sort, order, start, limit, inUse |
| `arcane_volume_list` | `GET /environments/{id}/volumes` | nada | search, sort, order, start, limit, inUse, includeInternal |
| `arcane_network_list` | `GET /environments/{id}/networks` | nada | search, sort, order, start, limit, inUse |
| `arcane_stack_list` | `GET /environments/{id}/projects` | search, limit *(descartado)* | sort, order, start, **limit**, status, archived, tags |
| `arcane_template_list` | `GET /templates` | search, limit *(descartado)* | sort, order, start, **limit**, type |
| `arcane_environment_list` | `GET /environments` | search, limit | sort, order, start, type |
| `arcane_activity_list` | `GET /environments/{id}/activities` | search, status, type, resourceType, limit | sort, order, start |
| `arcane_event_list` | `GET /events[/environment/{id}]` | environmentId, severity, type, search, limit | sort, order, start |
| `arcane_git_repository_list` | `GET /customize/git-repositories` | los 5 | — |
| `arcane_gitops_sync_list` | `GET /environments/{id}/gitops-syncs` | los 5 | — |
| `arcane_volume_backup_list` | `GET /environments/{id}/volumes/{name}/backups` | los 5 | — |
| `arcane_job_list` | `GET /environments/{id}/jobs` | — | — |

`arcane_job_list` no tiene paginación: su endpoint devuelve el sobre `{jobs:[...]}`,
no `{data, pagination}`, y no admite parámetros de query. Solo le aplica el
tratamiento de `null` de la sección 4.2.

### 3.1 Fuera de alcance, deliberadamente

| Parámetro | Endpoints | Motivo |
|---|---|---|
| `updates` | containers, images, projects | Filtra por estado de actualización de imagen. Es el dominio de F3 y depende del comprobador de actualizaciones que hoy falla en la instancia |
| `groupBy` | containers | Medido: añade una clave `groups` a la respuesta. Necesita su propio tipo y su propio formateo. Es una funcionalidad, no una corrección de coherencia |

## 4. Diseño

### 4.1 Tipos

`PaginatedResponse<T>` no cambia. Los agregados llegan en una interfaz aparte, con el
mismo reparto que hace el propio spec entre `BasePaginated…` y
`BasePaginatedWithCounts…`:

```ts
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[] | null;
  pagination: Pagination;
}

export interface PaginatedResponseWithCounts<T, C> extends PaginatedResponse<T> {
  counts: C;
}
```

`counts` es **obligatorio** en la variante con agregados, porque `openapi.txt` lo
declara en `required` en los tres schemas. Los métodos que no lo traen siguen
devolviendo `PaginatedResponse<T>` a secas.

Se descartó la alternativa de un solo tipo con parámetro por defecto
(`PaginatedResponse<T, C = never>` con `counts: C`): con `C = never` el campo queda
declarado como obligatorio y de tipo imposible, así que ningún método sin agregados
podría construir su propia respuesta.

Tres interfaces nuevas, copiadas campo a campo del spec y verificadas contra la
respuesta real:

| Interfaz TS | Schema del spec | Usada por |
|---|---|---|
| `ContainerStatusCounts` | `ContainerStatusCounts` | `containers.list` |
| `VolumeUsageCounts` | `DockerVolumeVolumeUsageCountsData` | `volumes.list` |
| `NetworkUsageCounts` | `NetworkUsageCounts` | `networks.list` |

Las tres entran en el `MAP` de `scripts/audit-schema-drift.mjs`. Es la regla que este
proyecto se aplica a todo payload: un campo nuevo obligatorio en una versión futura
del spec tiene que saltar.

`ListOptionsWithSort` no cambia. La revisión de la premisa dio que **no es un tipo
aspiracional**: los tres métodos que lo usan directamente (`gitRepositories.list`,
`gitopsSyncs.list`, `volumeBackups.list`) sí envían `sort`, `order` y `start`. Quienes
los ignoran son `ActivityListOptions` y `EventListOptions`, que heredan de él y luego
no los reenvían. Se corrigen esos dos métodos, no el tipo base.

### 4.2 Contrato de salida de una tool de listado

Un helper único produce la salida de las 13. Acepta las dos variantes de sobre de la
sección 4.1, y por eso lee `counts` de forma opcional aunque en la variante con
agregados sea obligatorio:

```ts
export function listResponse<T>(
  result: PaginatedResponse<T> & { counts?: unknown },
  noun: string,
): ToolResult
```

Estructura de la salida:

```
Showing 20 of 32 volumes (page 1 of 2). Pass start=20 to see the rest.
{
  "pagination": { "totalItems": 32, "totalPages": 2, "currentPage": 1, "itemsPerPage": 20 },
  "counts": { "inuse": 8, "unused": 24, "total": 32 },
  "data": [ ... ]
}
```

Reglas:

- La línea en prosa **solo aparece cuando `pagination.totalPages > 1`**. Con una sola
  página la salida es el sobre JSON y nada más. Lo estructurado da uniformidad; la
  frase da relevancia, porque un campo anidado es fácil de saltarse leyendo.
- `counts` solo aparece cuando el endpoint lo trae.
- **`data: null` se trata como lista vacía.** El tipo ya admitía `null` y hoy se
  serializaría como el texto `"null"`. Es la deuda que el balance de F2 anotó para
  `arcane_job_list`; se cierra aquí para las 13.

Esto **rompe el formato de salida de las 13 tools**: pasan de emitir un array pelado a
emitir un objeto. El consumidor es un modelo, así que no hay integración que romper,
pero los ejemplos de salida del README hay que revisarlos.

### 4.3 Parámetros en las tools

Cada fichero de dominio declara su propia constante de nivel superior y la esparce:

```ts
const LIST_PARAMS = {
  search: z.string().optional().describe("..."),
  sort: z.string().optional().describe("..."),
  order: z.string().optional().describe("Sort direction: asc or desc"),
  start: z.number().int().min(0).optional().describe("Start index for pagination"),
  limit: z.number().int().min(1).optional().describe("Items per page (server default: 20)"),
};
```

Tres razones para la constante local en vez de un módulo compartido:

1. `gen-tools-table.mjs` **ya resuelve exactamente este patrón** — spreads de una
   `const` objeto literal declarada en el mismo fichero, el caso real de `INTERVALOS`
   en `jobs.ts`. Un spread de un identificador importado cae en el `else` del
   extractor y aborta. Con la constante local, el extractor no se toca.
2. Los `describe()` deben diferir por dominio: los campos ordenables de un contenedor
   no son los de un evento, y esos textos se publican en la tabla del README.
3. Solo cinco parámetros son realmente comunes. El resto son propios de cada endpoint.

Se retira el `.max(100)` de los seis sitios donde está: no lo declara el spec y el
servidor no lo aplica. Se mantiene `.min(1)` en `limit` y se añade `.min(0)` en
`start`.

### 4.4 El sobre de error: `withErrors`

Módulo nuevo `src/tools/respond.ts`:

```ts
export function withErrors<A>(handler: (args: A) => Promise<ToolResult>) {
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
```

Uso: `server.tool(nombre, desc, shape, withErrors(async ({...}) => { ... }))`.

Se envuelve **el handler**, no el registro. Así la llamada sigue siendo
`server.tool(...)` — una property access expression con `arguments[0]` literal de
cadena y `arguments[2]` objeto literal — que es justo lo que
`gen-tools-table.mjs:103` exige para reconocer una tool. El generador sigue
funcionando sin tocarlo, y su `--check` actúa de red: si la transformación rompiera
algo, cambiaría la cuenta de tools del README.

Desaparecen los 81 `catch`. El cuerpo de cada tool queda con el camino feliz y, donde
corresponda, la comprobación de `result.success === false` que ya exige el
procedimiento estándar.

### 4.5 Los resolvers: `collectAllPages`

Módulo nuevo `src/tools/paging.ts`:

```ts
const PAGE_SIZE = 200;
const MAX_PAGES = 10;

export async function collectAllPages<T>(
  fetchPage: (start: number, limit: number) => Promise<PaginatedResponse<T>>,
): Promise<{ items: T[]; complete: boolean; totalItems: number }>
```

Recorre páginas con `start` hasta que `pagination` dice que no queda nada, con tope
duro de 10 páginas (2.000 elementos). **En el caso normal es una sola petición**: el
bucle solo entra si hay truncamiento real. Corta también si una página vuelve vacía,
para no depender de que el servidor informe bien de `totalItems`.

Los resolvers son **cuatro**, no tres:

| Resolver | Fichero | Hoy |
|---|---|---|
| `resolveEnvironmentId` | `src/tools/resolve.ts:16` | `limit: 50`, sin paginar |
| `resolveStackId` | `src/tools/resolve.ts:48` | `limit: 50`, **descartado por el cliente** → recibe 20 |
| `resolveContainerId` | `src/tools/resolve.ts:80` | sin parámetros → recibe 20 |
| `resolveGitOpsSyncId` | `src/tools/gitops-syncs.ts:20` | sin parámetros → recibe 20 |

Los cuatro pasan a `collectAllPages`. Dos consecuencias diseñadas, no descubiertas
después:

1. **El mensaje de "no encontrado" depende de si la búsqueda fue completa.** Con
   `complete: true`, el mensaje actual. Con `complete: false`:
   `No container found with name 'X' among the first 2000 of 2500 containers in
   environment '0'. Use the container ID instead.` Deja de afirmar que no existe algo
   que no ha mirado.
2. **La lista de "Available: …" se capa.** Hoy hace `.join(", ")` sobre todo lo
   recibido; con paginación completa eso puede ser un mensaje de miles de nombres. Se
   limita a los 30 primeros más `…and N more`.

No se añade `search` de servidor a `resolveContainerId`. El endpoint lo admite, pero
la semántica de su `search` no está documentada en `openapi.txt`, y el resolver hoy
hace un match exacto en cliente contra `names[]` con y sin la barra inicial. Paginar
lo hace correcto sin cambiar qué cuenta como coincidencia.

### 4.6 La excepción del generador

`gen-tools-table.mjs:123` excluye del chequeo de ficheros huérfanos un único nombre
literal:

```js
const present = readdirSync("src/tools").filter(f => f.endsWith(".ts") && f !== "resolve.ts");
```

Cualquier fichero auxiliar nuevo en `src/tools/` aborta el script. Se convierte en un
conjunto explícito:

```js
const NON_TOOL_FILES = new Set(["resolve.ts", "respond.ts", "paging.ts"]);
```

Es un cambio en la **lista de excepciones**, no en el extractor. El `--check` sigue
comprobando que la cuenta de tools del README es la real, que es lo que protege de
verdad.

## 5. Verificación

La regla dura se mantiene, adaptada a que aquí no nacen tools: cambian 13.

### 5.1 Unitarios con `fetch` mockeado

**Los helpers, directamente** (fichero de test nuevo):

- `withErrors`: propaga el resultado cuando el handler resuelve; devuelve `isError`
  con el mensaje cuando lanza un `Error`; y cuando lanza algo que no es un `Error`.
- `listResponse`: una sola página (sin línea en prosa); varias páginas (con línea, y
  con el `start` correcto sugerido); `data: null` → lista vacía, nunca el texto
  `"null"`; con y sin `counts`.
- `collectAllPages`: agota en una petición cuando cabe todo; recorre varias páginas y
  concatena; alcanza el tope y devuelve `complete: false`; **corta ante un servidor
  que informa un `totalItems` inalcanzable** — la guarda contra el bucle infinito.

**El cliente**, un test por método que ahora manda parámetros nuevos, asertando la
**query string exacta**: `containers.list`, `images.list`, `volumes.list`,
`networks.list`, `stacks.list`, `templates.list`, `environments.list`,
`activities.list`, `events.list`.

**Los resolvers**: el caso de truncamiento con `fetch` mockeado, comprobando que el
elemento que está en la segunda página se encuentra, y que al agotar el tope el
mensaje de error dice `among the first N of M` en vez de afirmar que no existe.

### 5.2 e2e contra la instancia real

Dos invariantes falsables, sin cifras clavadas que envejezcan:

1. **`pagination.totalItems` cuadra con `counts`** pidiendo sin filtros:
   `=== counts.total` en volumes y networks, `=== counts.totalContainers` en
   containers.
2. **`start` recorre la colección entera.** Con `limit=5` se fuerza la paginación en
   cualquier recurso con 6 o más elementos: se piden todas las páginas con `start`, y
   se comprueba que no hay IDs repetidos y que lo recogido cuadra con `totalItems`.
   Funciona igual con 32 volúmenes que con 300.

Recordatorio del procedimiento: un fichero e2e que aborta al importar sale como
`skipped`, no como fallo. Se cuenta con `--reporter=verbose`, uno a uno.

### 5.3 Regresiones que deben saltar

- `npm run gen-tools-table -- --check` **va a fallar** en cuanto se añadan parámetros.
  Es la señal de que llegaron a las 13 tools. Se regenera, y las cifras del README se
  vuelven a medir con el comando, no a copiar.
- `node scripts/audit-schema-drift.mjs` debe seguir dando **0 graves** con las tres
  interfaces de `counts` dentro del `MAP`.
- `npm run type-check` limpio.

### 5.4 Despliegue

Rama, commits firmados, merge deliberado, push a `origin` y `github`. El despliegue es
automático: GitOps sincroniza y redespliega en ≤5 min.

La verificación se hace **dentro del contenedor**, nunca por el estado del sync:

```bash
ssh VM-Control 'docker exec arcane-mcp-server sh -c "grep -c collectAllPages /app/src/tools/paging.ts"'
```

Y después se ejercita la tool contra la instancia desplegada, comprobando el
comportamiento nuevo y no solo que no falle: hoy `arcane_volume_list` devuelve 20 de
32 callando; tiene que devolver la línea de truncamiento y los `counts`.

## 6. Lo que este trabajo no arregla

- `swarm` sigue sin decidir: 50 operaciones sin cubrir, el mayor bloque huérfano de la
  API, sin fase asignada. Decisión pendiente, ajena a este spec.
- `updates` y `groupBy` quedan fuera por lo dicho en 3.1.
- El mock unitario de `activities.cancel` sigue modelando una rama
  `{success:false, data:{error:...}}` que la API real no produce (rechaza con 409).
  Deuda heredada de F2, sin relación con el listado.

## 7. Referencias

- [Balance de F2](../../balances/2026-08-16-f2.md)
- [Spec de F2, sección 2 — criterio de exposición](2026-08-16-fork-arcane-mcp-f2-design.md)
- [Cómo añadir una tool](../../desarrollo/anadir-una-tool.md)
