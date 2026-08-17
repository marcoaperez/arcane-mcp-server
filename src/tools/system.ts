import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ArcaneClient } from "../arcane-client";
import { resolveEnvironmentId } from "./resolve";

export function registerSystemTools(server: McpServer, client: ArcaneClient): void {
  server.tool(
    "arcane_version",
    "Get the Arcane server version information.",
    {},
    async () => {
      try {
        const result = await client.system.version();
        const lines = [
          `Arcane version: ${result.displayVersion}`,
          `Go version: ${result.goVersion}`,
          `Revision: ${result.shortRevision}`,
          ...(result.buildTime ? [`Build time: ${result.buildTime}`] : []),
          result.updateAvailable
            ? `Update available: ${result.newestVersion} — ${result.releaseUrl}`
            : `Up to date`,
        ];
        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "arcane_system_docker_info",
    "Get Docker daemon and host information: versions, container and image counts, storage driver, resources.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
    },
    async ({ environmentId, environmentName }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        const result = await client.system.dockerInfo(envId);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "arcane_system_health",
    "Check whether the Docker system of an environment is healthy.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
    },
    async ({ environmentId, environmentName }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        const { ok, status } = await client.system.health(envId);
        if (!ok) {
          return {
            content: [{ type: "text", text: `System is not healthy (HTTP ${status})` }],
            isError: true,
          };
        }
        return { content: [{ type: "text", text: `System is healthy (HTTP ${status})` }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "arcane_system_prune",
    "Prune unused Docker resources. You must explicitly choose which resources to prune; nothing is pruned by default.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      buildCache: z.string().optional().describe("Prune build cache with this mode, e.g. dangling or all"),
      images: z.string().optional().describe("Prune images with this mode, e.g. dangling or all"),
      containers: z.string().optional().describe("Prune stopped containers with this mode"),
      volumes: z.string().optional().describe("Prune unused volumes with this mode"),
      networks: z.string().optional().describe("Prune unused networks with this mode"),
    },
    async ({ environmentId, environmentName, buildCache, images, containers, volumes, networks }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        // Sin recurso explicito no se poda nada: un cuerpo vacio podria
        // interpretarse como "poda todo", que es justo lo que no se quiere.
        const opciones: Record<string, { mode: string }> = {};
        if (buildCache) opciones.buildCache = { mode: buildCache };
        if (images) opciones.images = { mode: images };
        if (containers) opciones.containers = { mode: containers };
        if (volumes) opciones.volumes = { mode: volumes };
        if (networks) opciones.networks = { mode: networks };
        if (Object.keys(opciones).length === 0) {
          return {
            content: [{
              type: "text",
              text: "Error: choose at least one resource to prune (buildCache, images, containers, volumes or networks).",
            }],
            isError: true,
          };
        }
        const result = await client.system.prune(envId, opciones);
        return { content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "arcane_system_convert",
    "Convert a docker run command into a Docker Compose service definition.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      dockerRunCommand: z.string().describe("The full docker run command to convert"),
    },
    async ({ environmentId, environmentName, dockerRunCommand }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        const result = await client.system.convert(envId, dockerRunCommand);
        const lines = [
          `Service: ${result.serviceName}`,
          "",
          result.dockerCompose,
          ...(result.envVars ? ["", "Environment:", result.envVars] : []),
        ];
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );
}
