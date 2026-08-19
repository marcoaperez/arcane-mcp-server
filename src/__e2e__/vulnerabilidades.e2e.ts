import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { e2eClient, SCAN_IMAGE } from "./helpers";
import type { VulnerabilityScanResult, VulnerabilitySeveritySummary, IgnoredVulnerability } from "../arcane-client";

/** Claves de severidad de VulnerabilitySeveritySummary, sin "total". */
const SEVERIDADES = ["critical", "high", "medium", "low", "unknown"] as const;
type Severidad = (typeof SEVERIDADES)[number];

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

    // Sondeo hasta completed. El catch reintenta CUALQUIER error que no sea
    // el "failed" explícito del escaneo (incluye cortes de Tailscale, pero
    // también un ArcaneApiError real -404/500/auth- si scanResult empezara
    // a fallar de forma determinista); por eso se guarda el último error y
    // se incluye su mensaje en el timeout final, para que un fallo
    // determinista se delate a sí mismo en vez de perderse en 90 s de reintentos
    // silenciosos. Un 404 justo tras lanzar el scan es legítimamente
    // transitorio (el registro aún no existe), así que no se rethrow ante él.
    const plazo = Date.now() + 90_000;
    let ultimoEstado = "(sin respuesta)";
    let ultimoError: unknown;
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
        // corte de red u otro error transitorio: se reintenta, pero se
        // recuerda para no perder el detalle si se agota el plazo.
        ultimoError = err;
      }
      if (Date.now() > plazo) {
        const detalle = ultimoError instanceof Error ? ultimoError.message : String(ultimoError ?? "(ninguno)");
        throw new Error(
          `Timeout esperando el escaneo; último estado: ${ultimoEstado}; último error: ${detalle}`,
        );
      }
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

  it("image-options contiene la imagen escaneada y severity filtra de verdad", async () => {
    const todas = await client.vulnerabilities.imageOptions(envId);
    expect(todas.data).toContain(SCAN_IMAGE);

    // Falsable de verdad: para una severidad con hallazgos, la imagen DEBE
    // aparecer; para una severidad sin hallazgos, DEBE desaparecer. Un
    // filtro ignorado (que devolviera siempre la lista completa) haría
    // fallar la segunda mitad. Derivado de resultado.summary en tiempo de
    // ejecución, sin cifras clavadas: la BD de CVEs cambia.
    const s = resultado.summary as VulnerabilitySeveritySummary;
    const conHallazgos = SEVERIDADES.filter((sev) => s[sev] > 0);
    const sinHallazgos = SEVERIDADES.filter((sev) => s[sev] === 0);

    // Si toda severidad quedara del mismo lado, ninguna de las dos mitades
    // se ejercitaría y el test "pasaría" sin haber comprobado nada. Se hace
    // fallar explícitamente en vez de dejarlo pasar en silencio.
    expect(conHallazgos.length, `summary sin ninguna severidad con hallazgos: ${JSON.stringify(s)}`).toBeGreaterThan(
      0,
    );
    expect(sinHallazgos.length, `summary con hallazgos en todas las severidades: ${JSON.stringify(s)}`).toBeGreaterThan(
      0,
    );

    for (const sev of conHallazgos as Severidad[]) {
      const r = await client.vulnerabilities.imageOptions(envId, sev);
      expect(r.data, `severity=${sev} (${s[sev]} hallazgos) debería incluir ${SCAN_IMAGE}`).toContain(SCAN_IMAGE);
    }
    for (const sev of sinHallazgos as Severidad[]) {
      const r = await client.vulnerabilities.imageOptions(envId, sev);
      expect(r.data, `severity=${sev} (0 hallazgos) NO debería incluir ${SCAN_IMAGE}`).not.toContain(SCAN_IMAGE);
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

  // ── Ciclo mutante: SIEMPRE al final, para no afectar a las lecturas ──

  const MARCA = "e2e-arcane-mcp";

  it("ciclo completo: ignore → el conteo no cambia → aparece en ignored → unignore → desaparece", async () => {
    const lista = await client.vulnerabilities.imageList(envId, imageId, { sort: "severity", limit: 1 });
    const cve = (lista.data ?? [])[0];
    expect(cve).toBeDefined();

    const creado = await client.vulnerabilities.ignore(envId, {
      imageId,
      vulnerabilityId: cve.vulnerabilityId,
      pkgName: cve.pkgName,
      installedVersion: cve.installedVersion,
      reason: `${MARCA}: ciclo e2e, se elimina en este mismo test`,
    });
    expect(creado.success).toBe(true);
    expect(creado.data.id).toBeTruthy();
    // Eco de campos: el registro creado es el que se pidió crear.
    expect(creado.data.vulnerabilityId).toBe(cve.vulnerabilityId);
    expect(creado.data.imageId).toBe(imageId);
    expect(creado.data.pkgName).toBe(cve.pkgName);

    // Medido el 2026-08-19 contra la instancia real: crear un ignore NO
    // cambia el conteo que devuelven summary/list mientras el ignore está
    // vivo (44/44 en la medición manual). La tool describe esto como un
    // registro de triaje trazable, no como un filtro de reporting -esta
    // aserción es la que sostiene esa descripción; si Arcane empieza a
    // descontar el CVE, este assert es el primero en delatarlo.
    const durante = await client.vulnerabilities.imageSummary(envId, imageId);
    expect(durante.data.summary!.total).toBe(resultado.summary!.total);

    const con = await client.vulnerabilities.ignoredList(envId, { sort: "id", limit: 200 });
    expect((con.data ?? []).some((x) => x.id === creado.data.id)).toBe(true);

    const borrado = await client.vulnerabilities.unignore(envId, creado.data.id);
    expect(borrado.success).toBe(true);

    // Testigo independiente del efecto de unignore: el conteo sigue igual
    // tras revertir, coherente con que crear el ignore tampoco lo cambió.
    const despues = await client.vulnerabilities.imageSummary(envId, imageId);
    expect(despues.data.summary!.total).toBe(resultado.summary!.total);

    const sin = await client.vulnerabilities.ignoredList(envId, { sort: "id", limit: 200 });
    expect((sin.data ?? []).some((x) => x.id === creado.data.id)).toBe(false);
  });

  afterAll(async () => {
    // Limpieza de ignores marcados por el test. Si quedan vivos tras abortar
    // el ciclo, silencian una vulnerabilidad real en el reporting de producción.
    // Intenta listar, luego eliminar cada uno por separado: un fallo en listado
    // o en registro no abandona el resto (try/catch independientes). Los fallos
    // se reportan en rojo con detalle, pero NO tumban la suite (el siguiente run
    // lo reintentará). Sigue dependiendo de que el API funcione; si falla
    // permanentemente, los registros quedan vivos en la instancia.
    let ignoreList: IgnoredVulnerability[] = [];
    try {
      const ign = await client.vulnerabilities.ignoredList(envId, { sort: "id", limit: 200 });
      ignoreList = (ign.data ?? []).filter((x) => (x.reason ?? "").includes(MARCA));
    } catch (err) {
      const detalle = err instanceof Error ? err.message : String(err ?? "(ninguno)");
      console.error(
        `No se pudo listar los ignores en la limpieza. ` +
        `Cualquier ignore creado por este test puede estar vivo en la instancia y suprimiendo esa vulnerabilidad del reporting. ` +
        `Verifica manualmente: arcane_vulnerability_ignored_list o GET /environments/{envId}/vulnerabilities/ignored. ` +
        `Error: ${detalle}`
      );
    }
    for (const resto of ignoreList) {
      try {
        await client.vulnerabilities.unignore(envId, resto.id);
      } catch (err) {
        const detalle = err instanceof Error ? err.message : String(err ?? "(ninguno)");
        console.error(
          `IGNORE RESIDUAL: id=${resto.id}, reason="${resto.reason}". ` +
          `El registro está vivo en la instancia y sigue suprimiendo esa vulnerabilidad del reporting. ` +
          `Debe eliminarse manualmente: arcane_vulnerability_unignore o DELETE /environments/{envId}/vulnerabilities/ignore/{id}. ` +
          `Error: ${detalle}`
        );
      }
    }
  });
});
