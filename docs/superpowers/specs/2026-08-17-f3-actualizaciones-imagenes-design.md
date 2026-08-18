# Spec de diseño — F3: actualizaciones de imágenes

- **Fecha:** 2026-08-17
- **Fase:** F3 de la secuencia F2–F5
- **Base:** Arcane **2.8.0** (`openapi.txt`, 273 paths, 347 operaciones)
- **Punto de partida:** `193c602` — 81 tools, 78 de 249 operaciones cubiertas,
  231 tests unitarios, 36 e2e
- **Criterio que rige:** [criterio de exposición](../../arquitectura/criterio-exposicion.md)

---

## 1. El problema que resuelve

El fork sabe qué contenedores hay y qué está pasando en el host, pero no sabe **qué
está desactualizado**. Hoy un modelo no puede responder «¿qué hay pendiente de
actualizar y qué se rompería si lo actualizo?», ni siquiera aunque Arcane tenga la
respuesta guardada.

Y la tiene: `GET /environments/0/image-updates/summary` responde hoy mismo
`{"totalImages":18,"imagesWithUpdates":4,"digestUpdates":4,"errorsCount":2}`. El dato
existe y no llega al modelo.

Hay además tres deudas diferidas expresamente a esta fase desde F2, que se cierran
aquí. Dejarlas otra vez repetiría el patrón de `swarm`: un pendiente sin fase asignada
que reaparece en cada revisión hasta que alguien lo decide.

## 2. Alcance: 7 tools nuevas

81 → **88 tools**. Convención `arcane_<dominio>_<acción>`, la del proyecto.

### 2.1 Estado de actualizaciones — `src/tools/image-updates.ts` (nuevo)

| Tool | Operación | Notas |
|---|---|---|
| `arcane_image_update_summary` | `GET /environments/{id}/image-updates/summary` | Recuento agregado. Barata: no toca registros |
| `arcane_image_update_status` | `GET /environments/{id}/image-updates/by-refs` | Información **persistida** de las referencias que se pidan. No toca registros. `imageRefs` es una cadena separada por comas |
| `arcane_image_update_check` | `GET .../image-updates/check` **o** `.../check/{imageId}` | Consulta **en vivo** al registro, una imagen. Acepta referencia o ID |
| `arcane_image_update_check_batch` | `POST .../image-updates/check-batch` | En vivo, lista explícita. `imageRefs` es obligatorio en el spec |

**La distinción entre persistido y en vivo se conserva y se declara en las
descripciones.** No es un matiz teórico: el barrido en vivo choca con los límites de
tasa de los registros — está observado que `ghcr.io/getarcaneapp/arcane:latest` devuelve
`toomanyrequests` de forma intermitente. Un modelo que no distinga una de otra
consultará registros para responder algo que ya estaba guardado.

**Consolidación.** El spec ofrece tres operaciones equivalentes para comprobar una
imagen: `GET check?imageRef=`, `GET check/{imageId}` y `POST check/{imageId}`. Las tres
devuelven `ImageupdateResponse`. Se exponen como **una** tool que acepta referencia o
ID, igual que el resto del fork acepta `*Id` y `*Name`. Ofrecerle al modelo tres tools
que hacen lo mismo es una fuente típica de fallos de selección.

### 2.2 Aplicación de actualizaciones — `src/tools/updater.ts` (nuevo)

| Tool | Operación | Notas |
|---|---|---|
| `arcane_updater_status` | `GET /environments/{id}/updater/status` | Qué se está actualizando ahora mismo |
| `arcane_updater_history` | `GET /environments/{id}/updater/history` | Historial. **Puede venir recortado sin avisar — ver §3** |
| `arcane_updater_run` | `POST /environments/{id}/updater/run` | **Mutante.** `resourceIds` obligatorio, `dryRun` expuesto |

**`arcane_updater_run` exige el objetivo.** `UpdaterOptions` declara `resourceIds` como
opcional y anulable; **la tool lo hace obligatorio**. Así «actualiza y reinicia todo el
entorno» deja de ser expresable desde el MCP.

El motivo es el mismo por el que F2 excluyó `POST .../system/containers/stop-all`: el
radio de daño de una acción masiva mal disparada. Con un agravante propio: el contenedor
`arcane-mcp-server` es uno de los que el updater puede reiniciar, así que una
actualización masiva puede tumbar el propio canal por el que se pidió, a mitad de la
llamada.

`dryRun` se expone y se describe, porque es lo que permite mirar antes de actuar —y
lo que hace verificable la tool (§5.2).

### 2.3 Excluido de esta fase, a propósito

