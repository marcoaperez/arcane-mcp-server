# Auditoría de drift de campos — interfaces TS vs Arcane v2.7.0

- **Fecha:** 2026-08-16
- **Generado por:** `node scripts/audit-schema-drift.mjs`
- **Spec:** `openapi.txt` (descargado de la instancia con `npm run update-api-spec`)

## Contexto

Los *paths* del fork ya estaban validados (37/37 contra v2.7.0). Lo que no lo estaba
son los *shapes*: el fallo que degradó a RandomSynergy17/Arcane-MCP-Server fue de
campos (`names`, contadores, `driver`), no de rutas. Esta auditoría los mide.

La auditoría cubre **14 interfaces de payload**: `Environment`, `Project`,
`ContainerSummary`, `ImageSummary`, `Volume`, `NetworkSummary`, `NetworkInspect`,
`Pagination`, `VersionInfo`, `ContainerDetails`, `GitRepository`, `GitOpsSync`,
`Template` y `VolumeBackup`. Son los tipos que representan **respuestas** de la API
(lo que Arcane nos devuelve). Quedan fuera deliberadamente los `*Create`/`*Update`
(p. ej. `ContainerCreateOptions`, `ProjectUpdate`): esos son cuerpos de petición que
construimos nosotros, no payloads que la API nos entregue, así que no tiene sentido
compararlos contra un schema de respuesta.

## Leyenda de estados

| Estado | Significado | Gravedad |
|---|---|---|
| `SOBRA-EN-TS` | El campo está en la interfaz pero no existe en el spec | Alta |
| `FALTA-EN-TS-REQUERIDO` | El spec lo marca obligatorio y la interfaz no lo declara | Alta |
| `OPCIONAL-PERO-REQUERIDO` | Declarado con `?` pese a ser obligatorio | Media |
| `OBLIGATORIO-PERO-OPCIONAL` | Declarado sin `?` pese a ser opcional | Media |
| `FALTA-EN-TS-OPCIONAL` | Campo nuevo opcional del spec no declarado | Baja |
| `INTERFAZ-AUSENTE` | El tipo se declara inline en vez de como interfaz auditable | Media |
| `SCHEMA-AUSENTE` | El schema declarado en el `MAP` no existe en el spec | Media |

## Resultado

Spec: Arcane API 2.7.0 (268 paths)

