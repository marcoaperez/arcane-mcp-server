import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArcaneClient, JobSchedulesUpdate } from "../arcane-client";
import { resolveEnvironmentId } from "./resolve";
import { withErrors, textResponse } from "./respond";

/** Los nueve intervalos configurables, tal y como los declara JobscheduleUpdate. */
const INTERVALOS = {
  autoHealInterval: z.string().optional().describe("Auto-heal interval, e.g. 30s"),
  autoUpdateInterval: z.string().optional().describe("Auto-update interval"),
  dockerClientRefreshInterval: z.string().optional().describe("Docker client refresh interval"),
  environmentHealthInterval: z.string().optional().describe("Environment health check interval"),
  eventCleanupInterval: z.string().optional().describe("Event cleanup interval"),
  expiredSessionsCleanupInterval: z.string().optional().describe("Expired sessions cleanup interval"),
  pollingInterval: z.string().optional().describe("Polling interval"),
  scheduledPruneInterval: z.string().optional().describe("Scheduled prune interval"),
  vulnerabilityScanInterval: z.string().optional().describe("Vulnerability scan interval"),
};

export function registerJobTools(server: McpServer, client: ArcaneClient): void {
  server.tool(
    "arcane_job_list",
    "List background jobs with their schedule, whether they are enabled, and whether they can be run manually.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
    },
    withErrors(async ({ environmentId, environmentName }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.jobs.list(envId);
      // Este endpoint devuelve {jobs:[...]}, no el sobre paginado del resto de
      // la API, asi que no pasa por listResponse. `jobs: null` se emitia como
      // el texto "null", que no es una lista vacia ni un error: era ruido.
      return textResponse(JSON.stringify(result.jobs ?? [], null, 2));
    }),
  );

  server.tool(
    "arcane_job_run",
    "Run a background job immediately. Jobs with unmet prerequisites will not execute.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      jobId: z.string().describe("Job ID, e.g. auto-heal"),
    },
    withErrors(async ({ environmentId, environmentName, jobId }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.jobs.run(envId, jobId);
      if (result.success === false) {
        return {
          content: [{ type: "text", text: `Error: ${result.message || "Job run failed"}` }],
          isError: true,
        };
      }
      return { content: [{ type: "text", text: result.message || "Job started" }] };
    }),
  );

  server.tool(
    "arcane_job_schedules_get",
    "Get the configured intervals for scheduled background jobs.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
    },
    withErrors(async ({ environmentId, environmentName }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.jobs.getSchedules(envId);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }),
  );

  server.tool(
    "arcane_job_schedules_update",
    "Update one or more scheduled job intervals. Only the intervals provided are changed. Two of them govern background jobs with real side effects: scheduledPruneInterval controls how often unused Docker resources are automatically destroyed, and autoUpdateInterval controls how often running containers are automatically checked and mutated to newer images.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      ...INTERVALOS,
    },
    withErrors(async ({ environmentId, environmentName, ...intervalos }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      // Solo se envian los intervalos indicados: el resto se deja intacto.
      const cambios = Object.fromEntries(
        Object.entries(intervalos).filter(([, v]) => v !== undefined),
      ) as JobSchedulesUpdate;
      const result = await client.jobs.updateSchedules(envId, cambios);
      if (result.success === false) {
        return {
          content: [{ type: "text", text: "Error: Job schedules update failed" }],
          isError: true,
        };
      }
      // La respuesta trae la configuracion ya aplicada: devolverla es mas util
      // que un texto fijo, y ademas confirma que los cambios cuajaron.
      return { content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }] };
    }),
  );
}