| Operación | Motivo |
|---|---|
| `POST /environments/{id}/image-updates/check-all` | Barrido en vivo de **todas** las imágenes contra sus registros, sin acotar. Es la operación del job horario `image-polling`, que ya la ejecuta sola. Exponerla permitiría al modelo martillear los registros para obtener antes un dato que llega igual |

Es **el mismo criterio aplicado dos veces**: ni `updater/run` sin objetivo, ni
`check-all` sin lista. Las dos operaciones masivas del dominio quedan fuera; sus
equivalentes acotadas, dentro.

## 3. `updater/history` puede mentir por omisión, y no se puede arreglar del todo

`GET /updater/history` devuelve `BaseApiResponseListAutoUpdateRecord`: un array pelado
con `success` y `data`, **sin sobre de paginación**. Acepta `limit` con `default: 50`, y
no acepta `start`.

Es el defecto que cerró la fase de coherencia de listado, en su forma más severa: no
solo no dice cuánto falta, es que **no se puede paginar**. El único control es subir
`limit`.

`listResponse` no le aplica: no hay `pagination` que emitir.

**La solución es una heurística, y se declara como tal.** Si el servidor devuelve
exactamente tantos registros como se le pidieron, es muy probable que haya más. La tool
antepone entonces una línea en prosa:

```
This history may be truncated: exactly 50 records were requested and 50 were returned,
and this endpoint reports no total. Raise limit to find out.
```

Nótese lo que la frase **no** dice. No afirma que esté recortado, porque el endpoint no
permite saberlo. Prometer certeza donde la API no la da sería el mismo defecto que
`arcane_volume_browse` prometiendo *"the full file tree"* — corregido hace unas horas.

Con `data.length < limit`, no se antepone nada: ahí sí se sabe que están todos.

**`by-refs` y `check-batch` no tienen este problema.** Devuelven mapas indexados por
referencia de imagen (`additionalProperties`), no arrays: no hay nada que truncar.

## 4. El enriquecimiento: tres deudas diferidas desde F2

### 4.1 `ImageSummary.usedBy`

La instancia **ya lo devuelve** y el tipo TS lo descarta. Es una de las 23
desalineaciones que la auditoría de drift reporta como `FALTA-EN-TS-OPCIONAL`:

```json
"usedBy": [{"type":"project","name":"arcane-mcp","id":"ced1a362-a318-4cfc-82b9-83c26baf47a2"}]
```

No es adorno. Es lo que separa «esta imagen tiene actualización disponible» de
«actualizar esta imagen reinicia el proyecto arcane-mcp». Sin él, la decisión de
actualizar se toma a ciegas.

Se declara `ImageUsedBy { type: string; name: string; id?: string }` — `type` y `name`
son `required` en el spec, `id` no — y `usedBy?: ImageUsedBy[] | null` en `ImageSummary`,
opcional porque así lo declara el spec.

### 4.2 `ProjectDetails.updateInfo`

`ProjectUpdateInfo` tiene diez campos: `status`, `hasUpdate`, `imageCount`,
`checkedImageCount`, `imagesWithUpdates`, `errorCount` (los seis `required`), más
`errorMessage`, `lastCheckedAt`, `imageRefs` y `updatedImageRefs`.

Con esto `arcane_stack_get` responde «este stack tiene 4 imágenes, 3 comprobadas, 1 con
actualización» sin cruzar dos tools a mano.

### 4.3 El filtro `updates` en tres tools de listado

| Tool | Valores que declara el spec |
|---|---|
| `arcane_container_list` | `has_update`, `up_to_date`, `error`, `unknown` |
| `arcane_stack_list` (projects) | `has_update`, `up_to_date`, `error`, `unknown` |
| `arcane_image_list` | `true`, `false` |

**La asimetría es real y hay que respetarla:** en images es un booleano expresado como
cadena; en los otros dos, un enumerado de cuatro valores. Los tres son de tipo `string`
en el spec. Cada `describe()` enumera los valores de **su** endpoint — para eso existen
las constantes `LIST_PARAMS` locales a cada fichero, y por eso no se comparten.

### 4.4 Tipos nuevos bajo auditoría

Al `MAP` de `scripts/audit-schema-drift.mjs`:

| Interfaz TS | Schema del spec |
|---|---|
| `ImageUpdateInfo` | `ImageUpdateInfo` |
| `ImageUpdateResponse` | `ImageupdateResponse` |
| `ImageUpdateSummary` | `ImageupdateSummary` |
| `ImageUsedBy` | `ImageUsedBy` |
| `ProjectUpdateInfo` | `ProjectUpdateInfo` |
| `UpdaterResult` | `UpdaterResult` |
| `UpdaterResourceResult` | `UpdaterResourceResult` |
| `UpdaterStatus` | `UpdaterStatus` |
| `AutoUpdateRecord` | `AutoUpdateRecord` |

