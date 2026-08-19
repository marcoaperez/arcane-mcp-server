# Spec de F5 — build y registries

- **Fecha:** 2026-08-19
- **Punto de partida:** `e72bbcf` (cierre de F4) — 100 tools, 294 unitarios, 59 e2e,
  drift 21, cobertura 98 de 249
- **Base:** Arcane **2.8.0** (`openapi.txt`, 273 paths, 347 operaciones)
- **Alcance:** 17 tools sobre 17 de las 22 operaciones del dominio

Todas las cifras y comportamientos de este documento salen de un comando ejecutado
contra la instancia real el 2026-08-19. Ninguno viene de `openapi.txt` sin
contrastar, porque el spec describe la forma pero no el comportamiento, y este
proyecto ya ha pagado cinco veces por confundir las dos cosas.

---

## 1. Qué son las 22 operaciones, medido

El spec de F0 estimaba ~14. Son 22:

| Bloque | Ops |
|---|---|
| `/container-registries` — CRUD, `pull-usage`, `sync`, `{id}/test` | 8 |
| `/templates/registries` — CRUD | 4 |
| `/environments/{id}/builds/browse` — GET, DELETE, `content`, `download`, `mkdir`, `upload` | 6 |
| `POST /images/build`, `GET /images/builds`, `GET /images/builds/{buildId}`, `POST /projects/{projectId}/build` | 4 |

## 2. Qué queda fuera, y por qué

### 2.1 Cuatro escrituras de registro — motivo nuevo

`POST /container-registries`, `PUT /{id}`, `DELETE /{id}` y `POST /sync`.

**La premisa que motivó revisarlo resultó falsa, y conviene dejarlo escrito.** Se
sospechaba que las lecturas devolvían credenciales. **No lo hacen.** Medido creando
dos registros sonda con tokens centinela —uno `generic`, otro `ecr`— y leyéndolos por
las tres vías:

| Vía | `token` | `awsSecretAccessKey` | Sí devuelve |
|---|---|---|---|
| `GET /container-registries` | **ausente** | **ausente** | `url`, `username`, `insecure`, `enabled`, `registryType`, `repositoryNames` |
| `GET /container-registries/{id}` | **ausente** | **ausente** | Íd. |
| `GET /container-registries/pull-usage` | **ausente** | **ausente** | `registryId`, `provider`, `registry`, `authMethod` |

No están enmascarados: el campo no existe en la respuesta. El `ecr` sí devolvió
`awsAccessKeyId`, que es un identificador, no un secreto. Y el token se almacena y se
usa: el `test` intentó un `registry login` real.

**El motivo de exclusión es el contrario del que se buscaba: para crear o actualizar
un registro, el modelo tendría que redactar el secreto.** `token` es obligatorio en
`CreateContainerRegistryRequest`. No hay forma de invocar esa tool sin que la
contraseña viaje en el `arguments` de la llamada, y de ahí al contexto del modelo y al
transcript del cliente MCP. Es el radio de daño de
[`criterio-exposicion.md` §2.1](../../arquitectura/criterio-exposicion.md) entrando por
la puerta de atrás: el peligro no es lo que sale, es lo que hay que meter.

Es un **cuarto motivo de exclusión**, distinto de los tres que ya recoge el criterio, y
se añade a ese documento como tal.

Tres agravantes concretos:

- **`sync` es el peor.** Su cuerpo es un array de registros completos donde `token` es
  obligatorio y `awsSecretAccessKey` va incluido: una escritura masiva que transporta
  todos los secretos a la vez. Ni el spec ni el nombre aclaran si sustituye el conjunto.
- **`update` puede vaciar la credencial en silencio.** Como la lectura nunca devuelve el
  token, un modelo no puede reconstruir el cuerpo para un cambio cosmético. **No se ha
  medido** qué hace un `PUT` sin `token`; el modo de fallo plausible —credencial
  borrada, pulls fallando más tarde y en otro sitio— es el peor perfil que tiene este
  proyecto.
