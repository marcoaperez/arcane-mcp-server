# Cómo añadir una tool a `arcane-mcp`

Procedimiento estándar para F2–F5. Cada tool nueva pasa por los seis pasos.

## 0. Precondiciones

```bash
bun install
npm test          # debe dar verde antes de empezar
npm run type-check
```

Si `openapi.txt` lleva tiempo sin tocarse, refréscalo y reaudita:

```bash
npm run update-api-spec
node scripts/audit-schema-drift.mjs
```

## 1. Localizar el endpoint en el spec

`openapi.txt` es la fuente de verdad, no el código de otros forks.

```bash
node -e "const s=JSON.parse(require('fs').readFileSync('openapi.txt','utf8')); console.log(Object.keys(s.paths).filter(p=>p.includes('<dominio>')))"
```

Para ver el schema de respuesta de un path concreto:

```bash
node -e "const s=JSON.parse(require('fs').readFileSync('openapi.txt','utf8')); console.log(JSON.stringify(s.paths['<path>'], null, 2))"
```

**Detección de endpoints NDJSON:** si la respuesta `200` declara `content` vacío
(`"content": {}`) en vez de `application/json`, el endpoint **transmite NDJSON**
(`application/x-json-stream`). Ver el paso 3.

## 2. Declarar el tipo en `src/arcane-client.ts`

Copia el shape del schema del spec, campo por campo. Respeta la opcionalidad:
lo que el spec liste en `required` va **sin** `?`.

Si el tipo representa un payload de la API, añádelo al mapa `MAP` de
`scripts/audit-schema-drift.mjs` para que quede bajo auditoría permanente:

```js
const MAP = {
  // ...
  MiTipoNuevo: "SchemaDelSpec",
};
```

## 3. Añadir el método al cliente

Endpoint normal (JSON único):

```ts
async list(envId: string): Promise<PaginatedResponse<MiTipo>> {
  return this.client.request<PaginatedResponse<MiTipo>>("GET", `/environments/${envId}/mi-recurso`);
}
```

Endpoint NDJSON — **nunca uses `request()`**, revienta con
`Unexpected non-whitespace character after JSON`:

```ts
async miAccion(envId: string, id: string): Promise<ActionResponse> {
  // El endpoint transmite NDJSON (application/x-json-stream), no un JSON único.
  const events = await this.client.requestNdjson<ComposeStreamEvent>(
    "POST",
    `/environments/${envId}/mi-recurso/${id}/accion`
  );
  return summarizeComposeStream(events, "MiAcción");
}
```

Shape conocido del stream de compose:
`{type,activityId}` → `{log}`\* → `{done:true}`, o `{error}` en caso de fallo.

## 4. Registrar la tool MCP

Un fichero por dominio en `src/tools/`. Nombre según la convención
`arcane_<dominio>_<acción>`. Patrón:

```ts
server.tool(
  "arcane_<dominio>_<acción>",
  "Descripción en una línea, en inglés, orientada al cliente MCP.",
  {
    environmentId: z.string().optional().describe("Environment ID (use if known)"),
    environmentName: z.string().optional().describe("Environment name (alternative to ID)"),
  },
  async ({ environmentId, environmentName }) => {
    try {
      const envId = await resolveEnvironmentId(client, environmentId, environmentName);
      const result = await client.miDominio.miAccion(envId);
      return { content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }] };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  },
);
```

Reglas:

- Acepta siempre `*Id` **y** `*Name`, y resuelve con los helpers de `src/tools/resolve.ts`.
- Toda tool devuelve `isError: true` cuando falla; nunca lanza.
- Para acciones que devuelven `ActionResponse`, comprueba `result.success === false`
  y devuelve `isError: true` con `result.message`. Un `success:false` silenciado es
  el bug que tuvo `arcane_project_redeploy`.
- Registra la función `register<Dominio>Tools` en `src/index.ts`.

## 5. Verificar — regla dura, sin excepciones

Ninguna tool se da por terminada sin **las dos** comprobaciones.

**(a) Test unitario con `fetch` mockeado** en `src/__tests__/`:

```ts
it(".miAccion(envId) - POST /environments/{envId}/mi-recurso/accion", async () => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) } as Response);
  await client.miDominio.miAccion("env123");
  expect(mockFetch).toHaveBeenCalledWith(
    "http://localhost:3552/api/environments/env123/mi-recurso/accion",
    expect.objectContaining({ method: "POST" })
  );
});
```

Para endpoints NDJSON, mockea `text:` en vez de `json:` y verifica al menos:
stream de éxito con `{done:true}`, stream con `{error}`, y el fallback de objeto único.

**(b) e2e contra la instancia v2.7.0 real** en `src/__e2e__/`:

```ts
import { e2eClient, IDEMPOTENT_STACK } from "./helpers";
```

Tools de lectura: e2e directo, sin restricciones.
Tools mutantes: **solo** sobre stacks idempotentes (`ical-bridge` por defecto,
configurable con `ARCANE_E2E_STACK`).

```bash
npm test
ARCANE_BASE_URL=http://192.168.180.210:3552 ARCANE_API_KEY=<clave> npm run test:e2e
npm run type-check
```

**Ejecuta los e2e desde dentro de la LAN, no por Tailscale.** Medido el 2026-08-19:
desde el Mac se cae el 16,7 % de las peticiones (50 de 60); desde `vm-control`, 0 de 120.
`./scripts/e2e-remoto.sh` copia el árbol, instala con bun y ejecuta con node en
contenedores sobre `vm-control`. Instala con bun pero **ejecuta con node**: bajo el
runtime de bun, `zod` no resuelve y `src/tools/gitops-syncs.ts` revienta al importar.

## 6. Documentar y publicar

- Añade la fila a la tabla de tools del `README.md`.
- Commit en rama. **Nunca commits sueltos en `main`.**
- Push a `origin` y a `github`.
- El merge a `main` es deliberado. **Desde el 2026-08-16 el despliegue es automático:**
  GitOps sincroniza los ficheros al host y redespliega solo. El intervalo de sync por
  defecto es de 5 minutos, así que basta con esperar.

  Hasta esa fecha el redeploy fallaba siempre con `no active sessions` al resolver la
  imagen base, y cada despliegue exigía un `docker compose up -d --build` a mano. La
  causa era un bug del módulo `go.getarcane.app/builds` v0.3.0 que usa Arcane: la
  sesión de BuildKit se cerraba antes de resolver los metadatos de la imagen base.
  Se corrigió actualizando Arcane a **v2.8.0**, que trae el módulo v0.3.1. Ver
  [la auditoría de la actualización](../auditorias/2026-08-16-actualizacion-arcane-2.8.0.md).

- Verifica el despliegue **mirando dentro del contenedor**, no el estado del sync.
  Sigue siendo la capa correcta: un `lastSyncStatus: success` con la imagen vieja fue
  el modo de fallo silencioso de este proyecto durante toda F0/F1.

  ```bash
  ssh VM-Control 'docker exec arcane-mcp-server sh -c "grep -c <algo-nuevo> /app/src/tools/<fichero>.ts"'
  ```

  Después, ejercita la tool contra la instancia real y comprueba el comportamiento
  nuevo, no solo que no falle.

- **Las acciones que recrean contenedores pueden agotar el timeout del cliente MCP
  en la primera llamada** y funcionar en la segunda. No lo interpretes como un fallo
  de la tool sin reintentar.
