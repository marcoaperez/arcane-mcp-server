/**
 * Parte una lista separada por comas, tolerando espacios alrededor de cada
 * elemento y descartando los vacios (p.ej. una coma final).
 *
 * Compartido por `image-updates.ts` (referencias de imagen) y `updater.ts`
 * (IDs de recurso): ambos exponen un parametro de tool como cadena
 * separada por comas -asi lo declara el spec de la API- y necesitan la
 * misma normalizacion antes de pasarla al cliente como array.
 */
export function parseCommaList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