| Interfaz TS | Schema spec | Campo | Estado |
|---|---|---|---|
| `Environment` | `EnvironmentEnvironment` | `name` | OBLIGATORIO-PERO-OPCIONAL |
| `Environment` | `EnvironmentEnvironment` | `connected` | FALTA-EN-TS-OPCIONAL |
| `Environment` | `EnvironmentEnvironment` | `connectedAt` | FALTA-EN-TS-OPCIONAL |
| `Environment` | `EnvironmentEnvironment` | `edgeAgentInstance` | FALTA-EN-TS-OPCIONAL |
| `Environment` | `EnvironmentEnvironment` | `edgeCapabilities` | FALTA-EN-TS-OPCIONAL |
| `Environment` | `EnvironmentEnvironment` | `edgeMTLSCertificate` | FALTA-EN-TS-OPCIONAL |
| `Environment` | `EnvironmentEnvironment` | `edgeSecurityMode` | FALTA-EN-TS-OPCIONAL |
| `Environment` | `EnvironmentEnvironment` | `edgeSessionId` | FALTA-EN-TS-OPCIONAL |
| `Environment` | `EnvironmentEnvironment` | `edgeTransport` | FALTA-EN-TS-OPCIONAL |
| `Environment` | `EnvironmentEnvironment` | `lastEdgeTransport` | FALTA-EN-TS-OPCIONAL |
| `Environment` | `EnvironmentEnvironment` | `lastHeartbeat` | FALTA-EN-TS-OPCIONAL |
| `Environment` | `EnvironmentEnvironment` | `lastPollAt` | FALTA-EN-TS-OPCIONAL |
| `Environment` | `EnvironmentEnvironment` | `lastSeen` | FALTA-EN-TS-OPCIONAL |
| `Project` | `ProjectDetails` | `iconUrl` | SOBRA-EN-TS |
| `Project` | `ProjectDetails` | `activityId` | FALTA-EN-TS-OPCIONAL |
| `Project` | `ProjectDetails` | `archivedAt` | FALTA-EN-TS-OPCIONAL |
| `Project` | `ProjectDetails` | `composeFileName` | FALTA-EN-TS-OPCIONAL |
| `Project` | `ProjectDetails` | `directoryFiles` | FALTA-EN-TS-OPCIONAL |
| `Project` | `ProjectDetails` | `fileTreeRevision` | FALTA-EN-TS-OPCIONAL |
| `Project` | `ProjectDetails` | `fileTreeTruncated` | FALTA-EN-TS-OPCIONAL |
| `Project` | `ProjectDetails` | `hasBuildDirective` | FALTA-EN-TS-OPCIONAL |
| `Project` | `ProjectDetails` | `iconDarkUrl` | FALTA-EN-TS-OPCIONAL |
| `Project` | `ProjectDetails` | `iconLightUrl` | FALTA-EN-TS-OPCIONAL |
| `Project` | `ProjectDetails` | `includeFiles` | FALTA-EN-TS-OPCIONAL |
| `Project` | `ProjectDetails` | `isArchived` | FALTA-EN-TS-REQUERIDO |
| `Project` | `ProjectDetails` | `isDiscovered` | FALTA-EN-TS-OPCIONAL |
| `Project` | `ProjectDetails` | `overrideContent` | FALTA-EN-TS-OPCIONAL |
| `Project` | `ProjectDetails` | `overrideFileName` | FALTA-EN-TS-OPCIONAL |
| `Project` | `ProjectDetails` | `projectFiles` | FALTA-EN-TS-OPCIONAL |
| `Project` | `ProjectDetails` | `redeployDisabled` | FALTA-EN-TS-OPCIONAL |
| `Project` | `ProjectDetails` | `relativePath` | FALTA-EN-TS-OPCIONAL |
| `Project` | `ProjectDetails` | `runtimeServices` | FALTA-EN-TS-OPCIONAL |
| `Project` | `ProjectDetails` | `services` | FALTA-EN-TS-OPCIONAL |
| `Project` | `ProjectDetails` | `updateInfo` | FALTA-EN-TS-OPCIONAL |
| `ContainerSummary` | `ContainerSummary` | `iconDarkUrl` | FALTA-EN-TS-OPCIONAL |
| `ContainerSummary` | `ContainerSummary` | `iconLightUrl` | FALTA-EN-TS-OPCIONAL |
| `ContainerSummary` | `ContainerSummary` | `redeployDisabled` | FALTA-EN-TS-OPCIONAL |
| `ImageSummary` | `ImageSummary` | `usedBy` | FALTA-EN-TS-OPCIONAL |
| `ImageSummary` | `ImageSummary` | `vulnerabilityScan` | FALTA-EN-TS-OPCIONAL |
| `Volume` | `VolumeVolume` | `createdAt` | OPCIONAL-PERO-REQUERIDO |
| `Volume` | `VolumeVolume` | `size` | OPCIONAL-PERO-REQUERIDO |
| `Volume` | `VolumeVolume` | `activityId` | FALTA-EN-TS-OPCIONAL |
| `Volume` | `VolumeVolume` | `containers` | FALTA-EN-TS-REQUERIDO |
| `Volume` | `VolumeVolume` | `id` | FALTA-EN-TS-REQUERIDO |
| `Volume` | `VolumeVolume` | `inUse` | FALTA-EN-TS-REQUERIDO |
| `Volume` | `VolumeVolume` | `labels` | FALTA-EN-TS-REQUERIDO |
| `Volume` | `VolumeVolume` | `options` | FALTA-EN-TS-REQUERIDO |
| `Volume` | `VolumeVolume` | `scope` | FALTA-EN-TS-REQUERIDO |
| `NetworkSummary` | `NetworkSummary` | `created` | OPCIONAL-PERO-REQUERIDO |
| `NetworkSummary` | `NetworkSummary` | `internal` | SOBRA-EN-TS |
| `NetworkSummary` | `NetworkSummary` | `attachable` | SOBRA-EN-TS |
| `NetworkSummary` | `NetworkSummary` | `ingress` | SOBRA-EN-TS |
| `NetworkSummary` | `NetworkSummary` | `ipam` | SOBRA-EN-TS |
| `NetworkSummary` | `NetworkSummary` | `inUse` | FALTA-EN-TS-REQUERIDO |
| `NetworkSummary` | `NetworkSummary` | `isDefault` | FALTA-EN-TS-REQUERIDO |
| `NetworkSummary` | `NetworkSummary` | `labels` | FALTA-EN-TS-REQUERIDO |
| `NetworkSummary` | `NetworkSummary` | `options` | FALTA-EN-TS-REQUERIDO |
| `NetworkInspect` | `NetworkInspect` | `created` | OPCIONAL-PERO-REQUERIDO |
| `NetworkInspect` | `NetworkInspect` | `configFrom` | FALTA-EN-TS-REQUERIDO |
| `NetworkInspect` | `NetworkInspect` | `configOnly` | FALTA-EN-TS-REQUERIDO |
| `NetworkInspect` | `NetworkInspect` | `containersList` | FALTA-EN-TS-REQUERIDO |
| `NetworkInspect` | `NetworkInspect` | `enableIPv4` | FALTA-EN-TS-REQUERIDO |
| `NetworkInspect` | `NetworkInspect` | `enableIPv6` | FALTA-EN-TS-REQUERIDO |
| `NetworkInspect` | `NetworkInspect` | `peers` | FALTA-EN-TS-OPCIONAL |
| `NetworkInspect` | `NetworkInspect` | `services` | FALTA-EN-TS-OPCIONAL |
| `VersionInfo` | `VersionInfo` | `*` | INTERFAZ-AUSENTE |
| `ContainerDetails` | `ContainerDetails` | `labels` | OBLIGATORIO-PERO-OPCIONAL |
| `ContainerDetails` | `ContainerDetails` | `activityId` | FALTA-EN-TS-OPCIONAL |
| `ContainerDetails` | `ContainerDetails` | `composeInfo` | FALTA-EN-TS-OPCIONAL |
| `ContainerDetails` | `ContainerDetails` | `iconDarkUrl` | FALTA-EN-TS-OPCIONAL |
| `ContainerDetails` | `ContainerDetails` | `iconLightUrl` | FALTA-EN-TS-OPCIONAL |
| `ContainerDetails` | `ContainerDetails` | `redeployDisabled` | FALTA-EN-TS-OPCIONAL |
| `GitRepository` | `GitopsGitRepository` | `createdAt` | OPCIONAL-PERO-REQUERIDO |
| `GitRepository` | `GitopsGitRepository` | `updatedAt` | OPCIONAL-PERO-REQUERIDO |
| `GitRepository` | `GitopsGitRepository` | `sshHostKeyVerification` | FALTA-EN-TS-OPCIONAL |
| `GitOpsSync` | `GitopsGitOpsSync` | `projectName` | OPCIONAL-PERO-REQUERIDO |
| `GitOpsSync` | `GitopsGitOpsSync` | `syncInterval` | OPCIONAL-PERO-REQUERIDO |
| `GitOpsSync` | `GitopsGitOpsSync` | `status` | SOBRA-EN-TS |
| `GitOpsSync` | `GitopsGitOpsSync` | `createdAt` | OPCIONAL-PERO-REQUERIDO |
| `GitOpsSync` | `GitopsGitOpsSync` | `updatedAt` | OPCIONAL-PERO-REQUERIDO |
| `GitOpsSync` | `GitopsGitOpsSync` | `environmentId` | FALTA-EN-TS-REQUERIDO |
| `GitOpsSync` | `GitopsGitOpsSync` | `lastSyncCommit` | FALTA-EN-TS-OPCIONAL |
| `GitOpsSync` | `GitopsGitOpsSync` | `lastSyncError` | FALTA-EN-TS-OPCIONAL |
| `GitOpsSync` | `GitopsGitOpsSync` | `lastSyncStatus` | FALTA-EN-TS-OPCIONAL |
| `GitOpsSync` | `GitopsGitOpsSync` | `maxSyncBinarySize` | FALTA-EN-TS-REQUERIDO |
| `GitOpsSync` | `GitopsGitOpsSync` | `maxSyncFiles` | FALTA-EN-TS-REQUERIDO |
| `GitOpsSync` | `GitopsGitOpsSync` | `maxSyncTotalSize` | FALTA-EN-TS-REQUERIDO |
| `GitOpsSync` | `GitopsGitOpsSync` | `preDeployEnv` | FALTA-EN-TS-OPCIONAL |
| `GitOpsSync` | `GitopsGitOpsSync` | `preDeployExtraMounts` | FALTA-EN-TS-OPCIONAL |
| `GitOpsSync` | `GitopsGitOpsSync` | `preDeployLastRunAt` | FALTA-EN-TS-OPCIONAL |
| `GitOpsSync` | `GitopsGitOpsSync` | `preDeployLastRunOutput` | FALTA-EN-TS-OPCIONAL |
| `GitOpsSync` | `GitopsGitOpsSync` | `preDeployLastRunStatus` | FALTA-EN-TS-OPCIONAL |
| `GitOpsSync` | `GitopsGitOpsSync` | `preDeployNetworkMode` | FALTA-EN-TS-REQUERIDO |
| `GitOpsSync` | `GitopsGitOpsSync` | `preDeployRunnerImage` | FALTA-EN-TS-OPCIONAL |
| `GitOpsSync` | `GitopsGitOpsSync` | `preDeployScriptPath` | FALTA-EN-TS-OPCIONAL |
| `GitOpsSync` | `GitopsGitOpsSync` | `preDeployTimeoutSec` | FALTA-EN-TS-REQUERIDO |
| `GitOpsSync` | `GitopsGitOpsSync` | `projectId` | FALTA-EN-TS-OPCIONAL |
| `GitOpsSync` | `GitopsGitOpsSync` | `repository` | FALTA-EN-TS-OPCIONAL |
| `GitOpsSync` | `GitopsGitOpsSync` | `syncDirectory` | FALTA-EN-TS-REQUERIDO |
| `GitOpsSync` | `GitopsGitOpsSync` | `syncedFiles` | FALTA-EN-TS-OPCIONAL |
| `GitOpsSync` | `GitopsGitOpsSync` | `targetType` | FALTA-EN-TS-REQUERIDO |
| `Template` | `TemplateTemplate` | `description` | OPCIONAL-PERO-REQUERIDO |
| `Template` | `TemplateTemplate` | `composeContent` | SOBRA-EN-TS |
| `Template` | `TemplateTemplate` | `category` | SOBRA-EN-TS |
| `Template` | `TemplateTemplate` | `tags` | SOBRA-EN-TS |
| `Template` | `TemplateTemplate` | `iconUrl` | SOBRA-EN-TS |
| `Template` | `TemplateTemplate` | `createdAt` | SOBRA-EN-TS |
| `Template` | `TemplateTemplate` | `updatedAt` | SOBRA-EN-TS |
| `Template` | `TemplateTemplate` | `content` | FALTA-EN-TS-REQUERIDO |
| `Template` | `TemplateTemplate` | `isCustom` | FALTA-EN-TS-REQUERIDO |
| `Template` | `TemplateTemplate` | `isRemote` | FALTA-EN-TS-REQUERIDO |
| `Template` | `TemplateTemplate` | `metadata` | FALTA-EN-TS-OPCIONAL |
| `Template` | `TemplateTemplate` | `registry` | FALTA-EN-TS-OPCIONAL |
| `Template` | `TemplateTemplate` | `registryId` | FALTA-EN-TS-OPCIONAL |
| `VolumeBackup` | `VolumeBackup` | `filename` | SOBRA-EN-TS |
| `VolumeBackup` | `VolumeBackup` | `size` | OPCIONAL-PERO-REQUERIDO |
| `VolumeBackup` | `VolumeBackup` | `activityId` | FALTA-EN-TS-OPCIONAL |
| `VolumeBackup` | `VolumeBackup` | `updatedAt` | FALTA-EN-TS-OPCIONAL |

