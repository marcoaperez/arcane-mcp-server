# Balance de la coherencia de la superficie de listado

- **Fecha:** 2026-08-17
- **Punto de partida:** `ccabb12` — cierre de F2 en `main`
- **Punto de llegada:** `533477f` — 20 commits, 33 ficheros, +5.585 / −1.429
  (más el cierre de esta tarea)
- **Estado:** implementación completa y verificada contra la instancia real;
  pendiente el merge a `main`, el push y la verificación del despliegue, que
  ejecuta el propietario del proyecto, no este agente

---

## 1. Resumen en una frase

Las once tareas de implementación dan a las nueve tools de listado un
contrato de salida uniforme (`{pagination, counts?, data}`) con `sort`,
`order`, `start` y `limit` reenviados de verdad al servidor, corrigen de paso
un bug de la propia API de Arcane 2.8.0 que hacía perder elementos al paginar
sin orden explícito, y sustituyen 25 `try/catch` repetidos por un único
sobre de error para las 81 tools — con cuatro defectos reales encontrados
midiendo (no en el encargo original) y un quinto endpoint con `counts` que
el inventario del plan no había contado.

## 2. Cifras medidas hoy

Todas las cifras de esta tabla salen de un comando ejecutado en esta sesión,
no del plan ni de informes previos. El comando exacto de cada una está en la
sección 3.

| Métrica | Comando | Resultado |
|---|---|---|
| Tests unitarios | `npm test` | **214 passed** (5 ficheros) |
| Tests e2e (verbose, contra la instancia real) | `npm run test:e2e -- --reporter=verbose` | **32 passed**, 0 skipped, contados uno a uno |
| `tsc --noEmit` | `npm run type-check` | Limpio, sin salida |
| Tools registradas | `npm run gen-tools-table -- --check` | **81** (`OK: la tabla del README.md está al día`) |
| Drift de campos | `node scripts/audit-schema-drift.mjs` | 23 desalineaciones, **0 graves** (las 23 son `FALTA-EN-TS-OPCIONAL`) |
| Cobertura de operaciones método+ruta | script ad hoc con el compilador de TS (ver 3.2) | **78 de 347**, 0 ausentes — **sin cambio** respecto a F2 |

## 3. Cómo se midió cada cifra

### 3.1 Tests y verificación estática

```
npm test                                    → Test Files 5 passed (5); Tests 214 passed (214)
npm run type-check                          → sin salida (tsc limpio)
npm run gen-tools-table -- --check          → OK: la tabla del README.md está al día (81 tools).
node scripts/audit-schema-drift.mjs         → Total: 23 desalineaciones (0 graves: las 23 son FALTA-EN-TS-OPCIONAL)
```

### 3.2 Tests e2e: 5 intentos con `ECONNREFUSED` antes del run limpio

```
set -a; . ./.dev.vars; set +a
ARCANE_BASE_URL=http://192.168.180.210:3552 npm run test:e2e -- --reporter=verbose
```

La instancia tiene los cortes de red intermitentes que ya avisaba el brief.
De siete ejecuciones completas en esta sesión, las seis primeras tuvieron
entre 1 y 3 tests con `TypeError: fetch failed / ECONNREFUSED` — nunca un
fallo de aserción, siempre el mismo `connect ECONNREFUSED
192.168.180.210:3552` en un test distinto cada vez. La séptima ejecución dio
**Test Files 5 passed (5); Tests 32 passed (32)**, contada línea a línea con
`grep -c "✓"` sobre la salida cruda (32, coincide con el recuento agregado
de vitest) y verificado que no hay ninguna línea `skip`. Los 32 nombres de
test son únicos: no hay duplicados que inflen el recuento.

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
| 11 | 25 `try/catch` eliminados de `activities.ts`, `events.ts`, `jobs.ts`, `system.ts` → un solo sobre de error (`withErrors`) para las 81 tools | `533477f` |

Cuentas de partida verificadas: 152 tests / 19 e2e / 81 tools antes de la
Tarea 1 → **214 tests / 32 e2e / 81 tools** hoy (81 tools no cambia: este
trabajo modifica tools existentes, no añade dominios nuevos).

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
- Deudas menores heredadas de tareas anteriores de esta misma rama, sin
  tocar en esta tarea de cierre porque no formaban parte de su alcance:
  - `src/arcane-client.ts:265`, el comentario de `PaginatedResponseWithCounts`
    todavía dice "los tres schemas que lo usan"; ya son cuatro
    (`GitopsSyncCounts` incluido) — comentario desactualizado, sin efecto en
    comportamiento.
  - El test de `arcane_environment_list` (Tarea 8) solo comprueba el sobre
    de salida, a diferencia de sus hermanos no verifica que
    `sort`/`order`/`start`/`type` se reenvíen — no hay bug (el revisor lo
    comprobó leyendo el código), pero es más débil ante regresiones futuras.
  - El cap de "Available containers" en los mensajes de resolución cuenta
    nombres, no contenedores (un contenedor puede repetir nombre entre
    proyectos) — literal del diseño, no un defecto.
- No se ha vuelto a capturar el stream real de `/pull` con imágenes de
  registro grandes ni otros escenarios de red distintos a los ya
  documentados en F0/F1; fuera del alcance de esta tarea, que es solo de
  listado y documentación.
- La cobertura del `.max`/`.default` retirado en la Tarea 8 no se ha vuelto
  a intentar disparar contra la instancia real con `limit=1000` en esta
  tarea de cierre (ya se hizo y quedó documentado en las Tareas 6 y 8); no
  se repite aquí porque no es una cifra que este balance publique.

Ninguna de estas es bloqueante: la superficie de listado funciona
correctamente contra la instancia real tal y como está, con 214 tests
unitarios y 32 e2e en verde.

## 7. Referencias

- [Spec de la coherencia de la superficie de listado](../superpowers/specs/2026-08-17-coherencia-superficie-listado-design.md)
- [Plan de la coherencia de la superficie de listado](../superpowers/plans/2026-08-17-coherencia-superficie-listado.md)
- [Issue redactado para el upstream (paginación sin `sort`)](../auditorias/2026-08-17-paginacion-sin-sort-upstream.md)
- [Balance de F2](2026-08-16-f2.md)
- [Balance de F0 + F1](2026-08-16-f0-f1.md)
- [Registro completo de la sesión](../../.superpowers/sdd/progress.md)
