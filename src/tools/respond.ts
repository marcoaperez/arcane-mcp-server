import type { PaginatedResponse } from "../arcane-client";

/** Lo que devuelve el handler de una tool MCP. */
export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

/**
 * Envuelve el handler de una tool para que ningun fallo escape como excepcion:
 * toda tool devuelve `isError: true` cuando falla, nunca lanza.
 *
 * Se envuelve el handler y no el registro a proposito. Asi la llamada sigue
 * siendo `server.tool(nombre, desc, shape, handler)`, que es la forma exacta que
 * `scripts/gen-tools-table.mjs` reconoce para contar las tools del README.
 */
export function withErrors<A>(
  handler: (args: A) => Promise<ToolResult>,
): (args: A) => Promise<ToolResult> {
  return async (args: A): Promise<ToolResult> => {
    try {
      return await handler(args);
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  };
}

/** Respuesta de texto plano. */
export function textResponse(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

/**
 * Salida comun de toda tool de listado.
 *
 * Emite `{pagination, counts?, data}` y, SOLO cuando hay mas de una pagina,
 * antepone una linea en prosa. Lo estructurado da uniformidad; la frase da
 * relevancia, porque un campo anidado es facil de saltarse leyendo y una lista
 * truncada en silencio es justo lo que hace concluir algo falso.
 */
export function listResponse<T>(
  result: PaginatedResponse<T> & { counts?: unknown },
  noun: string,
): ToolResult {
  const items = result.data ?? [];
  const p = result.pagination;

  const body: Record<string, unknown> = { pagination: p };
  if (result.counts !== undefined) body.counts = result.counts;
  body.data = items;

  let text = JSON.stringify(body, null, 2);

  if (p && p.totalPages > 1) {
    const base = `Showing ${items.length} of ${p.totalItems} ${noun} (page ${p.currentPage} of ${p.totalPages}).`;
    const hint =
      p.currentPage < p.totalPages ? ` Pass start=${p.currentPage * p.itemsPerPage} to see the rest.` : "";
    text = `${base}${hint}\n${text}`;
  }

  return { content: [{ type: "text", text }] };
}
