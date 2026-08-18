import { describe, it, expect } from "vitest";
import { e2eClient } from "./helpers";

/**
 * Invariantes de las actualizaciones de imagenes contra la instancia real.
 *
 * Sin cifras clavadas: la instancia cambia. Se afirman relaciones que siguen
 * siendo verdad con 18 imagenes o con 300.
 */
describe("actualizaciones (e2e, Arcane 2.8.0)", () => {
  const client = e2eClient();
  const envId = "0";

  it("summary devuelve recuentos coherentes entre si", async () => {
    const r = await client.imageUpdates.summary(envId);
    expect(r.success).toBe(true);
    expect(r.data.totalImages).toBeGreaterThan(0);
    expect(r.data.imagesWithUpdates).toBeLessThanOrEqual(r.data.totalImages);
    expect(r.data.digestUpdates).toBeLessThanOrEqual(r.data.imagesWithUpdates);
  });

  it("el filtro updates cuadra con el recuento del summary", async () => {
    // Cruza la mitad nueva de la fase con la enriquecida: si una de las dos
    // miente, este test lo ve y los tests aislados no.
    const resumen = await client.imageUpdates.summary(envId);
    const conUpdate = await client.images.list(envId, { updates: "true", limit: 500 });
    expect(conUpdate.pagination.totalItems).toBe(resumen.data.imagesWithUpdates);
  });

  it("images.list devuelve usedBy, el campo que estaba diferido", async () => {
    const r = await client.images.list(envId, { limit: 200 });
    const enUso = (r.data ?? []).find((i) => i.inUse);
    expect(enUso).toBeDefined();
    expect(Array.isArray(enUso!.usedBy ?? [])).toBe(true);
    expect((enUso!.usedBy ?? []).length).toBeGreaterThan(0);
    expect(typeof enUso!.usedBy![0].type).toBe("string");
    expect(typeof enUso!.usedBy![0].name).toBe("string");
  });

  it("byRefs devuelve informacion persistida de las referencias pedidas", async () => {
    const imgs = await client.images.list(envId, { limit: 5 });
    const refs = (imgs.data ?? []).flatMap((i) => i.repoTags ?? []).slice(0, 2);
    expect(refs.length).toBeGreaterThan(0);

    const r = await client.imageUpdates.byRefs(envId, refs);
    expect(r.success).toBe(true);
    expect(typeof r.data).toBe("object");
    expect(Array.isArray(r.data)).toBe(false); // es un mapa, no un array
  });

  it("check en vivo responde para una imagen de un registro publico", async () => {
    // NO se usa ghcr.io/getarcaneapp/arcane: esta observado que devuelve
    // toomanyrequests de forma intermitente. Un fallo aqui debe significar que
    // la tool esta rota, no que el registro estaba limitando.
    const r = await client.imageUpdates.check(envId, { imageRef: "gitea/gitea:1.25.5" });
    expect(r.success).toBe(true);
    expect(typeof r.data.hasUpdate).toBe("boolean");
    expect(typeof r.data.updateType).toBe("string");
  });

  it("updater.status responde con los recuentos y sus listas", async () => {
    const r = await client.updater.status(envId);
    expect(r.success).toBe(true);
    expect(r.data.updatingContainers).toBe((r.data.containerIds ?? []).length);
    expect(r.data.updatingProjects).toBe((r.data.projectIds ?? []).length);
  });

  it("updater.history respeta el limit, que es el unico control que ofrece", async () => {
    const uno = await client.updater.history(envId, 1);
    expect((uno.data ?? []).length).toBeLessThanOrEqual(1);
  });

  it("updater.run exige resourceIds y no llega a llamar a la API sin ellos", async () => {
    await expect(client.updater.run(envId, { resourceIds: [] })).rejects.toThrow(/resourceIds/);
  });
});