- **`delete` es irreversible por construcción**: la API no devuelve el token, así que no
  hay manera de recrear lo borrado.

### 2.2 `GET /builds/browse/download` — redundante

Devuelve bytes crudos, y un cliente MCP no puede recibir un flujo binario.
`builds/browse/content` ya entrega el mismo fichero en base64 con `maxBytes`. Cae en la
familia de `GET /environments/{id}/version` de
[`criterio-exposicion.md` §2.3](../../arquitectura/criterio-exposicion.md): redundante,
YAGNI.

**Se excluye en vez de fingirla.** El precedente del fork es malo y conviene nombrarlo:
`arcane_volume_backup_download` (`src/tools/volume-backups.ts:67`) **no llama nunca al
cliente** — devuelve la cadena fija «Binary download is not supported via MCP tool
interface». El método `download()` de `src/arcane-client.ts:2040` existe y ninguna tool
lo alcanza. Es una tool que aparenta serlo, y cuenta en el 100 del README. F5 no repite
ese patrón. *(Arreglar esa tool es deuda declarada, no trabajo de F5.)*

### 2.3 Qué NO es motivo de exclusión

- **`builds/browse` no es administración.** Se sospechaba que escribía en el sistema de
  ficheros del host. No: la raíz es `/builds`, un directorio dentro del contenedor del
  agente —el propio error lo dice, `mkdir /builds: permission denied`— y **Arcane impone
  la jaula**. Medido: `..`, `../..`, `a/../..` y `../../../../etc` dan
  `500 path traversal not allowed`; `/etc` se re-enraíza a `/builds/etc`. Es material de
  entrada para construir imágenes: operar cargas de trabajo, §1 del criterio en su
  sentido más literal. Mismo caso que `volume-files`, no una excepción a justificar.
- **`templates/registries` no guarda credenciales.** Su schema es
  `{id, name, url, description, enabled, lastFetchError}` y su `Create`/`Update` solo
  aceptan cuatro campos. Es un catálogo de URLs. CRUD completo, sin recorte.

### 2.4 El denominador honesto pasa a 244

Las cinco operaciones de §2.1 y §2.2 se restan: el denominador se define como «las
operaciones que este fork pretende poder cubrir», y se acaba de decidir que a estas
nunca llegará.

```
  347  operaciones en openapi.txt
 − 51  swarm
 − 47  escrituras de administración de Arcane
 −  4  escrituras de registro de contenedor (el modelo redactaría el secreto)
 −  1  builds/browse/download (redundante)
 ────
  244
```

Medido con el comando de `criterio-exposicion.md` §5 extendido con los dos conjuntos
nuevos. **Se reproduce, no se resta a mano.**

---

## 3. Las 17 tools

| Operación | Tool |
|---|---|
| `GET /container-registries` | `arcane_container_registry_list` |
| `GET /container-registries/{id}` | `arcane_container_registry_get` |
| `GET /container-registries/pull-usage` | `arcane_container_registry_pull_usage` |
| `POST /container-registries/{id}/test` | `arcane_container_registry_test` |
| `GET /templates/registries` | `arcane_template_registry_list` |
| `POST /templates/registries` | `arcane_template_registry_create` |
| `PUT /templates/registries/{id}` | `arcane_template_registry_update` |
| `DELETE /templates/registries/{id}` | `arcane_template_registry_delete` |
| `GET /environments/{id}/builds/browse` | `arcane_build_workspace_browse` |
| `GET .../builds/browse/content` | `arcane_build_workspace_read` |
| `POST .../builds/browse/mkdir` | `arcane_build_workspace_mkdir` |
| `POST .../builds/browse/upload` | `arcane_build_workspace_upload` |
| `DELETE .../builds/browse` | `arcane_build_workspace_delete` |
| `POST .../images/build` | `arcane_image_build` |
| `GET .../images/builds` | `arcane_image_build_list` |
| `GET .../images/builds/{buildId}` | `arcane_image_build_get` |
| `POST .../projects/{projectId}/build` | `arcane_project_build` |

