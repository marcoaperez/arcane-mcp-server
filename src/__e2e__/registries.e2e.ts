import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { e2eClient, siembraRegistroDeContenedor, borraRegistroDeContenedor } from "./helpers";

const client = e2eClient();

describe("e2e: registros de contenedor contra Arcane real", () => {
  let registroId: string;

  beforeAll(async () => {
    registroId = await siembraRegistroDeContenedor();
  });

  afterAll(async () => {
    if (registroId) await borraRegistroDeContenedor(registroId);
  });

  it("list() encuentra el registro sembrado y NO devuelve credenciales", async () => {
    const res = await client.containerRegistries.list({ limit: 100, sort: "url" });
    const sonda = (res.data ?? []).find(r => r.id === registroId);
    expect(sonda).toBeDefined();
    expect(sonda!.url).toBe("arcane-mcp-e2e.invalid");
    // La razon por la que estas lecturas se exponen: el secreto no vuelve.
    expect(JSON.stringify(sonda)).not.toContain("no-es-un-secreto-real");
    expect(Object.keys(sonda!)).not.toContain("token");
    expect(Object.keys(sonda!)).not.toContain("awsSecretAccessKey");
  });

  it("get() devuelve el mismo registro, tampoco con credenciales", async () => {
    const res = await client.containerRegistries.get(registroId);
    expect(res.data.id).toBe(registroId);
    expect(JSON.stringify(res.data)).not.toContain("no-es-un-secreto-real");
    expect(Object.keys(res.data)).not.toContain("token");
    expect(Object.keys(res.data)).not.toContain("awsSecretAccessKey");
  });

  it("pullUsage() incluye el registro sembrado", async () => {
    const res = await client.containerRegistries.pullUsage();
    const ids = (res.data.registries ?? []).map(r => r.registryId);
    expect(ids).toContain(registroId);
  });

  it("test() falla contra un host inexistente y el error nombra el host", async () => {
    // Zona no vista declarada: el camino de EXITO no se puede ejercitar,
    // porque no hay credenciales reales de ningun registro en esta instancia.
    await expect(client.containerRegistries.test(registroId)).rejects.toThrow(
      /arcane-mcp-e2e\.invalid/,
    );
  });
});

describe("e2e: registros de plantillas contra Arcane real", () => {
  let id: string;

  afterAll(async () => {
    if (id) {
      try { await client.templateRegistries.delete(id); }
      catch (e) {
        console.error(`\n[e2e] RESIDUO: registro de plantillas ${id} sin borrar: ${e}\n`);
      }
    }
  });

  it("create() devuelve el registro creado", async () => {
    const res = await client.templateRegistries.create({
      name: "arcane-mcp-e2e",
      url: "https://arcane-mcp-e2e.invalid/templates.json",
      description: "sonda e2e de arcane-mcp - borrar si sobrevive",
      enabled: false,
    });
    id = res.data.id;
    expect(res.data.name).toBe("arcane-mcp-e2e");
    expect(res.data.enabled).toBe(false);
  });

  it("list() lo encuentra", async () => {
    const res = await client.templateRegistries.list();
    expect((res.data ?? []).map(r => r.id)).toContain(id);
  });

  it("update() cambia la descripcion y el cambio se ve en list()", async () => {
    await client.templateRegistries.update(id, {
      name: "arcane-mcp-e2e",
      url: "https://arcane-mcp-e2e.invalid/templates.json",
      description: "descripcion cambiada por el e2e",
      enabled: false,
    });
    const res = await client.templateRegistries.list();
    const actual = (res.data ?? []).find(r => r.id === id);
    expect(actual!.description).toBe("descripcion cambiada por el e2e");
  });
});
