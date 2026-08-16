# Spec de diseño — F2: observabilidad y núcleo del host

- **Fecha:** 2026-08-16
- **Fase:** F2 de la secuencia F2–F5
- **Base:** Arcane **2.8.0** (`openapi.txt`, 273 paths, 347 operaciones)
- **Punto de partida:** `ad50829` — 68 tools, 63 operaciones cubiertas, 111 tests, 6 e2e

---

## 1. El problema que resuelve

Hoy el fork sabe **actuar** sobre Docker pero no sabe **mirar**. Dos síntomas concretos,
los dos observados durante F0/F1 y la actualización a 2.8.0:

1. **El `activityId` huérfano.** Los cuatro endpoints NDJSON abren su stream con
   `{"type":"activity","activityId":"..."}`. Ese identificador se le entrega al usuario
   en cada despliegue y **no existe ninguna tool capaz de resolverlo**. Se ve el
   identificador de la operación y no se puede preguntar qué pasó con ella.
2. **Los fallos silenciosos.** El 2026-08-16, al listar activities por primera vez,
   apareció que `image_update_check` llevaba fallando cada hora (18:00, 19:00, 20:00,
   las tres en `failed`) sin que nadie se hubiera enterado. No había forma de saberlo.

F2 cubre el hueco: qué está pasando en el host, qué ha pasado, y por qué falló.

## 2. Criterio de exposición (aplica a F2–F5, no solo a F2)

Esta decisión se tomó antes de listar ninguna tool porque condiciona todas las fases
siguientes.

> **Se expone lo que opera cargas de trabajo Docker y su observabilidad. De la
> administración del propio Arcane se exponen las lecturas, nunca las escrituras.**

En la práctica quedan **permanentemente fuera como superficie de escritura** los
dominios `auth` (32 operaciones), `oidc` (10), `users` (8), `roles` (6), `api-keys` (5)
y `federated-credentials` (5) — 66 operaciones. El motivo es de radio de daño: son las
llaves del castillo, no aportan nada a la tarea de gestionar Docker, y un cliente MCP
comprometido podría con ellas dejar al propietario fuera de su propia instancia.

Las lecturas de esos dominios sí se admiten (diagnosticar "por qué falla este permiso"),
con la contrapartida asumida de que su contenido entra en el contexto del modelo.

**Nota de alcance para fases futuras:** `swarm` son **50 operaciones sin cubrir** y no
figura en ninguna fase prevista (F3 imágenes, F4 vulnerabilidades, F5 build+registries).
Es el mayor bloque huérfano de la API. Decidir si entra —y en qué fase— queda pendiente;
no forma parte de F2.

## 3. Alcance: 13 tools en 4 dominios

Convención `arcane_<dominio>_<acción>`, la que ya usa el proyecto.

Las tools se consolidan cuando dos endpoints solo se diferencian en un filtro, para no
ofrecerle al modelo dos herramientas que hacen lo mismo — una fuente típica de fallos de
selección. No se consolidan conceptos que Arcane mantiene separados.

### 3.1 Activities — `src/tools/activities.ts` (nuevo)

Una *activity* es una ejecución concreta y rastreable (un despliegue, un pull, un
escaneo).

| Tool | Operación | Notas |
|---|---|---|
| `arcane_activity_list` | `GET /environments/{id}/activities` | Filtros `status`, `type`, `resourceType`, `search`, `limit` |
| `arcane_activity_get` | `GET /environments/{id}/activities/{activityId}` | Resuelve el `activityId` que devuelven los streams NDJSON |
| `arcane_activity_cancel` | `POST /environments/{id}/activities/{activityId}/cancel` | Mutante. Acepta `requestedBy` opcional |

### 3.2 Events — `src/tools/events.ts` (nuevo)

Un *event* es una entrada del registro de auditoría. Los endpoints son **globales**, no
por entorno.

| Tool | Operación | Notas |
|---|---|---|
| `arcane_event_list` | `GET /events` **o** `GET /events/environment/{environmentId}` | Una sola tool: con `environmentId` va a la ruta por entorno, sin él a la global. Filtros `severity`, `type`, `search`, `limit` |
| `arcane_event_stats` | `GET /events/stats` | Recuento por severidad |