`arcane_project_build` está sujeta a la puerta de la §8: si no hay sujeto sobre el que
ejercitarla, no se entrega.

**Ninguna cifra de cierre se predice aquí.** El plan de F4 predijo tres y las tres eran
falsas. Cobertura, drift, número de tools y de tests se miden al cerrar la fase.

---

## 4. Arquitectura

### 4.1 Cuatro ficheros de tools

```
src/tools/container-registries.ts   4 tools   GROUPS: "Container registries"
src/tools/template-registries.ts    4 tools   GROUPS: "Template registries"
src/tools/build-workspace.ts        5 tools   GROUPS: "Build workspace"
src/tools/image-builds.ts           4 tools   GROUPS: "Image builds"
```

Cuatro y no dos: son cuatro recursos distintos y `GROUPS` mapea fichero → epígrafe del
README, así que fusionarlos produce una tabla peor. `template-registries.ts` va aparte
de `templates.ts` porque `/templates/registries` es un catálogo de fuentes y
`/templates` son las plantillas.

Los cuatro se registran en `GROUPS` de `scripts/gen-tools-table.mjs` en la misma tarea
que los crea; el script aborta si no. Y las cuatro funciones `register…Tools` en
`src/index.ts`.

**Deuda declarada y no tocada:** `src/arcane-client.ts` está en 77 KB y ~2.300 líneas, y
F5 le suma cuatro clases de métodos. Partirlo es su propia tarea; mezclarlo con una fase
de funcionalidad sería un mal cambio. Candidato inmediatamente posterior a F5.

### 4.2 Tres huecos en el transporte

Ninguna tool se puede escribir sin taparlos antes.

**(a) `requestSinCuerpo()` — el 204.** `request()` termina en `response.json()`, que
revienta con un cuerpo vacío. Medido: `mkdir` y `DELETE` de `builds/browse` devuelven
**204 sin cuerpo**. El método nuevo se calca de `requestHead()`, con el mismo bloque de
extracción de `detail`, y una diferencia deliberada: **aquí un estado de error sí lanza**.
En `requestHead` no lanzaba porque «el sistema no está sano» es un dato válido; aquí «no
pude crear el directorio» es un fallo de la llamada.

**(b) `summarizeBuildStream()` — el NDJSON de build.** Medido: `Content-Type:
application/x-json-stream`, `Transfer-Encoding: chunked`, y el shape es **exactamente**
`ComposeStreamEvent`:

```
{"type":"activity","activityId":"87bd302f-…"}
{"log":"#1 [internal] load remote build context"}
…
{"done":true}
```

y en el fallo `{"error":"build context not found: stat /ruta: no such file or directory"}`.

`requestNdjson` y `extractStreamError` sirven tal cual. Lo que **no** sirve es
`summarizeComposeStream`: une *todos* los logs con `" | "` en un solo `message`. Un
`compose up` produce unas líneas; una build produce cientos, sin cota. Sería el problema
de tamaño de `scan_result` por la puerta de atrás. El summarizer nuevo vive en el mismo
fichero, **comparte `extractStreamError`**, expone el `activityId` del primer evento,
conserva la **cola** del log y dice cuántas líneas descartó.
`summarizeComposeStream` no se toca: da servicio a cuatro endpoints que funcionan.

**Trampa que el diseño debe absorber: el endpoint devuelve HTTP 200 aunque la build
falle.** El fracaso solo vive dentro del stream. Es la clase de bug de
`arcane_project_redeploy`, y hay test que lo demuestra.

**(c) La lectura en base64.** `builds/browse/content` devuelve `{content, mimeType}` con
`content` en base64. Se decodifica. **Solo se vuelca si el `mimeType` empieza por `text/` o es uno de
`application/json`, `application/yaml`, `application/x-yaml` o `application/xml`**; en
cualquier otro caso se dicen `mimeType` y tamaño y se para. Meter un binario en base64 en el contexto del modelo
no ayuda a nadie.

