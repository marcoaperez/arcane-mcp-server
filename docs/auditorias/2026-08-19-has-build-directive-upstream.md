# Issue para el upstream: `hasBuildDirective` siempre es `false` en `GET /projects/{id}` y en el listado

- **Fecha:** 2026-08-19
- **Estado:** **redactado, sin publicar** — publicar en el repositorio de un tercero lo
  decide el propietario de este proyecto, no quien lo investiga. El texto listo para
  copiar está más abajo, entre las líneas `---`.
- **Repositorio destino:** [getarcaneapp/arcane](https://github.com/getarcaneapp/arcane)
- **Sería el quinto issue** que este fork redacta contra el upstream, tras los cuatro de
  F3/F4 enlazados desde [`docs/README.md`](../README.md).

## Diagnóstico (en español, para este repositorio)

**Síntoma, medido hoy contra la instancia real (Arcane 2.8.0):** cuatro proyectos con
`build:` de servicio verificado en el propio fichero que la API declara como su
`composeFileName`, y los cuatro con `hasBuildDirective: false` en `GET
/environments/{id}/projects/{projectId}`. Ninguno de los 22 proyectos de los seis
entornos que gestiona esta instancia lo tiene a `true` en el listado.

| Proyecto | `composeFileName` | `build:` de servicio (verificado) | `hasBuildDirective` en `GET /projects/{id}` |
|---|---|---|---|
| `ical-bridge` | `compose.yaml` | sí, línea 8: `build: .` | `false` |
| `arcane-mcp` | `docker-compose.yml` | sí, línea 3: `build: .` | `false` |
| `ionos-manager` | `docker-compose.yml` | sí, línea 6: `build: .` | `false` |
| `obsidian-notify` | `docker-compose.yml` | sí, líneas 16 y 66: `build: .` (dos servicios) | `false` |

**La causa no es que el campo esté roto: es que el endpoint que lo expone nunca pide que
se calcule.** Contra el código de `getarcaneapp/arcane` en el tag `v2.8.0`
(`5ff0b69`, el mismo commit que corre esta instancia):

1. `GetProjectDetails()` fija el valor por defecto a `false` incondicionalmente
   (`backend/internal/project/project_details.go:216`, tag `v2.8.0`):

   ```go
   resp.HasBuildDirective = false
   ```

2. El único código que lo recalcula leyendo el compose de verdad es
   `enrichWithComposeServiceConfigs()` (mismo fichero, líneas 528–537), que recorre los
   servicios del compose parseado y pone `true` si alguno declara `build:`:

   ```go
   hasBuildDirective := false
   for _, svc := range composeProj.Services {
       svcList = append(svcList, svc)
       if svc.Build != nil {
           hasBuildDirective = true
       }
   }
   resp.Services = svcList
   resp.HasBuildDirective = resp.HasBuildDirective || hasBuildDirective
   ```

3. Esa función solo se llama si `opts.IncludeServiceConfigs` es `true`
   (`GetProjectDetails()`, línea ~260: `if opts.IncludeServiceConfigs { ... }`).

4. El handler que atiende `GET /projects/{projectId}` — `GetProject()`, en
   `backend/internal/project/handler.go:788` — llama a `GetProjectDetails()` con
   `project.DetailsOptions{}`, es decir, **todas las opciones en `false`**:

   ```go
   details, err := h.projectService.GetProjectDetails(ctx, input.ProjectID, project.DetailsOptions{})
   ```

   Por eso `hasBuildDirective` nunca sale del valor por defecto en esta ruta. El listado
   (`GET /projects`, `ListProjects()`) ni siquiera pasa por `GetProjectDetails()`, así
   que hereda el mismo `false` por construcción — no hay ninguna vía por la que llegue a
   `true` en el listado.
5. Otros tres handlers **sí** pasan `IncludeServiceConfigs: true` y por tanto **sí**
   calculan el campo correctamente: `GetProjectCompose()` (`GET
   /projects/{id}/compose`), `GetProjectUpdates()` (`GET /projects/{id}/updates`) y
   `UpdateProject()` (`PUT /projects/{id}`). Es decir, el mismo backend sabe calcular el
   campo bien — solo no lo hace en el endpoint que un cliente normal usa para leer un
   proyecto.

**Confirmación cruzada, medida hoy sobre los mismos cuatro proyectos:** el endpoint
`/compose`, que sí activa `IncludeServiceConfigs`, devuelve `hasBuildDirective: true`
para los cuatro — el mismo proyecto, dos endpoints, dos valores:

| Proyecto | `GET /projects/{id}` | `GET /projects/{id}/compose` |
|---|---|---|
| `ical-bridge` | `false` | **`true`** |
| `arcane-mcp` | `false` | **`true`** |
| `ionos-manager` | `false` | **`true`** |
| `obsidian-notify` | `false` | **`true`** |

Esto es más fuerte que sospechar un campo "roto": demuestra, con el mismo dato de
entrada, que el cálculo existe, funciona, y solo un handler decide no invocarlo.

**Consecuencia para este fork:** ninguna funcional. `arcane_project_build` (F5) no
depende de `hasBuildDirective` para decidir nada — la propia herramienta advierte que no
hay que fiarse de él («Do not rely on the project's hasBuildDirective field to decide: it
reports false even for projects that do have one», en `src/tools/image-builds.ts`).
Documentado para que un modelo que sí lea ese campo no descarte proyectos que sí tienen
build.

---

El texto de abajo, entre las líneas `---`, está en inglés (idioma del repositorio
upstream) y listo para copiar y pegar tal cual en un issue nuevo de GitHub. Nadie de
este trabajo lo ha publicado ni ha abierto el issue.

---

**Title:** `hasBuildDirective` is always `false` on `GET /projects/{id}` and in the
project listing, even for projects with a `build:` service

**Affected version:** 2.8.0 (`GET /api/version` → `"currentVersion": "v2.8.0"`), source
verified at tag `v2.8.0` (`5ff0b696b468c9a684c7883f4ccf329e85acc80d`)

### Summary

`project.Details.HasBuildDirective` is documented as "whether any Compose service
defines a build directive" (`types/project/project.go`), but on `GET
/projects/{projectId}` and in `GET /projects` it is always `false`, even for projects
whose compose file genuinely declares `build:`.

### Root cause

`GetProjectDetails()` defaults the field to `false`
(`backend/internal/project/project_details.go`):

```go
resp.HasBuildDirective = false
```

The only place that recomputes it from the parsed compose file is
`enrichWithComposeServiceConfigs()`, and it is only invoked when
`opts.IncludeServiceConfigs` is `true`:

```go
hasBuildDirective := false
for _, svc := range composeProj.Services {
    svcList = append(svcList, svc)
    if svc.Build != nil {
        hasBuildDirective = true
    }
}
resp.Services = svcList
resp.HasBuildDirective = resp.HasBuildDirective || hasBuildDirective
```

`ProjectHandler.GetProject()` — the handler behind `GET /projects/{projectId}` — calls
`GetProjectDetails()` with an empty options struct:

```go
details, err := h.projectService.GetProjectDetails(ctx, input.ProjectID, project.DetailsOptions{})
```

so `IncludeServiceConfigs` is `false` and the field never leaves its default.
`ListProjects()` (behind `GET /projects`) does not call `GetProjectDetails()` at all, so
it inherits the same `false` by construction.

Three other handlers already pass `IncludeServiceConfigs: true` and therefore compute the
field correctly: `GetProjectCompose()` (`GET /projects/{id}/compose`),
`GetProjectUpdates()` (`GET /projects/{id}/updates`), and `UpdateProject()` (`PUT
/projects/{id}`).

### Steps to reproduce

Pick any project whose compose file declares `build:` for at least one service, then
compare the two endpoints:

```bash
curl -s -H "X-API-Key: $ARCANE_API_KEY" \
  "$ARCANE_HOST/api/environments/$ENV_ID/projects/$PROJECT_ID" \
  | jq '.data.hasBuildDirective, .data.composeFileName'
# -> false

curl -s -H "X-API-Key: $ARCANE_API_KEY" \
  "$ARCANE_HOST/api/environments/$ENV_ID/projects/$PROJECT_ID/compose" \
  | jq '.data.hasBuildDirective'
# -> true
```

On this instance, four projects reproduce it identically — `ical-bridge`, `arcane-mcp`,
`ionos-manager`, `obsidian-notify` — and 0 of the 22 projects across the 6 environments
this instance manages report `hasBuildDirective: true` from the listing endpoint, even
though several of them build from source.

### Expected behaviour

`GET /projects/{projectId}` and `GET /projects` report the same `hasBuildDirective` value
that `/compose` already computes correctly for the same project.

### Actual behaviour

`hasBuildDirective` is unconditionally `false` from the plain get/list endpoints, and only
`true` from `/compose`, `/updates`, and after a `PUT` — endpoints a client would not
normally call just to check whether a project can be built.

### Suggested fix

Either pass `IncludeServiceConfigs: true` from `GetProject()`/`ListProjects()` too (the
compose file has to be read anyway to serve `composeFileName`), or move the
`svc.Build != nil` check outside the `IncludeServiceConfigs` gate so it runs whenever the
compose file is already being parsed for other fields.

### Impact

Any client that trusts `hasBuildDirective` to decide whether it is worth calling `POST
/projects/{projectId}/build` will skip every project that has a build directive, since
the field it would filter on is always `false` from the endpoints it would naturally
call.

---

## Cómo se reprodujeron los datos de este documento

```bash
set -a; . ./.dev.vars; set +a
B=http://192.168.180.210:3552/api

# GET /projects/{id} vs GET /projects/{id}/compose, para los cuatro proyectos
for id in a2ae6abc-6144-42b2-8683-732c0f9c8f64 ced1a362-a318-4cfc-82b9-83c26baf47a2 \
          0f001cf1-4315-4c0e-b10d-c9de523c8fbf 2bd51699-6634-4c10-b172-18b6fee82138; do
  curl -s -H "X-API-Key: $ARCANE_API_KEY" "$B/environments/0/projects/$id" \
    | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d).data;console.log(j.name,'GET /projects/{id} ->',j.hasBuildDirective)})"
  curl -s -H "X-API-Key: $ARCANE_API_KEY" "$B/environments/0/projects/$id/compose" \
    | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d).data;console.log('  /compose ->',j.hasBuildDirective)})"
