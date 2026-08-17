import { describe, it, expect } from "vitest";
import { withErrors, textResponse, listResponse } from "../tools/respond";
import type { PaginatedResponse } from "../arcane-client";

const pagina = <T>(data: T[], p: Partial<PaginatedResponse<T>["pagination"]> = {}): PaginatedResponse<T> => ({
  success: true,
  data,
  pagination: { totalItems: data.length, totalPages: 1, currentPage: 1, itemsPerPage: 20, ...p },
});

describe("withErrors", () => {
  it("devuelve tal cual el resultado cuando el handler resuelve", async () => {
    const envuelto = withErrors(async (args: { n: number }) => textResponse(`ok ${args.n}`));
    const r = await envuelto({ n: 7 });
    expect(r).toEqual({ content: [{ type: "text", text: "ok 7" }] });
    expect(r.isError).toBeUndefined();
  });

  it("convierte un Error lanzado en isError con su message", async () => {
    const envuelto = withErrors(async () => {
      throw new Error("boom");
    });
    const r = await envuelto({});
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toBe("Error: boom");
  });

  it("convierte en isError algo lanzado que no es un Error", async () => {
    const envuelto = withErrors(async () => {
      throw "un string pelado";
    });
    const r = await envuelto({});
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toBe("Error: un string pelado");
  });
});

describe("listResponse", () => {
  it("con una sola pagina no antepone ninguna linea en prosa", () => {
    const r = listResponse(pagina([{ id: "a" }, { id: "b" }]), "volumes");
    expect(r.content[0].text.startsWith("{")).toBe(true);
    const body = JSON.parse(r.content[0].text);
    expect(body.pagination.totalItems).toBe(2);
    expect(body.data).toHaveLength(2);
    expect(body).not.toHaveProperty("counts");
  });

  it("con varias paginas antepone el aviso y sugiere el siguiente start", () => {
    const veinte = Array.from({ length: 20 }, (_, i) => ({ id: `v${i}` }));
    const r = listResponse(pagina(veinte, { totalItems: 32, totalPages: 2, currentPage: 1, itemsPerPage: 20 }), "volumes");
    const [primera] = r.content[0].text.split("\n");
    expect(primera).toBe("Showing 20 of 32 volumes (page 1 of 2). Pass start=20 to see the rest.");
  });

  it("en la ultima pagina avisa del total pero no sugiere un start que no existe", () => {
    const doce = Array.from({ length: 12 }, (_, i) => ({ id: `v${i}` }));
    const r = listResponse(pagina(doce, { totalItems: 32, totalPages: 2, currentPage: 2, itemsPerPage: 20 }), "volumes");
    const [primera] = r.content[0].text.split("\n");
    expect(primera).toBe("Showing 12 of 32 volumes (page 2 of 2).");
    expect(primera).not.toContain("Pass start=");
  });

  it("trata data:null como lista vacia y nunca emite el texto 'null'", () => {
    const r = listResponse({ ...pagina<{ id: string }>([]), data: null }, "jobs");
    const body = JSON.parse(r.content[0].text);
    expect(body.data).toEqual([]);
    expect(r.content[0].text).not.toMatch(/^\s*null\s*$/m);
  });

  it("incluye counts cuando el endpoint lo trae", () => {
    const r = listResponse({ ...pagina([{ id: "a" }]), counts: { inuse: 8, unused: 24, total: 32 } }, "volumes");
    const body = JSON.parse(r.content[0].text);
    expect(body.counts).toEqual({ inuse: 8, unused: 24, total: 32 });
  });
});
