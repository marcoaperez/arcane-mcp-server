import { describe, it, expect, beforeAll } from "vitest";
import { e2eClient, SCAN_IMAGE } from "./helpers";
import type { VulnerabilityScanResult } from "../arcane-client";

/**
 * Vulnerabilidades contra la instancia real. La SIEMBRA es parte de la suite:
 * el beforeAll escanea SCAN_IMAGE (asíncrono, ~13 s en frío y ~1 s en caliente,
 * medido en la puerta de F4), así que todas las lecturas ejercitan datos
 * reales, no envolturas vacías. Sin cifras clavadas: la BD de CVEs cambia.
 */
describe("vulnerabilidades (e2e, Arcane 2.8.0)", () => {
  const client = e2eClient();
  const envId = "0";
  let imageId: string;
  let acuse: VulnerabilityScanResult;
  let resultado: VulnerabilityScanResult;

  beforeAll(async () => {
    const imgs = await client.images.list(envId, { limit: 200 });
    const img = (imgs.data ?? []).find((i) => (i.repoTags ?? []).includes(SCAN_IMAGE));
    if (!img) throw new Error(`No existe ${SCAN_IMAGE} en el entorno; ajusta ARCANE_E2E_SCAN_IMAGE`);
    imageId = img.id;

    const lanzado = await client.vulnerabilities.scan(envId, imageId);
    acuse = lanzado.data;

    // Sondeo hasta completed. Tolera cortes de Tailscale reintentando; un
    // escaneo en estado failed NO se tolera: es un fallo real.
    const plazo = Date.now() + 90_000;
    let ultimoEstado = "(sin respuesta)";
    for (;;) {
      try {
        const r = await client.vulnerabilities.scanResult(envId, imageId);
        ultimoEstado = r.data.status;
        if (r.data.status === "completed") {
          resultado = r.data;
          return;
        }
        if (r.data.status === "failed") {
          throw new Error(`SCAN_FAILED: ${r.data.error ?? "(sin detalle)"}`);
        }
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("SCAN_FAILED")) throw err;
        // corte de red: se reintenta hasta agotar el plazo
      }
      if (Date.now() > plazo) throw new Error(`Timeout esperando el escaneo; último estado: ${ultimoEstado}`);
      await new Promise((res) => setTimeout(res, 3_000));
    }
  }, 120_000);

  it("scanner-status: el escáner está disponible", async () => {
    const r = await client.vulnerabilities.scannerStatus(envId);
    expect(r.success).toBe(true);
    expect(r.data.available).toBe(true);
    expect(r.data.version ?? "").not.toBe("");
  });

  it("el acuse del scan es asíncrono y trae activityId", () => {
    // Medido en la puerta de F4: el POST devuelve el acuse, no el resultado.
    expect(["scanning", "completed"]).toContain(acuse.status);
    expect(typeof acuse.activityId).toBe("string");
    expect(acuse.activityId!.length).toBeGreaterThan(0);
    expect(acuse.imageId).toBe(imageId);
  });

  it("el resultado completado tiene summary coherente y CVEs con forma", () => {
    const s = resultado.summary!;
    expect(s.total).toBeGreaterThanOrEqual(1);
    expect(s.total).toBe(s.critical + s.high + s.medium + s.low + s.unknown);
    const cves = resultado.vulnerabilities ?? [];
    expect(cves.length).toBeGreaterThan(0);
    for (const c of cves.slice(0, 5)) {
      expect(c.vulnerabilityId).toBeTruthy();
      expect(c.pkgName).toBeTruthy();
      expect(c.severity).toBeTruthy();
    }
  });

  it("imageSummary cuadra con el resultado del escaneo", async () => {
    const r = await client.vulnerabilities.imageSummary(envId, imageId);
    expect(r.data.status).toBe("completed");
    expect(r.data.summary!.total).toBe(resultado.summary!.total);
  });

  it("imageList pagina y su total cuadra con el summary", async () => {
    const r = await client.vulnerabilities.imageList(envId, imageId, { sort: "severity", limit: 5 });
    expect((r.data ?? []).length).toBeGreaterThan(0);
    expect((r.data ?? []).length).toBeLessThanOrEqual(5);
    // Cruce entre endpoints: si list y summary discrepan, uno de los dos miente.
    expect(r.pagination.grandTotalItems).toBe(resultado.summary!.total);
  });

  it("el filtro severity filtra de verdad", async () => {
    const r = await client.vulnerabilities.imageList(envId, imageId, { sort: "severity", severity: "high", limit: 100 });
    // Todo item devuelto ES high — la aserción de filtro real, no "no explota".
    for (const c of r.data ?? []) {
      expect(c.severity).toBe("HIGH");
    }
    expect(r.pagination.totalItems).toBe(resultado.summary!.high);
  });

  it("listAll filtra por imageName", async () => {
    const r = await client.vulnerabilities.listAll(envId, { sort: "severity", imageName: SCAN_IMAGE, limit: 100 });
    expect((r.data ?? []).length).toBeGreaterThan(0);
    for (const c of r.data ?? []) {
      expect(c.imageName).toBe(SCAN_IMAGE);
      expect(c.imageId).toBe(imageId);
    }
  });

  it("image-options contiene la imagen escaneada y severity devuelve un subconjunto", async () => {
    const todas = await client.vulnerabilities.imageOptions(envId);
    expect(todas.data).toContain(SCAN_IMAGE);
    const altas = await client.vulnerabilities.imageOptions(envId, "high");
    for (const nombre of altas.data) {
      expect(todas.data).toContain(nombre);
    }
  });

  it("el batch de summaries omite lo no escaneado y no inventa claves", async () => {
    const inventado = "sha256:0000000000000000000000000000000000000000000000000000000000000000";
    const r = await client.vulnerabilities.imageSummaries(envId, [imageId, inventado]);
    const mapa = r.data.summaries;
    // La escaneada está, con estado terminal.
    expect(mapa[imageId]).toBeDefined();
    expect(mapa[imageId].status).toBe("completed");
    // La inventada se OMITE (comportamiento medido, patrón by-refs de F3)...
    expect(mapa[inventado]).toBeUndefined();
    // ...y ninguna clave no pedida aparece.
    for (const clave of Object.keys(mapa)) {
      expect([imageId, inventado]).toContain(clave);
    }
  });

  it("el summary del entorno refleja al menos la imagen sembrada", async () => {
    const r = await client.vulnerabilities.environmentSummary(envId);
    expect(r.data.scannedImages).toBeGreaterThanOrEqual(1);
    expect(r.data.totalImages).toBeGreaterThanOrEqual(r.data.scannedImages);
    expect(r.data.summary!.total).toBeGreaterThanOrEqual(resultado.summary!.total);
  });
});
