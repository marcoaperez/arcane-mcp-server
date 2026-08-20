#!/usr/bin/env node
/**
 * Audita el drift entre las interfaces TypeScript del cliente
 * (src/arcane-client.ts y src/arcane-client/*.ts)
 * y los schemas del spec OpenAPI de Arcane (openapi.txt).
 *
 * Uso:
 *   node scripts/audit-schema-drift.mjs          # tabla Markdown
 *   node scripts/audit-schema-drift.mjs --json   # salida estructurada
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import ts from "typescript";

// Interfaz TS -> schema del spec. Solo los tipos que representan payloads
// de la API (no los *Create/*Update, que son cuerpos de petición nuestros).
const MAP = {
  Environment: "EnvironmentEnvironment",
  Project: "ProjectDetails",
  ContainerSummary: "ContainerSummary",
  ImageSummary: "ImageSummary",
  Volume: "VolumeVolume",
  NetworkSummary: "NetworkSummary",
  NetworkInspect: "NetworkInspect",
  Pagination: "BasePaginationResponse",
  VersionInfo: "VersionInfo",
  ContainerDetails: "ContainerDetails",
  GitRepository: "GitopsGitRepository",
  GitOpsSync: "GitopsGitOpsSync",
  Template: "TemplateTemplate",
  VolumeBackup: "VolumeBackup",
  VolumeWorkspace: "WorkspaceWorkspace",
  WorkspaceFileEntry: "WorkspaceFileEntry",
  Activity: "ActivityActivity",
  ActivityDetail: "ActivityDetail",
  ActivityMessage: "ActivityMessage",
  ActivityStartedBy: "ActivityStartedBy",
  JobPrerequisite: "JobscheduleJobPrerequisite",
  Event: "EventEvent",
  EventSeverityCounts: "EventSeverityCounts",
  JobStatus: "JobscheduleJobStatus",
  JobSchedulesConfig: "JobscheduleConfig",
  SystemPruneResult: "SystemPruneAllResult",
  SystemConvertResult: "SystemConvertDockerRunResponse",
  DockerInfo: "DockerinfoInfo",
  ContainerStatusCounts: "ContainerStatusCounts",
  VolumeUsageCounts: "DockerVolumeVolumeUsageCountsData",
  NetworkUsageCounts: "NetworkUsageCounts",
  GitopsSyncCounts: "GitopsSyncCounts",
  ImageUpdateResponse: "ImageupdateResponse",
  ImageUpdateInfo: "ImageUpdateInfo",
  ImageUpdateSummary: "ImageupdateSummary",
  ImageUsedBy: "ImageUsedBy",
  ProjectUpdateInfo: "ProjectUpdateInfo",
  UpdaterResult: "UpdaterResult",
  UpdaterResourceResult: "UpdaterResourceResult",
  UpdaterStatus: "UpdaterStatus",
  AutoUpdateRecord: "AutoUpdateRecord",
  ScannerStatus: "ScannerStatus",
  VulnerabilitySeveritySummary: "VulnerabilitySeveritySummary",
  VulnerabilityCVSSInfo: "VulnerabilityCVSSInfo",
  Vulnerability: "VulnerabilityVulnerability",
  VulnerabilityWithImage: "VulnerabilityVulnerabilityWithImage",
  VulnerabilityScanResult: "VulnerabilityScanResult",
  VulnerabilityScanSummary: "VulnerabilityScanSummary",
  VulnerabilityScanSummariesResponse: "VulnerabilityScanSummariesResponse",
  EnvironmentVulnerabilitySummary: "VulnerabilityEnvironmentVulnerabilitySummary",
  IgnoredVulnerability: "VulnerabilityIgnoredVulnerability",
  ContainerRegistry: "ContainerregistryContainerRegistry",
  RegistryPullUsage: "ContainerregistryPullUsage",
  TemplateRegistry: "TemplateTemplateRegistry",
  BuildWorkspaceEntry: "WorkspaceFileEntry",
  BuildFileContent: "BuildFileContentResponse",
  ImageBuildRecord: "ImageBuildRecord",
  UploadSession: "UploadSession",
};

function tsInterfaceProps(file) {
  const src = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const out = {};
  src.forEachChild((node) => {
    if (!ts.isInterfaceDeclaration(node)) return;
    out[node.name.text] = node.members
      .filter(ts.isPropertySignature)
      .map((m) => ({ name: m.name.getText(src), optional: !!m.questionToken }));
  });
  return out;
}

/**
 * Ficheros donde viven las interfaces del cliente.
 *
 * Desde que src/arcane-client.ts se partio por dominios, los tipos ya no estan
 * todos en un fichero. Este auditor leia SOLO el fichero raiz y, tras la
 * particion, reportaba las 24 interfaces como INTERFAZ-AUSENTE: no daba un
 * numero equivocado, se quedaba CIEGO -habria dejado de cazar drift real-.
 * Se descubren los ficheros en vez de listarlos para que anadir un dominio
 * nuevo no vuelva a romperlo en silencio.
 */
