# Balance de la coherencia de la superficie de listado

- **Fecha:** 2026-08-17
- **Punto de partida:** `ccabb12` — cierre de F2 en `main`
- **Punto de llegada:** `533477f` — 20 commits, 33 ficheros, +5.585 / −1.429
  (más el cierre de esta tarea)
- **Estado:** implementación completa; tests unitarios verificados en esta
  sesión de arreglo (228 passed). La suite e2e (36 tests) tuvo una corrida
  limpia durante la ronda de arreglos, pero no en la verificación final ni
  después — pendiente repetir la corrida contra la instancia estable (ver
  3.2). Pendiente además el merge a `main`, el push y la verificación del
  despliegue, que ejecuta el propietario del proyecto, no este agente

---

## 1. Resumen en una frase

Hay trece tools cuyo nombre acaba en `_list`; doce de ellas —todas menos
`arcane_job_list`, cuyo endpoint devuelve `{jobs:[...]}` y no el sobre
paginado— reciben de las once tareas de implementación un contrato de salida
uniforme (`{pagination, counts?, data}`) con `sort`, `order`, `start` y
`limit` reenviados de verdad al servidor. De paso, esas tareas corrigen
un bug de la propia API de Arcane 2.8.0 que hacía perder elementos al paginar
sin orden explícito, y sustituyen 80 `try/catch` repetidos (81 → 1, medido
con `git grep -c '} catch' -- 'src/tools/*.ts'`) por un único sobre de error
para las 81 tools — con cuatro defectos reales encontrados midiendo (no en el
encargo original) y un quinto endpoint con `counts` que el inventario del
plan no había contado.

## 2. Cifras medidas hoy

Todas las cifras de esta tabla salen de un comando ejecutado en esta sesión,
no del plan ni de informes previos. El comando exacto de cada una está en la
sección 3.

| Métrica | Comando | Resultado |
|---|---|---|
| Tests unitarios | `npm test` | **228 passed** (5 ficheros) |
| Tamaño de la suite e2e | `grep -rn "it(\|test(" src/__e2e__/*.e2e.ts \| wc -l` (confirmado por el propio resumen de vitest en cada intento) | **36 tests** — sin corrida limpia reciente contra la instancia real, ver nota en 3.2 |
| `tsc --noEmit` | `npm run type-check` | Limpio, sin salida |
| Tools registradas | `npm run gen-tools-table -- --check` | **81** (`OK: la tabla del README.md está al día`) |
| Drift de campos | `node scripts/audit-schema-drift.mjs` | 23 desalineaciones, **0 graves** (las 23 son `FALTA-EN-TS-OPCIONAL`) |
| Cobertura de operaciones método+ruta | script ad hoc con el compilador de TS (ver 3.3) | **78 de 347**, 0 ausentes — **sin cambio** respecto a F2 |

## 3. Cómo se midió cada cifra

### 3.1 Tests y verificación estática

```
npm test                                    → Test Files 5 passed (5); Tests 228 passed (228)
npm run type-check                          → sin salida (tsc limpio)
npm run gen-tools-table -- --check          → OK: la tabla del README.md está al día (81 tools).
node scripts/audit-schema-drift.mjs         → Total: 23 desalineaciones (0 graves: las 23 son FALTA-EN-TS-OPCIONAL)
```

### 3.2 Tests e2e: verificación pendiente de repetir con la instancia estable

```
set -a; . ./.dev.vars; set +a
ARCANE_BASE_URL=http://192.168.180.210:3552 npm run test:e2e -- --reporter=verbose
```

La suite tiene **36 tests**, contados con dos métodos independientes:
`grep -rn "it(\|test(" src/__e2e__/*.e2e.ts | wc -l` da 36, y el resumen de
vitest (`Tests ... (36)`) coincide en cada intento, limpio o no.

Durante la ronda de arreglos de esta misma tarea se consiguió una corrida
completamente limpia: **36 de 36 passed, 0 skipped**. Es la única corrida
limpia registrada hasta ahora.

