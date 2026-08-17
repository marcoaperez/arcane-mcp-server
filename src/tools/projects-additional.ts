import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArcaneClient } from "../arcane-client";
import { resolveEnvironmentId, resolveStackId } from "./resolve";
import { withErrors } from "./respond";

export function registerProjectAdditionalTools(server: McpServer, client: ArcaneClient): void {
  server.tool(
    "arcane_project_down",
    "Stop and remove containers, networks created by the project (preserves volumes).",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      projectId: z.string().optional().describe("Project ID (use if known)"),
      projectName: z.string().optional().describe("Project name (alternative to ID)"),
    },
    withErrors(async ({ environmentId, environmentName, projectId, projectName }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const pId = await resolveStackId(client, envId, projectId, projectName);
      const project = await client.stacks.get(envId, pId);
      const result = await client.projectAdditional.down(envId, pId);
      return {
        content: [{ type: "text", text: `Project '${project.data.name}' stopped successfully` }],
      };
    }),
  );

  server.tool(
    "arcane_project_pull_images",
    "Pull images for a project without starting containers.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      projectId: z.string().optional().describe("Project ID (use if known)"),
      projectName: z.string().optional().describe("Project name (alternative to ID)"),
    },
    withErrors(async ({ environmentId, environmentName, projectId, projectName }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const pId = await resolveStackId(client, envId, projectId, projectName);
      const project = await client.stacks.get(envId, pId);
      const result = await client.projectAdditional.pullImages(envId, pId);
      if (result.success === false) {
        return {
          content: [{ type: "text" as const, text: `Pull failed for project '${project.data.name}': ${result.message}` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text", text: `Images pulled successfully for project '${project.data.name}'. ${result.message}` }],
      };
    }),
  );

  server.tool(
    "arcane_project_redeploy",
    "Redeploy a project - stops and recreates all containers.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      projectId: z.string().optional().describe("Project ID (use if known)"),
      projectName: z.string().optional().describe("Project name (alternative to ID)"),
    },
    withErrors(async ({ environmentId, environmentName, projectId, projectName }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const pId = await resolveStackId(client, envId, projectId, projectName);
      const project = await client.stacks.get(envId, pId);
      const result = await client.projectAdditional.redeploy(envId, pId);
      if (result.success === false) {
        return {
          content: [{ type: "text" as const, text: `Failed to redeploy project '${project.data.name}': ${result.message}` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text", text: `Project '${project.data.name}' redeployed successfully. ${result.message}` }],
      };
    }),
  );

  server.tool(
    "arcane_project_destroy",
    "Stop and remove containers, networks, and optionally volumes and files for a project.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      projectId: z.string().optional().describe("Project ID (use if known)"),
      projectName: z.string().optional().describe("Project name (alternative to ID)"),
      removeFiles: z.boolean().optional().describe("Remove project files"),
      removeVolumes: z.boolean().optional().describe("Remove associated volumes"),
    },
    withErrors(async ({ environmentId, environmentName, projectId, projectName, removeFiles, removeVolumes }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const pId = await resolveStackId(client, envId, projectId, projectName);
      const project = await client.stacks.get(envId, pId);
      const result = await client.projectAdditional.destroy(envId, pId, removeFiles, removeVolumes);
      return {
        content: [{ type: "text", text: `Project '${project.data.name}' destroyed successfully` }],
      };
    }),
  );
}