function ficherosDelCliente() {
  const ficheros = ["src/arcane-client.ts"];
  const dir = "src/arcane-client";
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).sort()) {
      if (f.endsWith(".ts")) ficheros.push(`${dir}/${f}`);
    }
  }
  return ficheros;
}

/**
 * Fusiona las interfaces de todos los ficheros del cliente, pero a diferencia
 * de un `Object.assign` liso, NO deja que un nombre duplicado gane en
 * silencio ("gana el ultimo fichero leido"): si dos dominios declaran la
 * misma interfaz, este auditor contrastaria contra la declaracion equivocada
 * sin que nadie se entere. Revienta en vez de fusionar.
 */
function fusionaInterfaces(ficheros) {
  const iface = {};
  const origenDe = new Map();
  for (const f of ficheros) {
    for (const [nombre, miembros] of Object.entries(tsInterfaceProps(f))) {
      const origenPrevio = origenDe.get(nombre);
      if (origenPrevio) {
        throw new Error(
          `Interfaz \`${nombre}\` declarada en mas de un fichero: ${origenPrevio} y ${f}. ` +
            `El auditor de drift no puede saber cual de las dos representa el tipo real; renombra una de las dos.`,
        );
      }
      iface[nombre] = miembros;
      origenDe.set(nombre, f);
    }
  }
  return iface;
}

const iface = fusionaInterfaces(ficherosDelCliente());
const spec = JSON.parse(readFileSync("openapi.txt", "utf8"));
const schemas = spec.components.schemas;

const findings = [];
for (const [tsName, schemaName] of Object.entries(MAP)) {
  const schema = schemas[schemaName];
  if (!schema) {
    findings.push({ tsName, schemaName, field: "*", status: "SCHEMA-AUSENTE" });
    continue;
  }
  const members = iface[tsName];
  if (!members) {
    findings.push({ tsName, schemaName, field: "*", status: "INTERFAZ-AUSENTE" });
    continue;
  }

  const specProps = schema.properties ?? {};
  const required = new Set(schema.required ?? []);

  for (const m of members) {
    if (!(m.name in specProps)) {
      findings.push({ tsName, schemaName, field: m.name, status: "SOBRA-EN-TS" });
    } else if (required.has(m.name) && m.optional) {
      findings.push({ tsName, schemaName, field: m.name, status: "OPCIONAL-PERO-REQUERIDO" });
    } else if (!required.has(m.name) && !m.optional) {
      findings.push({ tsName, schemaName, field: m.name, status: "OBLIGATORIO-PERO-OPCIONAL" });
    }
  }

  const tsNames = new Set(members.map((m) => m.name));
  for (const p of Object.keys(specProps)) {
    if (!tsNames.has(p)) {
      findings.push({
        tsName,
        schemaName,
        field: p,
        status: required.has(p) ? "FALTA-EN-TS-REQUERIDO" : "FALTA-EN-TS-OPCIONAL",
      });
    }
  }
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ specVersion: spec.info.version, findings }, null, 2));
} else {
  console.log(`Spec: Arcane API ${spec.info.version} (${Object.keys(spec.paths).length} paths)\n`);
  console.log("| Interfaz TS | Schema spec | Campo | Estado |");
  console.log("|---|---|---|---|");
  for (const f of findings) {
    console.log(`| \`${f.tsName}\` | \`${f.schemaName}\` | \`${f.field}\` | ${f.status} |`);
  }
  console.log(`\nTotal: ${findings.length} desalineaciones.`);
}