Total: 118 desalineaciones.

Nota: el bug más notable de esta ampliación es `Template`. La interfaz TS declara
`composeContent`, `category`, `tags`, `iconUrl`, `createdAt` y `updatedAt`, y
**ninguno de esos campos existe** en `TemplateTemplate`; además le faltan `content`
(el campo real y obligatorio del schema), `isCustom` e `isRemote`. Cualquier código
que lea `Template.content` está leyendo `undefined`.

## Reproducir

```bash
npm run update-api-spec          # refresca openapi.txt desde la instancia
node scripts/audit-schema-drift.mjs
```

## Resolución (2026-08-16)

Corregidos en `src/arcane-client.ts` todos los hallazgos de gravedad alta y media:

- `NetworkSummary`: eliminados `internal`, `attachable`, `ingress` e `ipam` (no existen
  en v2.7.0; siguen existiendo en `NetworkInspect`). Añadidos `inUse`, `isDefault`,
  `labels` y `options`. `created` pasa a obligatorio.
- `Volume`: añadidos `id`, `inUse`, `scope`, `containers`, `labels` y `options`;
  `createdAt` y `size` pasan a obligatorios.
- `NetworkInspect`: añadidos los campos obligatorios de v2.7.0 (`configOnly`,
  `configFrom`, `enableIPv4`, `enableIPv6`, `containersList`) y `created` pasa a
  obligatorio.
