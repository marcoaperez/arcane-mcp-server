#!/usr/bin/env node
/**
 * Audita el drift entre las interfaces TypeScript de src/arcane-client.ts
 * y los schemas del spec OpenAPI de Arcane (openapi.txt).
 *
 * Uso:
 *   node scripts/audit-schema-drift.mjs          # tabla Markdown
 *   node scripts/audit-schema-drift.mjs --json   # salida estructurada
 */
import { readFileSync } from "node:fs";
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

const iface = tsInterfaceProps("src/arcane-client.ts");
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
