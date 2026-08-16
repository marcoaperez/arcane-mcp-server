import { describe, it, expect, afterAll } from "vitest";
import { e2eClient } from "./helpers";

/**
 * Comprobación contra la instancia real de la API workspace, que en Arcane 2.8.0
 * sustituyó a la familia `/browse` (eliminada: devuelve 404).
 *
 * La parte mutante no usa el stack idempotente porque no opera sobre stacks:
 * crea su propio volumen desechable y lo borra al terminar, así que no toca
 * ningún dato ajeno al test.
 */
describe("volume workspace (e2e, Arcane 2.8.0)", () => {
  const client = e2eClient();
  const envId = "0";
  const volumen = "arcane-mcp-e2e-workspace";
  let creado = false;

  afterAll(async () => {
    if (creado) {
      await client.volumes.remove(envId, volumen).catch(() => {});
    }
  });

  it("crea el volumen de prueba", async () => {
    await client.request("POST", `/environments/${envId}/volumes`, { name: volumen });
    creado = true;

    const inspeccion = await client.volumes.inspect(envId, volumen);
    expect(inspeccion.success).toBe(true);
  });

  it("getWorkspace devuelve el testigo de revisión y un árbol vacío", async () => {
    const ws = await client.volumeFiles.getWorkspace(envId, volumen);

    expect(ws.success).toBe(true);
    expect(typeof ws.data.fileTreeRevision).toBe("string");
    expect(ws.data.fileTreeRevision.length).toBeGreaterThan(0);
    expect(ws.data.files ?? []).toEqual([]);
  });

  it("uploadFile escribe el fichero y el árbol lo refleja", async () => {
    const resultado = await client.volumeFiles.uploadFile(
      envId,
      volumen,
      "hola.txt",
      "hola desde el e2e",
    );
    expect(resultado.success).not.toBe(false);

    const ws = await client.volumeFiles.getWorkspace(envId, volumen);
    const nombres = (ws.data.files ?? []).map((f) => f.relativePath);
    expect(nombres).toContain("hola.txt");

    const entrada = (ws.data.files ?? []).find((f) => f.relativePath === "hola.txt")!;
    expect(entrada.isDirectory).toBe(false);
    expect(entrada.size).toBe("hola desde el e2e".length);
  });
});
