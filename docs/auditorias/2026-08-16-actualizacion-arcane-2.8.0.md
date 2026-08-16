# Actualización de Arcane 2.7.0 → 2.8.0: causa raíz del redeploy roto y su coste

- **Fecha:** 2026-08-16
- **Motivo:** cerrar la única deuda técnica que quedaba de F0/F1 — el redeploy de GitOps
- **Resultado:** despliegue automático restaurado; 2 tools migradas; 0 hallazgos graves

---

## 1. La causa raíz

El redeploy de GitOps fallaba siempre con:

```
failed to prepare project images for deploy: node:22-bookworm-slim:
failed to resolve source metadata for docker.io/library/node:22-bookworm-slim:
no active sessions
```

**No era un problema de red ni de configuración del host.** Es un bug del módulo de
terceros `go.getarcane.app/builds` **v0.3.0**, que es quien construye las imágenes en
Arcane: la sesión de BuildKit se cierra **antes de tiempo**, después de transferir el
contexto y antes de resolver los metadatos de la imagen base. Cualquier imagen base que
haya que resolver contra el registro falla.

Cómo se estableció, en orden:

1. El stack trace de los logs de `arcane` apunta a `project_service.go:2126`, que en la
   revisión desplegada (`a4a84fe`) es la llamada a `prepareProjectImagesForDeploy`.
2. Ese código delega en un módulo externo; `resolve source metadata` y `no active
   sessions` son mensajes del frontend y del gestor de sesiones de BuildKit, que se
   emiten **antes** de cualquier acceso a la red.