done

# Barrido de los 6 entornos: 0 proyectos con hasBuildDirective:true en el listado
node -e "
const B = 'http://192.168.180.210:3552/api';
const key = process.env.ARCANE_API_KEY;
async function get(path) { return (await fetch(B+path, {headers:{'X-API-Key':key}})).json(); }
(async () => {
  const envs = (await get('/environments?limit=50')).data.map(e=>e.id);
  let total=0, trues=0;
  for (const e of envs) {
    const r = await get('/environments/'+e+'/projects?limit=100');
    total += r.data.length;
    trues += r.data.filter(p=>p.hasBuildDirective===true).length;
  }
  console.log('proyectos='+total+' hasBuildDirective=true en total='+trues);
})();
"
```

Código fuente del upstream, contra el tag exacto que corre la instancia:

```bash
gh api "repos/getarcaneapp/arcane/git/refs/tags/v2.8.0" -q .object.sha
# -> 5ff0b696b468c9a684c7883f4ccf329e85acc80d

gh api "repos/getarcaneapp/arcane/contents/backend/internal/project/project_details.go?ref=v2.8.0" -q .content \
  | base64 -d | grep -n "HasBuildDirective\|IncludeServiceConfigs"

gh api "repos/getarcaneapp/arcane/contents/backend/internal/project/handler.go?ref=v2.8.0" -q .content \
  | base64 -d | sed -n '/func (h \*ProjectHandler) GetProject(ctx/,+12p'
```