### 4.3 Los identificadores en ruta

F5 mete cuatro: el `{id}` de registros de contenedor, el `{id}` de registros de
plantillas, `{buildId}` y `{projectId}`.

**Los cuatro llevan `encodeURIComponent`, no `segmentoDeRuta()`, y test de traversal.**
`segmentoDeRuta()` existe solo porque el `sha256:` de una imagen tiene que viajar con los
dos puntos crudos (F4 §5.1). Ninguno de estos cuatro es un id de imagen: son UUID. Dejar
pasar `:` en ellos no aporta nada y abre superficie, así que se usa el codificador más
estricto, que además es el que el fork ya aplica a `envId` en todas partes.

El `path` de `builds/browse` **no** es un segmento: viaja como parámetro de query. Se
construye con `URLSearchParams` y el test asierta la query literal completa.

---

## 5. Los dos recortes de salida

### 5.1 `buildArgs` enmascarado, en el cliente

**Los build args se persisten en claro y los devuelven las dos lecturas.** Medido:
lanzada una build con `buildArgs: {"SECRETO_SONDA":"SENTINELA-BUILDARG-F5"}`, el valor
aparece íntegro en `GET /images/builds` y en `GET /images/builds/{buildId}`. Los build
args llevan tokens de rutina (`NPM_TOKEN`, `GITHUB_TOKEN`).

No hay precedente en el fork para tragárselo: el detalle de contenedor **no contiene
`Env` en ningún sitio**; este fork no expone hoy ninguna variable de entorno de terceros.

**Se enmascara en el cliente, no en la capa de tool.** Una sola función, aplicada por
`list()` y por `get()`: conserva las claves, sustituye los valores por
`<hidden by arcane-mcp>`. En la capa de tool, una segunda tool futura sobre el mismo
endpoint reintroduciría la fuga sin que nada fallara — que es exactamente cómo se
desplegó rota `arcane_image_update_check` en F3, por una rama que nadie ejercitó.

La salida lleva una línea en prosa diciendo que están ocultos: sin ella, un modelo
reportará que el valor del build arg es literalmente esa cadena.

**Y `output` no se enmascara, y se dice.** Un log de build contiene todo lo que la build
imprimió: la sonda hizo `RUN echo sonda-f5` y el log guardado contiene `#5 0.657
sonda-f5`. No se puede enmascarar un log libre sin destruir aquello para lo que sirve. La
descripción de la tool dice sin rodeos que se devuelve tal cual. **No se finge una
garantía que no existe** — es la lección de F4 §5.3 aplicada por adelantado.

### 5.2 `output` recortado por la cola

Medido: 1,9 KB en una build trivial, sin cota en una real. Se conservan las **últimas 100
líneas** y se antepone en prosa cuántas se descartaron, más el `outputTruncated` que ya
trae el servidor — mismo trato que `fileTreeTruncated` en `arcane_volume_browse`. La cola
y no la cabeza porque en una build fallida el error está al final.

**El listado hoy NO trae `output`** (medido), así que no hay nada que recortar ahí. Se
asierta en un test, para que si un día la API empieza a incluirlo no se vuelquen veinte
logs de build sin que nada avise.

---

## 6. Fidelidad de los tipos: dónde el spec miente

**El listado de `builds/browse` contradice `openapi.txt`.** Las entradas reales traen
`{modTime, name, path, mode, size, isDirectory, isSymlink}`: **faltan `relativePath` y
`editable`**, que el spec declara obligatorios, y la respuesta se identifica como
`BaseApiResponseListVolumeFileEntry`, no `WorkspaceFileEntry`.

**El tipo sigue a la realidad**, con `relativePath` y `editable` opcionales, y se
documenta por qué en el propio tipo: la auditoría de drift lo marcará contra el spec y el
siguiente que lo lea querrá «arreglarlo».

