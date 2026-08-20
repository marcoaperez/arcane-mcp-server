import { describe, it, expect, beforeAll } from "vitest";
import type { ArcaneClient } from "../arcane-client";
import { e2eClient } from "./helpers";
import { resolveEnvironmentId, resolveStackId, resolveContainerId } from "../tools/resolve";
import { resolveGitOpsSyncId } from "../tools/gitops-syncs";

/**
 * Comprobacion contra la instancia real de los cuatro resolvers nombre->id
 * (Tarea 10): `resolveEnvironmentId`, `resolveStackId`, `resolveContainerId`
 * y `resolveGitOpsSyncId`.
 *
 * Antes de este fichero, NINGUN e2e los ejercitaba: `stack-lifecycle.e2e.ts`
 * busca el stack con su propio `stacks.list({search}).data.find(...)`, y
 * `volume-workspace.e2e.ts` pasa el nombre del volumen tal cual como
 * parametro de ruta. Los resolvers son el cambio de mas riesgo de la tarea 6:
 * deciden si se le dice al modelo que algo no existe, asi que necesitan su
 * propia cobertura contra la API real, no solo contra el mock unitario.
 *
 * Solo lectura: ningun test de este fichero muta nada.
 */
describe("e2e: resolvers nombre->id contra Arcane real", () => {
  const client: ArcaneClient = e2eClient();
  let envId: string;

  beforeAll(async () => {
    const envs = await client.environments.list();
    const localDocker = (envs.data ?? []).find((e) => e.name === "Local Docker");
    if (!localDocker) {
      throw new Error("La instancia no tiene un entorno llamado 'Local Docker'");
    }
    envId = localDocker.id;
  });

  it("resolveEnvironmentId resuelve 'Local Docker' al mismo id que devuelve el listado", async () => {
    const resolved = await resolveEnvironmentId(client, undefined, "Local Docker");
    expect(resolved).toBe(envId);
  });

  it("resolveStackId resuelve 'arcane' al mismo id que devuelve el listado", async () => {
    const stacks = await client.stacks.list(envId, { search: "arcane" });
    // search es filtrado en servidor y puede devolver mas de una coincidencia
    // parcial (p.ej. tambien "arcane-mcp"); el nombre exacto identifica cual.
    const esperado = (stacks.data ?? []).find((s) => s.name === "arcane");
    expect(esperado).toBeDefined();

    const resolved = await resolveStackId(client, envId, undefined, "arcane");
    expect(resolved).toBe(esperado!.id);
  });

  it("resolveContainerId resuelve el ULTIMO contenedor ordenado por nombre", async () => {
    // El nombre esperado se DERIVA del mismo listado, no se cablea.
    //
    // Este test cableaba 'terminus-worker-1', medido a mano cuando se escribio.
    // Fallaba ~2 de cada 12 corridas, y la investigacion del 2026-08-20 dio con
    // el motivo: el invariante "X es el ultimo contenedor" no es una propiedad
    // del resolver, es una propiedad del inventario del host, y ese inventario
    // lo mutan TRES actores independientes -esta misma suite, que redespliega
    // ical-bridge en stack-lifecycle.e2e.ts; el sync de GitOps, cada 5 minutos;
    // y el auto-updater-. Medido: en reposo el invariante se cumple en 949 de
    // 949 muestras, pero un redespliegue real sube el recuento de 16 a 17.
    //
    // El mecanismo concreto, cazado el 2026-08-20: ese contenedor de mas lleva
    // un nombre ALEATORIO de Docker (adjetivo_cientifico). Se observo uno,
    // 'compassionate_faraday'. Los que empiezan por u-z -vigilant_turing,
    // zealous_curie, wonderful_bohr...- ordenan DESPUES de terminus-worker-1 y
    // le roban la ultima posicion. Son ~5% de la lista de adjetivos de Docker,
    // que con varios contenedores efimeros por corrida da la tasa observada de
    // ~2 fallos por cada 12 corridas.
    //
    // Se conserva la intencion original -ejercitar el ULTIMO elemento, no el
    // primero, para que un resolver que solo mirase la primera pagina cayera-
    // sin depender de que el host tenga hoy los contenedores de entonces.
    const pagina = await client.containers.list(envId, { start: 0, limit: 200, sort: "name" });
    const items = pagina.data ?? [];
    expect(items.length).toBeGreaterThan(0);

    const ultimo = items[items.length - 1];
    const nombre = (ultimo.names ?? [])[0]?.replace(/^\//, "");
    // Si la API devolviera un contenedor sin nombres, el fallo tiene que decir
    // ESO y no un "expected false to be true" que no orienta a nadie.
    expect(nombre, `el ultimo contenedor no trae nombre: ${JSON.stringify(ultimo)}`).toBeTruthy();

    const resolved = await resolveContainerId(client, envId, undefined, nombre!);
    expect(
      resolved,
      `resolveContainerId('${nombre}') deberia dar el id del ultimo contenedor del listado ` +
        `(${items.length} contenedores: ${items.map((c) => (c.names ?? ["?"])[0]).join(", ")})`,
    ).toBe(ultimo.id);
  });

  it("resolveGitOpsSyncId resuelve 'arcane' al mismo id que devuelve el listado", async () => {
    const syncs = await client.gitOpsSyncs.list(envId, { search: "arcane" });
    const esperado = (syncs.data ?? []).find((s) => s.name === "arcane");
    expect(esperado).toBeDefined();

    const resolved = await resolveGitOpsSyncId(client, envId, undefined, "arcane");
    expect(resolved).toBe(esperado!.id);
  });

  it("los cuatro resolvers, ante un nombre inexistente, dicen que no existe y NUNCA 'among the first'", async () => {
    const inexistente = `no-existe-e2e-${Date.now()}`;

    /**
     * Cada coleccion real (entornos, stacks del entorno, contenedores del
     * entorno, syncs del entorno) cabe muy por debajo del tope de
     * `collectAllPages` (2.000 elementos), asi que `complete` sera siempre
     * `true` y el mensaje correcto es el de "no existe": el que expone el
     * listado de nombres disponibles. Si algun dia el mensaje fuera el de
     * "no lo he mirado todo" (`among the first`) seria una regresion real:
     * significaria que se está a punto de decir "no existe" sin haber
     * recorrido la coleccion entera.
     */
    async function rechazaComoInexistente(fn: () => Promise<string>, tipoEnMensaje: string): Promise<void> {
      let mensaje: string | undefined;
      try {
        await fn();
      } catch (err) {
        mensaje = (err as Error).message;
      }
      expect(mensaje).toBeDefined();
      expect(mensaje).toMatch(new RegExp(`No ${tipoEnMensaje} found with name '${inexistente}'`));
      expect(mensaje).not.toContain("among the first");
    }

    await rechazaComoInexistente(() => resolveEnvironmentId(client, undefined, inexistente), "environment");
    await rechazaComoInexistente(() => resolveStackId(client, envId, undefined, inexistente), "stack");
    await rechazaComoInexistente(() => resolveContainerId(client, envId, undefined, inexistente), "container");
    await rechazaComoInexistente(() => resolveGitOpsSyncId(client, envId, undefined, inexistente), "GitOps sync");
  });
});
