import { describe, it, expect, vi } from "vitest";
import { collectAllPages, PAGE_SIZE, MAX_PAGES, type PageRequest } from "../tools/paging";
import type { PaginatedResponse } from "../arcane-client";

/** Sirve `total` elementos en paginas del tamaño que le pidan. */
const servidor = (total: number) =>
  vi.fn(async ({ start, limit }: PageRequest): Promise<PaginatedResponse<{ id: number }>> => {
    const data = Array.from({ length: Math.max(0, Math.min(limit, total - start)) }, (_, i) => ({ id: start + i }));
    return {
      success: true,
      data,
      pagination: {
        totalItems: total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        currentPage: Math.floor(start / limit) + 1,
        itemsPerPage: limit,
      },
    };
  });

describe("collectAllPages", () => {
  it("agota en una sola peticion cuando todo cabe en una pagina", async () => {
    const fetchPage = servidor(32);
    const r = await collectAllPages("name", fetchPage);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith({ start: 0, limit: PAGE_SIZE, sort: "name" });
    expect(r.items).toHaveLength(32);
    expect(r.complete).toBe(true);
    expect(r.totalItems).toBe(32);
  });

  it("recorre varias paginas y concatena en orden", async () => {
    const fetchPage = servidor(450);
    const r = await collectAllPages("name", fetchPage);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage).toHaveBeenNthCalledWith(2, { start: PAGE_SIZE, limit: PAGE_SIZE, sort: "name" });
    expect(r.items).toHaveLength(450);
    expect(r.items[0].id).toBe(0);
    expect(r.items[449].id).toBe(449);
    expect(r.complete).toBe(true);
  });

  it("propaga el `sort` que le pasa el llamante a cada pagina", async () => {
    // No basta con exigir `sort` en la firma: hay que comprobar que de
    // verdad llega a fetchPage en cada vuelta, no solo en la primera.
    const fetchPage = servidor(450);
    await collectAllPages("createdAt", fetchPage);
    for (const call of fetchPage.mock.calls) {
      expect(call[0].sort).toBe("createdAt");
    }
  });

  it("se detiene en el tope y lo declara con complete:false", async () => {
    const fetchPage = servidor(PAGE_SIZE * MAX_PAGES + 1);
    const r = await collectAllPages("name", fetchPage);
    expect(fetchPage).toHaveBeenCalledTimes(MAX_PAGES);
    expect(r.items).toHaveLength(PAGE_SIZE * MAX_PAGES);
    expect(r.complete).toBe(false);
    expect(r.totalItems).toBe(PAGE_SIZE * MAX_PAGES + 1);
  });

  it("corta ante un servidor que promete mas elementos de los que sirve", async () => {
    // totalItems miente: dice 1000 y devuelve una pagina vacia en la segunda
    // llamada. Sin esta guarda, el bucle daria vueltas hasta el tope.
    const fetchPage = vi.fn(async ({ start }: PageRequest): Promise<PaginatedResponse<{ id: number }>> => ({
      success: true,
      data: start === 0 ? [{ id: 1 }] : [],
      pagination: { totalItems: 1000, totalPages: 5, currentPage: 1, itemsPerPage: PAGE_SIZE },
    }));
    const r = await collectAllPages("name", fetchPage);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(r.items).toHaveLength(1);
    expect(r.complete).toBe(true);
  });

  it("trata data:null como pagina vacia sin reventar", async () => {
    const fetchPage = vi.fn(async (): Promise<PaginatedResponse<{ id: number }>> => ({
      success: true,
      data: null,
      pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: PAGE_SIZE },
    }));
    const r = await collectAllPages("name", fetchPage);
    expect(r.items).toEqual([]);
    expect(r.complete).toBe(true);
  });

  it("no compila si se omite `sort` (guardia de tipos, no de runtime)", () => {
    // Este test no ejecuta nada: `_llamadaSinSort` nunca se invoca. Lo que
    // importa es que `tsc --noEmit` (npm run type-check) siga marcando la
    // linea de abajo como error. Si `@ts-expect-error` deja de tener efecto
    // porque `collectAllPages` volvio a aceptar quedarse sin `sort`, el
    // type-check falla con "Unused '@ts-expect-error' directive" — asi es
    // como este test "falla" ante una regresion del hallazgo 1.
    function _llamadaSinSort() {
      // @ts-expect-error collectAllPages exige `sort` como primer argumento obligatorio.
      return collectAllPages(servidor(1));
    }
    void _llamadaSinSort;
    expect(true).toBe(true);
  });
});