- `Environment`: `name` pasa a opcional; añadidos los campos opcionales de edge/estado
  de conexión (`connected`, `connectedAt`, `edge*`, `lastHeartbeat`, `lastPollAt`,
  `lastSeen`).
- `Project`: eliminado `iconUrl` (no existe); añadido `isArchived: boolean`
  (obligatorio); añadidos los opcionales no diferidos (`activityId`, `archivedAt`,
  `composeFileName`, `fileTreeRevision`, `fileTreeTruncated`, `hasBuildDirective`,
  `iconDarkUrl`, `iconLightUrl`, `isDiscovered`, `overrideContent`,
  `overrideFileName`, `redeployDisabled`, `relativePath`).
- `ContainerSummary`: añadidos `iconDarkUrl`, `iconLightUrl`, `redeployDisabled`.
- `ImageSummary`: sin cambios — sus dos únicos hallazgos (`usedBy`,
  `vulnerabilityScan`) son diferidos a F3/F4.
- `VersionInfo`: extraída como interfaz exportada (antes era un tipo inline no
  auditable, de ahí el estado `INTERFAZ-AUSENTE`). **Discrepancia con el brief**: el
  código propuesto en la Tarea 6 no incluía `nodeVersion` ni `svelteKitVersion`, pero
  `openapi.txt` los marca `required` en `VersionInfo`. Se han añadido ambos siguiendo
  la regla "el spec manda" — sin ellos la auditoría no bajaba de 2 hallazgos graves
  (`FALTA-EN-TS-REQUERIDO`). Ver la nota en el propio código de la interfaz.