Los tipos nuevos se añaden al `MAP` de `scripts/audit-schema-drift.mjs`, y se demuestra
que la auditoría los vigila mutando uno para que aparezca `FALTA-EN-TS-REQUERIDO` — como
se hizo en F4 con `ScannerStatus`.

Dos observaciones más, sin acción en F5, para el balance:

- `registryType` solo admite `generic` y `ecr`. El spec lo declara `string` libre; el
  valor lo revela un 400.
- Los listados de `container-registries` y de `images/builds` devuelven
  `grandTotalItems: 0` con `totalItems` distinto de cero. Es incoherente y es candidato a
  issue upstream.
- `ImageBuildRecord` anota `environmentId: "0"` aunque la llamada sea a otro entorno: el
  agente registra su id local. Un modelo que filtre por ese campo se equivocará, así que
  la descripción de la tool lo advierte.

---

## 7. Verificación

### 7.1 La regla dura

Ninguna tool se da por terminada sin **test unitario con `fetch` mockeado** y
**comprobación e2e contra la instancia real**. Las mutantes, con sujeto inocuo.

Tres reglas que este proyecto ya ha pagado:

- **Dos tests por parámetro opcional**, uno con él y otro sin él, asertando la **URL
  literal completa**. `toHaveBeenCalledWith` considera iguales una clave ausente y una
  clave con valor `undefined`, así que enumerar `sort: undefined` no comprueba nada
  (F4 §5.4).
- **Fixtures que el percent-encoding cambie.** Nada de `ign-1`. Los `path` viajan como
  query, así que se asierta la query construida, no solo la ruta.
- **Falsabilidad demostrada.** Cada revisor de tarea muta el código y enseña que el test
  cae. Un test que solo comprueba que algo «no explota» o que un campo existe no cuenta.

### 7.2 Siembra: cuatro problemas distintos

**(a) `container-registries` está a cero y no exponemos `create`.** La suite siembra por
`fetch` directo en `beforeAll`, con sujeto inocuo: URL `arcane-mcp-e2e.invalid` (nunca
resuelve), `enabled: false`, descripción que dice de dónde salió. Que la siembra no pase
por las tools es coherente: la fase decidió que el modelo no escriba credenciales; la
suite no es el modelo.

La limpieza hereda el trato de F4: **avisa en rojo con el id y cómo borrarlo a mano, sin
tumbar la suite.**

El e2e de `test` no comprueba que «no explota»: asierta `isError: true` y que el mensaje
nombre el host. Medido, literal: `Registry test failed: registry login failed: Error response from
daemon: Get "https://<host>/v2/": dial tcp: lookup <host>: no such host`.

**(b) `templates/registries` está a cero, pero su CRUD sí se expone**, así que la suite
se siembra con sus propias tools: crear → listar → actualizar → borrar. Autocontenida,
con URL `.invalid` para que Arcane no martillee un host ajeno.

**(c) El workspace de builds solo funciona en 1 de 6 entornos.** Medido: cinco dan
`500 mkdir /builds: permission denied`; solo `Zabbix` responde 200.

**No es el caso `swarm`**, donde eran 0 de 6 y la comprobación era imposible. Aquí hay
dónde ejercitarlo.

Pero cablear el id de `Zabbix` sería fabricar el defecto que ya tiene
`resolvers.e2e.ts` —un test acoplado al inventario vivo, que falla 2 de cada 12
corridas—. En su lugar: un helper descubre en `beforeAll` el primer entorno que responda
200, con `ARCANE_E2E_BUILD_ENV` para forzarlo. **Si no encuentra ninguno, falla; no
salta.** La regla dura dice que ninguna tool se entrega sin e2e, así que «no he podido
comprobarlo» es rojo, no verde, y un `skipped` es justo el disfraz que hay que evitar.

Como cinco de seis entornos van a dar 500, **el aviso de las tools dice lo observable**
—que el agente no puede crear `/builds`— **y no inventa el motivo**. Es la lección de
F4 §5.3, y esta tool la toca cinco veces de cada seis.

