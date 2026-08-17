import { describe, it, expect, vi } from "vitest";
import { collectAllPages, PAGE_SIZE, MAX_PAGES } from "../tools/paging";
import type { PaginatedResponse } from "../arcane-client";

/** Sirve `total` elementos en paginas del tamaño que le pidan. */
const servidor = (total: number) =>
  vi.fn(async (start: number, limit: number): Promise<PaginatedResponse<{ id: number }>> => {
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
    const r = await collectAllPages(fetchPage);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith(0, PAGE_SIZE);
    expect(r.items).toHaveLength(32);
    expect(r.complete).toBe(true);
    expect(r.totalItems).toBe(32);
  });

  it("recorre varias paginas y concatena en orden", async () => {
    const fetchPage = servidor(450);
    const r = await collectAllPages(fetchPage);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage).toHaveBeenNthCalledWith(2, PAGE_SIZE, PAGE_SIZE);
    expect(r.items).toHaveLength(450);
    expect(r.items[0].id).toBe(0);
    expect(r.items[449].id).toBe(449);
    expect(r.complete).toBe(true);
  });

  it("se detiene en el tope y lo declara con complete:false", async () => {
    const fetchPage = servidor(PAGE_SIZE * MAX_PAGES + 1);
    const r = await collectAllPages(fetchPage);
    expect(fetchPage).toHaveBeenCalledTimes(MAX_PAGES);
    expect(r.items).toHaveLength(PAGE_SIZE * MAX_PAGES);
    expect(r.complete).toBe(false);
    expect(r.totalItems).toBe(PAGE_SIZE * MAX_PAGES + 1);
  });

  it("corta ante un servidor que promete mas elementos de los que sirve", async () => {
    // totalItems miente: dice 1000 y devuelve una pagina vacia en la segunda
    // llamada. Sin esta guarda, el bucle daria vueltas hasta el tope.
    const fetchPage = vi.fn(async (start: number): Promise<PaginatedResponse<{ id: number }>> => ({
      success: true,
      data: start === 0 ? [{ id: 1 }] : [],
      pagination: { totalItems: 1000, totalPages: 5, currentPage: 1, itemsPerPage: PAGE_SIZE },
    }));
    const r = await collectAllPages(fetchPage);
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
    const r = await collectAllPages(fetchPage);
    expect(r.items).toEqual([]);
    expect(r.complete).toBe(true);
  });
});