- `Template`, `TemplateCreate`, `TemplateUpdate`: reescritas contra `TemplateTemplate` /
  `TemplateCreateRequest` / `TemplateUpdateRequest`. Eliminados `composeContent`,
  `category`, `tags`, `iconUrl`, `createdAt` y `updatedAt` (no existen en v2.7.0);
  el compose vive en `content`. **Único cambio de comportamiento de la tarea**:
  `arcane_template_create` y `arcane_template_update` no podían funcionar contra
  v2.7.0 — enviaban `composeContent` (el spec exige `content`), trataban
  `description`/`envContent` como opcionales (el spec los exige obligatorios) y
  enviaban `category`/`tags`, que no existen en la API. Se corrigieron los parámetros
  zod de ambas tools en `src/tools/templates.ts` para reflejar exactamente
  `TemplateCreateRequest`/`TemplateUpdateRequest`.
- `ContainerDetails`: `labels` pasa a opcional; añadidos `activityId`, `composeInfo`,
  `iconDarkUrl`, `iconLightUrl`, `redeployDisabled`.
- `GitRepository`: `createdAt`/`updatedAt` pasan a obligatorios; añadido
  `sshHostKeyVerification`.
- `GitOpsSync`: reescrita completa contra `GitopsGitOpsSync`. Eliminado `status` (el
  estado real vive en `lastSyncStatus`). Añadidos los campos obligatorios que
  faltaban (`environmentId`, `projectName`, `targetType`, `syncDirectory`,
  `maxSyncFiles`, `maxSyncBinarySize`, `maxSyncTotalSize`, `preDeployNetworkMode`,
  `preDeployTimeoutSec`, `createdAt`, `updatedAt`) y los opcionales no diferidos
  (`lastSyncCommit`, `lastSyncError`, `lastSyncStatus`, `projectId`, `repository`,
  `syncedFiles`).