**(d) La build.** Sujeto medido hoy: `contextDir: /builds`, `dockerfileInline` con
`FROM alpine:3.19`, **4 segundos**. El e2e asierta el camino `{done:true}` y **también el
fallo**: un `contextDir` inexistente devuelve HTTP 200 con `{error}` dentro del stream, y
el test demuestra que eso produce `isError: true`.

Ojo con una afirmación fácil de escribir y falsa: **`load:false` no significa
«descarta»**. Medido: 20 → 21 imágenes, con la etiqueta creada. La imagen se borra al
final, avisando si no puede.

### 7.3 Residuos declarados

- **El historial de builds no se puede limpiar.** `GET /images/builds` es apéndice sin
  borrado. Cada corrida de la suite añade filas para siempre; con ~12 corridas por fase,
  ~24 filas permanentes. Para probar el enmascarado hace falta que alguna build lleve un
  build arg, así que se usa siempre el mismo par falso y estable
  —`ARCANE_MCP_E2E_ARG=valor-de-prueba-no-secreto`— para que lo acumulado sean filas
  idénticas e inocuas.
- **Tres filas de las sondas de hoy ya están ahí**, una con el centinela
  `SENTINELA-BUILDARG-F5`. Valor falso, inofensivo, e imborrable.
- **Zona no vista:** qué devuelven las tools de workspace cuando el agente **sí** puede
  crear `/builds` pero el directorio contiene una jerarquía profunda. Solo se ha visto
  vacío y con un directorio.

---

## 8. La puerta abierta: `arcane_project_build`

`POST /projects/{projectId}/build` necesita un proyecto con directivas `build:`.
**No está resuelto, y el spec no lo finge.**

Lo medido hasta ahora:

- El campo `hasBuildDirective` de `ProjectDetails` sale **`false` en los 22 proyectos** de
  los seis entornos.
- Pero **`docker-compose.yml` de este propio repositorio contiene `build: .`**, y ese
  repositorio *es* el proyecto `arcane-mcp` desplegado por GitOps. El campo contradice un
  fichero que se puede leer.
- `GET /projects/{id}/workspace/file` devuelve **403** con esta clave de API, así que el
  compose desplegado no se ha podido leer por la API para dirimirlo.

**Regla de decisión, para que esto no sea un TBD:**

1. Se resuelve la contradicción leyendo el compose desplegado por `ssh` a `vm-control`.
2. **Si existe algún proyecto con directiva `build:` que no sea `arcane-mcp`**, es el
   sujeto del e2e y la tool se entrega.
3. **Si el único es `arcane-mcp`, la tool NO se ejercita sobre él.** Construirlo recrea
   el contenedor que atiende este mismo canal MCP.
4. **Si no hay ninguno**, la tool queda **diferida, no excluida**, en
   `criterio-exposicion.md` §2.4: es exactamente la situación de `swarm` —sin e2e posible—
   pero reversible en cuanto exista un proyecto que la ejercite. F5 cierra con 16 tools y
   el denominador no cambia, porque una diferida sigue contando.

Y en los cuatro casos: **`hasBuildDirective` contradiciendo el compose es, o un bug del
upstream, o un campo que significa algo más estrecho de lo que su nombre dice.** Se
determina y se documenta; si es bug, se publica.

---

## 9. Ejecución de los e2e: fuera de Tailscale

Las corridas limpias de F4 costaron 22, 15 y 3 intentos. La causa está medida:

| Desde dónde | Peticiones | Fallos |
|---|---|---|
| El Mac, vía Tailscale | 60 | **10 (16,7 %)** |
| `vm-control` → `localhost:3552` | 60 | **0** |
| `vm-control` → `192.168.180.210:3552` | 60 | **0** |

