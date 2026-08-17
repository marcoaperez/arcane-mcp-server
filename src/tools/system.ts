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
    "Get Docker daemon and host information: versions, container and image counts, storage driver, CPU/memory resources, and warnings. Pass full:true to get the complete raw Docker info object (70+ fields, including Plugins, Swarm and RegistryConfig) instead of this summary.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      full: z.boolean().optional().describe("Return the complete raw Docker info object instead of the summary"),
    },
    async ({ environmentId, environmentName, full }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        const result = await client.system.dockerInfo(envId);
        if (full) {
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        // Resumen: la tool solo promete versiones, recuentos de contenedores/imagenes,
        // storage driver, recursos y avisos. El objeto completo (70+ campos, con Plugins,
        // Swarm, RegistryConfig...) es puro coste de contexto salvo que se pida con full:true.
        const resumen = {
          versions: {
            serverVersion: result.ServerVersion,
            apiVersion: result.apiVersion,
            kernelVersion: result.KernelVersion,
            operatingSystem: result.OperatingSystem,
            osType: result.OSType,
            arch: result.arch,
          },
          containers: {
            total: result.Containers,
            running: result.ContainersRunning,
            paused: result.ContainersPaused,
            stopped: result.ContainersStopped,
          },
          images: result.Images,
          storageDriver: result.Driver,
          resources: {
            cpus: result.NCPU,
            memTotal: result.MemTotal,
          },
          warnings: result.Warnings,
        };
        return { content: [{ type: "text", text: JSON.stringify(resumen, null, 2) }] };
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
    "Check whether the Docker system of an environment is healthy. Known issue: against Arcane 2.8.0 this endpoint always returns HTTP 500 (its Status field is never populated by the upstream handler), regardless of Docker's actual health — a 500 here is a known bug, not a verdict on Docker. Use arcane_system_docker_info to check Docker's status directly.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
    },
    async ({ environmentId, environmentName }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        const { ok, status } = await client.system.health(envId);
        if (status === 500) {
          // Arcane 2.8.0: SystemHealthOutput declara `Status int` en el spec, pero el
          // handler nunca lo rellena, asi que este endpoint devuelve 500 SIEMPRE, incluso
          // con Docker perfectamente sano (verificado en vivo contra la instancia). No es
          // un veredicto sobre el estado de Docker: traducirlo a "not healthy" empujaria al
          // modelo a intentar remediar un Docker que no esta roto. arcane_system_docker_info
          // sobre el mismo entorno es la comprobacion real.
          return {
            content: [{
              type: "text",
              text:
                "System health check returned HTTP 500 — this is a known bug in Arcane 2.8.0's " +
                "/system/health endpoint (its Status field is never populated by the handler), NOT " +
                "a verdict on Docker's health. Use arcane_system_docker_info on this environment to " +
                "check the actual Docker status.",
            }],
          };
        }
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
      volumes: z
        .string()
        .optional()
        .describe(
          "Prune unused volumes with this mode. Irreversible: this permanently deletes their data, with no way to recover it.",
        ),
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
        // Es la tool mas destructiva de la fase: un success:false silenciado aqui
        // reportaria una poda normal mientras el host devuelve un fallo.
        if (result.success === false) {
          const motivo = result.data?.errors?.join("; ") || "Prune failed";
          return { content: [{ type: "text", text: `Error: ${motivo}` }], isError: true };
        }
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