### 3.3 Jobs — `src/tools/jobs.ts` (nuevo)

| Tool | Operación | Notas |
|---|---|---|
| `arcane_job_list` | `GET /environments/{id}/jobs` | **Sobre distinto:** `{jobs:[...]}`, no el `{data:[...]}` paginado del resto de la API |
| `arcane_job_run` | `POST /environments/{id}/jobs/{jobId}/run` | Mutante |
| `arcane_job_schedules_get` | `GET /environments/{id}/job-schedules` | |
| `arcane_job_schedules_update` | `PUT /environments/{id}/job-schedules` | Mutante. Reescribe los intervalos del entorno |

### 3.4 System — `src/tools/system.ts` (existe, hoy solo con `arcane_version`)

| Tool | Operación | Notas |
|---|---|---|
| `arcane_system_docker_info` | `GET /environments/{id}/system/docker/info` | Estado del demonio y del host |
| `arcane_system_health` | `HEAD /environments/{id}/system/health` | **Sin cuerpo de respuesta** — ver 4.1 |
| `arcane_system_prune` | `POST /environments/{id}/system/prune` | Mutante. Granular por recurso |
| `arcane_system_convert` | `POST /environments/{id}/system/convert` | Traduce un `docker run` a compose |

### 3.5 Excluido deliberadamente

| Operación | Motivo |
|---|---|
| `DELETE /events/{eventId}` | Borra el rastro de auditoría. No añade capacidad operativa y destruye justo la evidencia que esta fase existe para poder leer |
| `DELETE /environments/{id}/activities/history` | Íd. |
| `GET /environments/{id}/version` | Redundante con `arcane_version` habiendo un solo entorno local. YAGNI |
| `POST .../system/containers/{start-all,stop-all,start-stopped}` | Acciones masivas: un `stop-all` mal disparado tumba los 15 contenedores del host, incluido el propio Arcane |
| `webhooks`, `notifications`, `updater`, `settings`, `deployment`/mTLS, `dashboard`, `diagnostics` | Configuración persistente y superficie de agente, no observabilidad. Fase propia si se justifica |

## 4. Diseño técnico

### 4.1 Capacidad nueva del cliente: `requestHead()`

`HEAD /system/health` declara `200` **sin `content`**. El `request<T>()` actual termina
en `response.json()`, que con un cuerpo vacío lanza. Es el mismo tipo de trampa que los
endpoints NDJSON en F0 y el multipart en la migración a 2.8.0.

Se añade un tercer transporte junto a `requestNdjson()` y `requestMultipart()`:

```ts
/**
 * Como `request<T>`, pero para endpoints que no devuelven cuerpo (HEAD).
 * El veredicto es el código de estado, no el JSON.
 */
async requestHead(method: string, path: string): Promise<{ ok: boolean; status: number }>
```

`arcane_system_health` traduce eso a un mensaje legible, no a un JSON vacío.

### 4.2 Tipos y auditoría de drift

Los tipos nuevos se declaran contra el spec campo a campo y **entran en el `MAP` de
`scripts/audit-schema-drift.mjs`**, para que queden bajo auditoría permanente:

| Interfaz TS | Schema del spec |
|---|---|
| `Activity` | `ActivityActivity` |
| `ActivityDetail` | `ActivityDetail` |
| `Event` | `EventEvent` |
| `EventSeverityCounts` | `EventSeverityCounts` |
| `JobStatus` | `JobscheduleJobStatus` |
| `JobSchedulesConfig` | `JobscheduleConfig` |
| `DockerInfo` | `DockerinfoInfo` |
| `SystemPruneResult` | `SystemPruneAllResult` |
| `SystemConvertResult` | `SystemConvertDockerRunResponse` |

La auditoría debe seguir cerrando en **0 hallazgos graves** al terminar la fase.

### 4.3 Registro

Las tres funciones `registerActivityTools`, `registerEventTools` y `registerJobTools` se
registran en `src/index.ts`, junto a las existentes. `system.ts` se amplía en su sitio.

