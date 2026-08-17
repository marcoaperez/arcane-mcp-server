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
    //
    // sort=name&order=asc es OBLIGATORIO aqui, no cosmetico: medido contra
    // esta misma instancia, paginar con `start` SIN `sort` explicito no
    // garantiza un orden estable entre peticiones (Arcane 2.8.0) y el mismo
    // recorrido pierde elementos (ver el siguiente test, que lo documenta).
    // Es exactamente por lo que `collectAllPages` (src/tools/paging.ts)
    // exige `sort` como argumento obligatorio.
    const limit = 5;
    const sortOpts = { sort: "name", order: "asc" as const };
    const primera = await client.volumes.list(envId, { limit, start: 0, ...sortOpts });
    const total = primera.pagination.totalItems;

    // Si hubiera menos de 6 volumenes no habria nada que paginar y el test no
    // probaria nada: entonces falla, en vez de pasar vacio.
    expect(total).toBeGreaterThan(limit);
    expect(primera.pagination.totalPages).toBeGreaterThan(1);

    const nombres: string[] = [];
    for (let start = 0; start < total; start += limit) {
      const pagina = await client.volumes.list(envId, { limit, start, ...sortOpts });
      expect(pagina.pagination.currentPage).toBe(Math.floor(start / limit) + 1);
      nombres.push(...(pagina.data ?? []).map((v) => v.name));
    }

    expect(nombres).toHaveLength(total);
    expect(new Set(nombres).size).toBe(total);
  });

  it("documenta: paginar con start SIN sort no garantiza recorrer la coleccion entera (bug conocido de Arcane 2.8.0)", async () => {
    // Mismo recorrido que el test anterior pero sin `sort`/`order`. No se
    // afirma un numero de duplicados ni de elementos perdidos: eso haria el
    // test fragil (depende de cuantos volumenes haya ahora mismo) y lo
    // romperia el dia que Arcane arregle el bug upstream. Este test se
    // limita a documentar, con datos reales de la instancia, si el problema
    // se reproduce ahora mismo — y no falla en ningun caso: si algun dia
    // deja de reproducirse, sigue siendo informativo via console.info en vez
    // de romperse.
    const limit = 5;
    const primera = await client.volumes.list(envId, { limit, start: 0 });
    const total = primera.pagination.totalItems;

    if (total <= limit) {
      // Nada que paginar en esta instancia ahora mismo: no hay bug que
      // reproducir. El test de arriba (con sort) ya cubre este caso.
      return;
    }

    const nombres: string[] = [];
    for (let start = 0; start < total; start += limit) {
      const pagina = await client.volumes.list(envId, { limit, start }); // sin sort, a proposito
      nombres.push(...(pagina.data ?? []).map((v) => v.name));
    }

    const unicos = new Set(nombres).size;
    if (unicos < total) {
      // eslint-disable-next-line no-console
      console.warn(
        `[e2e] paginar sin sort perdio/repitio elementos: ${unicos}/${total} unicos ` +
          `(recogidos ${nombres.length}). Bug conocido de Arcane 2.8.0 en /environments/${envId}/volumes; ` +
          "ver el hallazgo 1 de los arreglos de la tarea 6 y src/tools/paging.ts.",
      );
    } else {
      // eslint-disable-next-line no-console
      console.info(
        "[e2e] paginar sin sort recorrio la coleccion entera esta vez: Arcane pudo haber " +
          "arreglado el bug, o el orden salio estable por azar. No se puede afirmar que el " +
          "bug este resuelto a partir de una sola pasada.",
      );
    }

    // La unica invariante que debe cumplirse siempre, con o sin el bug: cada
    // pagina devuelve exactamente los elementos que promete `totalItems`, ni
    // de mas ni de menos. Lo que el bug rompe es CUALES son, no CUANTOS.
    expect(nombres).toHaveLength(total);
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
