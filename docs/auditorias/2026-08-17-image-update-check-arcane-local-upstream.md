# Issue para el upstream: `image_update_check` falla siempre por las imágenes que Arcane construye

- **Fecha:** 2026-08-17
- **Estado:** redactado, **sin publicar** (decisión del propietario del proyecto)
- **Repositorio destino:** [getarcaneapp/arcane](https://github.com/getarcaneapp/arcane)
- **Sería el cuarto issue** que este fork devuelve al upstream, tras:
  - [#3606](https://github.com/getarcaneapp/arcane/issues/3606) — redeploy de GitOps roto (ya reportado por otra persona, cerrado)
  - [#3638](https://github.com/getarcaneapp/arcane/issues/3638) — `HEAD /environments/{id}/system/health` devuelve 500 siempre
  - [paginación sin `sort`](2026-08-17-paginacion-sin-sort-upstream.md) — redactado, sin publicar

## Diagnóstico (en español, para este repositorio)

El job programado ha fallado **635 de 639 veces** en esta instancia (medido el
2026-08-17 a las 20:00; el contador sube en uno cada hora — a las 21:00 ya eran 636).
Los 4 éxitos son comprobaciones puntuales de una sola imagen, no barridos completos.

La causa es que **Arcane no reconoce como locales las imágenes que ella misma
construye**. Su sistema de builds las etiqueta con un registro sintético,
`arcane.local/<proyecto>-<hash>/<nombre>:latest`, y su comprobador de actualizaciones
trata ese prefijo como un registro real: llama a `docker distribution inspect`, que
intenta resolver `arcane.local` por DNS y falla.

Que es un fallo de la heurística y no del entorno lo demuestra la propia salida del
job: **sí** salta correctamente los builds locales **sin** prefijo de registro, y
**no** los que ella misma prefijó.

El prefijo `arcane.local/` no aparece en `openapi.txt`: no es contrato público, es un
detalle interno del sistema de builds.

**Consecuencia para este fork:** ninguna, más allá del ruido. Se comprobó que los datos
de actualizaciones sí llegan pese al estado `failed`
(`GET /image-updates/summary` responde 200 con `imagesWithUpdates: 4`), así que **F3 no
está bloqueada por esto**. Lo único incorrecto es el estado que reporta la activity.

---

El texto de abajo, entre las líneas `---`, está en inglés (idioma del repositorio
upstream) y listo para copiar y pegar tal cual en un issue nuevo de GitHub. Nadie de
este trabajo lo ha publicado ni ha abierto el issue.

---

**Title:** Scheduled `image_update_check` always fails: Arcane's own locally-built images (tagged `arcane.local/…`) are treated as remote registry images

**Affected version:** 2.8.0 (`GET /api/version` → `"currentVersion": "v2.8.0"`)

### Summary

Arcane's build system tags locally-built images with a synthetic registry hostname:

```
arcane.local/<project>-<hash>/<name>:latest
```

The image update checker does not recognise that prefix as a local build. It treats
`arcane.local` as a real registry, runs a distribution inspect against it, and the
lookup fails because `arcane.local` does not resolve — it is not a real host, and
nothing in Arcane ever makes it resolvable.

Because the scheduled `image_update_check` activity is marked `failed` when *any*
reference errors, **every scheduled run fails on any instance that has ever built an
image through Arcane**, even though the check itself works correctly for every real
registry image.

On this instance the job had failed **635 out of 639 runs** when this was measured
(2026-08-17 20:00 UTC+2), and the failure count grows by one every hour. The only
successes were single-image checks that happened not to touch a locally-built image.

### The inconsistency, in Arcane's own log output

This is a single run of the scheduled job. Note that local builds **without** a
registry prefix are skipped correctly, while the ones Arcane itself prefixed with
`arcane.local/` are not:

```
info     Checking 19 image references
info     ionos-manager:latest — local build, registry check skipped
info     arcane-mcp-arcane-mcp:latest — local build, registry check skipped
info     ical-bridge:local — local build, registry check skipped
error    arcane.local/obsidian-notify-2bd51699/taiko-data:latest: distribution inspect failed for
         arcane.local/obsidian-notify-2bd51699/taiko-data:latest: Error response from daemon:
         Get "https://arcane.local/v2/": dial tcp: lookup arcane.local on 127.0.0.53:53: server misbehaving
error    arcane.local/obsidian-notify-2bd51699/obsidian-notify:latest: … (same error)
error    arcane.local/arcane-mcp-ced1a362/arcane-mcp:latest:            … (same error)
error    arcane.local/taiko-data-dev-6247d5a7/taiko-data-dev:latest:    … (same error)
info     qdrant/qdrant:latest — up to date
success  node:24-alpine — update available
success  ollama/ollama:latest — update available
success  ghcr.io/usetrmnl/terminus:latest — update available
…
error    Image update check completed: 14 checked, 5 errors
```

The detection appears to treat "no registry prefix" as the signal for a local build.
Images carrying Arcane's own `arcane.local/` prefix fall through to the remote path.

The same four references fail on every run — this is fully deterministic, not a
transient network issue.

### Steps to reproduce

1. Build at least one image through Arcane (any project built by the GitOps/build
   pipeline), so that the local image list contains a tag of the form
   `arcane.local/<project>-<hash>/<name>:latest`. Confirm with:

   ```bash
   curl -s -H "X-API-Key: $ARCANE_API_KEY" \
     "$ARCANE_HOST/api/environments/$ENV_ID/images?limit=200" \
     | jq -r '.data[].repoTags[]?' | grep '^arcane\.local/'
   ```

2. Trigger the image update check (or wait for the scheduled run). Note the naming:
   the **job id** is `image-polling` (display name "Image Update Watcher"), while the
   **activity type** it produces is `image_update_check`.

   ```bash
   curl -s -X POST -H "X-API-Key: $ARCANE_API_KEY" \
     "$ARCANE_HOST/api/environments/$ENV_ID/jobs/image-polling/run"
   ```

3. Read the resulting activity:

   ```bash
   curl -s -H "X-API-Key: $ARCANE_API_KEY" \
     "$ARCANE_HOST/api/environments/$ENV_ID/activities?type=image_update_check&limit=1&sort=createdAt&order=desc" \
     | jq -r '.data[0].id'

   curl -s -H "X-API-Key: $ARCANE_API_KEY" \
     "$ARCANE_HOST/api/environments/$ENV_ID/activities/<activity-id>" \
     | jq -r '.data.messages[] | "\(.level)\t\(.message)"'
   ```

### Expected behaviour

Images tagged with Arcane's own `arcane.local/` build prefix are recognised as local
builds and skipped, exactly like locally-built images without a registry prefix
(`ionos-manager:latest`, `ical-bridge:local`). The scheduled job then completes with
status `success`.

### Actual behaviour

Those images are sent down the remote-registry path, DNS resolution of `arcane.local`
fails, each one is recorded as an error, and the whole activity is marked `failed` —
on every scheduled run, forever, on any instance that has built an image with Arcane.

### Impact

- The scheduled job is permanently red, so its status carries no signal: a genuine
  failure (registry down, credentials expired, daemon unreachable) is indistinguishable
  from this one. On this instance every scheduled run in the retained activity history
  has failed — the oldest retained run (2026-07-27, ~22 days back) is already failing,
  so the actual start date is unknown: it predates the history that is kept.
- The check itself still works for real registry images and its results are still
  reachable through `GET /environments/{id}/image-updates/summary`, so this is a
  reporting/classification defect rather than a loss of functionality. That is also why
  it is easy to miss.

### Suggested fix

Treat the `arcane.local/` prefix Arcane assigns to its own builds as a local-build
marker in the update checker, alongside the existing "no registry prefix" case. The
prefix is generated by Arcane itself, so the check can be exact rather than heuristic.

### Secondary observation (probably a separate issue)

In some runs — 2 of the 4 examined — the check of Arcane's own published image also
fails:

```
error  ghcr.io/getarcaneapp/arcane:latest: distribution inspect failed for
       ghcr.io/getarcaneapp/arcane:latest: Error response from daemon:
       toomanyrequests: retry-after: 347.316µs, allowed: 44000/minute
```

Two things look odd: a `retry-after` of 347 **microseconds**, and a quota of
44000/minute being exceeded by an instance making roughly 19 requests per hour. Other
`ghcr.io` images in the very same run (`ghcr.io/usetrmnl/terminus:latest`,
`ghcr.io/getarcaneapp/tools:latest`) succeed, so it is specific to that repository.

This one is intermittent and **not** the cause of the permanent failure: runs where it
does not occur still fail because of the `arcane.local` references above.

---

## Cómo se reprodujeron los datos de este documento

```bash
set -a; . ./.dev.vars; set +a
B=http://192.168.180.210:3552/api

# Reparto de estados historico
for st in success failed running; do
  printf "%s: " "$st"
  curl -s -H "X-API-Key: $ARCANE_API_KEY" \
    "$B/environments/0/activities?type=image_update_check&status=$st&limit=1" \
    | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).pagination.totalItems))"
done

# Mensajes de la ultima ejecucion
curl -s -H "X-API-Key: $ARCANE_API_KEY" \
  "$B/environments/0/activities?type=image_update_check&limit=1&sort=createdAt&order=desc"

# Los datos de actualizaciones SI llegan pese al estado failed
curl -s -H "X-API-Key: $ARCANE_API_KEY" "$B/environments/0/image-updates/summary"
```