La auditoría es quien verifica que están copiados campo a campo: esta fase no añade
tests unitarios para los tipos, igual que hizo la Task 3 de la fase anterior.

## 5. Verificación

### 5.1 Unitarios con `fetch` mockeado

Uno por método de cliente nuevo, asertando la **query string exacta** o el cuerpo
enviado. Más, específicamente:

- **La heurística de `updater_history`**, en sus tres ramas: `data.length === limit`
  (avisa), `data.length < limit` (no avisa), `data: null` (lista vacía, nunca el texto
  `"null"`).
- **Que `arcane_updater_run` rechaza una llamada sin `resourceIds`.** Es la garantía de
  §2.2 y tiene que tener un test que falle si alguien la relaja.
- **Que `arcane_image_update_check` resuelve tanto por referencia como por ID**, y que
  llama al endpoint que toca en cada caso.

### 5.2 e2e contra la instancia real

**La mutante se verifica con `dryRun: true`.** Es una llamada real que no aplica nada,
así que la regla dura se cumple sin sujeto de sacrificio.

> **Condición que el plan debe verificar antes de fiarse:** que `dryRun` de verdad no
> mute. Se comprueba capturando el estado del recurso —imagen en uso y momento de
> arranque del contenedor— antes y después de la llamada. Si resultara que sí actúa,
> `arcane_updater_run` se queda sin e2e posible y hay que replantear su inclusión, no
> seguir adelante dando la regla por cumplida.

**La heurística de truncamiento sí es verificable aquí.** Medido: `updater/history`
tiene 2 registros en esta instancia. Con `limit=1` se recibe 1 de 2 y la heurística debe
dispararse; con `limit=50`, no. Cubre las dos ramas contra datos reales.

**El e2e de `check` en vivo debe fallar si el registro contesta mal**, no tragárselo.
Distinguir «la tool funciona» de «el registro contestó» es justo lo que estos tests
existen para hacer. Se elige una imagen de un registro que no esté limitando; está
observado que `ghcr.io/getarcaneapp/arcane:latest` devuelve `toomanyrequests` de forma
intermitente, así que **no** se usa esa.

**Un invariante que cruza las dos mitades de la fase:** `arcane_image_update_summary`
declara `imagesWithUpdates`; `arcane_image_list` con `updates=true` debe devolver esa
misma cantidad. Es falsable, no clava cifras que envejezcan, y comprueba que lo nuevo y
lo enriquecido cuentan la misma historia — el tipo de aserción que en la fase anterior
detectó lo que los tests aislados no veían.

### 5.3 Regresiones que deben saltar

- **La auditoría de drift debe BAJAR de 23 desalineaciones** al declarar `usedBy` y
  `updateInfo`. Si no baja, los campos no se añadieron donde tocaba.
- `npm run gen-tools-table -- --check` fallará al añadir tools y parámetros. Se
  regenera y la cuenta debe pasar a **88**.
- `npm run type-check` limpio; e2e contados a mano con `--reporter=verbose`.

### 5.4 Despliegue

Rama, commits firmados, merge deliberado, push a `origin` y `github`. El despliegue es
automático (≤5 min) y se verifica **dentro del contenedor**, nunca por el estado del
sync.

Después se ejercita `arcane_image_update_summary` contra la instancia desplegada y se
comprueba que responde con los recuentos reales.

**Nota operativa:** el acceso al host va por Tailscale y tira entre un 10% y un 30% de
las conexiones, en cualquier puerto. Un fallo aislado de red no significa nada:
reintentar antes de diagnosticar.

## 6. Lo que esta fase NO arregla

- **El job `image-polling` seguirá en rojo.** Su causa raíz está
  [diagnosticada](../../auditorias/2026-08-17-image-update-check-arcane-local-upstream.md):
  Arcane no reconoce como locales las imágenes que ella misma etiqueta con el prefijo
  `arcane.local/`. Es un bug del upstream, no de este fork, y **no bloquea esta fase**:
  los datos de actualizaciones llegan igualmente.
- **`groupBy` en containers** sigue sin fase asignada. Añade una clave `groups` a la
  respuesta y necesita su propio tipo y formateo.
- **`arcane_updater_run` no permitirá actualizar todo el entorno de una llamada**, por
  diseño. Quien lo necesite lo hace desde la interfaz de Arcane.

## 7. Referencias

- [Criterio de exposición](../../arquitectura/criterio-exposicion.md)
- [Cómo añadir una tool](../../desarrollo/anadir-una-tool.md)
- [Balance de la coherencia de listado](../../balances/2026-08-17-coherencia-listado.md)
- [Diagnóstico del `image_update_check`](../../auditorias/2026-08-17-image-update-check-arcane-local-upstream.md)
