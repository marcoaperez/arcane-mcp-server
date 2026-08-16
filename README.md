# Arcane Docker MCP Server

> **Fork mantenido activamente por [Taiko Solutions](https://taikosolutions.com).**
> Verificado contra **Arcane v2.7.0**: las **58** combinaciones método+ruta que usa el
> cliente existen en el spec de la instancia, sin ausencias. Origen del fork:
> [`cougz/arcane-mcp-server`](https://github.com/cougz/arcane-mcp-server), inactivo
> desde marzo de 2026.
>
> | | |
> |---|---|
> | **Compatibilidad** | Arcane v2.x (probado contra v2.7.0) |
> | **Spec de referencia** | [`openapi.txt`](openapi.txt) — descargado de la instancia con `npm run update-api-spec` |
> | **Tools** | 68 |
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
| Path de `arcane_stack_pull` | `/pull-project-images`, inexistente en Arcane v2.x → 404 | `/pull`, según el spec v2.7.0 |
| Compatibilidad de shapes | Escrito contra Arcane v1.x | Interfaces alineadas con v2.7.0 y auditadas por `scripts/audit-schema-drift.mjs` |
| Despliegue | Solo Cloudflare Workers | Cloudflare Workers **o** contenedor Docker autoalojado (`docker-compose.yml` + `wrangler.local.jsonc`) |
| Cliente | `baseUrl` fijo hacia el binding VPC | Modo dual: binding VPC en Workers, URL real en local/Docker |
| Verificación | Sin runner de tests funcional | 107 tests unitarios + suite e2e contra una instancia Arcane real |

El fix de los endpoints NDJSON se ha ofrecido al upstream como PR autocontenido.

## Available Tools

<!-- BEGIN TOOLS -->

Las **68** tools que expone el servidor, agrupadas por dominio. Esta tabla la
genera `npm run gen-tools-table` a partir de `src/tools/`: las descripciones y los
parámetros son los que registra el código, no una copia mantenida a mano.

### Environments (5)

| Tool | Description | Inputs |
|---|---|---|
| `arcane_environment_list` | List all Docker environments managed by Arcane. Returns environment IDs, names, and connection status. | `search?`, `limit?` |
| `arcane_environment_get` | Get details of a specific Docker environment by ID or name. | `environmentId?`, `environmentName?` |
| `arcane_environment_create` | Create a new Docker environment in Arcane. | `name`, `apiUrl`, `accessToken?`, `bootstrapToken?`, `enabled?`, `isEdge?`, `useApiKey?` |
| `arcane_environment_update` | Update an existing Docker environment. | `environmentId?`, `environmentName?`, `name?`, `apiUrl?`, `accessToken?`, `bootstrapToken?`, `enabled?`, `regenerateApiKey?` |
| `arcane_environment_delete` | Delete a Docker environment from Arcane. | `environmentId?`, `environmentName?` |

### Compose stacks (9)

| Tool | Description | Inputs |
|---|---|---|
| `arcane_stack_list` | List all Docker Compose stacks (projects) in an environment. | `environmentId?`, `environmentName?`, `search?`, `limit?` |
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
| `arcane_container_list` | List all Docker containers in an environment. | `environmentId?`, `environmentName?` |
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
| `arcane_image_list` | List all Docker images in an environment. | `environmentId?`, `environmentName?` |
| `arcane_image_pull` | Pull a Docker image in an environment. | `environmentId?`, `environmentName?`, `imageName` |
| `arcane_image_remove` | Remove a Docker image from an environment. | `environmentId?`, `environmentName?`, `imageId` |
| `arcane_image_prune` | Remove unused Docker images from an environment. | `environmentId?`, `environmentName?` |

### Volumes (4)

| Tool | Description | Inputs |
|---|---|---|
| `arcane_volume_list` | List all Docker volumes in an environment. | `environmentId?`, `environmentName?` |
| `arcane_volume_inspect` | Get details of a specific Docker volume. | `environmentId?`, `environmentName?`, `volumeName` |
| `arcane_volume_remove` | Remove a Docker volume from an environment. | `environmentId?`, `environmentName?`, `volumeName` |
| `arcane_volume_prune` | Remove unused Docker volumes from an environment. | `environmentId?`, `environmentName?` |

### Volume backups (5)

| Tool | Description | Inputs |
|---|---|---|
| `arcane_volume_backup_create` | Create a backup of a Docker volume. | `environmentId?`, `environmentName?`, `volumeName` |
| `arcane_volume_backup_list` | List all backups for a Docker volume. | `environmentId?`, `environmentName?`, `volumeName`, `search?`, `sort?`, `order?`, `start?`, `limit?` |
| `arcane_volume_backup_delete` | Delete a volume backup. | `environmentId?`, `environmentName?`, `backupId` |
| `arcane_volume_backup_download` | Download a volume backup. Returns download URL or instructions. | `environmentId?`, `environmentName?`, `backupId` |
| `arcane_volume_backup_restore` | Restore a volume from a backup. | `environmentId?`, `environmentName?`, `volumeName`, `backupId` |

### Volume files (2)

| Tool | Description | Inputs |
|---|---|---|
| `arcane_volume_browse` | Browse files and directories in a Docker volume. | `environmentId?`, `environmentName?`, `volumeName`, `path?` |
| `arcane_volume_upload_file` | Upload a file to a Docker volume. | `environmentId?`, `environmentName?`, `volumeName`, `filename`, `content`, `path?` |

### Networks (4)

| Tool | Description | Inputs |
|---|---|---|
| `arcane_network_list` | List all Docker networks in an environment. | `environmentId?`, `environmentName?` |
| `arcane_network_inspect` | Get details of a specific Docker network. | `environmentId?`, `environmentName?`, `networkId` |
| `arcane_network_remove` | Remove a Docker network from an environment. | `environmentId?`, `environmentName?`, `networkId` |
| `arcane_network_prune` | Remove unused Docker networks from an environment. | `environmentId?`, `environmentName?` |

### Templates (5)

| Tool | Description | Inputs |
|---|---|---|
| `arcane_template_list` | List all Docker Compose templates. | `search?`, `limit?` |
| `arcane_template_get` | Get details of a specific template. | `templateId` |
| `arcane_template_create` | Create a new Docker Compose template. | `name`, `description`, `content`, `envContent` |
| `arcane_template_update` | Update an existing template. The API replaces the whole template, so all fields are required. | `templateId`, `name`, `description`, `content`, `envContent` |
| `arcane_template_delete` | Delete a template. | `templateId` |

### Git repositories (8)

| Tool | Description | Inputs |
|---|---|---|
| `arcane_git_repository_list` | List all git repositories configured in Arcane. Returns repository IDs, names, URLs, and authentication details. | `search?`, `sort?`, `order?`, `start?`, `limit?` |
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
| `arcane_gitops_sync_list` | List all GitOps syncs in an environment. GitOps syncs automatically deploy stacks from git repositories. | `environmentId?`, `environmentName?`, `search?`, `sort?`, `order?`, `start?`, `limit?` |
| `arcane_gitops_sync_get` | Get details of a specific GitOps sync by ID or name. | `environmentId?`, `environmentName?`, `syncId?`, `syncName?` |
| `arcane_gitops_sync_create` | Create a GitOps sync configuration for automatic deployment from a git repository. | `environmentId?`, `environmentName?`, `name`, `repositoryId`, `branch`, `composePath`, `projectName?`, `autoSync?`, `syncInterval?` |
| `arcane_gitops_sync_update` | Update an existing GitOps sync. | `environmentId?`, `environmentName?`, `syncId?`, `syncName?`, `name?`, `repositoryId?`, `branch?`, `composePath?`, `projectName?`, `autoSync?`, `syncInterval?` |
| `arcane_gitops_sync_delete` | Delete a GitOps sync from an environment. | `environmentId?`, `environmentName?`, `syncId?`, `syncName?` |
| `arcane_gitops_sync_browse_files` | Browse files in a GitOps sync repository. | `environmentId?`, `environmentName?`, `syncId?`, `syncName?`, `path?` |
| `arcane_gitops_sync_get_status` | Get the current sync status of a GitOps sync. | `environmentId?`, `environmentName?`, `syncId?`, `syncName?` |
| `arcane_gitops_sync_perform_sync` | Manually trigger a sync for a GitOps sync. | `environmentId?`, `environmentName?`, `syncId?`, `syncName?` |

### System (1)

| Tool | Description | Inputs |
|---|---|---|
| `arcane_version` | Get the Arcane server version information. | — |

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