- `VolumeBackup`: eliminado `filename` (no existe); `size` pasa a obligatorio;
  añadidos `activityId`, `updatedAt`.

Ningún handler de `src/tools/gitops-syncs.ts`, `src/tools/volume-backups.ts`,
`src/tools/networks.ts` ni `src/tools/volumes.ts` leía por nombre los campos
eliminados (`status`, `filename`, `internal`, `attachable`, `ingress`, `ipam`) — todos
reenvían el objeto `data`/`dto` sin desestructurar campos concretos, así que el
type-check no encontró más roturas que las de `src/tools/templates.ts`. El único
fichero de `src/tools/` que tuvo que tocarse fue `templates.ts`.

La auditoría queda con **0 hallazgos graves**
(`SOBRA-EN-TS` / `FALTA-EN-TS-REQUERIDO` / `OPCIONAL-PERO-REQUERIDO` /
`OBLIGATORIO-PERO-OPCIONAL` / `INTERFAZ-AUSENTE`). Quedan 22 hallazgos
`FALTA-EN-TS-OPCIONAL`, todos de dominios diferidos.

### Diferido a F2–F5 (intencionadamente)

Campos opcionales que pertenecen a dominios aún no implementados y que no se declaran
porque ninguna tool los consume todavía:

| Campo | Fase que lo necesita |
|---|---|
| `Project.updateInfo` | F3 — actualizaciones de imágenes |
| `ImageSummary.updateInfo` (no aplica, no declarado) | — |
| `ImageSummary.vulnerabilityScan` | F4 — vulnerability scanning |
| `ImageSummary.usedBy` | F3 |
| `Project.projectFiles`, `includeFiles`, `directoryFiles` | F5 — build |
| `Project.runtimeServices`, `services` | F2 — system |
| `GitOpsSync.preDeployEnv`, `preDeployExtraMounts`, `preDeployLastRun*`, `preDeployRunnerImage`, `preDeployScriptPath` | dominio pre-deploy de GitOps, sin tool que lo consuma |
| `VersionInfo.$schema`, `currentDigest`, `currentTag`, `enabledFeatures`, `newestDigest`, `releaseNotes`, `releasedAt` | metadatos de auto-actualización/schema, sin tool que los consuma |

Al abordar cada fase, volver a ejecutar `node scripts/audit-schema-drift.mjs` y
declarar los campos correspondientes.
