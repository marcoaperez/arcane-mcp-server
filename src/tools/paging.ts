import type { PaginatedResponse } from "../arcane-client";

/** Elementos por peticion al recorrer una coleccion entera. */
export const PAGE_SIZE = 200;

/** Tope duro de paginas. 10 x 200 = 2.000 elementos. */
export const MAX_PAGES = 10;

export interface CollectedPages<T> {
  items: T[];
  /** false si se alcanzo MAX_PAGES: la coleccion NO se ha visto entera. */
  complete: boolean;
  totalItems: number;
}

/**
 * Recorre una coleccion paginada hasta agotarla.
 *
 * En el caso normal es UNA sola peticion: el bucle solo continua si de verdad
 * hay mas elementos de los que caben en una pagina. Quien lo llama debe mirar
 * `complete` antes de concluir que algo no existe: decir "no existe" habiendo
 * mirado solo una parte es la conclusion falsa que este helper evita.
 */
export async function collectAllPages<T>(
  fetchPage: (start: number, limit: number) => Promise<PaginatedResponse<T>>,
): Promise<CollectedPages<T>> {
  const items: T[] = [];
  let totalItems = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetchPage(items.length, PAGE_SIZE);
    const batch = res.data ?? [];
    totalItems = res.pagination?.totalItems ?? items.length + batch.length;
    items.push(...batch);

    // Pagina vacia: el servidor no tiene mas que dar, diga lo que diga
    // totalItems. Sin esta guarda, un totalItems inflado agotaria el tope.
    if (batch.length === 0) return { items, complete: true, totalItems };
    if (items.length >= totalItems) return { items, complete: true, totalItems };
  }

  return { items, complete: false, totalItems };
}
