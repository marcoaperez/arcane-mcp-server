# Spec de diseño — F4: vulnerabilidades

- **Fecha:** 2026-08-18
- **Fase:** F4 de la secuencia F2–F5
- **Base:** Arcane **2.8.0** (`openapi.txt`, 273 paths, 347 operaciones)
- **Punto de partida:** `2a0bff4` — 88 tools, 86 de 249 operaciones cubiertas,
  262 tests unitarios, 46 e2e, drift 21 (0 graves)
- **Criterio que rige:** [criterio de exposición](../../arquitectura/criterio-exposicion.md)

---

## 1. El problema que resuelve

El fork sabe qué corre en el host y qué está desactualizado, pero no sabe **qué es
vulnerable**. Arcane trae Trivy integrado (medido: `available: true`, versión
0.73.0) y una superficie de 12 operaciones para escanear imágenes, consultar
resultados y triar hallazgos — ninguna llega al modelo.

Son exactamente 12 operaciones, contadas contra `openapi.txt` (no estimadas):

```
POST   .../images/vulnerabilities/summaries          resúmenes en lote
GET    .../images/{imageId}/vulnerabilities          resultado del escaneo
GET    .../images/{imageId}/vulnerabilities/list     listado paginado por imagen
POST   .../images/{imageId}/vulnerabilities/scan     MUTANTE: lanza un escaneo
GET    .../images/{imageId}/vulnerabilities/summary  resumen de una imagen
GET    .../vulnerabilities/all                       listado paginado del entorno
POST   .../vulnerabilities/ignore                    MUTANTE: ignorar una vulnerabilidad
DELETE .../vulnerabilities/ignore/{ignoreId}         MUTANTE: dejar de ignorarla
GET    .../vulnerabilities/ignored                   listado paginado
GET    .../vulnerabilities/image-options             nombres de imágenes escaneadas
GET    .../vulnerabilities/scanner-status            estado del escáner
GET    .../vulnerabilities/summary                   resumen del entorno
```

## 2. El problema de los 0 escaneos, y por qué esto no es `swarm`

Al arrancar la fase, **0 de 19 imágenes estaban escaneadas**. Con eso, 5 endpoints
devolvían envoltura vacía bien formada y 2 devolvían **404** («Vulnerability scan
not found») — para esos dos, lo único testeable habría sido la ruta de error, el
defecto exacto que un revisor cazó en F3.

No es el caso `swarm` (§2.2 del criterio): allí el 409 es infraestructura que no
existe y no está en nuestra mano; aquí el escáner existe y el estado vacío se
siembra con una llamada barata. **La operación que siembra es `scan`**, así que la
pregunta nunca fue «¿la tocamos?» sino «¿la exponemos?».

### 2.1 La puerta de siembra, ejecutada el 2026-08-18

Sujeto: `curlimages/curl:8.5.0` (33 MB, la más pequeña de las 19, `inUse: false`,
sin relación con el contenedor que atiende el canal MCP). Cuatro mediciones:

| # | Qué | Resultado medido |
|---|---|---|
| 1 | Tiempo de pared | Primer escaneo **~13 s** (21:55:32,6 → `scanTime` 21:55:45,4). Reescaneo **~1 s**. Sin descarga apreciable de BD: Trivy ya estaba operativo |
| 2 | Sincronía | **Asíncrono.** El POST devuelve en 0,23 s un acuse `{status:"scanning", scanPhase:"creating_container", activityId}`. El resultado se recoge con el GET. La actividad es `type:"vulnerability_scan"` y termina `success`/`progress:100` — **`arcane_activity_get` (F2) sirve para seguirla sin código nuevo** |
| 3 | Estabilidad | Reescanear **sustituye, no acumula**: tras el 2.º escaneo, `total=44`, `grandTotalItems=44`, `scannedImages=1`, idénticos; solo `scanTime` cambia. El e2e es repetible |
| 4 | No muta | Imagen intacta (`id`, `created`, `size` idénticos antes/después). Cero residuo de contenedores (la fase `creating_container` se limpia sola; 0 coincidencias trivy/scan entre los 16 contenedores) |

