# Auditoría de drift de campos — interfaces TS vs Arcane v2.7.0

- **Fecha:** 2026-08-16
- **Generado por:** `node scripts/audit-schema-drift.mjs`
- **Spec:** `openapi.txt` (descargado de la instancia con `npm run update-api-spec`)

## Contexto

Los *paths* del fork ya estaban validados (37/37 contra v2.7.0). Lo que no lo estaba
son los *shapes*: el fallo que degradó a RandomSynergy17/Arcane-MCP-Server fue de
campos (`names`, contadores, `driver`), no de rutas. Esta auditoría los mide.

## Leyenda de estados

| Estado | Significado | Gravedad |
|---|---|---|
| `SOBRA-EN-TS` | El campo está en la interfaz pero no existe en el spec | Alta |
| `FALTA-EN-TS-REQUERIDO` | El spec lo marca obligatorio y la interfaz no lo declara | Alta |
| `OPCIONAL-PERO-REQUERIDO` | Declarado con `?` pese a ser obligatorio | Media |
| `OBLIGATORIO-PERO-OPCIONAL` | Declarado sin `?` pese a ser opcional | Media |
| `FALTA-EN-TS-OPCIONAL` | Campo nuevo opcional del spec no declarado | Baja |
| `INTERFAZ-AUSENTE` | El tipo se declara inline en vez de como interfaz auditable | Media |

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

Total: 66 desalineaciones.

## Reproducir

```bash
npm run update-api-spec          # refresca openapi.txt desde la instancia
node scripts/audit-schema-drift.mjs
```
