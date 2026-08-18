# Issue para el upstream: paginación sin `sort` pierde/repite elementos

- **Fecha:** 2026-08-17
- **Estado:** **publicado** como [#3645](https://github.com/getarcaneapp/arcane/issues/3645) el 2026-08-17
- **Repositorio destino:** [getarcaneapp/arcane](https://github.com/getarcaneapp/arcane)

> **Corrección aplicada antes de publicar (2026-08-17).** Al verificar los pasos de
> reproducción contra la instancia real, el alcance que afirmaba el borrador resultó
> ser incorrecto. Seis recorridos completos por endpoint, con reintentos y
> descartando las pasadas con alguna página irrecuperable (0 descartes):
>
> | endpoint | decía el borrador | medido |
> | --- | --- | --- |
> | `volumes` (32 items) | falla | **falla**, 18–28 únicos de 32 |
> | `networks` (13 items) | no lo mencionaba | **falla más fuerte**, 7–10 de 13 |
> | `containers` (16) | falla | 16/16 en las 6 pasadas |
> | `projects` (9) | falla | 9/9 en las 6 pasadas |
> | `gitops-syncs` (8) | falla | 8/8 en las 6 pasadas |
> | `images` (18) | no lo mencionaba | 18/18 en las 6 pasadas |
>
> Se usaron páginas de 2 para maximizar el número de páginas (4–9 por endpoint) y
> darle la máxima oportunidad de reproducirse. El texto publicado afirma sólo lo
> reproducido, añade `networks` y describe la metodología de reintentos. El texto
> en inglés de más abajo es el del **borrador original**, no el publicado.
- **Sería el tercer issue** que este fork devuelve al upstream, tras:
  - [#3606](https://github.com/getarcaneapp/arcane/issues/3606) — redeploy de GitOps roto (ya reportado por otra persona, cerrado)
  - [#3638](https://github.com/getarcaneapp/arcane/issues/3638) — `HEAD /environments/{id}/system/health` devuelve 500 siempre

El texto de abajo, entre las líneas `---`, está en inglés (idioma del repositorio
upstream) y listo para copiar y pegar tal cual en un issue nuevo de GitHub. Nadie
de este trabajo lo ha publicado ni ha abierto el issue.

---

**Title:** Paginating with `start` but without an explicit `sort` returns a non-deterministic, incomplete page set

**Affected version:** 2.8.0 (confirmed against the OpenAPI spec served by the instance, `info.version: "2.8.0"`)

**Affected endpoints (confirmed):** `GET /api/environments/{id}/volumes`, and reproduced with a smaller effect on `GET /api/environments/{id}/containers`, `GET /api/environments/{id}/projects`, `GET /api/environments/{id}/gitops-syncs` — likely every paginated list endpoint that accepts `start`/`limit`, since they appear to share the same pagination implementation.

### Summary

When paging through a collection using `start`/`limit` **without** passing an explicit `sort` (and `order`), consecutive pages are not guaranteed to reflect a stable ordering of the underlying collection. Walking every page of a collection this way returns the *correct total row count* but a *non-deterministic set of unique items* — some items are skipped, others are returned more than once across different pages, and the specific items lost/duplicated changes between separate full-collection walks against an otherwise unchanged collection.

Passing an explicit `sort` (e.g. `sort=name&order=asc`) makes the walk consistently return every item exactly once, across repeated full-collection walks.

### Steps to reproduce

Requires an environment with more items in one resource type (e.g. volumes) than the page size used below, so that walking the collection takes more than one request.

```bash
export ARCANE_HOST="http://<your-arcane-host>:<port>"
export ARCANE_API_KEY="<your-api-key>"
export ENV_ID="<environment-id-with-6-or-more-volumes>"

# 1) Get the total item count.
curl -s -H "X-API-Key: $ARCANE_API_KEY" \
  "$ARCANE_HOST/api/environments/$ENV_ID/volumes?limit=1" | jq '.pagination.totalItems'
# e.g. 32

# 2) Walk the full collection in pages of 5, WITHOUT sort/order.
names_no_sort=()
for start in $(seq 0 5 30); do
  page=$(curl -s -H "X-API-Key: $ARCANE_API_KEY" \
    "$ARCANE_HOST/api/environments/$ENV_ID/volumes?limit=5&start=$start")
  echo "$page" | jq -r '.data[].name'
done | sort | uniq | wc -l
# Expected: equals totalItems (e.g. 32).
# Observed: fewer than totalItems, and the number varies between separate
# runs of the exact same loop against an unchanged collection (measured
# between 19 and 29 unique names out of 32 total, across a dozen separate
# runs on 2026-08-16 and 2026-08-17). Every individual page still returns
# exactly `limit` rows (or fewer on the last page) and the row COUNT across
# all pages always sums to totalItems — it's specifically WHICH rows repeat
# or go missing that is non-deterministic.

# 3) Repeat the exact same walk WITH sort=name&order=asc.
for start in $(seq 0 5 30); do
  curl -s -H "X-API-Key: $ARCANE_API_KEY" \
    "$ARCANE_HOST/api/environments/$ENV_ID/volumes?limit=5&start=$start&sort=name&order=asc" \
    | jq -r '.data[].name'
done | sort | uniq | wc -l
# Expected and observed: equals totalItems, consistently, across every run.
```

### Observed behaviour

- Without `sort`: each page reports the correct `pagination.totalItems` and
  returns the correct number of rows per page, but the *set* of unique items
  collected across all pages is smaller than `totalItems` — items are either
  skipped (never appear on any page) or duplicated (appear on more than one
  page), and it is not the same items each time the walk is repeated.
- With `sort` + `order` set explicitly: repeated full-collection walks
  consistently return every item exactly once.
- Reproduced primarily against `/environments/{id}/volumes` (32 items, page
  size 5, i.e. 7 pages), where the effect is most visible because it has the
  most pages among the resources tested. A smaller-scale version of the same
  effect was also observed on `/containers`, `/projects` and
  `/gitops-syncs` on the same instance, which have fewer pages (2-4) so the
  effect is harder to trigger but consistent with the same root cause.

### Expected behaviour

Paginating a collection via `start`/`limit` should be well-defined and
consistent between requests even without an explicit `sort`, e.g. by falling
back to a stable default ordering (such as sorting by primary key/creation
order) rather than an ordering that can change between individual requests
for the same collection (which is consistent with what unindexed, unordered
queries typically do against most databases when no `ORDER BY` is supplied).

### Impact

Any client that pages through a full collection to answer "does X exist" or
"list everything" — without knowing to pass `sort` explicitly — can silently
miss existing items or process duplicates, with no error and a `totalItems`
count that looks correct. This is especially dangerous for any client-side
logic that resolves a name to an ID by paging through a full listing and
concluding "not found" if the name never showed up on any page: the
existence of an item could be wrongly reported as absent. We worked around
this on our end by requiring an explicit `sort` on every paginated walk in
our client, but we don't control every client of this API, and the API
itself doesn't warn about or document this behaviour.

---

## Contexto adicional (no forma parte del texto del issue)

### Cómo se descubrió

Durante la Task 6 de este trabajo (coherencia de la superficie de listado),
al construir un e2e que recorría `/environments/0/volumes` en páginas de 5
para comprobar que `collectAllPages` (helper interno, `src/tools/paging.ts`)
no perdía elementos, una primera medición sin reintentos dio "containers
pierde 4 elementos" — resultó ser ruido de red, no el bug. Un script con
reintentos lo desmintió para `containers` pero **confirmó el patrón para
`volumes`**: 32 filas recogidas, entre 19 y 22 nombres únicos según la
ejecución, sin `sort`; 32 de 32 con `sort=name&order=asc`, de forma estable
en repetidas pasadas.

### Medición ampliada en esta tarea (Task 12, 2026-08-17)

Se repitió el mismo recorrido (`/environments/0/volumes`, páginas de 5, sin
`sort`) siete veces más como parte de la ejecución de la suite e2e de esta
tarea. Resultados: 27, 19, 20, 23, 27, 22 y 24 nombres únicos de 32, en todos
los casos con exactamente 32 filas recogidas (nunca menos). El rango
combinado con las medidas previas de la Task 6 (19, 20, 21, 22, 29) es
19–29 únicos de 32, siempre no determinista, siempre con el recuento total
correcto.

### Por qué importa para este proyecto

Los cuatro resolvers nombre→id de este fork (`resolveEnvironmentId`,
`resolveStackId`, `resolveContainerId`, `resolveGitOpsSyncId`,
`src/tools/resolve.ts`) recorren colecciones paginadas para decidir si un
nombre existe. Sin este hallazgo, habrían heredado el bug: podrían concluir
"no existe" sobre un nombre que sí existe, simplemente porque cayó en una
página que el recorrido sin `sort` se saltó. La corrección aplicada en este
fork —`collectAllPages(sort, fetchPage)` exige `sort` como primer parámetro
posicional obligatorio, verificado con una prueba de tipos que falla en
compilación si se omite— es un workaround del lado del cliente, no un
arreglo del bug en sí. El upstream sigue teniendo el problema para
cualquier otro cliente de la API que no sepa que tiene que pedir `sort`
explícitamente.
