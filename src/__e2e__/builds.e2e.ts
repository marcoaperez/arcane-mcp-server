import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { e2eClient, entornoConWorkspaceDeBuilds } from "./helpers";

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