### 4.4 Reglas heredadas que aplican sin excepción

- Toda tool acepta `environmentId` **y** `environmentName`, resueltos con los helpers de
  `src/tools/resolve.ts`. Excepción: las tools de events, cuyos endpoints son globales y
  donde `environmentId` es un filtro opcional.
- Ninguna tool lanza: se devuelve `isError: true`.
- Las que devuelvan `ActionResponse` comprueban `result.success === false` y lo propagan
  como error. Un `success:false` silenciado fue el bug de `arcane_project_redeploy`, y
  se repitió en `arcane_volume_upload_file`.

## 5. Verificación

Rige la regla dura del proyecto: **ninguna tool se da por terminada sin test unitario con
`fetch` mockeado y comprobación contra la instancia real**.

Las tools de lectura llevan e2e directo. Para las cuatro mutantes, cuya ejecución tiene
consecuencias reales en el host de producción, se extiende el patrón que el proyecto ya
usa (`ical-bridge` como stack idempotente, volumen desechable en la migración a 2.8.0):
**cada test es dueño del sujeto que muta, o la mutación es idempotente.**

| Tool mutante | Sujeto de la prueba | Por qué es inocuo |
|---|---|---|
| `arcane_activity_cancel` | Una activity que crea el propio test redesplegando `ical-bridge` | El test es dueño del sujeto |
| `arcane_job_run` | Un job con `prerequisites` sin cumplir (p. ej. `analytics-heartbeat`, con `analyticsEnabled: false`) | Se ejercita la ruta sin que el job llegue a actuar |
| `arcane_system_prune` | **Solo `buildCache`** | Es la poda que ya se hace de rutina en este host; nunca `images`, `volumes` ni `containers` |
| `arcane_job_schedules_update` | Los mismos valores leídos justo antes | Escritura identidad: verifica el viaje de ida y vuelta sin cambiar nada |

**Prohibido explícitamente** en los e2e: podar imágenes, volúmenes o contenedores;
cambiar intervalos reales; cancelar activities ajenas al test.

## 6. Criterios de aceptación

1. Las 13 tools registradas, con su fila en la tabla del README generada por
   `npm run gen-tools-table` (`--check` en verde).
2. `npm test` en verde, con test unitario para cada tool nueva.
3. `npm run test:e2e` en verde, cubriendo las 13 según la tabla de la sección 5.
4. `npm run type-check` limpio.
5. `node scripts/audit-schema-drift.mjs` con **0 hallazgos graves** y los 9 tipos nuevos
   en el `MAP`.
6. `arcane_activity_get` resuelve un `activityId` tomado de un stream NDJSON real. Es la
   prueba de que el agujero original queda cerrado.
7. Cobertura de la API: de 63 a **77 operaciones** de 347. Son 14 operaciones nuevas
   con 13 tools, porque `arcane_event_list` cubre dos rutas (la global y la por entorno).

## 7. Riesgos

| Riesgo | Mitigación |
|---|---|
| El sobre `{jobs:[...]}` se trata como el paginado y devuelve vacío en silencio | Ya observado en vivo y anotado en 3.3. El test unitario mockea el sobre real |
| `system_prune` expuesto al modelo con opciones por defecto peligrosas | Los parámetros de poda son explícitos y sin valores por defecto destructivos: quien llama elige qué podar |
| Un e2e mutante deja residuo en el host | Cada test limpia lo suyo, como el volumen desechable de la migración a 2.8.0 |
| El drift vuelve a aparecer al actualizar Arcane | Los 9 tipos entran en el `MAP`, así que la auditoría los vigila desde el primer día |

## Referencias

- [Balance de F0 y F1](../../balances/2026-08-16-f0-f1.md)
- [Auditoría de la actualización a 2.8.0](../../auditorias/2026-08-16-actualizacion-arcane-2.8.0.md)
- [Cómo añadir una tool](../../desarrollo/anadir-una-tool.md)
- [Spec de F0 + F1](2026-08-16-fork-arcane-mcp-f0-f1-design.md)
