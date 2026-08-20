# Arcane Docker MCP Server

> **Fork mantenido activamente por [Taiko Solutions](https://taikosolutions.com).**
> Verificado contra **Arcane v2.8.0**: las **98** combinaciones método+ruta que usa el
> cliente existen en el spec de la instancia, sin ausencias — **98 de las 249**
> operaciones que este fork pretende cubrir (denominador honesto, ver
> [criterio de exposición](docs/arquitectura/criterio-exposicion.md); 98 de 347 en bruto).
> Origen del fork: [`cougz/arcane-mcp-server`](https://github.com/cougz/arcane-mcp-server),
> inactivo desde marzo de 2026.
>
> | | |
> |---|---|
> | **Compatibilidad** | Arcane v2.x (probado contra v2.8.0) |
> | **Spec de referencia** | [`openapi.txt`](openapi.txt) — descargado de la instancia con `npm run update-api-spec` |
> | **Tools** | 100 |
> | **Documentación** | [`docs/`](docs/README.md) |

A Model Context Protocol (MCP) server for managing Docker environments through [Arcane](https://getarcane.app/), deployed on Cloudflare Workers.

This MCP server provides Claude Desktop and other MCP clients with tools to manage Docker containers, images, volumes, networks, and Docker Compose stacks via Arcane's REST API.

## What This Project Is

Arcane is a Docker management platform that provides a unified API for managing multiple Docker environments. This MCP server exposes Arcane's functionality as MCP tools, allowing you to interact with your Docker infrastructure through natural language conversations with Claude.

Built on Cloudflare Workers using the official Cloudflare `agents` package, this server provides a scalable, globally distributed way to manage your Docker resources.

## En qué diverge este fork del upstream

| Área | `cougz/arcane-mcp-server` | Este fork |
|---|---|---|
| Endpoints NDJSON (`/pull`, `/up`, `/redeploy`) | Rotos: parsean el cuerpo con `response.json()` y revientan con `Unexpected non-whitespace character after JSON` en la segunda línea del stream | `requestNdjson()` + agregación a `ActionResponse`, con los errores del stream propagados a la tool |
| Path de `arcane_stack_pull` | `/pull-project-images`, inexistente en Arcane v2.x → 404 | `/pull`, según el spec v2.8.0 |
| Compatibilidad de shapes | Escrito contra Arcane v1.x | Interfaces alineadas con v2.8.0 y auditadas por `scripts/audit-schema-drift.mjs` |
| Despliegue | Solo Cloudflare Workers | Cloudflare Workers **o** contenedor Docker autoalojado (`docker-compose.yml` + `wrangler.local.jsonc`) |
| Cliente | `baseUrl` fijo hacia el binding VPC | Modo dual: binding VPC en Workers, URL real en local/Docker |
| Verificación | Sin runner de tests funcional | 291 tests unitarios + 57 tests e2e contra una instancia Arcane real |

El fix de los endpoints NDJSON se ha ofrecido al upstream como PR autocontenido.

## Pendiente al actualizar Arcane (v2.8.0 → siguiente release)

La instancia de referencia corre **v2.8.0** deliberadamente: es la versión contra la que
están verificadas las 98 combinaciones método+ruta y los comportamientos que describen las
tools de este README.

**v2.8.1** (2026-08-19) no aporta nada a este fork: no corrige ninguno de los issues
abiertos desde aquí. **La siguiente release sí**. A fecha de 2026-08-20 hay dos fixes
nuestros mergeados en `main` y todavía sin publicar, y uno de ellos cambia el contrato de
la API. Cuando salga esa versión, el salto pasa a ser recomendable en lugar de opcional.

### Lo que traerá la siguiente release

- **Cambio de contrato que hay que absorber: `arcane_vulnerability_image_list`.** El PR
  [#3682](https://github.com/getarcaneapp/arcane/pull/3682) hace que
  `GET /images/{imageId}/vulnerabilities/list` devuelva **404** cuando no existe scan para
  ese id, en vez del **200 con página vacía** que devuelve hoy
  (`ListVulnerabilities` pasa a retornar `ErrVulnerabilityScanNotFound`). Es una mejora
  —hoy una imagen sin scan es indistinguible de una imagen limpia— pero la tool debe
  tratar ese 404 como "sin resultados de scan", no como error duro, igual que ya hace
  `arcane_vulnerability_scan_result`.
- **Los `{imageId}` percent-codificados dejan de fallar.** El mismo PR decodifica los
  parámetros de ruta en la capa de routing (`UnescapePathParamValues` en Echo), de modo
  que `sha256:…`, `sha256%3A…` y `%73ha256:…` resuelven a la misma imagen. El
  emparejamiento de rutas se sigue haciendo sobre el path escapado, así que un `/`
  codificado no puede cambiar qué ruta casa. Cierra
  [#3657](https://github.com/getarcaneapp/arcane/issues/3657).
- **Paginación estable sin `sort` explícito.** El PR
  [#3648](https://github.com/getarcaneapp/arcane/pull/3648) cierra
  [#3645](https://github.com/getarcaneapp/arcane/issues/3645): recorrer páginas con
  `start` sin ordenación explícita deja de devolver resultados no deterministas.

### Lo que ya trajo v2.8.1

- **`arcane_image_update_check` gana un estado nuevo.** El PR
  [#3631](https://github.com/getarcaneapp/arcane/pull/3631) hace que las imágenes nunca
  descargadas reporten un estado propio `not pulled` en lugar de fallar la comprobación.
- **El contrato JSON no cambia.** El refactor de `models` a paquetes de dominio
  ([#3636](https://github.com/getarcaneapp/arcane/pull/3636)) mueve los structs de fichero
  pero conserva los tags `json`. Verificado campo a campo sobre `VulnerabilityIgnore` en
  `backend/internal/vulnerability/model.go` de v2.8.1, y el diff `v2.8.0...v2.8.1` no
  contiene ningún campo eliminado ni renombrado.

### En cualquier caso, al saltar

- **Rehacer la línea base de verificación.** Regenerar `openapi.txt` con
  `npm run update-api-spec` y pasar `scripts/audit-schema-drift.mjs`. Los comportamientos
  medidos que documentan las descripciones de las tools (`arcane_system_health` siempre
  500, `arcane_vulnerability_ignore` sin efecto sobre los recuentos) dejan de estar
  garantizados hasta volver a medirlos.
- **Requisitos operativos.** Pinear la imagen antes de actualizar — la instancia arrastra
  las etiquetas `:latest` y `:v2.8.0` sobre el mismo digest — y contar con que el salto
  **migra el esquema de la base de datos**: backup previo.

### Estado de los issues abiertos contra upstream desde este proyecto

| Issue | Estado | Fix |
|---|---|---|
| [#3638](https://github.com/getarcaneapp/arcane/issues/3638) — `HEAD /system/health` siempre 500 | abierto, sin respuesta | — |
| [#3640](https://github.com/getarcaneapp/arcane/issues/3640) — batch de update check falla en imágenes locales | abierto, sin respuesta | — |
| [#3645](https://github.com/getarcaneapp/arcane/issues/3645) — paginación sin `sort` | cerrado 2026-08-19 | [#3648](https://github.com/getarcaneapp/arcane/pull/3648), en `main` sin publicar |
| [#3657](https://github.com/getarcaneapp/arcane/issues/3657) — no se percent-decodifican los `{imageId}` | cerrado 2026-08-20 | [#3682](https://github.com/getarcaneapp/arcane/pull/3682), en `main` sin publicar |
| [#3685](https://github.com/getarcaneapp/arcane/issues/3685) — `hasBuildDirective` siempre `false` | abierto 2026-08-20 | — |

## Available Tools

<!-- BEGIN TOOLS -->

Las **116** tools que expone el servidor, agrupadas por dominio. Esta tabla la
genera `npm run gen-tools-table` a partir de `src/tools/`: las descripciones y los
parámetros son los que registra el código, no una copia mantenida a mano.

### Environments (5)

| Tool | Description | Inputs |
|---|---|---|
| `arcane_environment_list` | List Docker environments managed by Arcane. Returns environment IDs, names, connection status and pagination; if the response says there are more pages, pass start to see the rest before drawing conclusions about what exists. | `search?`, `sort?`, `order?`, `start?`, `limit?`, `type?` |
| `arcane_environment_get` | Get details of a specific Docker environment by ID or name. | `environmentId?`, `environmentName?` |
| `arcane_environment_create` | Create a new Docker environment in Arcane. | `name`, `apiUrl`, `accessToken?`, `bootstrapToken?`, `enabled?`, `isEdge?`, `useApiKey?` |
| `arcane_environment_update` | Update an existing Docker environment. | `environmentId?`, `environmentName?`, `name?`, `apiUrl?`, `accessToken?`, `bootstrapToken?`, `enabled?`, `regenerateApiKey?` |
| `arcane_environment_delete` | Delete a Docker environment from Arcane. | `environmentId?`, `environmentName?` |

### Compose stacks (9)

| Tool | Description | Inputs |
|---|---|---|
| `arcane_stack_list` | List Docker Compose stacks (projects) in an environment. Returns pagination; if the response says there are more pages, pass start to see the rest before drawing conclusions about what exists. | `environmentId?`, `environmentName?`, `search?`, `sort?`, `order?`, `start?`, `limit?`, `status?`, `archived?`, `tags?`, `updates?` |
| `arcane_stack_get` | Get details of a specific Docker Compose stack by ID or name. | `environmentId?`, `environmentName?`, `stackId?`, `stackName?` |
| `arcane_stack_deploy` | Deploy a new Docker Compose stack to an environment. | `environmentId?`, `environmentName?`, `name`, `composeContent`, `envContent?` |
| `arcane_stack_update` | Update an existing Docker Compose stack. | `environmentId?`, `environmentName?`, `stackId?`, `stackName?`, `name?`, `composeContent?`, `envContent?` |
| `arcane_stack_delete` | Delete a Docker Compose stack from an environment. | `environmentId?`, `environmentName?`, `stackId?`, `stackName?` |
| `arcane_stack_start` | Start a Docker Compose stack. | `environmentId?`, `environmentName?`, `stackId?`, `stackName?` |
| `arcane_stack_stop` | Stop a Docker Compose stack. | `environmentId?`, `environmentName?`, `stackId?`, `stackName?` |
| `arcane_stack_restart` | Restart a Docker Compose stack. | `environmentId?`, `environmentName?`, `stackId?`, `stackName?` |
| `arcane_stack_pull` | Pull images for a Docker Compose stack. | `environmentId?`, `environmentName?`, `stackId?`, `stackName?` |

### Project lifecycle (4)

| Tool | Description | Inputs |
|---|---|---|
| `arcane_project_down` | Stop and remove containers, networks created by the project (preserves volumes). | `environmentId?`, `environmentName?`, `projectId?`, `projectName?` |
| `arcane_project_pull_images` | Pull images for a project without starting containers. | `environmentId?`, `environmentName?`, `projectId?`, `projectName?` |
| `arcane_project_redeploy` | Redeploy a project - stops and recreates all containers. | `environmentId?`, `environmentName?`, `projectId?`, `projectName?` |
| `arcane_project_destroy` | Stop and remove containers, networks, and optionally volumes and files for a project. | `environmentId?`, `environmentName?`, `projectId?`, `projectName?`, `removeFiles?`, `removeVolumes?` |

### Containers (6)

| Tool | Description | Inputs |
|---|---|---|
| `arcane_container_list` | List Docker containers in an environment. Returns pagination and running/stopped counts; if the response says there are more pages, pass start to see the rest before drawing conclusions about what exists. | `environmentId?`, `environmentName?`, `search?`, `sort?`, `order?`, `start?`, `limit?`, `includeInternal?`, `standalone?`, `updates?` |
| `arcane_container_get` | Get details of a specific Docker container by ID or name. | `environmentId?`, `environmentName?`, `containerId?`, `containerName?` |
| `arcane_container_start` | Start a Docker container. | `environmentId?`, `environmentName?`, `containerId?`, `containerName?` |
| `arcane_container_stop` | Stop a Docker container. | `environmentId?`, `environmentName?`, `containerId?`, `containerName?` |
| `arcane_container_restart` | Restart a Docker container. | `environmentId?`, `environmentName?`, `containerId?`, `containerName?` |
| `arcane_container_kill` | Force kill a Docker container. | `environmentId?`, `environmentName?`, `containerId?`, `containerName?` |

### Containers — advanced (3)

| Tool | Description | Inputs |
|---|---|---|
| `arcane_container_create` | Create and start a new Docker container. | `environmentId?`, `environmentName?`, `name`, `image`, `cmd?`, `env?`, `ports?`, `volumes?`, `networks?`, `restartPolicy?`, `detach?` |
| `arcane_container_delete` | Delete a Docker container. | `environmentId?`, `environmentName?`, `containerId?`, `containerName?`, `force?`, `volumes?` |
| `arcane_container_update` | Update a Docker container configuration. | `environmentId?`, `environmentName?`, `containerId?`, `containerName?` |

### Images (4)

| Tool | Description | Inputs |
|---|---|---|
| `arcane_image_list` | List Docker images in an environment. Returns pagination; if the response says there are more pages, pass start to see the rest before drawing conclusions about what exists. | `environmentId?`, `environmentName?`, `search?`, `sort?`, `order?`, `start?`, `limit?`, `inUse?`, `updates?` |
| `arcane_image_pull` | Pull a Docker image in an environment. | `environmentId?`, `environmentName?`, `imageName` |
| `arcane_image_remove` | Remove a Docker image from an environment. | `environmentId?`, `environmentName?`, `imageId` |
| `arcane_image_prune` | Remove unused Docker images from an environment. | `environmentId?`, `environmentName?` |

### Volumes (4)

| Tool | Description | Inputs |
|---|---|---|
| `arcane_volume_list` | List Docker volumes in an environment. Returns pagination and in-use counts; if the response says there are more pages, pass start to see the rest before drawing conclusions about what exists. | `environmentId?`, `environmentName?`, `search?`, `sort?`, `order?`, `start?`, `limit?`, `inUse?`, `includeInternal?` |
| `arcane_volume_inspect` | Get details of a specific Docker volume. | `environmentId?`, `environmentName?`, `volumeName` |
| `arcane_volume_remove` | Remove a Docker volume from an environment. | `environmentId?`, `environmentName?`, `volumeName` |
| `arcane_volume_prune` | Remove unused Docker volumes from an environment. | `environmentId?`, `environmentName?` |

### Volume backups (5)

| Tool | Description | Inputs |
|---|---|---|
| `arcane_volume_backup_create` | Create a backup of a Docker volume. | `environmentId?`, `environmentName?`, `volumeName` |
| `arcane_volume_backup_list` | List backups of a Docker volume. Returns pagination; if the response says there are more pages, pass start to see the rest before drawing conclusions about what exists. | `environmentId?`, `environmentName?`, `volumeName`, `search?`, `sort?`, `order?`, `start?`, `limit?` |
| `arcane_volume_backup_delete` | Delete a volume backup. | `environmentId?`, `environmentName?`, `backupId` |
| `arcane_volume_backup_download` | Look up a volume backup and get a starting-point curl command to download it. This tool cannot stream the binary backup file to an MCP client, so it does NOT return the file itself: it verifies the backup really exists (isError if not), returns its metadata, and builds a curl command from THIS SERVER's own view of the Arcane API base URL (e.g. an internal Docker hostname, or a placeholder in Cloudflare Workers mode) — not necessarily a URL reachable from the machine that will run the curl. The human may need to swap in a different host before running it. | `environmentId?`, `environmentName?`, `volumeName`, `backupId` |
| `arcane_volume_backup_restore` | Restore a volume from a backup. | `environmentId?`, `environmentName?`, `volumeName`, `backupId` |

### Volume files (2)

| Tool | Description | Inputs |
|---|---|---|
| `arcane_volume_browse` | List the file tree of a Docker volume. The server may truncate the tree: check fileTreeTruncated before concluding a file does not exist. | `environmentId?`, `environmentName?`, `volumeName` |
| `arcane_volume_upload_file` | Upload a file to a Docker volume. | `environmentId?`, `environmentName?`, `volumeName`, `filename`, `content`, `path?` |

### Networks (4)

| Tool | Description | Inputs |
|---|---|---|
| `arcane_network_list` | List Docker networks in an environment. Returns pagination and in-use counts; if the response says there are more pages, pass start to see the rest before drawing conclusions about what exists. | `environmentId?`, `environmentName?`, `search?`, `sort?`, `order?`, `start?`, `limit?`, `inUse?` |
| `arcane_network_inspect` | Get details of a specific Docker network. | `environmentId?`, `environmentName?`, `networkId` |
| `arcane_network_remove` | Remove a Docker network from an environment. | `environmentId?`, `environmentName?`, `networkId` |
| `arcane_network_prune` | Remove unused Docker networks from an environment. | `environmentId?`, `environmentName?` |

### Templates (5)

| Tool | Description | Inputs |
|---|---|---|
| `arcane_template_list` | List Docker Compose templates. Returns pagination; if the response says there are more pages, pass start to see the rest before drawing conclusions about what exists. | `search?`, `sort?`, `order?`, `start?`, `limit?`, `type?` |
| `arcane_template_get` | Get details of a specific template. | `templateId` |
| `arcane_template_create` | Create a new Docker Compose template. | `name`, `description`, `content`, `envContent` |
| `arcane_template_update` | Update an existing template. The API replaces the whole template, so all fields are required. | `templateId`, `name`, `description`, `content`, `envContent` |
| `arcane_template_delete` | Delete a template. | `templateId` |

### Template registries (4)

| Tool | Description | Inputs |
|---|---|---|
| `arcane_template_registry_list` | List the template registries Arcane fetches Compose templates from. Check lastFetchError to see whether a registry is failing to load. | — |
| `arcane_template_registry_create` | Add a template registry. Template registries hold no credentials: a name, a URL, a description and enabled — all four are required. | `name`, `url`, `description`, `enabled` |
| `arcane_template_registry_update` | Update a template registry. All four fields are required and this replaces all of them, including the ones you didn't mean to change: read the current values with arcane_template_registry_list first, or you will silently overwrite a field with a guessed value. | `registryId`, `name`, `url`, `description`, `enabled` |
| `arcane_template_registry_delete` | Delete a template registry. | `registryId` |

### Git repositories (8)

| Tool | Description | Inputs |
|---|---|---|
| `arcane_git_repository_list` | List git repositories configured in Arcane. Returns repository IDs, names, URLs, authentication details and pagination; if the response says there are more pages, pass start to see the rest before drawing conclusions about what exists. | `search?`, `sort?`, `order?`, `start?`, `limit?` |
| `arcane_git_repository_get` | Get details of a specific git repository by ID. | `id` |
| `arcane_git_repository_create` | Create a new git repository in Arcane. | `name`, `url`, `authType`, `description?`, `enabled?`, `username?`, `token?`, `sshKey?`, `sshHostKeyVerification?` |
| `arcane_git_repository_update` | Update an existing git repository. | `id`, `name?`, `url?`, `authType?`, `description?`, `enabled?`, `username?`, `token?`, `sshKey?`, `sshHostKeyVerification?` |
| `arcane_git_repository_delete` | Delete a git repository from Arcane. | `id` |
| `arcane_git_repository_list_branches` | List all branches in a git repository. | `id` |
| `arcane_git_repository_browse_files` | Browse files in a git repository. | `id`, `branch?`, `path?` |
| `arcane_git_repository_test` | Test connection to a git repository. | `id`, `branch?` |

### GitOps syncs (8)

| Tool | Description | Inputs |
|---|---|---|
| `arcane_gitops_sync_list` | List GitOps syncs in an environment. Returns pagination and total/active/successful counts; if the response says there are more pages, pass start to see the rest before drawing conclusions about what exists. | `environmentId?`, `environmentName?`, `search?`, `sort?`, `order?`, `start?`, `limit?` |
| `arcane_gitops_sync_get` | Get details of a specific GitOps sync by ID or name. | `environmentId?`, `environmentName?`, `syncId?`, `syncName?` |
| `arcane_gitops_sync_create` | Create a GitOps sync configuration for automatic deployment from a git repository. | `environmentId?`, `environmentName?`, `name`, `repositoryId`, `branch`, `composePath`, `projectName?`, `autoSync?`, `syncInterval?` |
| `arcane_gitops_sync_update` | Update an existing GitOps sync. | `environmentId?`, `environmentName?`, `syncId?`, `syncName?`, `name?`, `repositoryId?`, `branch?`, `composePath?`, `projectName?`, `autoSync?`, `syncInterval?` |
| `arcane_gitops_sync_delete` | Delete a GitOps sync from an environment. | `environmentId?`, `environmentName?`, `syncId?`, `syncName?` |
| `arcane_gitops_sync_browse_files` | Browse files in a GitOps sync repository. | `environmentId?`, `environmentName?`, `syncId?`, `syncName?`, `path?` |
| `arcane_gitops_sync_get_status` | Get the current sync status of a GitOps sync. | `environmentId?`, `environmentName?`, `syncId?`, `syncName?` |
| `arcane_gitops_sync_perform_sync` | Manually trigger a sync for a GitOps sync. | `environmentId?`, `environmentName?`, `syncId?`, `syncName?` |

### System (5)

| Tool | Description | Inputs |
|---|---|---|
| `arcane_version` | Get the Arcane server version information. | — |
| `arcane_system_docker_info` | Get Docker daemon and host information: versions, container and image counts, storage driver, CPU/memory resources, and warnings. Pass full:true to get the complete raw Docker info object (70+ fields, including Plugins, Swarm and RegistryConfig) instead of this summary. | `environmentId?`, `environmentName?`, `full?` |
| `arcane_system_health` | Check whether the Docker system of an environment is healthy. Known issue: against Arcane 2.8.0 this endpoint always returns HTTP 500 (its Status field is never populated by the upstream handler), regardless of Docker's actual health — a 500 here is a known bug, not a verdict on Docker. Use arcane_system_docker_info to check Docker's status directly. | `environmentId?`, `environmentName?` |
| `arcane_system_prune` | Prune unused Docker resources. You must explicitly choose which resources to prune; nothing is pruned by default. | `environmentId?`, `environmentName?`, `buildCache?`, `images?`, `containers?`, `volumes?`, `networks?` |
| `arcane_system_convert` | Convert a docker run command into a Docker Compose service definition. | `environmentId?`, `environmentName?`, `dockerRunCommand` |

### Activities (3)

| Tool | Description | Inputs |
|---|---|---|
| `arcane_activity_list` | List background activities (deployments, pulls, scans) with optional filters. Returns pagination; if the response says there are more pages, pass start to see the rest before concluding an activity did not happen. | `environmentId?`, `environmentName?`, `search?`, `sort?`, `order?`, `start?`, `limit?`, `status?`, `type?`, `resourceType?` |
| `arcane_activity_get` | Get a background activity with its full message log. Use this to resolve the activityId returned by deploy, redeploy and pull operations. The server truncates the message log to 500 entries by default; pass limit to raise that. | `environmentId?`, `environmentName?`, `activityId`, `limit?` |
| `arcane_activity_cancel` | Cancel a running background activity. | `environmentId?`, `environmentName?`, `activityId`, `requestedBy?` |

### Events (2)

| Tool | Description | Inputs |
|---|---|---|
| `arcane_event_list` | List audit log events. Returns pagination; if the response says there are more pages, pass start to see the rest before concluding an event was not recorded. | `environmentId?`, `search?`, `sort?`, `order?`, `start?`, `limit?`, `severity?`, `type?` |
| `arcane_event_stats` | Get event counts by severity across all environments. | — |

### Jobs (4)

| Tool | Description | Inputs |
|---|---|---|
| `arcane_job_list` | List background jobs with their schedule, whether they are enabled, and whether they can be run manually. | `environmentId?`, `environmentName?` |
| `arcane_job_run` | Run a background job immediately. Jobs with unmet prerequisites will not execute. Some jobs have broad side effects when run this way: image-polling checks every image in the environment against its registry (the mass sweep this server otherwise does not expose), and auto-update would mutate running containers if Arcane's autoUpdate setting is ever enabled. Check what a job does with arcane_job_list before running it. | `environmentId?`, `environmentName?`, `jobId` |
| `arcane_job_schedules_get` | Get the configured intervals for scheduled background jobs. | `environmentId?`, `environmentName?` |
| `arcane_job_schedules_update` | Update one or more scheduled job intervals. Only the intervals provided are changed. Two of them govern background jobs with real side effects: scheduledPruneInterval controls how often unused Docker resources are automatically destroyed, and autoUpdateInterval controls how often running containers are automatically checked and mutated to newer images. | `environmentId?`, `environmentName?`, `autoHealInterval?`, `autoUpdateInterval?`, `dockerClientRefreshInterval?`, `environmentHealthInterval?`, `eventCleanupInterval?`, `expiredSessionsCleanupInterval?`, `pollingInterval?`, `scheduledPruneInterval?`, `vulnerabilityScanInterval?` |

### Image updates (4)

| Tool | Description | Inputs |
|---|---|---|
| `arcane_image_update_summary` | Get the aggregate image update counts for an environment: how many images there are, how many have updates available, and how many failed to check. Cheap: reads stored results, does not query any registry. | `environmentId?`, `environmentName?` |
| `arcane_image_update_status` | Get the STORED update information for specific image references. Does not query any registry, so it is fast and safe to call repeatedly. The response map can omit some of the requested references, and the response does not say why — the tool flags this in prose when it happens. Use arcane_image_update_check for a fresh answer on the omitted references. | `environmentId?`, `environmentName?`, `imageRefs` |
| `arcane_image_update_check` | Check ONE image for updates by querying its registry LIVE. Slower than arcane_image_update_status and subject to registry rate limits, so prefer the stored status unless you need a fresh answer. Accepts an image reference or an image ID. | `environmentId?`, `environmentName?`, `imageRef?`, `imageId?` |
| `arcane_image_update_check_batch` | Check a specific LIST of images for updates by querying their registries LIVE. Requires the list: checking every image at once is not exposed, because a scheduled job already does that sweep hourly. | `environmentId?`, `environmentName?`, `imageRefs` |

### Updater (3)

| Tool | Description | Inputs |
|---|---|---|
| `arcane_updater_status` | Report which containers and projects are being updated right now. | `environmentId?`, `environmentName?` |
| `arcane_updater_history` | List past automatic update runs. This endpoint reports no total count and cannot be paged, so the list may be incomplete: raise limit if you need to be sure you are seeing everything. | `environmentId?`, `environmentName?`, `limit?` |
| `arcane_updater_run` | Apply pending updates to SPECIFIC containers or projects, recreating them. You must name the targets: updating everything at once is deliberately not available. Pass dryRun to see what would happen without changing anything. | `environmentId?`, `environmentName?`, `resourceIds`, `type?`, `dryRun?`, `forceUpdate?` |

### Vulnerabilities (12)

| Tool | Description | Inputs |
|---|---|---|
| `arcane_vulnerability_scanner_status` | Check whether the vulnerability scanner (Trivy) is available in an environment, and its version. Check this before launching a scan with arcane_vulnerability_scan. | `environmentId?`, `environmentName?` |
| `arcane_vulnerability_summary` | Get the environment-wide vulnerability summary: how many images exist, how many have been scanned, and the aggregate CVE counts by severity. Images never scanned contribute nothing: check scannedImages vs totalImages before reading the counts as the whole picture. | `environmentId?`, `environmentName?` |
| `arcane_vulnerability_list` | List vulnerabilities across all scanned images in an environment, paginated. Filter by severity (critical, high, medium, low, unknown) and/or by exact image name. | `environmentId?`, `environmentName?`, `search?`, `sort?`, `order?`, `start?`, `limit?`, `severity?`, `imageName?` |
| `arcane_vulnerability_image_options` | List the names of images that have vulnerability scan results, optionally only those with findings of a given severity. Useful to discover what has been scanned before drilling down. | `environmentId?`, `environmentName?`, `severity?` |
| `arcane_vulnerability_scan_result` | Get the scan metadata for ONE image: status (scanning/completed/failed), scan time, scanner version, error if any, and the severity summary. The full CVE detail is deliberately NOT included — page through it with arcane_vulnerability_image_list. An error saying the scan was not found means there are no scan results for that image ID: either it was never scanned, or the ID is wrong — the error does not distinguish the two. Check the ID, then launch arcane_vulnerability_scan if you expect results. | `environmentId?`, `environmentName?`, `imageId` |
| `arcane_vulnerability_image_list` | List the vulnerabilities of ONE image, paginated, with full CVE detail per item. Filter by severity. An error saying the scan was not found means there are no scan results for that image ID: either it was never scanned, or the ID is wrong — the error does not distinguish the two. Check the ID, then launch arcane_vulnerability_scan if you expect results. | `environmentId?`, `environmentName?`, `imageId`, `search?`, `sort?`, `order?`, `start?`, `limit?`, `severity?` |
| `arcane_vulnerability_image_summary` | Get the vulnerability summary of ONE image: scan status, scan time and CVE counts by severity. An error saying the scan was not found means there are no scan results for that image ID: either it was never scanned, or the ID is wrong — the error does not distinguish the two. Check the ID, then launch arcane_vulnerability_scan if you expect results. | `environmentId?`, `environmentName?`, `imageId` |
| `arcane_vulnerability_image_summaries` | Get vulnerability scan summaries for a LIST of images in one call. The response map can omit some of the requested images, and the response does not say why — the tool flags this in prose when it happens. Use arcane_vulnerability_scan on the ones you expect to have results. | `environmentId?`, `environmentName?`, `imageIds` |
| `arcane_vulnerability_ignored_list` | List the vulnerabilities that have been marked as ignored in an environment, paginated. Each record includes who ignored it, when, and the stated reason. Use the record id with arcane_vulnerability_unignore to reverse one. | `environmentId?`, `environmentName?`, `search?`, `sort?`, `order?`, `start?`, `limit?` |
| `arcane_vulnerability_scan` | Launch a vulnerability scan (Trivy) of ONE image. The scan is asynchronous: this returns an acknowledgement with an activityId, not the result. Follow progress with arcane_activity_get, and read the outcome with arcane_vulnerability_scan_result once completed (~15 s for a small image). Scanning consumes CPU on the host. Check arcane_vulnerability_scanner_status first if unsure the scanner is available. | `environmentId?`, `environmentName?`, `imageId` |
| `arcane_vulnerability_ignore` | Mark ONE vulnerability of ONE image as ignored by creating a persistent ignore record. Requires a reason, which is stored and shown in arcane_vulnerability_ignored_list. Reversible with arcane_vulnerability_unignore. Measured against Arcane v2.8.0: creating the record does NOT change the CVE counts returned by arcane_vulnerability_image_summary or arcane_vulnerability_image_list — treat this as a tracked triage decision, not a reporting filter. | `environmentId?`, `environmentName?`, `imageId`, `vulnerabilityId`, `pkgName`, `reason`, `installedVersion?` |
| `arcane_vulnerability_unignore` | Remove an ignore record created by arcane_vulnerability_ignore, so it no longer appears in arcane_vulnerability_ignored_list. The ignoreId comes from arcane_vulnerability_ignored_list or from the record returned by arcane_vulnerability_ignore. Measured against Arcane v2.8.0: removing the record does NOT change the CVE counts returned by arcane_vulnerability_image_summary or arcane_vulnerability_image_list. | `environmentId?`, `environmentName?`, `ignoreId` |

### Container registries (4)

| Tool | Description | Inputs |
|---|---|---|
| `arcane_container_registry_list` | List the container registries Arcane pulls images from. Credentials are never returned by this API: tokens and AWS secret keys are absent from the response, so what you get is configuration only. | `search?`, `sort?`, `order?`, `start?`, `limit?` |
| `arcane_container_registry_get` | Get one container registry by ID. Credentials are never returned by this API. | `registryId` |
| `arcane_container_registry_pull_usage` | Report pull-rate usage per registry: observed pulls, and the remaining quota when the provider exposes one. | — |
| `arcane_container_registry_test` | Test connectivity and authentication to a container registry. Does not modify the registry's configuration in Arcane. This performs a real registry login against the third-party host; only the failure path has been observed (host unreachable) — the success path has not been exercised against this instance, so what it does beyond that is not confirmed. On failure the error text is the registry login output, which names the host and the reason. | `registryId` |

### Build workspace (4)

| Tool | Description | Inputs |
|---|---|---|
| `arcane_build_workspace_browse` | List files and directories in the build workspace of an environment. The workspace is a directory inside the Arcane agent, not the host filesystem, and paths cannot escape it. Measured against this instance: only 1 of the 6 environments has a usable build workspace. The other 5 respond "500 failed to ensure builds directory: mkdir /builds: permission denied". | `environmentId?`, `environmentName?`, `path?` |
| `arcane_build_workspace_read` | Read a file from the build workspace. Binary files are not returned: their MIME type and the number of bytes read are reported instead. Measured against this instance: only 1 of the 6 environments has a usable build workspace. The other 5 respond "500 failed to ensure builds directory: mkdir /builds: permission denied". | `environmentId?`, `environmentName?`, `path`, `maxBytes?` |
| `arcane_build_workspace_mkdir` | Create a directory in the build workspace. Measured against this instance: only 1 of the 6 environments has a usable build workspace. The other 5 respond "500 failed to ensure builds directory: mkdir /builds: permission denied". | `environmentId?`, `environmentName?`, `path` |
| `arcane_build_workspace_delete` | Delete a file or directory from the build workspace. A path is required: this tool cannot delete the workspace root. Measured against this instance: only 1 of the 6 environments has a usable build workspace. The other 5 respond "500 failed to ensure builds directory: mkdir /builds: permission denied". | `environmentId?`, `environmentName?`, `path` |

### Image builds (4)

| Tool | Description | Inputs |
|---|---|---|
| `arcane_image_build` | Build a Docker image with BuildKit. Note that load:false does NOT discard the image: it is still created and tagged. Build arguments are stored by Arcane and readable afterwards, so do not pass secrets. | `environmentId?`, `environmentName?`, `contextDir`, `dockerfile?`, `dockerfileInline?`, `tags?`, `buildArgs?`, `labels?`, `target?`, `platforms?`, `noCache?`, `pull?`, `push?`, `load?`, `provider?` |
| `arcane_project_build` | Build the Compose services of a project that declare a build directive. Do not rely on the project's hasBuildDirective field to decide: it reports false even for projects that do have one. | `environmentId?`, `environmentName?`, `projectId?`, `projectName?`, `services?`, `push?`, `load?`, `provider?` |
| `arcane_image_build_list` | List the image build history of an environment. Build argument values are hidden; their names are kept. The environmentId recorded on each build is the agent's own local id, not the environment you queried. | `environmentId?`, `environmentName?`, `search?`, `sort?`, `order?`, `start?`, `limit?`, `status?`, `provider?` |
| `arcane_image_build_get` | Get one build record with its full build log. Build argument values are hidden, but the log itself is returned verbatim and contains whatever the build printed, including anything it echoed by mistake. The environmentId recorded on the build is the agent's own local id, not the environment you queried. | `environmentId?`, `environmentName?`, `buildId` |

<!-- END TOOLS -->

**Note:** For tools that accept both `*Id` and `*Name` parameters (e.g., `environmentId` vs `environmentName`), you only need to provide one. The server will automatically resolve names to IDs via API calls.

## Local Development Setup

### Prerequisites

- [Bun](https://bun.sh/) runtime
- An Arcane instance running on port 3552 (or any accessible port)
- An Arcane API key

### Setup Steps

1. **Clone the repository**

```bash
git clone https://github.com/your-username/arcane-mcp-server.git
cd arcane-mcp-server
```

2. **Install dependencies**

```bash
bun install
```

3. **Configure local secrets**

Copy the example environment file and fill in your values:

```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` with your Arcane API key:

```
ARCANE_API_KEY=your-api-key-here
```

4. **Start the dev server**

```bash
bun run dev
```

The server will start on `http://localhost:8788`.

5. **Connect with MCP Inspector**

In a second terminal:

```bash
bunx @modelcontextprotocol/inspector@latest
```

Connect the inspector to `http://localhost:8788/mcp` to verify:
- All tools appear under **List Tools**
- `arcane_environment_list` returns real data from your Arcane instance
- `arcane_stack_list` with `environmentName` (not ID) works via name resolution
- `arcane_container_logs` returns log content
- Invalid tool inputs return proper error responses

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
`autoSync` sobre `main`. El sync escribe los ficheros nuevos en
`/opt/stacks/arcane-mcp` **e intenta redesplegar**, pero ese redeploy falla en este
proyecto:

```
redeploy failed: failed to prepare project images for deploy: node:22-bookworm-slim:
failed to resolve source metadata for docker.io/library/node:22-bookworm-slim:
no active sessions
```

No es un problema de red — el registro responde desde el host —, sino que el build
que lanza Arcane no tiene sesión de BuildKit para resolver la imagen base del
`Dockerfile`. Como `docker-compose.yml` usa `build: .` sin volumen, el código va
horneado en la imagen, así que sin rebuild no llega nada nuevo. En la práctica,
desplegar requiere lanzarlo a mano:

```bash
ssh VM-Control 'cd /opt/stacks/arcane-mcp && docker compose up -d --build'
```

Dos reglas que se ganaron a base de despliegues fantasma:

1. **Espera a que GitOps haya sincronizado tu commit antes de reconstruir.** El build
   toma el disco tal como esté; lanzarlo antes produce una imagen nueva con código
   viejo. Comprueba `lastSyncCommit` con `arcane_gitops_sync_get_status`.
2. **Verifica mirando dentro del contenedor**, no el estado del sync. Ni un
   `lastSyncStatus: success` ni uno `failed` te dicen qué código está sirviendo.

Todo el trabajo va en ramas y los merges a `main` son deliberados y verificados.

Para desplegar en Cloudflare Workers en su lugar, usa `npm run deploy`
(`wrangler.jsonc`, con binding de servicio VPC hacia Arcane).

Para contribuir, lee [cómo añadir una tool](docs/desarrollo/anadir-una-tool.md).

## Connecting Claude Desktop via mcp-remote

To use this MCP server with Claude Desktop, configure it in your Claude Desktop settings:

1. Install the `mcp-remote` client if you haven't already:

```bash
bunx @modelcontextprotocol/inspector@latest
```

2. Add the following to your Claude Desktop configuration file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "arcane": {
      "command": "bunx",
      "args": ["mcp-remote", "https://arcane-mcp-server.<account>.workers.dev/mcp"]
    }
  }
}
```

Replace `<account>` with your Cloudflare account identifier.

## Connecting OpenCode

To use this MCP server with [OpenCode](https://opencode.ai), configure it in your OpenCode settings:

1. Open OpenCode Settings → MCP Servers
2. Add a new MCP server with the following configuration:

```json
{
  "name": "Arcane",
  "url": "https://arcane-mcp-server.<account>.workers.dev/mcp",
  "transport": "sse"
}
```

Replace `<account>` with your Cloudflare account identifier.

### OpenCode Usage Examples

Once connected, you can interact with your Arcane Docker infrastructure through natural language conversations in OpenCode:

**Example 1: List environments**
```
User: Show me all my Docker environments
OpenCode: [Calls arcane_environment_list]
Here are your Docker environments:
- production (connected)
- staging (connected)
- dev (connected)
```

**Example 2: Deploy a stack using a template**
```
User: Deploy a WordPress stack to my production environment
OpenCode: [Calls arcane_template_list, then arcane_stack_deploy]
Deploying WordPress to production...
Stack 'wordpress' deployed successfully in environment 'production'
```

**Example 3: Start/stop containers**
```
User: Stop the database container in staging
OpenCode: [Calls arcane_environment_list, arcane_container_list, then arcane_container_stop]
Container 'db' stopped successfully in environment 'staging'
```

**Example 4: Pull and prune images**
```
User: Pull the latest nginx image and clean up unused images
OpenCode: [Calls arcane_image_pull, then arcane_image_prune]
Pulled nginx:latest...
Pruned 3 unused images, reclaimed 1.2GB
```

**Example 5: Inspect a volume**
```
User: Show me details of the data volume
OpenCode: [Calls arcane_volume_inspect]
Volume 'data' details:
- Driver: local
- Mountpoint: /var/lib/docker/volumes/data
- Created: 2024-01-15T10:30:00Z
- Size: 5.2GB
```

## Secrets Setup

Secrets are managed through the Cloudflare Dashboard:

1. Navigate to **Cloudflare Dashboard** → **Workers & Pages**
2. Select your `arcane-mcp-server` worker
3. Go to **Settings** → **Variables and Secrets**
4. Add the following secret (type: **Secret**):

| Name | Description |
|------|-------------|
| `ARCANE_API_KEY` | Your Arcane API key |

The Arcane host and port are configured via the Cloudflare VPC service binding (`service_id` in `wrangler.jsonc`) and do not need to be set here.

## Deployment via Cloudflare Workers Builds

This project uses Cloudflare Workers Builds for continuous deployment from Git.

### Initial Setup

1. **Connect your repository**

   Cloudflare Dashboard → **Workers & Pages** → **Create application** → **Import a repository** → select your GitHub repo.

2. **Configure build settings**

   - **Build command:** `bun run type-check`
   - **Deploy command:** `bunx wrangler deploy`

3. **Set secrets**

   Follow the [Secrets Setup](#secrets-setup) instructions above.

4. **Verify Worker name**

   The `name` in `wrangler.jsonc` must exactly match the Worker name in the Cloudflare dashboard. If there's a mismatch, the build will fail.

### Deploying

Simply push to your `main` branch:

```bash
git push origin main
```

Monitor the build: Dashboard → Workers & Pages → your worker → **Builds** → View build history.

## Running Tests

Run the test suite:

```bash
bun test
```

Run tests in watch mode:

```bash
bun run test:watch
```

All tests must pass before pushing to the repository.

## Architecture

This project follows the Cloudflare `agents` package pattern:

- **ArcaneAgent** (Durable Object): Manages MCP sessions using WebSocket hibernation
- **ArcaneClient**: Typed HTTP client for the Arcane REST API
- **Tool Registrations**: MCP tools organized by domain (environments, stacks, containers, etc.)
- **Name Resolution**: Automatic resolution of resource names to IDs for user-friendly interactions

The Durable Object pattern is required by the `agents` package and handles:
- WebSocket session management
- Session state persistence
- Both SSE and Streamable HTTP transports automatically
- Cold starts and reconnections seamlessly

## License

See LICENSE file for details.