Resultado colateral: la instancia quedó sembrada (44 CVEs reales de curl 8.5.0:
0 críticas, 6 altas, 21 medias, 17 bajas) y los dos 404 pasaron a 200 con datos.

**Consecuencia de diseño:** la siembra pasa a ser parte de la suite e2e (`beforeAll`
escanea el sujeto en cada corrida, ver §6.2), no un paso manual. La fase no repite
el problema de `swarm`.

### 2.2 Lo que el spec de la API no dice y la medición sí

- El POST de `scan` declara `application/json` con el schema
  `VulnerabilityScanResult` — cierto, pero es el **acuse** (estado `scanning`, sin
  array); el mismo schema sirve de acuse y de resultado.
- El batch `summaries` **omite del mapa las imágenes sin escaneo** en vez de
  incluirlas con error — el mismo comportamiento que `by-refs` en F3 (§5.2 de su
  balance). Su tool hereda el mismo tratamiento: aviso en prosa cuando el mapa
  omite referencias pedidas.
- El GET crudo por imagen pesa **~124 KB para 44 CVEs** (descripciones, referencias,
  CVSS). Motiva el enfoque de recorte de §4.1.

## 3. Decisiones de alcance

### 3.1 `scan` se expone, acotada por construcción

La operación masiva **no es expresable** con este endpoint: exige `imageId` en el
path. No hace falta inventar la acotación tipo `resourceIds` de F3 — la API ya la
trae. El barrido masivo existe como job (`vulnerability-scan`, deshabilitado, con
prerequisito `vulnerabilityScanEnabled: false`) y queda fuera: ya está advertido en
la descripción de `arcane_job_run` desde F3.

La tool devuelve el **acuse con `activityId`, sin sondeo interno** — como el resto
de acciones asíncronas del proyecto. La descripción declara la asincronía y remite
a `arcane_activity_get` / `arcane_vulnerability_scan_result` para el seguimiento.

### 3.2 `ignore`/`unignore` se exponen: son triaje, no administración

El criterio excluye las escrituras de administración por **radio de daño** (las
llaves del castillo: pueden dejarte fuera de tu instancia). Un ignore no se les
parece: es **reversible** con una llamada, **visible** siempre en `ignored` (con
`createdBy`, `createdAt`, `reason`), **acotado** a una tripleta
(imagen, CVE, paquete) por llamada — `imageId` es obligatorio en el payload, no
existe el «ignora esta CVE en todas partes» — y no destruye evidencia: el escaneo
completo sigue ahí. El triaje («esta CVE no nos aplica, documéntalo») es el flujo
que esta fase existe para servir.

Dos salvaguardas, decididas con el propietario:

1. **`reason` obligatorio en ambas capas** (schema de la tool Y firma del cliente),
   aunque el spec lo declare opcional — el precedente exacto de `resourceIds` en
   F3: endurecer en ambas capas para que relajar una no baste. Un ignore sin motivo
   escrito es deuda invisible; con motivo, es una decisión auditada.
2. La descripción de la tool declara que **modifica el informe de seguridad de
   forma persistente** y que `arcane_vulnerability_ignored_list` lista lo
   silenciado.

`createdBy` del payload **no se expone**: lo rellena el servidor con el usuario
autenticado; dejarlo escribible sería permitir firmar como otro.

### 3.3 Los tres listados reutilizan el patrón de la fase de coherencia

`LIST_PARAMS` local al fichero (la duplicación es requisito del generador de la
tabla, no descuido — ver §5.5 del balance de F3), `listResponse` para el contrato
de salida, y `collectAllPages` con `sort` obligatorio. Parámetros extra verificados
contra el spec:

| Listado | Estándar | Extra |
|---|---|---|
| `.../{imageId}/vulnerabilities/list` | `search,sort,order,start,limit` | `severity` |
| `/vulnerabilities/all` | ídem | `severity`, `imageName` |
| `/vulnerabilities/ignored` | ídem | — |
| `/vulnerabilities/image-options` | — | `severity` (suelto, sin paginación) |

