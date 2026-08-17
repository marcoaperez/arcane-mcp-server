import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArcaneClient, JobSchedulesUpdate } from "../arcane-client";
import { resolveEnvironmentId } from "./resolve";

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
    async ({ environmentId, environmentName }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        const result = await client.jobs.list(envId);
        return { content: [{ type: "text", text: JSON.stringify(result.jobs, null, 2) }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "arcane_job_run",
    "Run a background job immediately. Jobs with unmet prerequisites will not execute.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      jobId: z.string().describe("Job ID, e.g. auto-heal"),
    },
    async ({ environmentId, environmentName, jobId }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        const result = await client.jobs.run(envId, jobId);
        if (result.success === false) {
          return {
            content: [{ type: "text", text: `Error: ${result.message || "Job run failed"}` }],
            isError: true,
          };
        }
        return { content: [{ type: "text", text: result.message || "Job started" }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "arcane_job_schedules_get",
    "Get the configured intervals for scheduled background jobs.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
    },
    async ({ environmentId, environmentName }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        const result = await client.jobs.getSchedules(envId);
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
    "arcane_job_schedules_update",
    "Update one or more scheduled job intervals. Only the intervals provided are changed.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      ...INTERVALOS,
    },
    async ({ environmentId, environmentName, ...intervalos }) => {
      try {
        const envId = await resolveEnvironmentId(client, environmentId, environmentName);
        // Solo se envian los intervalos indicados: el resto se deja intacto.
        const cambios = Object.fromEntries(
          Object.entries(intervalos).filter(([, v]) => v !== undefined),
        ) as JobSchedulesUpdate;
        const result = await client.jobs.updateSchedules(envId, cambios);
        if (result.success === false) {
          return {
            content: [{ type: "text", text: "Error: update failed" }],
            isError: true,
          };
        }
        // La respuesta trae la configuracion ya aplicada: devolverla es mas util
        // que un texto fijo, y ademas confirma que los cambios cuajaron.
        return { content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );
}