3. El upstream tenía el fallo reportado por otro usuario en
   [issue #3606](https://github.com/getarcaneapp/arcane/issues/3606), cerrado el
   2026-08-12: *"This should be fixed with the go.getarcane.app/builds module v0.3.1"*.
4. Contrastado en los `go.mod`: la revisión desplegada pinea `builds v0.3.0`; el tag
   `v2.8.0` pinea `v0.3.1` (commit `6d2ec79b`). Nuestra imagen era del **7 de agosto**,
   seis días anterior al arreglo.

### La reproducción, y lo que corrige de la hipótesis heredada

El stream del redeploy capturado antes de actualizar muestra el mecanismo exacto:

```
{"log":"#1 [internal] load remote build context"}
{"log":"#1 DONE 0.0s"}
{"log":"#2 copy /context /"}
{"log":"#2 DONE 0.0s"}
{"log":"#3 [internal] load metadata for docker.io/library/node:22-bookworm-slim"}
{"log":"#3 ERROR: no active sessions"}
```

La documentación de F0/F1 daba por hipótesis que *"el build que lanza Arcane no dispone
de sesión de BuildKit"*. **Es falso:** sí dispone. El paso `#2 copy /context /`, que usa
la sesión, se completa. La sesión existe y **muere a media construcción**.

De ahí se sigue que la vía que se daba por más probable —tener la imagen base entre las
locales— habría funcionado por el motivo equivocado: una imagen local no necesita sesión,
así que enmascara el bug sin arreglarlo. Además no se sostiene sola: **tras el build
exitoso, `node:22-bookworm-slim` sigue sin aparecer en `docker images`**, porque BuildKit
la resuelve contra su propia caché y no contra el almacén de imágenes.

## 2. Lo verificado

| Comprobación | Antes (v2.7.0) | Después (v2.8.0) |
|---|---|---|
| `POST /projects/{id}/redeploy` con la imagen base ausente en local | `no active sessions` | 12 pasos de build, contenedor recreado y `Healthy`, `{"done":true}` |
| Errores en el stream | 1 | **0** |
| Migración de BD | — | esquema 70 → 72, sin incidencias |

La condición de la prueba es imprescindible: **`node:22-bookworm-slim` debe estar ausente
del host**. Si estuviera en local, BuildKit no necesitaría sesión y la prueba no
demostraría nada. Se comprobó ausente antes y después.

## 3. El coste: 9 operaciones eliminadas en 2.8.0

El spec no está versionado en el repo del upstream (lo genera un CLI), así que este coste
**no era medible antes de actualizar**. Medido después, comparando los conjuntos de
operaciones de ambos specs:

- 2.7.0: 340 operaciones · 2.8.0: 347 · **9 eliminadas**, 16 añadidas.
- De las 9 eliminadas, **2 estaban en uso** por nuestro cliente:
  `GET /volumes/{name}/browse` y `POST /volumes/{name}/browse/upload`.
  Verificado en vivo contra la instancia: devuelven **404**.

La familia `/browse` se sustituye por `/workspace` (upstream #3497). Consecuencia: la
actualización **rompió dos tools que antes funcionaban**, y arreglarlas formaba parte
del trabajo, no era opcional.

### La migración

| Antes | Ahora |
|---|---|
| `GET /volumes/{n}/browse?path=` | `GET /volumes/{n}/workspace` |
| `POST /volumes/{n}/browse/upload` | `PUT /volumes/{n}/workspace` (multipart) |
| `VolumeFileNode` (`type: 'file' \| 'directory'`) | `WorkspaceFileEntry` (`isDirectory: boolean`) |

Dos cambios que conviene conocer:

- **`arcane_volume_browse` pierde el parámetro `path`.** La API workspace no lo acepta:
  devuelve el árbol completo y cada entrada trae su `relativePath`. No se ha emulado el
  filtrado en cliente porque la semántica no sería la misma (listar los hijos directos de
  un directorio ≠ filtrar un subárbol por prefijo).
- **`arcane_volume_upload_file` conserva su contrato** (`filename` + `path`), que se
  compone internamente en el `relativePath` único que espera la API.

El `PUT /workspace` es `multipart/form-data` con un campo `manifest` que el spec describe
solo como *"JSON encoded volume workspace manifest"*, **sin schema**. La forma se obtuvo
del tipo `WorkspaceUpdateManifest` del upstream:

```json
{
  "fileTreeRevision": "<el del workspace leído justo antes>",
  "fileChanges": [{ "operation": "create_file", "relativePath": "notas/hola.txt", "uploadIndex": 0 }]
}
```

`fileTreeRevision` es un testigo de concurrencia optimista, así que `uploadFile()` lee el
workspace antes de escribir. `uploadIndex` referencia la posición del binario dentro del
campo `files` del multipart. El `Content-Type` **no** se fija a mano: lo pone el runtime
para incluir el boundary.

## 4. Drift de campos

`Project` acumuló los tres únicos hallazgos graves de la actualización, todos rastreables
a las notas de la release:

| Campo | Estado | Origen |
|---|---|---|
| `fileTreeRevision` | SOBRA-EN-TS | se movió al schema `Workspace` |
| `fileTreeTruncated` | SOBRA-EN-TS | íd. |
| `tags` | FALTA-EN-TS-REQUERIDO | nueva función de etiquetado (#3601) |

Corregidos. La auditoría queda de nuevo en **0 hallazgos graves** y 20
`FALTA-EN-TS-OPCIONAL`, todos de dominios diferidos a propósito (eran 22: los otros dos
eran `fileTreeRevision`/`fileTreeTruncated`, que ya no existen en `ProjectDetails`).

`VolumeWorkspace` y `WorkspaceFileEntry` se añadieron al `MAP` de
`scripts/audit-schema-drift.mjs` y **no producen ninguna desalineación**.

## 5. Estado final

- Suite: **111 tests** en 3 ficheros (antes 105). E2E: **6** (antes 3).
- `openapi.txt` en **2.8.0** — 273 paths, 638 schemas.
- 68 tools, tabla del README regenerada del código.
- Auditoría de drift: **0 graves**.

## 6. Pendiente

**La imagen de Arcane sigue sin pinear.** El compose usa
`ghcr.io/getarcaneapp/arcane:latest`, así que la próxima versión entrará sola, sin
decisión, y puede volver a eliminar operaciones en uso — que es exactamente lo que acaba
de pasar. Pinear exige tocar el repo que GitOps sincroniza en `/opt/stacks/arcane`,
**no** el fichero del host: ahí lo revertiría el siguiente sync.

## Reproducir

```bash
npm run update-api-spec
node scripts/audit-schema-drift.mjs
set -a; . ./.dev.vars; set +a
ARCANE_BASE_URL=http://192.168.180.210:3552 npm run test:e2e
```

## Referencias

- [Balance de F0 y F1](../balances/2026-08-16-f0-f1.md)
- [Cómo añadir una tool](../desarrollo/anadir-una-tool.md)
- [Issue #3606 del upstream](https://github.com/getarcaneapp/arcane/issues/3606)
- [Release v2.8.0](https://github.com/getarcaneapp/arcane/releases/tag/v2.8.0)
