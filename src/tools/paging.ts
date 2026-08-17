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

/** Peticion de una pagina individual. `sort` va incluido a proposito: ver mas abajo. */
export interface PageRequest {
  start: number;
  limit: number;
  sort: string;
}

/**
 * Recorre una coleccion paginada hasta agotarla.
 *
 * En el caso normal es UNA sola peticion: el bucle solo continua si de verdad
 * hay mas elementos de los que caben en una pagina. Quien lo llama debe mirar
 * `complete` antes de concluir que algo no existe: decir "no existe" habiendo
 * mirado solo una parte es la conclusion falsa que este helper evita.
 *
 * `sort` es OBLIGATORIO como primer argumento, a proposito, y no un detalle
 * de estilo: medido contra Arcane 2.8.0 real (GET /environments/0/volumes,
 * 32 elementos, paginas de 5 via `start`), paginar SIN `sort` devuelve 32
 * filas pero solo 22 elementos unicos — la API no garantiza un orden estable
 * entre peticiones cuando no se le pide uno. Con `sort=name&order=asc` da 32
 * de 32 en dos pasadas seguidas. Confirmado ademas en environments, projects,
 * containers y gitops-syncs. Los resolvers nombre->id que usan este helper
 * decidirian "no existe" a partir de una pagina incompleta: exactamente la
 * conclusion falsa que este modulo existe para evitar. Si dentro de unos
 * meses esto parece arbitrario y sientes la tentacion de hacer `sort`
 * opcional: no lo hagas sin releer esta nota (hallazgo 1 de los arreglos de
 * la tarea 6) y volver a medir contra una instancia real.
 */
export async function collectAllPages<T>(
  sort: string,
  fetchPage: (req: PageRequest) => Promise<PaginatedResponse<T>>,
): Promise<CollectedPages<T>> {
  const items: T[] = [];
  let totalItems = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetchPage({ start: items.length, limit: PAGE_SIZE, sort });
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
