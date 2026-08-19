import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArcaneClient, BuildStreamSummary } from "../arcane-client";
import { LINEAS_DE_LOG_CONSERVADAS } from "../arcane-client";
import { resolveEnvironmentId, resolveProjectId } from "./resolve";
import { withErrors, listResponse, textResponse } from "./respond";
import type { ToolResult } from "./respond";

function respuestaDeBuild(resumen: BuildStreamSummary): ToolResult {
  const partes: string[] = [resumen.message];
  if (resumen.activityId) partes.push(`Activity: ${resumen.activityId}`);
  if (resumen.droppedLines > 0) {
    partes.push(
      `Showing the last ${LINEAS_DE_LOG_CONSERVADAS} log lines; ${resumen.droppedLines} earlier lines omitted.`,
    );
  }
  partes.push(resumen.logTail.join("\n"));
  const texto = partes.join("\n");
  return resumen.success
    ? textResponse(texto)
    : { content: [{ type: "text", text: texto }], isError: true };
}

export function registerImageBuildTools(server: McpServer, client: ArcaneClient): void {
  server.tool(
    "arcane_image_build",
    "Build a Docker image with BuildKit. Note that load:false does NOT discard the image: it is still created and tagged. Build arguments are stored by Arcane and readable afterwards, so do not pass secrets.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      contextDir: z.string().min(1).describe("Build context directory or Git URL"),
      dockerfile: z.string().optional().describe("Dockerfile path within the context"),
      dockerfileInline: z.string().optional().describe("Inline Dockerfile content, instead of a path"),
      tags: z.array(z.string()).optional().describe("Image tags to apply"),
      buildArgs: z.record(z.string(), z.string()).optional().describe("Build arguments. Stored by Arcane and readable later: never pass secrets"),
      labels: z.record(z.string(), z.string()).optional().describe("OCI labels to apply to the image"),
      target: z.string().optional().describe("Target stage in a multi-stage Dockerfile"),
      platforms: z.array(z.string()).optional().describe("Target platforms for a multi-platform build, e.g. linux/amd64"),
      noCache: z.boolean().optional().describe("Disable the build cache"),
      pull: z.boolean().optional().describe("Always pull referenced base images"),
      push: z.boolean().optional().describe("Push the image to its registry"),
      load: z.boolean().optional().describe("Load the built image into Docker. false does NOT discard it: the image is still created and tagged"),
      provider: z.string().optional().describe("Build provider override"),
    },
    withErrors(async ({ environmentId, environmentName, ...req }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      return respuestaDeBuild(await client.imageBuilds.build(envId, req));
    }),
  );

  server.tool(
    "arcane_project_build",
    "Build the Compose services of a project that declare a build directive. Do not rely on the project's hasBuildDirective field to decide: it reports false even for projects that do have one.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      projectId: z.string().optional().describe("Project ID (use if known)"),
      projectName: z.string().optional().describe("Project name (alternative to ID)"),
      services: z.array(z.string()).optional().describe("Service names to build (defaults to all buildable services)"),
      push: z.boolean().optional().describe("Push the built images"),
      load: z.boolean().optional().describe("Load the built images into Docker. false does NOT discard them: they are still created and tagged"),
      provider: z.string().optional().describe("Build provider override"),
    },
    withErrors(async ({ environmentId, environmentName, projectId, projectName, ...req }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const projId = await resolveProjectId(client, envId, projectId, projectName);
      return respuestaDeBuild(await client.imageBuilds.buildProject(envId, projId, req));
    }),
  );

  server.tool(
    "arcane_image_build_list",
    "List the image build history of an environment. Build argument values are hidden; their names are kept. The environmentId recorded on each build is the agent's own local id, not the environment you queried.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      search: z.string().optional().describe("Free-text search over build records"),
      sort: z.string().optional().describe("Column to sort by, e.g. createdAt, status"),
      order: z.string().optional().describe("Sort direction: asc or desc"),
      start: z.number().int().min(0).optional().describe("Start index for pagination (server default: 0)"),
      limit: z.number().int().min(1).optional().describe("Items per page (server default: 20)"),
      status: z.string().optional().describe("Filter by status, e.g. success or failed"),
      provider: z.string().optional().describe("Filter by build provider"),
    },
    withErrors(async ({ environmentId, environmentName, ...opts }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.imageBuilds.list(envId, opts);
      return listResponse(result, "image builds");
    }),
  );

  server.tool(
    "arcane_image_build_get",
    "Get one build record with its full build log. Build argument values are hidden, but the log itself is returned verbatim and contains whatever the build printed, including anything it echoed by mistake.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      buildId: z.string().describe("Build ID"),
    },
    withErrors(async ({ environmentId, environmentName, buildId }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.imageBuilds.get(envId, buildId);
      const aviso = result.data.outputTruncated
        ? "This build log is TRUNCATED by the server: it is not the complete output.\n"
        : "";
      return textResponse(
        `${aviso}Build argument values are hidden; their names are kept.\n` +
          JSON.stringify(result.data, null, 2),
      );
    }),
  );
}
