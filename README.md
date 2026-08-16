# Arcane Docker MCP Server

A Model Context Protocol (MCP) server for managing Docker environments through [Arcane](https://getarcane.app/), deployed on Cloudflare Workers.

This MCP server provides Claude Desktop and other MCP clients with tools to manage Docker containers, images, volumes, networks, and Docker Compose stacks via Arcane's REST API.

## What This Project Is

Arcane is a Docker management platform that provides a unified API for managing multiple Docker environments. This MCP server exposes Arcane's functionality as MCP tools, allowing you to interact with your Docker infrastructure through natural language conversations with Claude.

Built on Cloudflare Workers using the official Cloudflare `agents` package, this server provides a scalable, globally distributed way to manage your Docker resources.

## Available Tools

| Tool Name | Description | Required Inputs |
|-----------|-------------|-----------------|
| `arcane_environment_list` | List all Docker environments managed by Arcane | `search?`, `limit?` |
| `arcane_environment_get` | Get details of a specific environment | `environmentId?`, `environmentName?` |
| `arcane_environment_create` | Create a new Docker environment | `name`, `apiUrl`, `accessToken?`, `enabled?`, `isEdge?` |
| `arcane_environment_update` | Update an existing environment | `environmentId?`/`environmentName?`, `name?`, `apiUrl?`, etc. |
| `arcane_environment_delete` | Delete a Docker environment | `environmentId?`/`environmentName?` |
| `arcane_stack_list` | List Docker Compose stacks in an environment | `environmentId?`/`environmentName?`, `search?` |
| `arcane_stack_get` | Get details of a specific stack | `environmentId?`/`environmentName?`, `stackId?`/`stackName?` |
| `arcane_stack_deploy` | Deploy a new Docker Compose stack | `environmentId?`/`environmentName?`, `name`, `composeContent` |
| `arcane_stack_update` | Update an existing stack | `environmentId?`/`environmentName?`, `stackId?`/`stackName?` |
| `arcane_stack_start` | Start a Docker Compose stack | `environmentId?`/`environmentName?`, `stackId?`/`stackName?` |
| `arcane_stack_stop` | Stop a Docker Compose stack | `environmentId?`/`environmentName?`, `stackId?`/`stackName?` |
| `arcane_stack_restart` | Restart a Docker Compose stack | `environmentId?`/`environmentName?`, `stackId?`/`stackName?` |
| `arcane_stack_pull` | Pull images for a stack | `environmentId?`/`environmentName?`, `stackId?`/`stackName?` |
| `arcane_stack_delete` | Delete a Docker Compose stack | `environmentId?`/`environmentName?`, `stackId?`/`stackName?` |
| `arcane_container_list` | List all containers in an environment | `environmentId?`/`environmentName?` |
| `arcane_container_get` | Get details of a specific container | `environmentId?`/`environmentName?`, `containerId?`/`containerName?` |
| `arcane_container_start` | Start a container | `environmentId?`/`environmentName?`, `containerId?`/`containerName?` |
| `arcane_container_stop` | Stop a container | `environmentId?`/`environmentName?`, `containerId?`/`containerName?` |
| `arcane_container_restart` | Restart a container | `environmentId?`/`environmentName?`, `containerId?`/`containerName?` |
| `arcane_container_kill` | Force kill a container | `environmentId?`/`environmentName?`, `containerId?`/`containerName?` |
| `arcane_image_list` | List all Docker images in an environment | `environmentId?`/`environmentName?` |
| `arcane_image_pull` | Pull a Docker image | `environmentId?`/`environmentName?`, `imageName` |
| `arcane_image_remove` | Remove a Docker image | `environmentId?`/`environmentName?`, `imageId` |
| `arcane_image_prune` | Remove unused Docker images | `environmentId?`/`environmentName?` |
| `arcane_volume_list` | List all Docker volumes in an environment | `environmentId?`/`environmentName?` |
| `arcane_volume_inspect` | Get details of a specific volume | `environmentId?`/`environmentName?`, `volumeName` |
| `arcane_volume_remove` | Remove a Docker volume | `environmentId?`/`environmentName?`, `volumeName` |
| `arcane_volume_prune` | Remove unused Docker volumes | `environmentId?`/`environmentName?` |
| `arcane_network_list` | List all Docker networks in an environment | `environmentId?`/`environmentName?` |
| `arcane_network_inspect` | Get details of a specific network | `environmentId?`/`environmentName?`, `networkId` |
| `arcane_network_remove` | Remove a Docker network | `environmentId?`/`environmentName?`, `networkId` |
| `arcane_network_prune` | Remove unused Docker networks | `environmentId?`/`environmentName?` |
| `arcane_template_list` | List all Docker Compose templates | `search?`, `limit?` |
| `arcane_template_get` | Get details of a specific template | `templateId` |
| `arcane_template_create` | Create a new template | `name`, `description`, `content`, `envContent` |
| `arcane_template_update` | Update an existing template (full replace) | `templateId`, `name`, `description`, `content`, `envContent` |
| `arcane_template_delete` | Delete a template | `templateId` |
| `arcane_version` | Get the Arcane server version | - |

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
