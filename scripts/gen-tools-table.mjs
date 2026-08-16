#!/usr/bin/env node
/**
 * Regenera la tabla de tools del README a partir de src/tools/, leyendo los
 * registros `server.tool(...)` con el compilador de TypeScript.
 *
 * Uso:
 *   npm run gen-tools-table          # reescribe el README
 *   npm run gen-tools-table -- --check   # falla si el README está desactualizado
 *
 * La tabla vive entre los marcadores BEGIN/END TOOLS del README. El resto del
 * fichero no se toca.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import ts from "typescript";

const README = "README.md";
const BEGIN = "<!-- BEGIN TOOLS -->";
const END = "<!-- END TOOLS -->";

// Fichero de src/tools/ -> título de sección. El orden define el orden del README.
// `resolve.ts` no registra tools: son helpers de resolución nombre->id.
const GROUPS = [
  ["environments.ts", "Environments"],
  ["stacks.ts", "Compose stacks"],
  ["projects-additional.ts", "Project lifecycle"],
  ["containers.ts", "Containers"],
  ["containers-additional.ts", "Containers — advanced"],
  ["images.ts", "Images"],
  ["volumes.ts", "Volumes"],
  ["volume-backups.ts", "Volume backups"],
  ["volume-files.ts", "Volume files"],
  ["networks.ts", "Networks"],
  ["templates.ts", "Templates"],
  ["git-repositories.ts", "Git repositories"],
  ["gitops-syncs.ts", "GitOps syncs"],
  ["system.ts", "System"],
  ["activities.ts", "Activities"],
  ["events.ts", "Events"],
];

/** Extrae {name, desc, params} de cada `server.tool(name, desc, shape, handler)`. */
function extractTools(file) {
  const path = `src/tools/${file}`;
  const src = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
  const tools = [];

  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.getText(src) === "tool" &&
      node.arguments.length >= 3 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      const params = [];
      const shape = node.arguments[2];
      if (ts.isObjectLiteralExpression(shape)) {
        for (const p of shape.properties) {
          if (!ts.isPropertyAssignment(p)) continue;
          params.push({
            name: p.name.getText(src),
            optional: p.initializer.getText(src).includes(".optional()"),
          });
        }
      }
      tools.push({
        name: node.arguments[0].text,
        desc: ts.isStringLiteral(node.arguments[1]) ? node.arguments[1].text : "",
        params,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(src);
  return tools;
}

const known = new Set(GROUPS.map(([f]) => f));
const present = readdirSync("src/tools").filter(f => f.endsWith(".ts") && f !== "resolve.ts");
const unmapped = present.filter(f => !known.has(f));
if (unmapped.length > 0) {
  console.error(`ERROR: ficheros de src/tools/ sin sección asignada: ${unmapped.join(", ")}`);
  console.error("Añádelos a GROUPS en este script, o la tabla los omitiría en silencio.");
  process.exit(1);
}

const fmtParams = (params) =>
  params.length === 0 ? "—" : params.map(p => `\`${p.name}${p.optional ? "?" : ""}\``).join(", ");

const lines = [];
let total = 0;
for (const [file, title] of GROUPS) {
  const tools = extractTools(file);
  if (tools.length === 0) continue;
  total += tools.length;
  lines.push(`### ${title} (${tools.length})`, "");
  lines.push("| Tool | Description | Inputs |");
  lines.push("|---|---|---|");
  for (const t of tools) {
    lines.push(`| \`${t.name}\` | ${t.desc.replace(/\|/g, "\\|")} | ${fmtParams(t.params)} |`);
  }
  lines.push("");
}

const intro = [
  `Las **${total}** tools que expone el servidor, agrupadas por dominio. Esta tabla la`,
  "genera `npm run gen-tools-table` a partir de `src/tools/`: las descripciones y los",
  "parámetros son los que registra el código, no una copia mantenida a mano.",
  "",
];
const table = [...intro, ...lines].join("\n").trimEnd();

const readme = readFileSync(README, "utf8");
const i = readme.indexOf(BEGIN);
const j = readme.indexOf(END);
if (i === -1 || j === -1) {
  console.error(`ERROR: no encuentro los marcadores ${BEGIN} / ${END} en ${README}.`);
  process.exit(1);
}

const next = `${readme.slice(0, i + BEGIN.length)}\n\n${table}\n\n${readme.slice(j)}`;

if (process.argv.includes("--check")) {
  if (next !== readme) {
    console.error(`ERROR: la tabla de tools del ${README} está desactualizada.`);
    console.error("Ejecuta: npm run gen-tools-table");
    process.exit(1);
  }
  console.log(`OK: la tabla del ${README} está al día (${total} tools).`);
  process.exit(0);
}

writeFileSync(README, next);
console.log(`Tabla regenerada en ${README}: ${total} tools en ${GROUPS.length} secciones.`);
