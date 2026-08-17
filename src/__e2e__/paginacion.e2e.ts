import { describe, it, expect } from "vitest";
import { e2eClient } from "./helpers";

/**
 * Invariantes de la superficie de listado contra la instancia real.
 *
 * Todo es lectura: ninguna de estas comprobaciones muta nada.
 *
 * No se afirma ninguna cantidad concreta. Un test que dijera "32 volumenes"
 * empezaria a fallar el dia que se cree el volumen 33, sin que nada este roto.
 */
describe("paginacion (e2e, Arcane 2.8.0)", () => {
  const client = e2eClient();
  const envId = "0";

  it("containers.list trae counts y cuadra con la paginacion", async () => {
    const r = await client.containers.list(envId);
    expect(r.counts).toBeDefined();
    expect(r.counts.totalContainers).toBe(r.pagination.totalItems);
  });

  it("volumes.list trae counts y cuadra con la paginacion", async () => {
    const r = await client.volumes.list(envId);
    expect(r.counts).toBeDefined();
    expect(r.counts.total).toBe(r.pagination.totalItems);
    expect(r.counts.inuse + r.counts.unused).toBe(r.counts.total);
  });

  it("networks.list trae counts y cuadra con la paginacion", async () => {
    const r = await client.networks.list(envId);
    expect(r.counts).toBeDefined();
    expect(r.counts.total).toBe(r.pagination.totalItems);
  });

  it("start recorre la coleccion entera sin repetir ni perder elementos", async () => {
    // limit=5 fuerza la paginacion en cualquier recurso con 6 o mas elementos.
    const limit = 5;
    const primera = await client.volumes.list(envId, { limit, start: 0 });
    const total = primera.pagination.totalItems;

    // Si hubiera menos de 6 volumenes no habria nada que paginar y el test no
    // probaria nada: entonces falla, en vez de pasar vacio.
    expect(total).toBeGreaterThan(limit);
    expect(primera.pagination.totalPages).toBeGreaterThan(1);

    const nombres: string[] = [];
    for (let start = 0; start < total; start += limit) {
      const pagina = await client.volumes.list(envId, { limit, start });
      expect(pagina.pagination.currentPage).toBe(Math.floor(start / limit) + 1);
      nombres.push(...(pagina.data ?? []).map((v) => v.name));
    }

    expect(nombres).toHaveLength(total);
    expect(new Set(nombres).size).toBe(total);
  });

  it("limit por encima del total lo devuelve todo en una pagina", async () => {
    const r = await client.volumes.list(envId, { limit: 1000 });
    expect(r.pagination.totalPages).toBe(1);
    expect(r.data ?? []).toHaveLength(r.pagination.totalItems);
  });

  it("stacks.list respeta el limit que antes se descartaba", async () => {
    const r = await client.stacks.list(envId, { limit: 1 });
    expect(r.pagination.itemsPerPage).toBe(1);
    expect((r.data ?? []).length).toBeLessThanOrEqual(1);
  });

  it("activities.list acepta sort, order y start", async () => {
    const r = await client.activities.list(envId, { sort: "createdAt", order: "desc", start: 0, limit: 3 });
    expect(r.success).toBe(true);
    expect((r.data ?? []).length).toBeLessThanOrEqual(3);
  });
});