En la revisión final de la rama y después, la instancia
(`192.168.180.210:3552`) se degradó: en más de 30 intentos no se volvió a
conseguir una corrida limpia; los mejores intentos dieron **35 de 36**. Ni
un solo fallo fue de aserción — todos son `TypeError: fetch failed` /
`connect ECONNREFUSED`. Las pocas líneas que aparecen como `AssertionError`
son literalmente `expected TypeError: fetch failed to be an instance of
ArcaneApiError`: la misma caída de red golpeando un test que esperaba un
error de API, no una regresión de comportamiento. Se descartó que fuera
saturación por concurrencia propia de la suite: serializando con
`--no-file-parallelism` falla igual (la propia `vitest.e2e.config.ts` ya
corre con `fileParallelism: false`), y sondas sueltas con `curl` contra la
instancia responden `200` con normalidad entre fallos. Es relevante que el
propietario del proyecto está trabajando sobre esa misma instancia en
paralelo en otra sesión, lo que podría explicar reinicios del servicio.

Como parte de esta tarea de arreglo se relanzó la suite una vez más ahora
(mismo comando de arriba): **28 passed, 5 failed, 3 skipped (36)**. Los 5
fallos son `TypeError: fetch failed` / `connect ECONNREFUSED` o su efecto en
cascada (`no such volume` sobre un volumen que no llegó a crearse porque el
fetch anterior falló). Los 3 `skipped` son los tests de
`stack-lifecycle.e2e.ts`, cuyo fichero completo abortó al importar por el
mismo `ECONNREFUSED` — exactamente el caso que la regla del proyecto señala:
**un fichero e2e que aborta al importar sale como `skipped`, no como fallo,
y `skipped` no es verde**
(`docs/superpowers/plans/2026-08-17-coherencia-superficie-listado.md:19`).
El patrón descrito arriba sigue vigente en el momento de escribir esto.

**Conclusión: esto es una verificación pendiente de repetir con la instancia
estable, no un resultado en verde.** El diseño de los 36 tests no está en
duda —cuando corren, no fallan por aserción—, pero no hay, a día de hoy, una
corrida limpia reciente que lo confirme end-to-end.

### 3.3 Cobertura de operaciones método+ruta

El script de F2 (sección 3.2 de `docs/balances/2026-08-16-f2.md`) nunca se
commiteó — era temporal, igual que esta vez. Se reescribió desde cero
siguiendo la misma descripción algorítmica (AST de TypeScript, no regex,
porque las plantillas anidan backticks) y se ejecutó **desde dentro del
repo** (colocado temporalmente en `scripts/_tmp-audit-route-coverage.mjs`
para que `import ts from "typescript"` resolviera contra `node_modules`, y
borrado después de medir — no queda en el árbol de trabajo).

La primera versión del script daba **76 de 347, con 3 ausentes**:

```
POST POST
GET {}
DELETE /environments/{}/projects/{}/destroy?removeFiles={}&removeVolumes={}
```

Los tres eran bugs del propio script de medición, no de `arcane-client.ts`:

1. `this.client.requestNdjson<T>(method, path, body?)` recibe el método HTTP
   como **primer** argumento, igual que `request()`; el script asumía que el
   primer argumento era siempre la ruta y que `requestNdjson` era siempre
   `POST` — de ahí `"POST POST"` (tomaba el string `"POST"` como si fuera la
   ruta).
2. `EventsMethods.list()` usa `const base = opts?.environmentId ? \`...\` :
   "/events"`: la rama `whenTrue` es una plantilla con interpolación, no un
   string literal plano. El resolutor original solo aceptaba ternarios con
   **las dos** ramas como string literal; al no encajar, `base` caía al caso
   genérico y se sustituía por `"{}"` entero — de ahí `"GET {}"`. Se corrigió
   resolviendo cada rama del ternario de forma recursiva con la misma
   función que resuelve rutas completas.
