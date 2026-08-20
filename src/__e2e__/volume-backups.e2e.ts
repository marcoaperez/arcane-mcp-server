import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { e2eClient } from "./helpers";
import { registerVolumeBackupTools } from "../tools/volume-backups";

/**
 * Comprobación e2e de arcane_volume_backup_download contra la instancia real.
 *
 * Antes de este arreglo, la tool devolvía siempre el mismo texto fijo sin
 * llamar nunca al cliente: ni comprobaba que el backup existiera, ni
 * distinguía un backupId real de uno inventado. Este fichero prueba
 * justamente eso — que el handler hace una llamada real (via
 * collectAllPages + volumeBackups.list) y responde distinto en cada caso.
 *
 * Servidor MCP falso minimo, igual de simple que el que usan los tests
 * unitarios de src/__tests__/tools.test.ts: solo captura el handler
 * registrado para poder invocarlo directamente contra el cliente real.
 */
function fakeServer() {
  const handlers = new Map<string, (args: any) => Promise<any>>();
  return {
    tool: (name: string, _desc: string, _schema: any, handler: (args: any) => Promise<any>) => {
      handlers.set(name, handler);
    },
    getHandler: (name: string) => {
      const h = handlers.get(name);
      if (!h) throw new Error(`Tool no registrada: ${name}`);
      return h;
    },
  };
}

describe("arcane_volume_backup_download (e2e, Arcane 2.8.0)", () => {
  const client = e2eClient();
  const envId = "0";

  let volumeName = "";
  let backupId = "";
  let volumenCreado = false;
  let backupCreado = false;

  beforeAll(async () => {
    // Reusa un backup ya existente en esta instancia si lo hay: no todo
    // test tiene que fabricar sus propios datos.
    const volumenes = (await client.volumes.list(envId, { limit: 50 })).data ?? [];
    for (const v of volumenes) {
      const backups = await client.volumeBackups.list(envId, v.name, { limit: 1 });
      const existente = (backups.data ?? [])[0];
      if (existente) {
        volumeName = v.name;
        backupId = existente.id;
        return;
      }
    }

    // Ninguna instancia tiene backups: se crea un volumen y un backup
    // desechables. Se borran en afterAll.
    volumeName = "arcane-mcp-e2e-backups";
    await client.request("POST", `/environments/${envId}/volumes`, { name: volumeName });
    volumenCreado = true;

    const creado = await client.volumeBackups.create(envId, volumeName);
    if (!creado.data?.id) {
      throw new Error(`volumeBackups.create no devolvió un id de backup: ${JSON.stringify(creado)}`);
    }
    backupId = creado.data.id;
    backupCreado = true;
  });

  afterAll(async () => {
    // AVISA en vez de fallar si la limpieza no funciona: tumbar la suite no
    // borra el residuo, solo esconde el resto de los resultados. Mismo
    // patrón que borraRegistroDeContenedor() en helpers.ts.
    if (backupCreado) {
      try {
        await client.volumeBackups.delete(envId, backupId);
      } catch (e) {
        console.error(
          `\n[e2e] RESIDUO: el backup ${backupId} del volumen '${volumeName}' no se pudo borrar: ` +
            `${e instanceof Error ? e.message : String(e)}\n` +
            `[e2e] Borralo a mano:\n` +
            `[e2e]   curl -X DELETE -H "X-API-Key: $ARCANE_API_KEY" \\\n` +
            `[e2e]     "$ARCANE_BASE_URL/api/environments/${envId}/volumes/backups/${backupId}"\n`,
        );
      }
    }
    if (volumenCreado) {
      try {
        await client.volumes.remove(envId, volumeName);
      } catch (e) {
        console.error(
          `\n[e2e] RESIDUO: el volumen ${volumeName} no se pudo borrar: ` +
            `${e instanceof Error ? e.message : String(e)}\n` +
            `[e2e] Borralo a mano:\n` +
            `[e2e]   curl -X DELETE -H "X-API-Key: $ARCANE_API_KEY" \\\n` +
            `[e2e]     "$ARCANE_BASE_URL/api/environments/${envId}/volumes/${volumeName}"\n`,
        );
      }
    }
  });

  it("hay un volumen y un backup real disponibles para el resto de tests", () => {
    expect(volumeName).not.toBe("");
    expect(backupId).not.toBe("");
  });

  it("encuentra el backup real: metadatos y comando de descarga contra la ruta real del cliente", async () => {
    const server = fakeServer();
    registerVolumeBackupTools(server as any, client);
    const handler = server.getHandler("arcane_volume_backup_download");

    const result = await handler({ environmentId: envId, volumeName, backupId });

    expect(result.isError).toBeUndefined();
    // Metadatos reales, no el texto fijo que devolvía antes del arreglo.
    expect(result.content[0].text).toContain(backupId);
    expect(result.content[0].text).toContain("Metadata");
    // Comando accionable contra la ruta que declara openapi.txt:
    // envId + backupId, sin volumeName en el path.
    expect(result.content[0].text).toContain(
      `/environments/${envId}/volumes/backups/${backupId}/download`,
    );
    expect(result.content[0].text).toContain("curl");
    expect(result.content[0].text).not.toContain("Binary download is not supported");
  });

  it("da isError para un backupId inventado, sin confundirlo con el real", async () => {
    const server = fakeServer();
    registerVolumeBackupTools(server as any, client);
    const handler = server.getHandler("arcane_volume_backup_download");

    const result = await handler({
      environmentId: envId,
      volumeName,
      backupId: "arcane-mcp-e2e-backup-inventado",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
    expect(result.content[0].text).toContain("arcane-mcp-e2e-backup-inventado");
  });
});
