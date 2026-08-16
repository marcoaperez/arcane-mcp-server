#!/usr/bin/env node
/**
 * Descarga el spec OpenAPI de una instancia Arcane real y lo escribe en
 * openapi.txt, que es la fuente de verdad del repo para los shapes de la API.
 *
 * Uso:
 *   npm run update-api-spec
 *   ARCANE_BASE_URL=http://otra-instancia:3552 npm run update-api-spec
 *
 * El endpoint /api/openapi.json de Arcane es público: no necesita API key.
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";

const BASE_URL = process.env.ARCANE_BASE_URL ?? "http://192.168.180.210:3552";
const OUTPUT = "openapi.txt";
const url = `${BASE_URL.replace(/\/+$/, "")}/api/openapi.json`;

function describe(spec) {
  return {
    version: spec?.info?.version ?? "(desconocida)",
    paths: Object.keys(spec?.paths ?? {}).length,
    schemas: Object.keys(spec?.components?.schemas ?? {}).length,
  };
}

let previous = null;
if (existsSync(OUTPUT)) {
  try {
    previous = describe(JSON.parse(readFileSync(OUTPUT, "utf8")));
  } catch (err) {
    console.warn(
      `AVISO: no se pudo leer el ${OUTPUT} existente (${err.message}). Se continúa igualmente porque se va a sobreescribir.`,
    );
  }
}

console.log(`Descargando ${url} ...`);
let response;
try {
  response = await fetch(url);
} catch (err) {
  console.error(`ERROR: no se pudo conectar con ${url} (${err.message}).`);
  process.exit(1);
}

if (!response.ok) {
  console.error(`ERROR: ${response.status} ${response.statusText}`);
  process.exit(1);
}

let spec;
try {
  spec = await response.json();
} catch (err) {
  console.error(`ERROR: la respuesta de ${url} no es JSON válido (${err.message}).`);
  process.exit(1);
}

if (!spec?.info?.version || !spec?.paths) {
  console.error("ERROR: la respuesta no parece un spec OpenAPI (falta info.version o paths).");
  process.exit(1);
}

const next = describe(spec);
writeFileSync(OUTPUT, JSON.stringify(spec));

if (previous) {
  console.log(`Antes:   ${previous.version} — ${previous.paths} paths, ${previous.schemas} schemas`);
}
console.log(`Ahora:   ${next.version} — ${next.paths} paths, ${next.schemas} schemas`);
console.log(`Escrito en ${OUTPUT}.`);
console.log("\nSiguiente paso obligatorio: reauditar el drift de campos con");
console.log("  node scripts/audit-schema-drift.mjs");
