import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArcaneClient } from "../arcane-client";
import { resolveEnvironmentId } from "./resolve";
import { withErrors } from "./respond";

export function registerContainerAdditionalTools(server: McpServer, client: ArcaneClient): void {
  server.tool(
    "arcane_container_create",
    "Create and start a new Docker container.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      name: z.string().describe("Container name"),
      image: z.string().describe("Docker image name"),
      cmd: z.array(z.string()).optional().describe("Command to run in container"),
      env: z.array(z.string()).optional().describe("Environment variables (e.g., ['KEY=value'])"),
      ports: z.union([z.string(), z.object({}).passthrough()]).optional().describe("Port mappings (e.g., {'80': '8080'})"),
      volumes: z.array(z.string()).optional().describe("Volume bindings (e.g., ['host:container'])"),
      networks: z.array(z.string()).optional().describe("Network names to connect to"),
      restartPolicy: z.string().optional().describe("Restart policy (e.g., 'always', 'on-failure')"),
      detach: z.boolean().optional().describe("Run container in background"),
    },
    withErrors(async ({ environmentId, environmentName, name, image, cmd, env, ports, volumes, networks, restartPolicy, detach }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const dto: any = { name, image };
      if (cmd) dto.cmd = cmd;
      if (env) dto.env = env;
      if (ports) dto.ports = typeof ports === 'string' ? JSON.parse(ports) : ports;
      if (volumes) dto.volumes = volumes;
      if (networks) dto.networks = networks;
      if (restartPolicy) dto.restartPolicy = restartPolicy;
      if (detach !== undefined) dto.detach = detach;
      const result = await client.containerAdditional.create(envId, dto);
      return {
        content: [{ type: "text", text: `Container created successfully:\n${JSON.stringify(result.data, null, 2)}` }],
      };
    }),
  );

  server.tool(
    "arcane_container_delete",
    "Delete a Docker container.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      containerId: z.string().optional().describe("Container ID (use if known)"),
      containerName: z.string().optional().describe("Container name (alternative to ID)"),
      force: z.boolean().optional().describe("Force remove running container"),
      volumes: z.boolean().optional().describe("Remove associated volumes"),
    },
    withErrors(async ({ environmentId, environmentName, containerId, containerName, force, volumes }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const cid = containerId || containerName;
      if (!cid) {
        throw new Error("Either containerId or containerName must be provided");
      }
      const result = await client.containerAdditional.delete(envId, cid, force, volumes);
      return {
        content: [{ type: "text", text: result.message || "Container deleted successfully" }],
      };
    }),
  );

  server.tool(
    "arcane_container_update",
    "Update a Docker container configuration.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      containerId: z.string().optional().describe("Container ID (use if known)"),
      containerName: z.string().optional().describe("Container name (alternative to ID)"),
    },
    withErrors(async ({ environmentId, environmentName, containerId, containerName }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const cid = containerId || containerName;
      if (!cid) {
        throw new Error("Either containerId or containerName must be provided");
      }
      const result = await client.containerAdditional.update(envId, cid);
      return {
        content: [{ type: "text", text: result.message || "Container updated successfully" }],
      };
    }),
  );
}
