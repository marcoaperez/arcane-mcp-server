import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArcaneClient } from "../arcane-client";
import { resolveEnvironmentId } from "./resolve";
import { withErrors, textResponse, listResponse } from "./respond";
import { parseCommaList } from "./comma-list";

const LIST_PARAMS = {
  search: z.string().optional().describe("Free-text search over vulnerability IDs and package names"),
  sort: z.string().optional().describe("Column to sort by, e.g. severity, pkgName, vulnerabilityId"),
  order: z.string().optional().describe("Sort direction: asc or desc"),
  start: z.number().int().min(0).optional().describe("Start index for pagination (server default: 0)"),
  limit: z.number().int().min(1).optional().describe("Items per page (server default: 20)"),
};

export function registerVulnerabilityTools(server: McpServer, client: ArcaneClient): void {
  server.tool(
    "arcane_vulnerability_scanner_status",
    "Check whether the vulnerability scanner (Trivy) is available in an environment, and its version. Check this before launching a scan with arcane_vulnerability_scan.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
    },
    withErrors(async ({ environmentId, environmentName }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.vulnerabilities.scannerStatus(envId);
      return textResponse(JSON.stringify(result.data, null, 2));
    }),
  );

  server.tool(
    "arcane_vulnerability_summary",
    "Get the environment-wide vulnerability summary: how many images exist, how many have been scanned, and the aggregate CVE counts by severity. Images never scanned contribute nothing: check scannedImages vs totalImages before reading the counts as the whole picture.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
    },
    withErrors(async ({ environmentId, environmentName }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.vulnerabilities.environmentSummary(envId);
      return textResponse(JSON.stringify(result.data, null, 2));
    }),
  );

  server.tool(
    "arcane_vulnerability_list",
    "List vulnerabilities across all scanned images in an environment, paginated. Filter by severity (critical, high, medium, low, unknown) and/or by exact image name.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      ...LIST_PARAMS,
      severity: z.string().optional().describe("Filter by severity: critical, high, medium, low or unknown"),
      imageName: z.string().optional().describe("Filter by exact image name, e.g. 'curlimages/curl:8.5.0'"),
    },
    withErrors(async ({ environmentId, environmentName, search, sort, order, start, limit, severity, imageName }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.vulnerabilities.listAll(envId, { search, sort, order, start, limit, severity, imageName });
      return listResponse(result, "vulnerabilities");
    }),
  );

  server.tool(
    "arcane_vulnerability_image_options",
    "List the names of images that have vulnerability scan results, optionally only those with findings of a given severity. Useful to discover what has been scanned before drilling down.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      severity: z.string().optional().describe("Only images with findings of this severity: critical, high, medium, low or unknown"),
    },
    withErrors(async ({ environmentId, environmentName, severity }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.vulnerabilities.imageOptions(envId, severity);
      return textResponse(JSON.stringify(result.data, null, 2));
    }),
  );

  server.tool(
    "arcane_vulnerability_scan_result",
    "Get the scan metadata for ONE image: status (scanning/completed/failed), scan time, scanner version, error if any, and the severity summary. The full CVE detail is deliberately NOT included — page through it with arcane_vulnerability_image_list. An error saying the scan was not found means there are no scan results for that image ID: either it was never scanned, or the ID is wrong — the error does not distinguish the two. Check the ID, then launch arcane_vulnerability_scan if you expect results.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      imageId: z.string().describe("Image ID (sha256:...), from arcane_image_list"),
    },
    withErrors(async ({ environmentId, environmentName, imageId }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.vulnerabilities.scanResult(envId, imageId);
      // Recorte deliberado (spec F4 §4.1): el detalle completo pesa cientos de
      // KB (124 KB medidos con solo 44 CVEs) y ya es accesible paginado via
      // arcane_vulnerability_image_list. Aqui, los metadatos que solo este
      // endpoint tiene, mas el summary.
      const { vulnerabilities, ...meta } = result.data;
      const n = vulnerabilities?.length ?? 0;
      return textResponse(
        `Scan metadata and summary. The CVE detail (${n} item(s)) is NOT included here: ` +
          `use arcane_vulnerability_image_list to page through it.\n` +
          JSON.stringify(meta, null, 2),
      );
    }),
  );

  server.tool(
    "arcane_vulnerability_image_list",
    "List the vulnerabilities of ONE image, paginated, with full CVE detail per item. Filter by severity. An error saying the scan was not found means there are no scan results for that image ID: either it was never scanned, or the ID is wrong — the error does not distinguish the two. Check the ID, then launch arcane_vulnerability_scan if you expect results.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      imageId: z.string().describe("Image ID (sha256:...), from arcane_image_list"),
      ...LIST_PARAMS,
      severity: z.string().optional().describe("Filter by severity: critical, high, medium, low or unknown"),
    },
    withErrors(async ({ environmentId, environmentName, imageId, search, sort, order, start, limit, severity }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.vulnerabilities.imageList(envId, imageId, { search, sort, order, start, limit, severity });
      return listResponse(result, "vulnerabilities");
    }),
  );

  server.tool(
    "arcane_vulnerability_image_summary",
    "Get the vulnerability summary of ONE image: scan status, scan time and CVE counts by severity. An error saying the scan was not found means there are no scan results for that image ID: either it was never scanned, or the ID is wrong — the error does not distinguish the two. Check the ID, then launch arcane_vulnerability_scan if you expect results.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      imageId: z.string().describe("Image ID (sha256:...), from arcane_image_list"),
    },
    withErrors(async ({ environmentId, environmentName, imageId }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.vulnerabilities.imageSummary(envId, imageId);
      return textResponse(JSON.stringify(result.data, null, 2));
    }),
  );

  server.tool(
    "arcane_vulnerability_image_summaries",
    "Get vulnerability scan summaries for a LIST of images in one call. The response map can omit some of the requested images, and the response does not say why — the tool flags this in prose when it happens. Use arcane_vulnerability_scan on the ones you expect to have results.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      imageIds: z.string().describe("Image IDs, comma-separated, e.g. 'sha256:abc,sha256:def'"),
    },
    withErrors(async ({ environmentId, environmentName, imageIds }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const pedidas = parseCommaList(imageIds);
      const result = await client.vulnerabilities.imageSummaries(envId, pedidas);
      const texto = JSON.stringify(result.data, null, 2);
      // Comprobado contra la instancia real: la API omite del mapa IDs pedidas
      // sin decir por qué -incluso un ID que no existe (sha256:000...0) se omite
      // igual que una imagen real sin escaneo, y openapi.txt no documenta ningún
      // motivo para las omisiones. Se dice lo que se sabe -que faltan del mapa-
      // sin afirmar por qué, porque la tool tampoco lo sabe, y se da la acción:
      // verificar los IDs y pedir escaneo fresco con arcane_vulnerability_scan.
      const devueltas = new Set(Object.keys(result.data.summaries ?? {}));
      const faltantes = pedidas.filter((id) => !devueltas.has(id));
      if (faltantes.length > 0) {
        return textResponse(
          `The response omits ${faltantes.length} of ${pedidas.length} requested image(s): ` +
            `${faltantes.join(", ")}. The response does not say why they are missing: an image ` +
            `that was never scanned and an image ID that does not exist are both omitted the same way. ` +
            `Check the IDs, and use arcane_vulnerability_scan on the ones you expect to have results.\n${texto}`,
        );
      }
      return textResponse(texto);
    }),
  );

  server.tool(
    "arcane_vulnerability_ignored_list",
    "List the vulnerabilities that have been marked as ignored in an environment, paginated. Each record includes who ignored it, when, and the stated reason. Use the record id with arcane_vulnerability_unignore to reverse one.",
    {
      environmentId: z.string().optional().describe("Environment ID (use if known)"),
      environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
      ...LIST_PARAMS,
    },
    withErrors(async ({ environmentId, environmentName, search, sort, order, start, limit }) => {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.vulnerabilities.ignoredList(envId, { search, sort, order, start, limit });
      return listResponse(result, "ignored vulnerabilities");
    }),
  );
}
