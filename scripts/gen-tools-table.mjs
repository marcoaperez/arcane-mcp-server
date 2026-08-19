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
// Los ficheros sin tools estan en NON_TOOL_FILES, mas abajo.
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
  ["template-registries.ts", "Template registries"],
  ["git-repositories.ts", "Git repositories"],
  ["gitops-syncs.ts", "GitOps syncs"],
  ["system.ts", "System"],
  ["activities.ts", "Activities"],
  ["events.ts", "Events"],
  ["jobs.ts", "Jobs"],
  ["image-updates.ts", "Image updates"],
  ["updater.ts", "Updater"],
  ["vulnerabilities.ts", "Vulnerabilities"],
  ["container-registries.ts", "Container registries"],
  ["build-workspace.ts", "Build workspace"],
];

/** Extrae {name, desc, params} de cada `server.tool(name, desc, shape, handler)`. */
function extractTools(file) {
  const path = `src/tools/${file}`;
  const src = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
  const tools = [];

  // Declaraciones `const X = {...}` de nivel superior, para poder resolver los
  // `...X` (spreads) que aparezcan dentro del objeto de parametros de una tool.
  // Caso real: jobs.ts declara `const INTERVALOS = {...}` y lo esparce en el
  // shape de arcane_job_schedules_update.
  const topLevelObjectConsts = new Map();
  for (const stmt of src.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (ts.isIdentifier(decl.name) && decl.initializer && ts.isObjectLiteralExpression(decl.initializer)) {
        topLevelObjectConsts.set(decl.name.getText(src), decl.initializer);
      }
    }
  }

  /**
   * Extrae los parametros {name, optional} de un objeto literal de shape zod,
   * resolviendo los `...CONST` que referencien una constante de objeto literal
   * del mismo fichero. Ante cualquier elemento que no sepa resolver, ABORTA en
   * vez de omitirlo: el fallo silencioso anterior (un `continue` ante
   * SpreadAssignment) es justo lo que dejó pasar `arcane_job_schedules_update`
   * al README con 2 parámetros de los 11 reales, sin que `--check` lo detectara.
   */
  const extractParams = (objectLiteral, toolName) => {
    const params = [];
    for (const p of objectLiteral.properties) {
      if (ts.isPropertyAssignment(p)) {
        params.push({
          name: p.name.getText(src),
          optional: p.initializer.getText(src).includes(".optional()"),
        });
      } else if (ts.isSpreadAssignment(p) && ts.isIdentifier(p.expression)) {
        const constName = p.expression.getText(src);
        const resolved = topLevelObjectConsts.get(constName);
        if (!resolved) {
          throw new Error(
            `${path}: la tool "${toolName}" esparce "...${constName}" pero no hay una constante ` +
            `de objeto literal "${constName}" en el mismo fichero que se pueda resolver.`
          );
        }
        params.push(...extractParams(resolved, toolName));
      } else {
        throw new Error(
          `${path}: la tool "${toolName}" tiene en su objeto de parámetros un elemento que este ` +
          `generador no sabe resolver (${ts.SyntaxKind[p.kind]}). Antes se omitía en silencio; ` +
          `ahora aborta para que el README no publique una tool con parámetros incompletos.`
        );
      }
    }
    return params;
  };

  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.getText(src) === "tool" &&
      node.arguments.length >= 3 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      const toolName = node.arguments[0].text;
      const shape = node.arguments[2];
      const params = ts.isObjectLiteralExpression(shape) ? extractParams(shape, toolName) : [];
      tools.push({
        name: toolName,
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
// Ficheros de src/tools/ que no registran tools: helpers compartidos.
// `resolve.ts` resuelve nombre->id; `respond.ts` construye la respuesta de una
// tool; `paging.ts` recorre colecciones paginadas; `comma-list.ts` parte listas
// separadas por comas (usado por `image-updates.ts` y `updater.ts`).
const NON_TOOL_FILES = new Set(["resolve.ts", "respond.ts", "paging.ts", "comma-list.ts"]);
const present = readdirSync("src/tools").filter(f => f.endsWith(".ts") && !NON_TOOL_FILES.has(f));
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