## 4. Alcance: 12 tools nuevas

88 → **100 tools**. Un fichero nuevo `src/tools/vulnerabilities.ts`, registrado en
`GROUPS` de `scripts/gen-tools-table.mjs`. Convención `arcane_vulnerability_*`.
Todas aceptan `environmentId`/`environmentName` y resuelven con `resolve.ts`.

### 4.1 Lecturas (9)

| Tool | Endpoint | Parámetros propios |
|---|---|---|
| `arcane_vulnerability_scanner_status` | GET `scanner-status` | — |
| `arcane_vulnerability_summary` | GET `vulnerabilities/summary` | — |
| `arcane_vulnerability_list` | GET `vulnerabilities/all` | `LIST_PARAMS` + `severity`, `imageName` |
| `arcane_vulnerability_image_options` | GET `image-options` | `severity` opcional |
| `arcane_vulnerability_scan_result` | GET `images/{imageId}/vulnerabilities` | `imageId` |
| `arcane_vulnerability_image_list` | GET `images/{imageId}/vulnerabilities/list` | `imageId` + `LIST_PARAMS` + `severity` |
| `arcane_vulnerability_image_summary` | GET `images/{imageId}/vulnerabilities/summary` | `imageId` |
| `arcane_vulnerability_image_summaries` | POST `images/vulnerabilities/summaries` | `imageIds` (lista con comas, `parseCommaList`) |
| `arcane_vulnerability_ignored_list` | GET `vulnerabilities/ignored` | `LIST_PARAMS` |

**El recorte de `_scan_result` (enfoque B, decidido):** el GET crudo devuelve el
detalle completo de todas las CVEs (~124 KB medidos con solo 44). La tool devuelve
los metadatos que solo este endpoint tiene — `status`, `scanPhase`, `error`,
`scannerVersion`, `scanTime`, `duration`, `activityId` — más el `summary`, y en
prosa remite a `_image_list` para el detalle paginado. Es la pieza que cierra el
ciclo del acuse de `_scan`. Precedente doble: `summarizeComposeStream` transforma,
`volume_browse` añade prosa. La operación cuenta como cubierta (el cliente la llama
tal cual); el recorte vive en la capa tool, no en el cliente (§5).

**Solo `imageId`, sin resolutor nombre→id** (YAGNI): la API solo acepta el id en el
path, `arcane_image_list` ya lo da, y `_list` filtra por `imageName` para quien
parte del nombre.

### 4.2 Mutantes (3)

| Tool | Endpoint | Parámetros propios |
|---|---|---|
| `arcane_vulnerability_scan` | POST `.../{imageId}/vulnerabilities/scan` | `imageId` obligatorio |
| `arcane_vulnerability_ignore` | POST `vulnerabilities/ignore` | `imageId`, `vulnerabilityId`, `pkgName`, **`reason`** obligatorios; `installedVersion` opcional |
| `arcane_vulnerability_unignore` | DELETE `ignore/{ignoreId}` | `ignoreId` obligatorio |

Retornos verificados en el spec: `ignore` devuelve el `IgnoredVulnerability` creado
**con su `id`** (el ciclo e2e ignore→unignore no necesita listar en medio);
`unignore` devuelve `BaseApiResponse` de struct vacío; `scan` devuelve
`VulnerabilityScanResult` en estado `scanning`.

## 5. Cliente y tipos

**`VulnerabilitiesMethods`** en `src/arcane-client.ts`, mismo molde que
`ImageUpdatesMethods`/`UpdaterMethods`, 12 métodos 1:1 con las operaciones. Todos
JSON único con `request()` — ningún endpoint de F4 es NDJSON (los 12 declaran
`application/json`; el único sospechoso, `scan`, está medido: acuse JSON).