`192.168.180.0/24` no está en la malla: lo anuncia el peer `firewall` (100.64.0.2) como
subnet router, y **`vm-control` no es nodo de Tailscale**, así que no hay atajo por IP
directa. La única forma de quitarse el salto es ejecutar desde dentro.

`scripts/e2e-remoto.sh` copia el árbol por `tar` sobre `ssh` (5,7 MB), instala con bun y
**ejecuta con node**, en contenedores sobre `vm-control` con `--network host` y
`ARCANE_BASE_URL=http://localhost:3552`. Sin tocar código: los helpers e2e ya leen esa
variable.

**Doce corridas de la suite actual: diez con 59 de 59, ~25-30 s cada una.**

Cuatro cosas que el script tiene que hacer y por qué:

1. `COPYFILE_DISABLE=1` y `--exclude='._*'`: el `tar` de macOS emite ficheros AppleDouble
   que vitest intenta transformar y reporta como ocho suites rotas.
2. **Instalar con bun, ejecutar con node.** Bajo el runtime de bun, `zod` no resuelve y
   `src/tools/gitops-syncs.ts` revienta al importar con
   `undefined is not an object (evaluating 'z.string')`. El fichero cae entero: la trampa
   del `skipped` con otra cara.
3. `node_modules` no se copia: el de macOS trae binarios de esbuild para darwin.
4. `chmod 600` sobre `.dev.vars`: el `tar` conserva el 0644 del Mac y ahí va la clave.

**La corrida no se reintenta si la suite llegó a ejecutarse.** Solo se reintenta cuando
`ssh` ni siquiera conectó — exit 255 sin ninguna línea de resumen de vitest. Un reintento
ciego convertiría el script en una máquina de esconder fallos reales.

**Consta que la clave de API pasa a vivir en `/root/arcane-mcp-e2e/.dev.vars` de
`vm-control`.**

### 9.1 Un defecto previo que el ruido tapaba

De doce ejecuciones, **dos fallaron el mismo y único test**:
`resolvers.e2e.ts:61`, «terminus-worker-1, el último contenedor ordenado por nombre».
El invariante se comprobó seis veces a mano contra la instancia: estable las seis.

Hipótesis **no demostrada**: el `beforeAll` de vulnerabilidades siembra un escaneo Trivy,
y `trivy` ordena después de `terminus`; un contenedor de escáner efímero rompería justo
esa aserción.

**No entra en F5.** Merece su propia pasada de depuración sistemática. Lo relevante es
que con un 16,7 % de caídas de red, un fallo intermitente del ~17 % se confundía con el
ruido.

---

## 10. Cierre de fase

Se mide, no se copia. Cada cifra del balance sale de un comando ejecutado en la sesión
de cierre:

| Qué | Con qué |
|---|---|
| Unitarios | `npm test` |
| Tipos | `npm run type-check` |
| Tools | `npm run gen-tools-table -- --check` |
| Drift | `node scripts/audit-schema-drift.mjs` |
| e2e | `scripts/e2e-remoto.sh`, contando los `✓` uno a uno |
| Cobertura | script AST temporal, reescrito y verificado antes de fiarse de su número |

**Documentación:**

- `criterio-exposicion.md`: motivo de exclusión nuevo (§2.1 de este spec), `download` en
  la familia de redundantes, denominador 244 con su comando.
- Un balance en `docs/balances/`, fechado el día del cierre, y su entrada en
  `docs/README.md`.
- `docs/desarrollo/anadir-una-tool.md` §5: el runner remoto.

**Revisión:** revisor por tarea **más revisión final de rama completa**, sin recortar. En
F4 el único hallazgo Critical —una inyección de ruta— lo cazó esa última, y ninguna de las
seis por tarea: la pregunta que lo destapa no existe desde el alcance de una tarea.

---

## 11. Referencias

- [Criterio de exposición](../../arquitectura/criterio-exposicion.md)
- [Cómo añadir una tool](../../desarrollo/anadir-una-tool.md)
- [Balance de F4](../../balances/2026-08-19-f4.md)
