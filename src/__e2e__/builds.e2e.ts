import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { e2eClient, entornoConWorkspaceDeBuilds, IDEMPOTENT_STACK } from "./helpers";
import { resolveProjectId } from "../tools/resolve";

const client = e2eClient();
const DIR = "arcane-mcp-e2e";

describe("e2e: workspace de builds contra Arcane real", () => {
  let envId: string;

  beforeAll(async () => {
    envId = await entornoConWorkspaceDeBuilds();
  });

  afterAll(async () => {
    try { await client.buildWorkspace.delete(envId, DIR); }
    catch (e) { console.error(`\n[e2e] RESIDUO: no se pudo borrar '${DIR}' del workspace: ${e}\n`); }
  });

  it("mkdir() crea el directorio y browse() lo ve", async () => {
    await client.buildWorkspace.mkdir(envId, DIR);
    const res = await client.buildWorkspace.browse(envId);
    const entrada = (res.data ?? []).find(e => e.name === DIR);
    expect(entrada).toBeDefined();
    expect(entrada!.isDirectory).toBe(true);
  });

  it("browse() rechaza el traversal: la jaula la impone Arcane", async () => {
    await expect(client.buildWorkspace.browse(envId, "../..")).rejects.toThrow(/path traversal not allowed/);
  });

  it("mkdir() rechaza el traversal", async () => {
    await expect(client.buildWorkspace.mkdir(envId, "../fuera-de-la-jaula")).rejects.toThrow(
      /path traversal not allowed/,
    );
  });

  it("una ruta absoluta se re-enraiza dentro del workspace, no escapa", async () => {
    // /etc NO lista el /etc del contenedor: busca /builds/etc, que no existe.
    await expect(client.buildWorkspace.browse(envId, "/etc")).rejects.toThrow(/builds\/etc/);
  });

  it("delete() borra el directorio y browse() deja de verlo", async () => {
    await client.buildWorkspace.delete(envId, DIR);
    const res = await client.buildWorkspace.browse(envId);
    expect((res.data ?? []).map(e => e.name)).not.toContain(DIR);
  });
});

describe("e2e: builds contra Arcane real", () => {
  let envId: string;
  const TAG = "arcane-mcp-e2e:build";
  // Valor falso y ESTABLE: el historial de builds no se puede borrar, asi que
  // cada corrida acumula una fila. Con el mismo par siempre, lo que se acumula
  // son filas identicas e inocuas.
  const ARG = { ARCANE_MCP_E2E_ARG: "valor-de-prueba-no-secreto" };
  let buildId: string;

  beforeAll(async () => {
    envId = await entornoConWorkspaceDeBuilds();
  });

  afterAll(async () => {
    try {
      const imgs = await client.images.list(envId, { limit: 200, sort: "repo" });
      const sonda = (imgs.data ?? []).find(i => JSON.stringify(i.repoTags ?? []).includes("arcane-mcp-e2e"));
      if (sonda) await client.images.remove(envId, sonda.id);
    } catch (e) {
      console.error(`\n[e2e] RESIDUO: no se pudo borrar la imagen ${TAG}: ${e}\n`);
    }
  });

  it("build() construye y devuelve done con activityId", async () => {
    const res = await client.imageBuilds.build(envId, {
      contextDir: "/builds",
      dockerfileInline: "FROM alpine:3.19\nARG ARCANE_MCP_E2E_ARG\nRUN echo e2e-ok\n",
      tags: [TAG],
      buildArgs: ARG,
      load: false,
      push: false,
    });
    expect(res.success).toBe(true);
    expect(res.activityId).toBeTruthy();
    expect(res.logTail.join("\n")).toContain("e2e-ok");
  });

  it("build() con un contextDir inexistente falla, aunque el HTTP sea 200", async () => {
    const res = await client.imageBuilds.build(envId, { contextDir: "/no-existe-arcane-mcp-e2e" });
    expect(res.success).toBe(false);
    expect(res.message).toContain("build context not found");
  });

  it("list() encuentra la build y NO devuelve el valor del build arg", async () => {
    const res = await client.imageBuilds.list(envId, { limit: 20, sort: "createdAt", order: "desc" });
    const mia = (res.data ?? []).find(b => JSON.stringify(b.tags ?? []).includes("arcane-mcp-e2e"));
    expect(mia).toBeDefined();
    buildId = mia!.id;
    expect(JSON.stringify(res)).not.toContain("valor-de-prueba-no-secreto");
    expect(Object.keys(mia!.buildArgs ?? {})).toContain("ARCANE_MCP_E2E_ARG");
  });

  it("get() devuelve el log y tampoco el valor del build arg", async () => {
    const res = await client.imageBuilds.get(envId, buildId);
    expect(res.data.output).toContain("e2e-ok");
    expect(JSON.stringify(res)).not.toContain("valor-de-prueba-no-secreto");
  });

  it("buildProject() sobre el stack idempotente construye sus servicios", async () => {
    // IDEMPOTENT_STACK es 'ical-bridge', y su compose.yaml tiene `build: .`
    // (verificado el 2026-08-19 leyendo el compose desplegado). arcane-mcp
    // tambien lo tiene y esta VETADO como sujeto: construirlo recrea el
    // contenedor que atiende este canal MCP.
    //
    // El id se RESUELVE por nombre, no se cablea: un id fijo es la misma
    // fragilidad que hace fallar a resolvers.e2e.ts 2 de cada 12 corridas.
    const projId = await resolveProjectId(client, "0", undefined, IDEMPOTENT_STACK);
    const res = await client.imageBuilds.buildProject("0", projId, {});
    expect(res.success).toBe(true);
  });
});