**El cliente es fiel a la API; la transformación vive en la tool.**
`client.vulnerabilities.scanResult()` devuelve el `VulnerabilityScanResult`
completo, array incluido; el recorte es de `arcane_vulnerability_scan_result`.
Así los tests del cliente asertan contra la forma real y el recorte se testea
aparte como presentación.

Tipos nuevos, copiados campo a campo del spec (la opcionalidad la fija el
`required` del spec; nada de `any` — la auditoría de drift no los detecta), todos
registrados en el `MAP` de `scripts/audit-schema-drift.mjs`:

| Tipo TS | Schema del spec |
|---|---|
| `ScannerStatus` | `ScannerStatus` |
| `VulnerabilitySeveritySummary` | `VulnerabilitySeveritySummary` |
| `VulnerabilityCVSSInfo` | `VulnerabilityCVSSInfo` |
| `Vulnerability` | `VulnerabilityVulnerability` |
| `VulnerabilityWithImage` | `VulnerabilityVulnerabilityWithImage` |
| `VulnerabilityScanResult` | `VulnerabilityScanResult` |
| `VulnerabilityScanSummary` | `VulnerabilityScanSummary` |
| `VulnerabilityScanSummariesResponse` | `VulnerabilityScanSummariesResponse` |
| `EnvironmentVulnerabilitySummary` | `VulnerabilityEnvironmentVulnerabilitySummary` |
| `IgnoredVulnerability` | `VulnerabilityIgnoredVulnerability` |

Cada implementador verifica los tipos contra `openapi.txt` **antes** de escribir
código — `openapi.txt` manda sobre este spec si discrepan.

## 6. Verificación

### 6.1 Unitarios con `fetch` mockeado

Un test por método del cliente (12): URL literal completa con la query construida,
método HTTP, y para `ignore` el body serializado real **incluyendo que `createdBy`
no viaja**. Las dos trampas conocidas son requisitos del plan:

- Prohibido enumerar claves `undefined` en `toHaveBeenCalledWith` (la aserción
  decorativa de F2). Los params opcionales se cubren con un test de URL **con** el
  parámetro y otro **sin** él.
- Cada tarea demuestra **falsabilidad por mutación**: mutar, ver fallar, revertir.

En la capa tool, los puntos donde una mutación pasaría desapercibida:

| Qué | Test | Mutación que debe cazar |
|---|---|---|
| Recorte de `_scan_result` | con mock de 3 CVEs, la salida contiene metadatos y prosa y **no contiene** `description`/`references` | quitar el recorte |
| `reason` obligatorio | patrón `ad696d4`: extraer `schemaShape` de `mock.calls`, reconstruir `z.object()`, `.parse()` rechaza sin `reason` | relajar a `.optional()` |
| Aviso de omisión en `_image_summaries` | ambas ramas (omite → aviso; completo → sin aviso), patrón `ee27f30` | romper la comparación |
| `listResponse` en los 3 listados | contrato de salida uniforme | desviarse del patrón |

### 6.2 e2e contra la instancia real — la siembra es parte de la suite

Fichero nuevo `src/__e2e__/vulnerabilidades.e2e.ts`. `beforeAll`:

1. Resuelve el `imageId` del sujeto por referencia (`ARCANE_E2E_SCAN_IMAGE`, por
   defecto `curlimages/curl:8.5.0`) contra `images.list` — sin sha256 clavado.
2. Lanza `scan` y guarda el acuse — eso **es** el e2e de la ruta feliz de la
   mutante (`status`, `activityId`).
3. Sondea `scanResult` hasta `completed`, timeout 90 s (medido: 13 s en frío, 1 s
   en caliente; margen para Tailscale). Reescanear en cada corrida es seguro:
   sustituye, no acumula (§2.1).

Aserciones con datos reales, **sin clavar cifras volátiles** (la BD de CVEs
cambia; nunca `total === 44`): invariantes como `total ≥ 1`,
`total = critical+high+medium+low+unknown`, todo item de
`image_list?severity=high` tiene `severity === "HIGH"` (aserción de filtro real,
no «no explota»), `image_options` contiene la referencia del sujeto, coherencia
`image_summary` ↔ `summary` del `scanResult`, y en el batch: la escaneada
presente, un id inventado **omitido**, ninguna clave no pedida (tratamiento
`byRefs`).

