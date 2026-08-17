import { describe, it, expect } from "vitest";
import { e2eClient } from "./helpers";
import { ArcaneApiError } from "../arcane-client";

/**
 * Comprobacion contra la instancia real de los cuatro dominios de F2.
 *
 * Las mutantes siguen la regla del proyecto: cada test es dueño del sujeto que
 * muta, o la mutacion es idempotente. Prohibido podar imagenes, volumenes o
 * contenedores; cambiar intervalos reales; cancelar activities ajenas al test.
 */
describe("observabilidad (e2e, Arcane 2.8.0)", () => {
  const client = e2eClient();
  const envId = "0";

  it("activities.list devuelve el sobre paginado", async () => {
    const r = await client.activities.list(envId, { limit: 5 });
    expect(r.success).toBe(true);
    expect(Array.isArray(r.data ?? [])).toBe(true);
  });

  it("activities.get resuelve un activityId real y trae sus mensajes", async () => {
    const lista = await client.activities.list(envId, { limit: 1 });
    const primera = (lista.data ?? [])[0];
    // Sin datos el test falla, no se salta: un e2e verde tiene que significar
    // que la tool funciona, no que no habia nada que probar.
    expect(primera).toBeDefined();

    const detalle = await client.activities.get(envId, primera.id);
    expect(detalle.data.activity.id).toBe(primera.id);
    expect(detalle.data).toHaveProperty("messages");
  });

  it("activities.cancel sobre una activity terminada rechaza con 409 (no-op controlado)", async () => {
    // Sujeto: una activity ya terminada, donde cancelar es un no-op controlado:
    // no puede tener efecto sobre nada en marcha.
    //
    // HALLAZGO (real API vs. mock unitario): el mock de la Tarea 2 asumia que
    // cancelar una activity terminada resuelve con {success:false, data:{error:
    // "already finished", ...}}. La instancia real, en cambio, RECHAZA la
    // peticion con HTTP 409 "activity is not running" (ArcaneApiError), algo
    // confirmado tambien fuera del cliente JS con curl directo. La tool
    // arcane_activity_cancel ya lo maneja bien porque envuelve la llamada en
    // un catch generico, asi que no hay bug en la tool: el mock modelaba mal
    // esta rama de la API real.
    const lista = await client.activities.list(envId, { limit: 1, status: "success" });
    const terminada = (lista.data ?? [])[0];
    expect(terminada).toBeDefined();

    let capturado: unknown;
    try {
      await client.activities.cancel(envId, terminada.id, "e2e");
    } catch (err) {
      capturado = err;
    }
    expect(capturado).toBeInstanceOf(ArcaneApiError);
    expect((capturado as ArcaneApiError).status).toBe(409);
  });

  it("events.list global devuelve eventos", async () => {
    const r = await client.events.list({ limit: 5 });
    expect(r.success).toBe(true);
  });

  it("events.list filtrado por entorno usa la ruta por entorno", async () => {
    const r = await client.events.list({ environmentId: envId, limit: 5 });
    expect(r.success).toBe(true);
  });

  it("events.stats devuelve los cinco recuentos", async () => {
    const r = await client.events.stats();
    expect(r.data).toHaveProperty("total");
    expect(r.data).toHaveProperty("error");
    expect(typeof r.data.total).toBe("number");
  });

  it("jobs.list devuelve el sobre {jobs}, no el paginado", async () => {
    const r = await client.jobs.list(envId);
    expect(Array.isArray(r.jobs ?? [])).toBe(true);
    expect(r).not.toHaveProperty("pagination");
    expect((r.jobs ?? []).length).toBeGreaterThan(0);
  });

  it("jobs.run sobre un job con prerequisitos sin cumplir no llega a actuar", async () => {
    const lista = await client.jobs.list(envId);
    const inocuo = (lista.jobs ?? []).find(
      (j) => j.canRunManually && (j.prerequisites ?? []).some((p) => !p.isMet),
    );
    // Si no hay candidato inocuo el test falla: significa que la premisa de
    // seguridad del e2e ya no se cumple y hay que revisarla, no ignorarla.
    expect(inocuo).toBeDefined();

    const r = await client.jobs.run(envId, inocuo!.id);
    expect(r).toHaveProperty("message");
    expect(typeof r.success).toBe("boolean");
  });

  it("jobs.updateSchedules reescribe los mismos valores (escritura identidad)", async () => {
    const antes = await client.jobs.getSchedules(envId);
    const r = await client.jobs.updateSchedules(envId, { autoHealInterval: antes.autoHealInterval });
    expect(r.success).not.toBe(false);

    const despues = await client.jobs.getSchedules(envId);
    expect(despues.autoHealInterval).toBe(antes.autoHealInterval);
  });

  it("system.dockerInfo devuelve datos del demonio", async () => {
    const r = await client.system.dockerInfo(envId);
    expect(typeof r.ServerVersion).toBe("string");
    expect(typeof r.Containers).toBe("number");
  });

  it("system.health devuelve 500 por un bug del endpoint en Arcane 2.8.0", async () => {
    // Esta asercion parece rara a proposito. HEAD /environments/{id}/system/health
    // devuelve 500 de forma reproducible en Arcane 2.8.0, y NO porque Docker este
    // mal: system.dockerInfo responde 200 con el inventario completo del mismo
    // entorno. La causa esta en el upstream: SystemHealthOutput declara un campo
    // `Status int` que el handler nunca rellena, asi que vale 0, y las dos ramas
    // de error del handler devuelven 503, no 500.
    //
    // Se afirma el estado REALMENTE observado en vez de un 200 que no ocurre, para
    // que el test sea falsable: fallara el dia que el upstream lo arregle, que es
    // justo cuando queremos enterarnos.
    const r = await client.system.health(envId);
    expect(r.status).toBe(500);
    expect(r.ok).toBe(false);
  });

  it("system.prune poda SOLO la cache de build", async () => {
    // Unico recurso admitido en e2e. Nunca images, volumes ni containers.
    const r = await client.system.prune(envId, { buildCache: { mode: "dangling" } });
    expect(r.data.success).toBe(true);
    expect(r.data.imagesDeleted ?? []).toEqual([]);
    expect(r.data.volumesDeleted ?? []).toEqual([]);
    expect(r.data.containersPruned ?? []).toEqual([]);
  });

  it("system.convert traduce un docker run a compose", async () => {
    const r = await client.system.convert(envId, "docker run -d --name web -p 8080:80 nginx:alpine");
    expect(r.success).toBe(true);
    expect(r.dockerCompose).toContain("nginx:alpine");
    expect(r.serviceName.length).toBeGreaterThan(0);
  });
});