3. `ProjectAdditionalMethods.destroy()` construye la query string a mano
   (`.../destroy?removeFiles=${a}&removeVolumes=${b}`), sin pasar por el
   patrón `` `${query ? `?${query}` : ""}` `` que el resto del cliente usa.
   El script solo cortaba la ruta en ese patrón concreto; se añadió un
   recorte genérico por el primer `?` literal del resultado, porque los
   paths del spec nunca llevan query string.

Con los tres arreglos, el resultado es:

```
Llamadas this.client.<request*|fetchFn>() encontradas: 81
Combinaciones metodo+ruta unicas usadas por el cliente: 78
Operaciones totales en el spec (openapi.txt): 347 (273 paths)
No resueltas estaticamente (revisar a mano): 0
Ausentes en el spec: 0

Cobertura: 78 de 347 operaciones del spec, 0 ausentes.
```

**78, igual que en F2, tal y como predecía el brief** ("este trabajo no
añade rutas nuevas, solo parámetros a rutas existentes"). No hizo falta
investigar ninguna discrepancia porque no la hubo.

## 4. Lo entregado

Las once tareas de implementación, en orden:

| Tarea | Qué añade | Commits |
|---|---|---|
| 1 | `withErrors`/`listResponse`/`textResponse` (`src/tools/respond.ts`) + `NON_TOOL_FILES` en el generador de la tabla | `802e12e` |
| 2 | `collectAllPages` (`src/tools/paging.ts`), `PAGE_SIZE=200`, `MAX_PAGES=10` | `e187a92` |
| 3 | `PaginatedResponseWithCounts` + `ContainerStatusCounts`/`VolumeUsageCounts`/`NetworkUsageCounts`, las tres en el MAP de la auditoría de drift | `f2f9500` |
| 4 | `appendListParams` + `ContainerListOptions`/`ImageListOptions`/`VolumeListOptions`/`NetworkListOptions` y los cuatro `list()` del cliente | `1a4d79b`, `d134c79` |
| 5 | Los cinco `list()` parciales del cliente (stacks, templates, activities, git-repositories, gitops-syncs...) migrados a `appendListParams` | `d134c79` |
| 6 | e2e de invariantes de paginación (`src/__e2e__/paginacion.e2e.ts`) + `collectAllPages` exige `sort` como primer parámetro posicional + `GitopsSyncCounts`, el cuarto endpoint con `counts` | `40c5bf6`, `9509eae`, `4e2c507`, `bad4148` |
| 7 | Las 4 tools de listado de Docker (`containers`, `images`, `volumes`, `networks`) con `LIST_PARAMS`, `withErrors`, `listResponse` | `e9bfb00` |
| 8 | Las 5 tools de listado parciales completas, retirados `.max(100)` y `.default(50)` | `afd218a` |
| 9 | Los 4 listados restantes (`activities`, `events`, `jobs`, `system` — donde aplica) con el mismo contrato + tests para `gitops_sync_list` y `volume_backup_list` (huecos sin cubrir del Step 1 original) | `9c64d32`, `f61becf` |
| 10 | Helper `resolveIdByName`, los cuatro resolvers nombre→id dejan de concluir "no existe" sobre una página incompleta, `src/__e2e__/resolvers.e2e.ts` (5 tests, cobertura e2e que no existía) | `f5086d5`, `2f6ffe2`, `bb2e1e3`, `12e1a86` |
| 11 | 44 `try/catch` eliminados en 11 ficheros (`containers-additional.ts`, `containers.ts`, `environments.ts`, `images.ts`, `networks.ts`, `projects-additional.ts`, `stacks.ts`, `system.ts`, `templates.ts`, `volume-files.ts`, `volumes.ts`) — consolidación final del sobre de error único (`withErrors`) para las 81 tools | `533477f` |

El total de `try/catch` eliminados en toda la rama es 80 (81 → 1 en
`src/tools/*.ts`, medido con `git grep -c '} catch'`), repartidos entre
varios commits a medida que cada tool se migraba a `withErrors`; `533477f`
es solo el commit de cierre que consolidó los 11 ficheros que aún no lo
usaban (44 de los 80). La fila 9 de esta tabla (`9c64d32`) ya había quitado
los 4 de `jobs.ts` como parte de darle el contrato de salida común; los de
`system.ts` (5) siguieron intactos hasta `533477f`, y `activities.ts` y
`events.ts` no tenían ninguno en ninguno de los dos puntos — no 25, y no
atribuible a un único commit.

Cuentas de partida verificadas: 152 tests / 19 e2e / 81 tools antes de la
Tarea 1 → **228 tests / 36 e2e (tamaño de la suite; ver 3.2 sobre el estado
de la corrida) / 81 tools** hoy (81 tools no cambia: este trabajo modifica
tools existentes, no añade dominios nuevos).

## 5. Lo que apareció y no estaba en el plan

### 5.1 El bug de paginación de la propia API de Arcane

Paginar `GET /environments/0/volumes` con `start` **sin** `sort` explícito
no garantiza un orden estable entre peticiones: recorrer la colección entera
en páginas de 5 (32 elementos, 7 páginas) recoge siempre 32 filas pero solo
entre **19 y 29 nombres únicos** según la ejecución — el mismo recorrido
repetido contra una colección sin cambios pierde o repite elementos
distintos cada vez. Con `sort=name&order=asc`, 32 de 32, de forma estable en
todas las pasadas medidas.

Cronología de la medición:
- Task 6 (2026-08-16, con reintentos para descartar ruido de red): 19, 20,
  21, 22, 29 únicos de 32, en cinco ejecuciones separadas.
- Esta tarea (2026-08-17, siete ejecuciones más como parte de correr la
  suite e2e completa): 27, 19, 20, 23, 27, 22, 24 únicos de 32 — nunca
  menos de 32 filas recogidas.

Confirmado también, con menor página y por tanto más difícil de disparar,
en `containers`, `projects` y `gitops-syncs`. No es un fallo de las Tareas
4/5 (el cliente envía `start` correctamente): es la API de Arcane 2.8.0.
`collectAllPages` (Tarea 2, ya commiteada antes de descubrirse el bug) tuvo
que endurecerse en la Tarea 6 para exigir `sort` como primer parámetro
posicional obligatorio — imposible de olvidar, verificado con
`@ts-expect-error` revirtiendo el código y viendo fallar el `type-check` — y
es el motivo real por el que los cuatro resolvers nombre→id de la Tarea 10
pasan `sort=name`: sin eso, podrían haber concluido "no existe" sobre un
recurso que sí existe, la conclusión falsa exacta que todo este trabajo
existe para eliminar.

**Se redacta el issue para el upstream** en
[`docs/auditorias/2026-08-17-paginacion-sin-sort-upstream.md`](../auditorias/2026-08-17-paginacion-sin-sort-upstream.md),
listo para copiar y pegar. **No se publica**: lo hace el propietario del
proyecto.

### 5.2 Cuatro defectos que la sesión de diseño encontró midiendo

Ninguno estaba en el encargo inicial; los cuatro salieron de medir contra
`openapi.txt` y la instancia real antes de escribir el plan:

1. El `limit` que las tools `arcane_stack_list` y `arcane_template_list`
   recibían pero **descartaban** antes de llamar al cliente — la Tarea 8 lo
   corrigió junto con el resto de la superficie parcial.
2. `resolveGitOpsSyncId`, el cuarto resolver nombre→id, que nadie había
   contado como tal hasta que se auditó `resolve.ts` — la Tarea 10 lo trata
   igual que a los otros tres.
3. El objeto `counts` (`ContainerStatusCounts`, `VolumeUsageCounts`,
   `NetworkUsageCounts`, `GitopsSyncCounts`) que el cliente recibía del
   servidor y **tiraba entero** en vez de devolverlo a la tool — las Tareas
   3 y 6 lo tipan y lo propagan.
4. Que `ListOptionsWithSort` **no** era un tipo aspiracional sin uso real:
   los tres métodos del cliente que lo usaban directamente (verificado
   contra el código, no contra el nombre del tipo) sí enviaban
   `sort`/`order`/`start`; los que no lo usaban directamente heredaban el
   comportamiento de todas formas a través de `appendListParams`. Esto
   evitó que la Tarea 4 duplicara lógica que ya existía.

### 5.3 Un quinto endpoint con `counts`, no un cuarto

El inventario del plan contaba tres endpoints con objeto `counts`
(containers, volumes, networks). La medición contra `openapi.txt` durante la
Tarea 6 encontró un **cuarto**: `gitops-syncs`, con `GitopsSyncCounts`
declarado `required` en el spec. Corregido: son cuatro, no tres, y los
cuatro están en el MAP de `audit-schema-drift.mjs` y se propagan en
`gitOpsSyncs.list()`.

### 5.4 Era falso que los e2e existentes ejercitaran los resolvers

Verificado con `git log`/lectura de código, no dado por bueno: ni
`stack-lifecycle.e2e.ts` ni `volume-workspace.e2e.ts` importan
`resolveStackId` ni `resolveContainerId` — el primero hace su propio
`stacks.list().find()`, el segundo pasa el nombre directamente como
parámetro de ruta. Los cuatro resolvers **no tenían cobertura e2e ninguna**
hasta que la Tarea 10 creó `src/__e2e__/resolvers.e2e.ts` (5 tests, incluido
uno que comprueba que un nombre inexistente da "no existe" y nunca "among
the first").

### 5.5 El `.max(100)` de seis tools era invención del fork

`openapi.txt` no declara `maximum` para el parámetro `limit` en ningún
endpoint de listado, y está medido en la Tarea 6/8 que el servidor acepta
`limit=1000` sin rechazarlo. El `.max(100)` (y el `.default(50)` que lo
acompañaba en algunas tools) no venía del spec: la Tarea 8 los retira.

### 5.6 Dos defectos del propio plan, cazados por implementadores y revisores

1. El snippet de test que el brief de la Tarea 7 daba como ejemplo
   construía `new ArcaneApiError("boom", 500)` — argumentos invertidos; el
   constructor real es `(status, message)`. El implementador lo corrigió y
   el revisor lo confirmó contra el constructor antes de aprobar.
2. El Step 1 del brief de la Tarea 9 solo pedía tests para
   `git_repository_list` y `job_list`; `gitops_sync_list` y
   `volume_backup_list` se quedaban **sin ningún test**, incluida la
   propagación de `counts` de gitops — el mismo patrón de fallo silencioso
   que motiva todo este trabajo, en pequeño, dentro del propio plan que lo
   corrige. El revisor lo marcó "Important" y se cerró en el mismo ciclo
   (`f61becf`).

### 5.7 La inferencia de tipos de `withErrors` se verificó compilando, con prueba falsable, antes de escribir el plan

Antes de comprometerse al diseño de la Tarea 1, se comprobó que la
inferencia de tipos de un handler envuelto por `withErrors` a través de
`server.tool()` sobrevive bajo `strict`: se escribió un handler con un campo
inexistente dentro del cuerpo envuelto y se confirmó que `tsc` lo rechaza en
tiempo de compilación (no en tiempo de ejecución). Sin esa comprobación
previa, la Tarea 1 y las Tareas 7-9 (que dependen de que el tipo del
resultado siga siendo inferible tras pasar por el wrapper) habrían
necesitado otro diseño si la inferencia se hubiera perdido.

## 6. Qué queda pendiente

- **Steps 6, 7 y 8 de este mismo encargo** (merge deliberado a `main`, push,
  y verificación del despliegue dentro del contenedor) quedan **fuera del
  alcance de este agente por decisión explícita**: los ejecuta el propietario
  del proyecto.
- **El issue del upstream sobre la paginación sin `sort` está redactado pero
  sin publicar** (sección 5.1) — lo publica el propietario, no este agente.
- Deudas menores heredadas de tareas anteriores de esta misma rama. Dos de
  las tres que quedaron sin tocar en la tarea de cierre se arreglaron en la
  ronda de arreglos de la revisión final:
  - ~~`src/arcane-client.ts:265`, el comentario de `PaginatedResponseWithCounts`
    todavía dice "los tres schemas que lo usan"~~ — corregido: ya dice
    "cuatro".
  - ~~El test de `arcane_environment_list` (Tarea 8) solo comprueba el sobre
    de salida... no verifica que `sort`/`order`/`start`/`type` se
    reenvíen~~ — corregido: las doce tools de listado paginadas (las trece
    que terminan en `_list` menos `arcane_job_list`, que no reenvía estos
    parámetros — ver sección 1) tienen ahora al menos un test que falla si dejan de
    reenviar `sort`/`order`/`start` con valores reales, y otro que falla si
    dejan de usar `listResponse` (ver la revisión final de la rama;
    verificado contando los tests `"... pasa sort, order y start con
    valores reales"` en `src/__tests__/tools.test.ts`, uno por cada una de
    las doce). Se encontró además que el mismo problema afectaba a
    `container`, `image`, `network`, `stack`, `template` y `git_repository`,
    no solo a `environment`: las aserciones que los cubrían comparaban
    contra `undefined`, que `toHaveBeenCalledWith` considera igual a una
    clave ausente, así que no cazaban una regresión real.
  - El cap de "Available containers" en los mensajes de resolución cuenta
    nombres, no contenedores (un contenedor puede repetir nombre entre
    proyectos) — literal del diseño, no un defecto. Sigue sin tocar.
- **`arcane_volume_browse` puede devolver una colección recortada sin
  avisarlo** (`src/tools/volume-files.ts:10`): su descripción promete "the
  full file tree", pero el spec declara `fileTreeTruncated` como `required`
  en la respuesta y la tool vuelca el JSON tal cual, sin ninguna línea en
  prosa que señale el campo cuando viene `true`. Es el único camino que esta
  revisión encontró por el que el modelo puede recibir una colección
  recortada sin que nada se lo advierta — la misma conclusión falsa por
  omisión que el resto de esta rama corrige en las tools de listado
  paginadas. Queda **fuera del alcance de esta rama** (no es una tool de
  listado paginado; es la única superficie de árbol de ficheros del
  proyecto) y sin arreglar a propósito.
- No se ha vuelto a capturar el stream real de `/pull` con imágenes de
  registro grandes ni otros escenarios de red distintos a los ya
  documentados en F0/F1; fuera del alcance de esta tarea, que es solo de
  listado y documentación.
- La cobertura del `.max`/`.default` retirado en la Tarea 8 no se ha vuelto
  a intentar disparar contra la instancia real con `limit=1000` en esta
  tarea de cierre (ya se hizo y quedó documentado en las Tareas 6 y 8); no
  se repite aquí porque no es una cifra que este balance publique.
- **La suite e2e (36 tests) no tiene una corrida limpia reciente contra la
  instancia real** (ver 3.2): la última fue durante la ronda de arreglos, no
  en la verificación final ni después, por la degradación de
  `192.168.180.210:3552`. Es una verificación pendiente de repetir cuando la
  instancia esté estable, no un defecto de diseño de los tests — ninguno de
  los fallos observados es de aserción.

Ninguna de estas es bloqueante para el diseño: los 228 tests unitarios están
en verde y ninguno de los 36 tests e2e ha fallado nunca por aserción. Pero la
superficie de listado no tiene, a día de hoy, una verificación e2e completa
y limpia contra la instancia real — eso queda pendiente, no confirmado.

## 7. Referencias

- [Spec de la coherencia de la superficie de listado](../superpowers/specs/2026-08-17-coherencia-superficie-listado-design.md)
- [Plan de la coherencia de la superficie de listado](../superpowers/plans/2026-08-17-coherencia-superficie-listado.md)
- [Issue redactado para el upstream (paginación sin `sort`)](../auditorias/2026-08-17-paginacion-sin-sort-upstream.md)
- [Balance de F2](2026-08-16-f2.md)
- [Balance de F0 + F1](2026-08-16-f0-f1.md)
- [Registro completo de la sesión](../../.superpowers/sdd/progress.md)