El ciclo mutante de ignore, autosuficiente y autolimpiante:

```
elegir 1 CVE del image_list del sujeto
→ ignore(reason con la marca "e2e-arcane-mcp")  → devuelve id y eco de campos
→ ignored_list la contiene
→ unignore(id)                                  → success
→ ignored_list ya no la contiene
```

Red de seguridad en `afterAll`: des-ignorar cualquier resto cuyo `reason` lleve la
marca, para que un abort a mitad de ciclo (Tailscale) no deje residuo permanente
en la postura de seguridad de la instancia.

Reglas de la casa: la mutante opera sobre la imagen de curl (nunca el contenedor
`arcane-mcp-server`), no hay pulls de registros externos (Trivy escanea la imagen
local), y el criterio de verde es `--reporter=verbose` contando `✓` una a una
(un fichero que aborta al importar sale como `skipped`, y `skipped` no es verde).

### 6.3 Errores y avisos

Las 12 tools con el sobre estándar (`withErrors`/`isError: true`, nunca lanzan).

- **404 «Vulnerability scan not found»** en `_scan_result`, `_image_summary` e
  `_image_list`: es el estado normal de una imagen sin escanear, no una avería.
  La descripción de cada tool lo documenta y remite a `_scan`. Sin transformar el
  error en código.
- **`status: "failed"`**: el recorte de §4.1 conserva `status` y `error`.
- **Escáner no disponible** (`available: false`): no medido (el nuestro está
  operativo); no se inventa comportamiento. La descripción de `_scan` remite a
  `_scanner_status` como comprobación previa.
- Avisos en prosa: solo los dos diseñados (omisión del batch, asincronía del
  acuse). Los listados heredan la prosa de `listResponse`. F4 no necesita
  heurísticas tipo `updater_history`: sus listados traen paginación completa.

### 6.4 Despliegue y cierre

1. Rama `feat/f4-vulnerabilidades`, commits firmados, merge deliberado, push a
   `origin` y `github`.
2. Despliegue automático por GitOps; verificación **dentro del contenedor**
   (`wc -c` local vs `/app/src/tools/vulnerabilities.ts`), nunca por el sync.
3. Docs: tabla del README regenerada; `criterio-exposicion.md` actualiza cabecera
   y cobertura tras el merge; balance de fase con **cifras medidas, ninguna
   proyectada** (expectativa aritmética: 88→100 tools, 86→98/249 operaciones; lo
   publicado saldrá de comandos). El primer commit de docs enlaza además los 4
   specs/planes que faltan en el índice (hallazgo de la revisión del 2026-08-18).

## 7. Lo que esta fase NO hace, dicho explícitamente

- No expone el barrido masivo: ni el job `vulnerability-scan` por vía nueva (sigue
  advertido en `arcane_job_run` desde F3), ni ningún «scan-all».
- No añade resolutor nombre→id de imágenes (YAGNI, §4.1).
- No expone `createdBy` en el payload de ignore (§3.2).
- No toca el diferido de §2.4 del criterio (webhooks, notifications, settings,
  mTLS, dashboard, diagnostics, `groupBy`).
- No observa el caso «escáner no disponible» (§6.3): zona no vista declarada, como
  el stream de `dryRun` con actualización pendiente en F3.

## 8. Referencias

- [Criterio de exposición](../../arquitectura/criterio-exposicion.md)
- [Cómo añadir una tool](../../desarrollo/anadir-una-tool.md)
- [Balance de F3 — patrones `ad696d4`, `ee27f30`, tratamiento `byRefs`](../../balances/2026-08-17-f3.md)
- [Balance de la coherencia de listado — `LIST_PARAMS`, `listResponse`, `collectAllPages`](../../balances/2026-08-17-coherencia-listado.md)
